// Disposable *local* functional preview: real application routes, synthetic identity/data.
// This is NOT a production login path. Never bind it beyond loopback or reuse its storage.
import { createServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNodeRequestListener } from '../src/server/host.mjs';
import { integratedFixture } from '../tests/helpers/integrated-app-fixture.mjs';
import sharp from 'sharp';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const origin = 'https://localhost:' + port;
const cleanups = [];
const tls = await mkdtemp(join(tmpdir(), 'being-there-preview-tls-'));
let server;
async function cleanup() {
  if (server?.listening) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  for (const fn of cleanups.reverse()) await fn();
  await rm(tls, { recursive: true, force: true });
}
try {
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', join(tls, 'key.pem'), '-out', join(tls, 'cert.pem'),
    '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
    '-days', '1'
  ], { stdio: 'ignore' });
  const fixture = await integratedFixture({ after: fn => cleanups.push(fn) }, { originOverride: origin });
  const owner = await fixture.login('local-preview-owner', 'owner@family.example.test');
  if (owner.callback.status !== 303) throw new Error('Synthetic preview session failed');
  const invite = fixture.repository.bootstrapInvitation({
    familyId: 'previewFamily', label: 'Example family (temporary)', email: 'owner@family.example.test'
  });
  async function write(path, body) {
    const response = await owner.request(path, { method: 'POST', body });
    if (!response.ok) throw new Error('Cannot initialize preview: ' + path + ' (' + response.status + ')');
    return response.json();
  }
  await write('/api/invitations/accept', { token: invite.token, displayName: 'Local preview organizer' });
  await write('/api/families/previewFamily/people', { id: 'avery', displayName: 'Avery (example)' });
  await write('/api/families/previewFamily/people', { id: 'riley', displayName: 'Riley (example)' });
  const picture = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
    <rect width="640" height="400" fill="#e9f3e2"/><rect y="280" width="640" height="120" fill="#a7cc9b"/>
    <circle cx="520" cy="75" r="44" fill="#ffdb83"/><path d="M0 285 Q160 165 320 290 Q460 165 640 285" fill="#6fae8a"/>
    <path d="M130 380 V250 M310 380 V220 M485 380 V270" stroke="#356c51" stroke-width="12"/>
    <g fill="#ffbc93"><circle cx="130" cy="246" r="37"/><circle cx="310" cy="216" r="42"/><circle cx="485" cy="266" r="31"/></g>
    <text x="320" y="58" text-anchor="middle" fill="#224c38" font-size="25" font-family="sans-serif">An imaginary garden</text>
  </svg>`);
  const png = await sharp(picture).png().toBuffer();
  await write('/api/families/previewFamily/contributions', {
    id: 'garden', title: 'A made-up garden afternoon', personIds: ['avery', 'riley'], base64: png.toString('base64')
  });
  await write('/api/families/previewFamily/memories/garden/stories', {
    id: 'story1', text: 'A fictional afternoon together in the garden.'
  });
  await write('/api/families/previewFamily/contributions', {
    id: 'sharedSunset', title: 'A sunset for the whole family', personIds: [], base64: png.toString('base64')
  });
  await write('/api/families/previewFamily/memories/sharedSunset/stories', {
    id: 'sunsetStory', text: 'I loved watching the light fade.', speakerPersonId: 'avery'
  });
  const listener = createNodeRequestListener({
    appOrigin: origin,
    handle: async request => {
      const pathname = new URL(request.url).pathname;
      // Synthetic OAuth verification is test-only and never exposed as a browser login.
      if (pathname.startsWith('/auth/')) return new Response('Preview identity is created at startup. Restart after signing out.', { status: 404 });
      const response = await fixture.app.handle(request);
      if (request.method !== 'GET' || pathname !== '/' || !response.ok) return response;
      const headers = new Headers(response.headers);
      for (const pair of owner.cookie.split('; ')) {
        headers.append('Set-Cookie', pair + '; Path=/; Secure; SameSite=Lax' +
          (pair.startsWith('__Host-being-there-session=') ? '; HttpOnly' : ''));
      }
      const html = (await response.text()).replace('</header>',
        '</header><aside id="preview-notice" role="note"><strong>Local example family.</strong> ' +
        'You are signed in as the fictional family organizer. Avery and Riley are example people, not accounts. ' +
        'Family space adds photos and stories. Tablet view shows every shared memory and allows optional storytelling. ' +
        'All content is discarded when the server stops. ' +
        'Do not use real family data here.</aside>');
      return new Response(html, { status: response.status, headers });
    }
  });
  server = createServer({ key: await readFile(join(tls, 'key.pem')), cert: await readFile(join(tls, 'cert.pem')) }, listener);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  console.log('Being There functional LOCAL sandbox: ' + origin);
  console.log('A temporary self-signed certificate may require a browser trust exception.');
  console.log('Real application UI; example household and identity; uploads/audio are temporary, not saved after exit.');
  console.log('Use npm run demo for the older static, noninteractive sample. Stop with Ctrl+C.');
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    try { await cleanup(); process.exitCode = 0; }
    catch (error) { console.error('Preview cleanup failed:', error.message); process.exitCode = 1; }
  });
} catch (error) {
  await cleanup();
  throw error;
}
