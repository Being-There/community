// Independent advanced-host reference adapter; SQLite transactions preserve
// metadata + exact original bytes together. No production family migration.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, lstatSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { AccessError } from './sessions.mjs';
import { validateMembership, canReadMemory, requireOrganizer } from './family-policy.mjs';
import { validateArchiveContent } from '../core/family-archive.mjs';
import { createIndependentArchive } from './independent-archive.mjs';
import { join } from 'node:path';
import { createFamily, createPerson, createMemory, createStory, createMediaOriginal } from '../core/family-model.mjs';
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
const text = value => JSON.stringify(value);
const parse = row => row ? JSON.parse(row.record) : null;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const opaque = () => randomBytes(18).toString('base64url');
function valid(value) { if (!id(value)) throw new AccessError(400); return value; }
export function openFamilyRepository({ filename, now = Date.now, originalsDirectory }) {
  const path = resolve(filename);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const parent = lstatSync(dirname(path));
  if (!parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o077)) throw new Error('Use a private data directory (mode 0700)');
  try { if (!lstatSync(path).isFile()) throw new Error('Regular database file required'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (![0, 1].includes(version)) { db.close(); throw new Error('Unsupported database version'); }
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,issuer TEXT NOT NULL,subject TEXT NOT NULL,record TEXT NOT NULL,UNIQUE(issuer,subject));
    CREATE TABLE IF NOT EXISTS families(id TEXT PRIMARY KEY,record TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS memberships(account_id TEXT NOT NULL,family_id TEXT NOT NULL,record TEXT NOT NULL,PRIMARY KEY(account_id,family_id),FOREIGN KEY(account_id) REFERENCES accounts(id),FOREIGN KEY(family_id) REFERENCES families(id));
    CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,family_id TEXT NOT NULL,id TEXT NOT NULL,record TEXT NOT NULL,PRIMARY KEY(kind,family_id,id),FOREIGN KEY(family_id) REFERENCES families(id));
    CREATE TABLE IF NOT EXISTS blobs(family_id TEXT NOT NULL,id TEXT NOT NULL,bytes BLOB NOT NULL,PRIMARY KEY(family_id,id),FOREIGN KEY(family_id) REFERENCES families(id));
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,account_id TEXT NOT NULL,record TEXT NOT NULL,FOREIGN KEY(account_id) REFERENCES accounts(id));
    CREATE TABLE IF NOT EXISTS invitations(hash TEXT PRIMARY KEY,family_id TEXT NOT NULL,record TEXT NOT NULL,FOREIGN KEY(family_id) REFERENCES families(id));
    CREATE TABLE IF NOT EXISTS archive_sequences(family_id TEXT PRIMARY KEY,sequence INTEGER NOT NULL,FOREIGN KEY(family_id) REFERENCES families(id));
    CREATE TABLE IF NOT EXISTS audits(id TEXT PRIMARY KEY,family_id TEXT NOT NULL,record TEXT NOT NULL,FOREIGN KEY(family_id) REFERENCES families(id));
    CREATE TABLE IF NOT EXISTS oauth(hash TEXT PRIMARY KEY,record TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS drive_oauth(hash TEXT PRIMARY KEY,family_id TEXT NOT NULL,record TEXT NOT NULL,FOREIGN KEY(family_id) REFERENCES families(id));
    CREATE TABLE IF NOT EXISTS drive_consents(family_id TEXT PRIMARY KEY,record TEXT NOT NULL,FOREIGN KEY(family_id) REFERENCES families(id));
    CREATE TABLE IF NOT EXISTS drive_controls(family_id TEXT PRIMARY KEY,generation INTEGER NOT NULL,FOREIGN KEY(family_id) REFERENCES families(id));
    PRAGMA user_version=1;`);
  const archive = createIndependentArchive(originalsDirectory ?? join(dirname(path), 'original-archive'));
  const getRecord = (kind, family, key) => parse(db.prepare('SELECT record FROM records WHERE kind=? AND family_id=? AND id=?').get(kind, family, key));
  const records = (kind, family, limit = 10001) => db.prepare('SELECT record FROM records WHERE kind=? AND family_id=? ORDER BY id LIMIT ?').all(kind, family, limit).map(parse);
  const insert = (kind, row) => db.prepare('INSERT INTO records VALUES(?,?,?,?)').run(kind, row.familyId, row.id, text(row));
  function transaction(operation) { db.exec('BEGIN IMMEDIATE'); try { const result = operation(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } }
  function contentFor(familyId) { return { family: parse(db.prepare('SELECT record FROM families WHERE id=?').get(familyId)), people: records('people', familyId), contributors: records('contributors', familyId), memories: records('memories', familyId), stories: records('stories', familyId), originals: records('media', familyId).filter(row => row.originalId === undefined) }; }
  function preserveFamily(familyId) {
    const snapshot = transaction(() => {
      const previous = db.prepare('SELECT sequence FROM archive_sequences WHERE family_id=?').get(familyId)?.sequence ?? 0;
      const sequence = previous + 1;
      db.prepare('INSERT INTO archive_sequences VALUES(?,?) ON CONFLICT(family_id) DO UPDATE SET sequence=excluded.sequence').run(familyId, sequence);
      const content = contentFor(familyId); const bytes = new Map(content.originals.map(row => [row.id, repository.getMediaBytes(familyId, row.id)]));
      return { content, bytes, sequence };
    });
    return archive(snapshot.content, key => snapshot.bytes.get(key), snapshot.sequence);
  }
  function durable(familyId, operation) { const result = transaction(operation); preserveFamily(familyId); return result; }
  const driveGeneration = familyId => db.prepare('SELECT generation FROM drive_controls WHERE family_id=?').get(familyId)?.generation ?? 0;
  function member(accountId, familyId) { return parse(db.prepare('SELECT record FROM memberships WHERE account_id=? AND family_id=?').get(accountId, familyId)); }
  function actor(principal, familyId, organizer = false) {
    const session = parse(db.prepare('SELECT record FROM sessions WHERE hash=?').get(principal.sessionHash));
    const account = parse(db.prepare('SELECT record FROM accounts WHERE id=?').get(principal.accountId));
    if (!session || session.accountId !== principal.accountId || session.expiresAt <= now() || !Number.isSafeInteger(session.idleMs) || session.idleMs < 1000 || now() - session.lastSeenAt >= session.idleMs || account?.state !== 'active' ||
        session.identityHash !== hash(text([account.issuer, account.subject]))) throw new AccessError(401);
    const stored = member(principal.accountId, familyId);
    const membership = validateMembership(stored, principal.accountId, familyId);
    if (organizer) requireOrganizer(membership);
    if (!id(stored.contributorId)) throw new Error('Missing contributor binding');
    return { ...membership, contributorId: stored.contributorId };
  }
  function putMember(row) { db.prepare('INSERT INTO memberships VALUES(?,?,?) ON CONFLICT(account_id,family_id) DO UPDATE SET record=excluded.record').run(row.accountId, row.familyId, text(row)); }
  function contributor(familyId, accountId, displayName = 'Family member') {
    const contributorId = opaque(); insert('contributors', { id: contributorId, familyId, displayName }); return contributorId;
  }
  // Shared insert path; the authenticated API and an explicitly local operator
  // both use it. No network endpoint accepts an operator importer identity.
  function insertPhoto(familyId, input, contributorId, kind = 'photo') {
    if (!['photo', 'video'].includes(kind) || (kind === 'video' && input.derivatives?.length)) throw new AccessError(400);
    const memory = { ...createMemory({ id: valid(input.id), familyId, personIds: input.personIds,
      title: input.title, contributorId }), originalIds: [kind + '_' + hash(text([familyId, input.id])).slice(0, 48)], hidden: false };
    if (memory.personIds.some(key => !getRecord('people', familyId, key))) throw new AccessError(400);
    const bytes = Uint8Array.from(input.bytes);
    const original = createMediaOriginal({ id: memory.originalIds[0], familyId, memoryId: memory.id,
      contributorId, kind, byteLength: bytes.length, sha256: hash(bytes) });
    const existing = getRecord('memories', familyId, memory.id);
    if (existing) {
      const old = getRecord('media', familyId, original.id);
      if (text(existing) !== text(memory) || text(old) !== text(original)) throw new AccessError(409);
      return { memoryId: memory.id, originalId: original.id, durable: true, alreadyPresent: true };
    }
    insert('memories', memory); insert('media', original);
    db.prepare('INSERT INTO blobs VALUES(?,?,?)').run(familyId, original.id, bytes);
    for (const derivative of input.derivatives ?? []) {
      const variant = { small: 'thumbnail', medium: 'preview', large: 'playback' }[derivative.name];
      if (!variant || !(derivative.bytes instanceof Uint8Array)) throw new AccessError(400);
      const record = { ...createMediaOriginal({ ...original, id: original.id + '_' + derivative.name,
        byteLength: derivative.bytes.length, sha256: hash(derivative.bytes) }),
        originalId: original.id, variant, width: derivative.width, height: derivative.height };
      insert('media', record); db.prepare('INSERT INTO blobs VALUES(?,?,?)').run(familyId, record.id, derivative.bytes);
    }
    return { memoryId: memory.id, originalId: original.id, durable: true, alreadyPresent: false };
  }
  const repository = {
    close() { db.close(); },
    ensureVerifiedAccount(identity) {
      if (typeof identity.issuer !== 'string' || typeof identity.subject !== 'string') throw new AccessError(401);
      return transaction(() => {
        const old = parse(db.prepare('SELECT record FROM accounts WHERE issuer=? AND subject=?').get(identity.issuer, identity.subject));
        if (old) {
          if (old.state !== 'active') throw new AccessError(401);
          // Verified email is only invitation-recipient evidence, never an identity key.
          const updated = { ...old, verifiedEmail: identity.verifiedEmail ?? null };
          db.prepare('UPDATE accounts SET record=? WHERE id=?').run(text(updated), old.id); return updated;
        }
        const row = { id: opaque(), state: 'active', issuer: identity.issuer, subject: identity.subject, verifiedEmail: identity.verifiedEmail ?? null };
        db.prepare('INSERT INTO accounts VALUES(?,?,?,?)').run(row.id, row.issuer, row.subject, text(row)); return row;
      });
    },
    findAccountByIdentity(issuer, subject) { return parse(db.prepare('SELECT record FROM accounts WHERE issuer=? AND subject=?').get(issuer, subject)); },
    getAccount(key) { return parse(db.prepare('SELECT record FROM accounts WHERE id=?').get(key)); },
    getSession(key) { return parse(db.prepare('SELECT record FROM sessions WHERE hash=?').get(key)); },
    replaceSession({ oldHash, newHash, record }) { return transaction(() => { if (oldHash) db.prepare('DELETE FROM sessions WHERE hash=?').run(oldHash); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(newHash, record.accountId, text(record)); }); },
    touchSession(key, at) { return transaction(() => { const row = repository.getSession(key); if (!row) return false; row.lastSeenAt = Math.max(row.lastSeenAt, at); return db.prepare('UPDATE sessions SET record=? WHERE hash=?').run(text(row), key).changes === 1; }); },
    deleteSession(key) { db.prepare('DELETE FROM sessions WHERE hash=?').run(key); },
    getMembership: member,
    listFamilies(accountId) { return db.prepare('SELECT f.record AS record,m.record AS membership FROM families f JOIN memberships m ON m.family_id=f.id WHERE m.account_id=?').all(accountId).flatMap(row => { const m = JSON.parse(row.membership); return m.state === 'active' ? [{ ...JSON.parse(row.record), role: m.role }] : []; }); },
    listMemories(familyId) { return records('memories', familyId); },
    getMemory(familyId, key) { return getRecord('memories', familyId, key); },
    listStories(familyId, memoryId, { limit = 100 } = {}) { return db.prepare("SELECT record FROM records WHERE kind='stories' AND family_id=? AND json_extract(record,'$.memoryId')=? ORDER BY id LIMIT ?").all(familyId, memoryId, limit + 1).map(parse); },
    getImageRenditions(familyId, originalId) { return ['small', 'medium', 'large'].flatMap(name => { const row = getRecord('media', familyId, originalId + '_' + name); return row?.originalId === originalId && Number.isSafeInteger(row.width) && row.width > 0 ? [{ name, width: row.width, height: row.height }] : []; }); },
    getMedia(familyId, key) { return getRecord('media', familyId, key); },
    getMediaBytes(familyId, key) { const row = db.prepare('SELECT bytes FROM blobs WHERE family_id=? AND id=?').get(familyId, key); return row ? Uint8Array.from(row.bytes) : null; },
    listMembers(familyId) { return db.prepare('SELECT record FROM memberships WHERE family_id=?').all(familyId).map(parse).map(row => ({ accountId: row.accountId, role: row.role, state: row.state, email: repository.getAccount(row.accountId)?.verifiedEmail ?? '' })); },
    listInvitations(familyId) { return db.prepare('SELECT hash,record FROM invitations WHERE family_id=?').all(familyId).map(row => ({ id: row.hash, ...JSON.parse(row.record) })); },
    listContributors(familyId) { return records('contributors', familyId); },
    listPeople(familyId) { return records('people', familyId); },
    // Operator-only setup. This is never exposed as a public HTTP route.
    bootstrapFamily({ familyId, label, accountId }) { return transaction(() => {
      const account = repository.getAccount(valid(accountId)); if (account?.state !== 'active') throw new AccessError(401);
      const family = createFamily({ id: valid(familyId), label });
      db.prepare('INSERT INTO families VALUES(?,?)').run(family.id, text(family));
      const contributorId = contributor(family.id, accountId);
      putMember({ accountId, familyId: family.id, state: 'active', role: 'organizer', scope: { kind: 'family' }, contributorId }); return family;
    }); },
    createPerson(principal, familyId, input) { return durable(familyId, () => { actor(principal, familyId, true); const row = createPerson({ id: valid(input.id), familyId, displayName: input.displayName }); insert('people', row); return row; }); },
    commitPhoto(principal, familyId, input) { return durable(familyId, () => {
      const membership = actor(principal, familyId);
      if (membership.scope.kind !== 'family') throw new AccessError(404);
      return insertPhoto(familyId, input, membership.contributorId);
    }); },
    commitVideo(principal, familyId, input) { return durable(familyId, () => {
      const membership = actor(principal, familyId);
      if (membership.scope.kind !== 'family') throw new AccessError(404);
      return insertPhoto(familyId, { ...input, derivatives: [] }, membership.contributorId, 'video');
    }); },
    // Trusted on-host intake only. Requires private database filesystem access.
    // Imported files are attributed to a distinct non-login source, not a forged member.
    importPhotoFromFolder({ familyId, personIds, title, bytes, derivatives }) {
      valid(familyId);
      if (!db.prepare('SELECT 1 FROM families WHERE id=?').get(familyId)) throw new AccessError(404);
      if (!(bytes instanceof Uint8Array) || !bytes.length) throw new AccessError(400);
      if (!Array.isArray(personIds) || new Set(personIds).size !== personIds.length ||
          personIds.some(key => !id(key) || !getRecord('people', familyId, key))) throw new AccessError(400);
      const digest = hash(bytes);
      const memoryId = 'ingest_' + hash(text([familyId, digest])).slice(0, 48);
      const contributorId = 'source_' + hash(text([familyId, 'local-folder-import'])).slice(0, 48);
      const originalId = 'photo_' + hash(text([familyId, memoryId])).slice(0, 48);
      const old = getRecord('memories', familyId, memoryId);
      if (old) {
        const original = getRecord('media', familyId, originalId);
        const existingBytes = repository.getMediaBytes(familyId, originalId);
        // A repeated import must not silently change which people a memory describes.
        if (old.contributorId !== contributorId || old.originalIds?.length !== 1 ||
            old.originalIds[0] !== originalId || original?.sha256 !== digest ||
            old.personIds?.length !== personIds.length ||
            personIds.some(key => !old.personIds.includes(key)) ||
            !existingBytes || hash(existingBytes) !== digest) throw new AccessError(409);
        // Re-run independent preservation before acknowledging an idempotent retry.
        // A prior transaction may have committed before its archive flush failed.
        // This is an operator-only path; never expose archive repair via public API.
        preserveFamily(familyId);
        return { memoryId, originalId, durable: true, alreadyPresent: true };
      }
      return durable(familyId, () => {
        if (!getRecord('contributors', familyId, contributorId))
          insert('contributors', { id: contributorId, familyId, displayName: 'Imported photos' });
        return insertPhoto(familyId, { id: memoryId, title, personIds, bytes, derivatives }, contributorId);
      });
    },
    commitStory(principal, familyId, memoryId, input) { return durable(familyId, () => {
      const membership = actor(principal, familyId); const memory = getRecord('memories', familyId, memoryId);
      if (!canReadMemory(membership, memory)) throw new AccessError(404);
      const recordingId = input.bytes ? 'audio_' + hash(text([familyId, input.id])).slice(0, 48) : null;
      if (input.speakerPersonId !== undefined && !getRecord('people', familyId, valid(input.speakerPersonId))) throw new AccessError(400);
      const story = { ...createStory({ id: valid(input.id), familyId, memoryId, contributorId: membership.contributorId, text: input.text, speakerPersonId: input.speakerPersonId }), recordingId };
      const bytes = input.bytes ? Uint8Array.from(input.bytes) : null;
      const original = bytes && createMediaOriginal({ id: recordingId, familyId, memoryId, contributorId: membership.contributorId, kind: 'audio', byteLength: bytes.length, sha256: hash(bytes) });
      const existing = getRecord('stories', familyId, story.id);
      if (existing) {
        if (text(existing) !== text(story) || (original && text(getRecord('media', familyId, recordingId)) !== text(original))) throw new AccessError(409);
        return { storyId: story.id, recordingId, durable: true, alreadyPresent: true };
      }
      insert('stories', story);
      if (original) { insert('media', original); db.prepare('INSERT INTO blobs VALUES(?,?,?)').run(familyId, original.id, bytes); }
      return { storyId: story.id, recordingId, durable: true, alreadyPresent: false };
    }); },
    createInvitation(principal, familyId, input) { return transaction(() => {
      actor(principal, familyId, true);
      if (!['organizer', 'contributor'].includes(input.role) || typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) || input.email.length > 254) throw new AccessError(400);
      const token = randomBytes(32).toString('base64url');
      const row = { familyId, email: input.email.toLowerCase(), role: input.role, expiresAt: now() + 7 * 86400000, state: 'pending' };
      db.prepare('INSERT INTO invitations VALUES(?,?,?)').run(hash(token), familyId, text(row)); return { id: hash(token), token, expiresAt: row.expiresAt };
    }); },
    previewInvitation(principal, token) {
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AccessError(404);
      const row = parse(db.prepare('SELECT record FROM invitations WHERE hash=?').get(hash(token)));
      const account = repository.getAccount(principal.accountId);
      if (!row || row.state !== 'pending' || row.expiresAt <= now() || !account?.verifiedEmail || row.email !== account.verifiedEmail.toLowerCase()) throw new AccessError(404);
      return { family: parse(db.prepare('SELECT record FROM families WHERE id=?').get(row.familyId)), role: row.role, scope: 'Family memories and contributions', expiresAt: row.expiresAt };
    },
    revokeInvitation(principal, familyId, invitationId) { return transaction(() => { actor(principal, familyId, true); const row = parse(db.prepare('SELECT record FROM invitations WHERE hash=? AND family_id=?').get(invitationId, familyId)); if (!row) throw new AccessError(404); row.state = 'revoked'; db.prepare('UPDATE invitations SET record=? WHERE hash=?').run(text(row), invitationId); return { revoked: true }; }); },
    acceptInvitation(principal, token, displayName = 'Family member') { return transaction(() => {
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AccessError(404);
      const invitation = parse(db.prepare('SELECT record FROM invitations WHERE hash=?').get(hash(token)));
      const account = repository.getAccount(principal.accountId); const session = repository.getSession(principal.sessionHash);
      if (!session || session.accountId !== account?.id || session.expiresAt <= now() || !Number.isSafeInteger(session.idleMs) || session.idleMs < 1000 || now() - session.lastSeenAt >= session.idleMs || account?.state !== 'active') throw new AccessError(401);
      if (!invitation || invitation.state !== 'pending' || invitation.expiresAt <= now() || !account.verifiedEmail || account.verifiedEmail.toLowerCase() !== invitation.email) throw new AccessError(404);
      const previous = member(account.id, invitation.familyId);
      if (previous) throw new AccessError(409); // Never revive or promote an existing/revoked member by replay.
      if (typeof displayName !== 'string' || displayName.length > 240) throw new AccessError(400);
      const contributorId = contributor(invitation.familyId, account.id, displayName);
      putMember({ accountId: account.id, familyId: invitation.familyId, state: 'active', role: invitation.role, scope: { kind: 'family' }, contributorId });
      invitation.state = 'consumed'; db.prepare('UPDATE invitations SET record=? WHERE hash=?').run(text(invitation), hash(token));
      return { familyId: invitation.familyId };
    }); },
    revokeMember(principal, familyId, accountId) { return transaction(() => {
      actor(principal, familyId, true); const target = member(valid(accountId), familyId); if (!target) throw new AccessError(404);
      const active = db.prepare('SELECT record FROM memberships WHERE family_id=?').all(familyId).map(parse).filter(row => row.state === 'active' && row.role === 'organizer');
      if (target.role === 'organizer' && target.state === 'active' && active.length <= 1) throw new AccessError(409);
      target.state = 'revoked'; putMember(target);
      const account = repository.getAccount(accountId);
      for (const row of db.prepare('SELECT hash,record FROM invitations WHERE family_id=?').all(familyId)) {
        const invitation = JSON.parse(row.record); if (account?.verifiedEmail?.toLowerCase() === invitation.email && invitation.state === 'pending') { invitation.state = 'revoked'; db.prepare('UPDATE invitations SET record=? WHERE hash=?').run(text(invitation), row.hash); }
      }
      return { revoked: true };
    }); },
    recordExportAudit(principal, familyId) { return transaction(() => { actor(principal, familyId, true); const row = { id: opaque(), familyId, accountId: principal.accountId, at: now(), action: 'export-prepared' }; db.prepare('INSERT INTO audits VALUES(?,?,?)').run(row.id, familyId, text(row)); }); },
    exportSnapshot(principal, familyId) { return transaction(() => {
      actor(principal, familyId, true);
      const content = contentFor(familyId);
      const bytes = new Map(content.originals.map(row => [row.id, repository.getMediaBytes(familyId, row.id)]));
      return { content, bytes };
    }); },
    // Explicit operator-owned fresh destination; identities/memberships are NOT imported.
    commitIsolatedRestore({ content, originals }) { return durable(content.family.id, () => {
      const familyId = valid(content.family.id);
      content = validateArchiveContent(content, familyId);
      if (!(originals instanceof Map) || originals.size !== content.originals.length) throw new AccessError(400);
      if (db.prepare('SELECT 1 FROM families WHERE id=?').get(familyId)) throw new AccessError(409);
      db.prepare('INSERT INTO families VALUES(?,?)').run(familyId, text(content.family));
      for (const kind of ['people', 'contributors', 'memories', 'stories']) for (const row of content[kind]) insert(kind, row);
      for (const row of content.originals) { const bytes = originals.get(row.id); if (!(bytes instanceof Uint8Array) || bytes.length !== row.byteLength || hash(bytes) !== row.sha256) throw new AccessError(400); insert('media', row); db.prepare('INSERT INTO blobs VALUES(?,?,?)').run(familyId, row.id, bytes); }
      return { familyId, access: 'disabled' };
    }); },
    bootstrapInvitation({ familyId, label, email, recovery = false }) { return transaction(() => {
      valid(familyId); if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AccessError(400);
      const existing = db.prepare('SELECT 1 FROM families WHERE id=?').get(familyId);
      if (recovery) { if (!existing || db.prepare('SELECT 1 FROM memberships WHERE family_id=?').get(familyId)) throw new AccessError(409); }
      else { const family = createFamily({ id: familyId, label }); db.prepare('INSERT INTO families VALUES(?,?)').run(familyId, text(family)); }
      const token = randomBytes(32).toString('base64url'); const invitation = { familyId, email: email.toLowerCase(), role: 'organizer', state: 'pending', expiresAt: now() + 7 * 86400000 };
      db.prepare('INSERT INTO invitations VALUES(?,?,?)').run(hash(token), familyId, text(invitation)); return { token };
    }); },
    // The refresh token is private installation state (SQLite mode 0600).
    // Never include it in family archives, API responses, audit records or logs.
    saveDriveAttempt(principal, familyId, stateHash, input) { return transaction(() => {
      actor(principal, familyId, true);
      if (!/^[a-f0-9]{64}$/.test(stateHash) || !/^[A-Za-z0-9_-]{43}$/.test(input.nonce) ||
          typeof input.codeVerifier !== 'string' || input.codeVerifier.length < 43 || input.codeVerifier.length > 128 ||
          !Number.isSafeInteger(input.expiresAt) || input.expiresAt <= now() || input.expiresAt > now() + 600000)
        throw new AccessError(400);
      db.prepare('DELETE FROM drive_oauth WHERE json_extract(record, \'$.expiresAt\') <= ?').run(now());
      if (db.prepare('SELECT count(*) AS n FROM drive_oauth').get().n >= 1000) throw new AccessError(429);
      // A newer consent attempt or disconnect invalidates every older callback.
      db.prepare('INSERT INTO drive_controls VALUES(?,1) ON CONFLICT(family_id) DO UPDATE SET generation=generation+1').run(familyId);
      db.prepare('DELETE FROM drive_oauth WHERE family_id=?').run(familyId);
      const row = { ...input, familyId, accountId: principal.accountId, sessionHash: principal.sessionHash, generation: driveGeneration(familyId) };
      db.prepare('INSERT INTO drive_oauth VALUES(?,?,?)').run(stateHash, familyId, text(row));
    }); },
    peekDriveAttempt(stateHash) {
      if (!/^[a-f0-9]{64}$/.test(stateHash)) return null;
      return parse(db.prepare('SELECT record FROM drive_oauth WHERE hash=?').get(stateHash));
    },
    consumeDriveAttempt(principal, familyId, stateHash) { return transaction(() => {
      actor(principal, familyId, true);
      const row = repository.peekDriveAttempt(stateHash);
      if (!row || row.familyId !== familyId || row.accountId !== principal.accountId ||
          row.sessionHash !== principal.sessionHash || row.expiresAt <= now() || row.generation !== driveGeneration(familyId)) return null;
      db.prepare('DELETE FROM drive_oauth WHERE hash=? AND family_id=?').run(stateHash, familyId);
      return row;
    }); },
    saveDriveConsent(principal, familyId, input) { return transaction(() => {
      actor(principal, familyId, true);
      const account = repository.getAccount(principal.accountId);
      if (account?.issuer !== 'https://accounts.google.com' || account.subject !== input.subject ||
          input.scope !== 'https://www.googleapis.com/auth/drive.file' ||
          typeof input.refreshToken !== 'string' || !input.refreshToken || input.refreshToken.length > 8192 ||
          !Number.isSafeInteger(input.consentedAt) || input.consentedAt > now())
        throw new AccessError(400);
      if (input.generation !== driveGeneration(familyId)) throw new AccessError(404);
      const row = { familyId, accountId: principal.accountId, subject: input.subject,
        refreshToken: input.refreshToken, scope: input.scope, consentedAt: input.consentedAt };
      db.prepare('INSERT INTO drive_consents VALUES(?,?) ON CONFLICT(family_id) DO UPDATE SET record=excluded.record').run(familyId, text(row));
    }); },
    // Server-only credential accessor. No token is returned from any HTTP route.
    // A fresh actor check is mandatory before loading this private record.
    getDriveCredential(principal, familyId) {
      actor(principal, familyId, true);
      const row = parse(db.prepare('SELECT record FROM drive_consents WHERE family_id=?').get(familyId));
      if (!row) return null;
      const account = repository.getAccount(principal.accountId);
      if (account?.issuer !== 'https://accounts.google.com' || account.subject !== row.subject ||
          row.scope !== 'https://www.googleapis.com/auth/drive.file' ||
          typeof row.refreshToken !== 'string' || !row.refreshToken) throw new AccessError(404);
      return Object.freeze({ refreshToken: row.refreshToken, scope: row.scope,
        subject: row.subject, generation: driveGeneration(familyId) });
    },
    getDriveConsentStatus(principal, familyId) {
      actor(principal, familyId, true);
      const row = parse(db.prepare('SELECT record FROM drive_consents WHERE family_id=?').get(familyId));
      return row ? { connected: true, scope: row.scope, consentedAt: row.consentedAt } : { connected: false };
    },
    clearDriveConsent(principal, familyId) { return transaction(() => {
      actor(principal, familyId, true);
      db.prepare('INSERT INTO drive_controls VALUES(?,1) ON CONFLICT(family_id) DO UPDATE SET generation=generation+1').run(familyId);
      db.prepare('DELETE FROM drive_oauth WHERE family_id=?').run(familyId);
      db.prepare('DELETE FROM drive_consents WHERE family_id=?').run(familyId);
    }); },
    saveOAuth(key, value) { return transaction(() => {
      const rows = db.prepare('SELECT hash,record FROM oauth LIMIT 1002').all();
      for (const row of rows) if (JSON.parse(row.record).expiresAt <= now()) db.prepare('DELETE FROM oauth WHERE hash=?').run(row.hash);
      if (db.prepare('SELECT count(*) AS n FROM oauth').get().n >= 1000) throw new AccessError(429);
      db.prepare('INSERT INTO oauth VALUES(?,?)').run(key, text(value));
    }); },
    consumeOAuth(key, bindingHash) { return transaction(() => { const row = parse(db.prepare('SELECT record FROM oauth WHERE hash=?').get(key)); if (!row || row.bindingHash !== bindingHash) return null; db.prepare('DELETE FROM oauth WHERE hash=?').run(key); return row; }); }
  };
  return Object.freeze(repository);
}
