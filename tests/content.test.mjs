import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'acorn';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const html = await readFile(resolve(root, 'dist/index.html'), 'utf8');
test('production document retains the deployed device information', () => {
  assert.match(html, /<title>MegaBytesMe - Ben<\/title>/);
  assert.match(html, /OS: Android 17 \(OneUI 9\)/);
  assert.match(html, /Super thin \(5\.8mm\), running Android 17\./);
  assert.doesNotMatch(html, /OS: OneUI 8\.5 \(Android 16\)/);
});
test('production application scripts retain ES5 syntax for legacy browsers', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length > 0);
  for (const [, source] of scripts) parse(source, { ecmaVersion: 5 });
});
test('all local document assets are present in the production directory', async () => {
  const assets = [...new Set([...html.matchAll(/(?:src|href)=\\?["'](assets\/[^"'\\<> ]+)/g)].map(match => match[1]))];
  assert.ok(assets.length >= 20, 'The real device/icon assets must be exercised');
  for (const asset of assets) await access(resolve(root, 'dist', asset));
  await assert.rejects(access(resolve(root, 'dist/Dockerfile')));
});
test('public service routes retain their production host and API prefixes', () => {
  assert.match(html, /megabytesme\.ddns\.net\/api\/spotlight-data/);
  assert.match(html, /megabytesme\.ddns\.net\/api\/cached-images\//);
  assert.match(html, /megabytesme\.ddns\.net\/lanyard-api\/v1\/users\//);
});
