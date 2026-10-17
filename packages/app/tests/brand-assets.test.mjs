import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { integratedFixture, origin } from './helpers/integrated-app-fixture.mjs';

test('new logo and favicon are readable without session while private API remains protected', async t => {
  const { app } = await integratedFixture(t);
  for (const path of ['/brand-mark.svg', '/favicon.svg']) {
    const result = await app.handle(new Request(origin + path));
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('content-type'), 'image/svg+xml');
    assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(result.headers.get('cache-control'), 'no-store');
    const svg = await result.text();
    assert.match(svg, /<svg/);
    assert.doesNotMatch(svg, /<script|foreignObject|onload\s*=|https?:\/\//i);
    const head = await app.handle(new Request(origin + path, { method: 'HEAD' }));
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  }
  const denied = await app.handle(new Request(origin + '/api/families'));
  assert.equal(denied.status, 401);
});

test('real app and community front page reference served, static brand assets', async () => {
  const app = await readFile(new URL('../src/app/index.html', import.meta.url), 'utf8');
  assert.match(app, /href="\/favicon\.svg"/);
  assert.match(app, /src="\/brand-mark\.svg"/);
  const site = await readFile(new URL('../../../docs/index.html', import.meta.url), 'utf8');
  assert.match(site, /href="assets\/favicon\.svg"/);
  assert.match(site, /src="assets\/brand-mark\.svg"/);
});
