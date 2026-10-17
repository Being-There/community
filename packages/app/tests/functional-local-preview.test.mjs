import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer as createPortProbe } from 'node:net';
import { request as httpsRequest } from 'node:https';

async function freePort() {
  const server = createPortProbe();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function get(url, { method = 'GET', headers = {}, payload } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, { method, headers, rejectUnauthorized: false }, response => {
      const parts = [];
      response.on('data', part => parts.push(part));
      response.on('end', () => resolve({
        status: response.statusCode, headers: response.headers, body: Buffer.concat(parts)
      }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('npm dev runs the full authenticated app on loopback with only synthetic disposable content', { timeout: 30000 }, async () => {
  const port = await freePort();
  const root = 'https://localhost:' + port;
  const child = spawn(process.execPath, ['scripts/local-preview.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let err = '', out = '';
  child.stdout.on('data', chunk => { out += chunk; });
  child.stderr.on('data', chunk => { err += chunk; });
  try {
    let home;
    for (let i = 0; i < 125; i++) {
      if (child.exitCode !== null) throw new Error('Preview exited: ' + err + out);
      try {
        home = await get('https://127.0.0.1:' + port + '/', { headers: { Host: 'localhost:' + port } });
        if (home.status === 200) break;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(home?.status, 200, err + out);
    assert.match(home.body.toString(), /Local example family/);
    assert.match(home.body.toString(), /id="experience"/);
    const cookies = (home.headers['set-cookie'] ?? []).map(pair => pair.split(';')[0]).join('; ');
    const csrf = cookies.split('; ').find(pair => pair.startsWith('__Host-being-there-csrf='))?.split('=')[1];
    assert.ok(csrf && cookies.includes('__Host-being-there-session='));
    const request = (path, opts = {}) => get('https://127.0.0.1:' + port + path, {
      ...opts, headers: { Host: 'localhost:' + port, Cookie: cookies, ...opts.headers }
    });
    const families = await request('/api/families');
    assert.equal(families.status, 200);
    assert.equal(JSON.parse(families.body.toString()).families[0].id, 'previewFamily');
    const memories = await request('/api/families/previewFamily/memories');
    assert.equal(memories.status, 200);
    assert.equal(JSON.parse(memories.body.toString()).memories.length, 1);
    const sample = JSON.parse(memories.body.toString()).memories[0];
    const original = await request('/api/families/previewFamily/media/' + sample.originalIds[0]);
    assert.equal(original.status, 200);
    assert.equal(original.headers['content-type'], 'image/png');
    const video = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(16), Buffer.from('temporary clip')]);
    const payload = Buffer.from(JSON.stringify({
      id: 'videoTest', title: 'Private example clip', personIds: ['avery'], mimeType: 'video/mp4',
      base64: video.toString('base64')
    }));
    const upload = await request('/api/families/previewFamily/contributions', {
      method: 'POST', payload,
      headers: { Origin: root, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Content-Length': payload.length }
    });
    assert.equal(upload.status, 200, upload.body.toString());
    assert.equal(JSON.parse(upload.body.toString()).durable, true);
    const next = await request('/api/families/previewFamily/memories');
    assert.equal(JSON.parse(next.body.toString()).memories.length, 2);
    assert.equal((await request('/auth/google/start')).status, 404);
    assert.equal((await get('https://127.0.0.1:' + port + '/api/families', { headers: { Host: 'localhost:' + port } })).status, 401);
  } finally {
    child.kill('SIGTERM');
    if (child.exitCode === null) await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 3500))]);
  }
});
