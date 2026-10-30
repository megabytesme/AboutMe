import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'acorn';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const html = await readFile(resolve(root, 'dist/index.html'), 'utf8');
const javascript = await readFile(resolve(root, 'dist/app.js'), 'utf8');
test('production document retains the deployed device information', () => {
  assert.match(html, /<title>MegaBytesMe - Ben<\/title>/);
  assert.match(javascript, /OS: Android 17 \(OneUI 9\)/);
  assert.match(javascript, /Super thin \(5\.8mm\), running Android 17\./);
  assert.doesNotMatch(javascript, /OS: OneUI 8\.5 \(Android 16\)/);
});
test('production styles and classic script load in the original document order', async () => {
  assert.match(html, /<head>[\s\S]*<link rel="stylesheet" href="styles\.css"\s*\/?>([\s\S]*?)<\/head>/);
  assert.match(html, /<script src="app\.js"><\/script>\s*<\/body>/);
  assert.doesNotMatch(html, /<style\b|<script\b[^>]*(?:type="module"|\basync\b|\bdefer\b)/);
  await access(resolve(root, 'dist/styles.css'));
});
test('source and production application scripts retain ES5 syntax for legacy browsers', async () => {
  parse(await readFile(resolve(root, 'content/app.js'), 'utf8'), { ecmaVersion: 5 });
  parse(javascript, { ecmaVersion: 5 });
});
test('all local document assets are present in the production directory', async () => {
  const assets = [...new Set([...(html + javascript).matchAll(/(?:src|href)=\\?["'](assets\/[^"'\\<> ]+)/g)].map(match => match[1]))];
  assert.ok(assets.length >= 20, 'The real device/icon assets must be exercised');
  for (const asset of assets) await access(resolve(root, 'dist', asset));
  await assert.rejects(access(resolve(root, 'dist/Dockerfile')));
});
test('public service routes retain their production host and API prefixes', () => {
  assert.match(javascript, /megabytesme\.ddns\.net\/api\/spotlight-data/);
  assert.match(javascript, /megabytesme\.ddns\.net\/api\/cached-images\//);
  assert.match(javascript, /megabytesme\.ddns\.net\/lanyard-api\/v1\/users\//);
});
