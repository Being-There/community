import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../src/demo/index.html', import.meta.url), 'utf8');
const server = await readFile(new URL('../src/demo/server.mjs', import.meta.url), 'utf8');
test('local demo explicitly fictional and supports all three views', () => {
 for (const text of ['Fictional local demo', 'data-view="family"', 'data-view="memory"', 'data-view="stories"', 'Reset demo']) assert.ok(html.includes(text), text);
});
test('local demo contains no external assets or storage APIs', () => {
 assert.doesNotMatch(html, /https?:\/\/|localStorage|sessionStorage|fetch\s*\(|XMLHttpRequest|<script[^>]+src=/i);
});
test('server binds loopback and blocks outgoing browser connections', () => {
 assert.match(server, /127\.0\.0\.1/);
 assert.match(server, /connect-src 'none'/);
 assert.match(server, /frame-ancestors 'none'/);
});
