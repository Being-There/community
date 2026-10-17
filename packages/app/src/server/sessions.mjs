// Server-owned session boundary. Provider verification and transactional storage
// are required injected adapters; no development identity fallback or login route.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
export const SESSION_COOKIE = '__Host-being-there-session';
export const CSRF_COOKIE = '__Host-being-there-csrf';
export class AccessError extends Error {
  constructor(status) { super('Access denied'); this.status = status; }
}
const hash = value => createHash('sha256').update(value).digest('hex');
const time = value => Number.isSafeInteger(value) && value >= 0;
function cookie(request, name) {
  const header = request?.headers?.get('cookie') ?? '';
  if (header.length > 8192) throw new AccessError(401);
  const values = header.split(';').map(part => part.trim()).filter(part => part.startsWith(name + '='));
  if (values.length !== 1) throw new AccessError(401);
  const value = values[0].slice(name.length + 1);
  if (!tokenPattern.test(value)) throw new AccessError(401);
  return value;
}
const secretEqual = (a, b) => typeof a === 'string' && typeof b === 'string' &&
  /^[a-f0-9]{64}$/.test(a) && /^[a-f0-9]{64}$/.test(b) && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

export function createSessionService({ repository, verifyIdentity, now = Date.now,
  absoluteMs = 7 * 24 * 60 * 60 * 1000, idleMs = 24 * 60 * 60 * 1000 }) {
  for (const method of ['findAccountByIdentity', 'getAccount', 'getSession', 'replaceSession', 'touchSession', 'deleteSession'])
    if (typeof repository?.[method] !== 'function') throw new TypeError('Session repository required');
  if (typeof verifyIdentity !== 'function' || typeof now !== 'function' ||
      !Number.isSafeInteger(absoluteMs) || absoluteMs < 1000 || absoluteMs > 31 * 24 * 60 * 60 * 1000 ||
      !Number.isSafeInteger(idleMs) || idleMs < 1000 || idleMs > absoluteMs)
    throw new TypeError('Verified identity adapter and bounded session lifetimes required');
  const principals = new WeakSet();
  function requirePrincipal(principal) { if (!principal || !principals.has(principal)) throw new AccessError(401); }
  function clock() { const value = now(); if (!time(value)) throw new Error('Invalid server clock'); return value; }
  const attributes = maxAge => '; Path=/; Secure; SameSite=Lax; Max-Age=' + maxAge;
  async function signIn(proof, previousRequest) {
    // This adapter must verify OAuth state/nonce/PKCE/issuer/audience/recipient.
    // Raw request claims, profile IDs or emails must never be returned as verified identities.
    const identity = await verifyIdentity(proof);
    const at = clock();
    if (!identity || typeof identity.issuer !== 'string' || !identity.issuer || identity.issuer.length > 2048 ||
        typeof identity.subject !== 'string' || !identity.subject || identity.subject.length > 255 ||
        !time(identity.authenticatedAt) || identity.authenticatedAt > at || at - identity.authenticatedAt > 300000)
      throw new AccessError(401);
    const account = await repository.findAccountByIdentity(identity.issuer, identity.subject);
    if (!validId(account?.id) || account.state !== 'active' || account.issuer !== identity.issuer || account.subject !== identity.subject)
      throw new AccessError(401);
    let oldHash = null;
    if (previousRequest) {
      try { oldHash = hash(cookie(previousRequest, SESSION_COOKIE)); }
      catch (error) { if (!(error instanceof AccessError)) throw error; }
    }
    if (!time(at + absoluteMs)) throw new Error('Invalid session expiry');
    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    // Must atomically remove oldHash and create newHash. Never upsert old sessions.
    await repository.replaceSession({ oldHash, newHash: hash(token), record: {
      accountId: account.id, idleMs, identityHash: hash(JSON.stringify([identity.issuer, identity.subject])), createdAt: at, lastSeenAt: at, expiresAt: at + absoluteMs,
      authenticatedAt: identity.authenticatedAt, csrfHash: hash(csrfToken)
    } });
    const age = Math.floor(absoluteMs / 1000);
    return Object.freeze({
      sessionCookie: SESSION_COOKIE + '=' + token + attributes(age) + '; HttpOnly',
      csrfCookie: CSRF_COOKIE + '=' + csrfToken + attributes(age), csrfToken
    });
  }
  async function authenticate(request) {
    const sessionHash = hash(cookie(request, SESSION_COOKIE));
    const session = await repository.getSession(sessionHash);
    const at = clock();
    if (!session || !validId(session.accountId) || ![session.createdAt, session.lastSeenAt, session.expiresAt, session.authenticatedAt].every(time) ||
        !/^[a-f0-9]{64}$/.test(session.csrfHash ?? '') || session.createdAt > at || session.lastSeenAt > at ||
        session.authenticatedAt > session.createdAt || session.lastSeenAt < session.createdAt ||
        session.expiresAt > session.createdAt + absoluteMs || at >= session.expiresAt || at - session.lastSeenAt >= idleMs)
      throw new AccessError(401);
    const account = await repository.getAccount(session.accountId);
    if (account?.id !== session.accountId || account.state !== 'active' ||
        typeof account.issuer !== 'string' || typeof account.subject !== 'string' ||
        !secretEqual(hash(JSON.stringify([account.issuer, account.subject])), session.identityHash)) throw new AccessError(401);
    // touchSession updates an existing row only; it must not revive deleted sessions.
    if (!await repository.touchSession(sessionHash, at)) throw new AccessError(401);
    const principal = Object.freeze({ accountId: account.id, sessionHash, csrfHash: session.csrfHash, authenticatedAt: session.authenticatedAt });
    principals.add(principal);
    return principal;
  }
  function requireMutation(request, principal, appOrigin) {
    requirePrincipal(principal);
    if (request.headers.get('origin') !== appOrigin) throw new AccessError(403);
    const fetchSite = request.headers.get('sec-fetch-site');
    if (fetchSite && fetchSite !== 'same-origin') throw new AccessError(403);
    const supplied = request.headers.get('x-csrf-token');
    let browserToken;
    try { browserToken = cookie(request, CSRF_COOKIE); } catch { throw new AccessError(403); }
    if (!supplied || !tokenPattern.test(supplied) || supplied !== browserToken || !secretEqual(hash(supplied), principal.csrfHash))
      throw new AccessError(403);
  }
  function requireRecentAuthentication(principal) {
    requirePrincipal(principal);
    const at = clock();
    if (!time(principal?.authenticatedAt) || principal.authenticatedAt > at || at - principal.authenticatedAt > 300000)
      throw new AccessError(403);
  }
  async function logout(principal) { requirePrincipal(principal); await repository.deleteSession(principal.sessionHash); }
  const clearCookies = () => [SESSION_COOKIE + '=' + attributes(0) + '; HttpOnly', CSRF_COOKIE + '=' + attributes(0)];
  return Object.freeze({ signIn, authenticate, requireMutation, requireRecentAuthentication, logout, clearCookies });
}
