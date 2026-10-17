import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  return port;
}

test('local demo serves synthetic HTML on loopback and rejects other paths', { timeout: 15000 }, async () => {
  const port = await freePort();
  const child = spawn(process.execPath, ['src/demo/server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  try {
    let response;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (child.exitCode !== null) throw new Error('Server exited: ' + stderr);
      try {
        response = await fetch('http://127.0.0.1:' + port + '/');
        break;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 75));
      }
    }
    assert.ok(response, 'Server did not start');
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Fictional local demo/);
    assert.match(response.headers.get('content-security-policy'), /connect-src 'none'/);
    const missing = await fetch('http://127.0.0.1:' + port + '/private');
    assert.equal(missing.status, 404);
    const post = await fetch('http://127.0.0.1:' + port + '/', { method: 'POST' });
    assert.equal(post.status, 404);
  } finally {
    child.kill();
    if (child.exitCode === null) await Promise.race([once(child, 'exit'), new Promise(resolve => setTimeout(resolve, 2000))]);
  }
});
