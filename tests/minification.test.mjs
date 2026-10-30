import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { build } from '../scripts/build.mjs';

test('minification preserves executable behaviour, assets and editable source', async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'aboutme-minification-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const source = join(temporary, 'content');
  const destination = join(temporary, 'dist');
  await mkdir(source);
  const html = '<!DOCTYPE html>\n<html><head><style>/* example */ body { color: #ffffff; }</style></head><body>\n<!-- example -->\n<script> function calculate(value) { return value + 2; } globalThis.answer = calculate(40); </script>\n</body></html>';
  const javascript = '// example\nfunction calculate(value) { return value + 2; }\nglobalThis.answer = calculate(40);\n';
  const css = '/* example */\nbody { color: #ffffff; margin: 0px 0px 0px 0px; }\n';
  const image = Buffer.from([0, 5, 255, 40, 3]);
  for (const [name, value] of [['index.html', html], ['app.js', javascript], ['style.css', css], ['image.png', image], ['Dockerfile', 'not web content']]) await writeFile(join(source, name), value);

  const result = await build(source, destination);
  const outputHtml = await readFile(join(destination, 'index.html'), 'utf8');
  const outputJs = await readFile(join(destination, 'app.js'), 'utf8');
  const outputCss = await readFile(join(destination, 'style.css'), 'utf8');
  assert.ok(result.minifiedTextBytes < result.originalTextBytes);
  assert.ok(outputHtml.length < html.length);
  assert.ok(outputJs.length < javascript.length);
  assert.ok(outputCss.length < css.length);
  assert.doesNotMatch(outputHtml, /example/);
  assert.equal(runInNewContext(outputJs + '; answer'), 42);
  const inlineScript = outputHtml.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.equal(runInNewContext(inlineScript + '; answer'), 42);
  assert.deepEqual(await readFile(join(destination, 'image.png')), image);
  assert.equal(await readFile(join(source, 'index.html'), 'utf8'), html);
  assert.equal(await readFile(join(source, 'app.js'), 'utf8'), javascript);
  assert.equal(await readFile(join(source, 'style.css'), 'utf8'), css);
  await assert.rejects(readFile(join(destination, 'Dockerfile')));
});
