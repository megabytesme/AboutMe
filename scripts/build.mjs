import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import CleanCSS from 'clean-css';
import { minify as minifyHtml } from 'html-minifier-terser';
import { minify as minifyJavaScript } from 'terser';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extensions = new Set(['.html', '.css', '.js', '.json', '.svg', '.png', '.jpg', '.jpeg', '.ico', '.webp', '.avif', '.woff', '.woff2', '.txt', '.xml', '.webmanifest']);

export async function build(source, destination) {
  await rm(destination, { recursive: true, force: true });
  let files = 0;
  let originalTextBytes = 0;
  let minifiedTextBytes = 0;
  async function copy(directory, target) {
    await mkdir(target, { recursive: true });
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || entry.name.startsWith('.')) throw new Error('Static content must not contain symbolic links or hidden files');
      const input = join(directory, entry.name);
      const output = join(target, entry.name);
      const extension = extname(entry.name).toLowerCase();
      if (entry.isDirectory()) await copy(input, output);
      else if (entry.isFile() && extensions.has(extension)) {
        if (['.html', '.css', '.js'].includes(extension)) {
          const text = await readFile(input, 'utf8');
          let minified;
          if (extension === '.html') {
            minified = await minifyHtml(text, {
              collapseWhitespace: true,
              removeComments: true,
              removeRedundantAttributes: true,
              removeScriptTypeAttributes: true,
              removeStyleLinkTypeAttributes: true,
              useShortDoctype: true,
              minifyCSS: true,
              minifyJS: true
            });
          } else if (extension === '.css') {
            const result = new CleanCSS({ rebase: false }).minify(text);
            if (result.errors.length) throw new Error('CSS minification failed: ' + result.errors.join('; '));
            minified = result.styles;
          } else {
            minified = (await minifyJavaScript(text)).code;
          }
          if (typeof minified !== 'string') throw new Error('Minification produced no output: ' + input);
          await writeFile(output, minified);
          originalTextBytes += Buffer.byteLength(text);
          minifiedTextBytes += Buffer.byteLength(minified);
        } else await copyFile(input, output);
        files++;
      }
    }
  }
  await copy(source, destination);
  return { outcome: 'pass', files, originalTextBytes, minifiedTextBytes };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify({ ...await build(join(root, 'content'), join(root, 'dist')), output: 'dist' }));
}
