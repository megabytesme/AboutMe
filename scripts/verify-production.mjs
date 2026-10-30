import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright-core';

const root = resolve(import.meta.dirname, '../dist');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) throw new Error('missing');
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
    response.end(await readFile(path));
  } catch { response.writeHead(404); response.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const executablePath = process.env.BROWSER_EXECUTABLE || (process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : '/usr/bin/google-chrome');
let browser;
try {
  browser = await chromium.launch({ executablePath, headless: true });
  for (const viewport of [{ width: 1600, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => {
      window.WebSocket = undefined;
      String.prototype.includes = undefined;
      String.prototype.startsWith = undefined;
      Array.prototype.includes = undefined;
      NodeList.prototype.forEach = undefined;
    });
    const page = await context.newPage();
    const errors = [];
    const missing = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) missing.push(response.url()); });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname === 'api.github.com') return route.fulfill({ json: [{ name: 'Fixture project', html_url: 'https://github.com/megabytesme/AboutMe', description: 'Project API fixture', updated_at: '2026-10-30T12:00:00Z', topics: ['test'], language: 'JavaScript' }] });
      if (url.pathname === '/api/spotlight-data') return route.fulfill({ json: [{ landscapePathCompressed: 'fixture-landscape.jpg', portraitPathCompressed: 'fixture-portrait.jpg', copyright: 'Fixture copyright', title: 'Fixture landscape' }] });
      if (url.pathname.startsWith('/lanyard-api/')) return route.fulfill({ json: { success: true, data: { discord_status: 'offline', activities: [], discord_user: { username: 'fixture' } } } });
      if (route.request().resourceType() === 'stylesheet') return route.fulfill({ contentType: 'text/css', body: '' });
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="blue"/></svg>' });
    });
    assert.equal((await page.goto(origin)).status(), 200);
    await page.locator('#window-about-me').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#window-about-me').evaluate(element => getComputedStyle(element).position), 'absolute', 'The external stylesheet must apply');
    assert.equal(await page.locator('script[src="app.js"]').count(), 1);
    assert.equal(await page.evaluate(() =>
      'legacy'.includes('leg') && 'legacy'.startsWith('leg') &&
      [1, 2].includes(2) && typeof document.querySelectorAll('body').forEach === 'function'
    ), true, 'The classic script must restore the existing legacy polyfills');
    await page.waitForFunction(() => document.body.style.backgroundImage.includes('fixture-'));
    await page.locator('#window-about-me .close').click();
    for (const id of ['projects', 'pc-rigs', 'vehicles', 'devices']) {
      await page.locator('[data-window-id="' + id + '"]').click();
      const window = page.locator('#window-' + id);
      await window.waitFor({ state: 'visible' });
      if (id === 'projects') await page.getByRole('link', { name: 'Fixture project' }).waitFor();
      if (id === 'devices') {
        assert.match(await window.innerText(), /Android 17/);
        await window.locator('#phone-history-tab-button').click();
        assert.equal(await window.locator('#phone-history-tab-button').getAttribute('aria-selected'), 'true');
        await window.locator('#phone-history-tab').waitFor({ state: 'visible' });
      }
      if (id === 'pc-rigs') {
        await window.locator('#previous-pc-rigs-tab-button').click();
        assert.equal(await window.locator('#previous-pc-rigs-tab-button').getAttribute('aria-selected'), 'true');
        await window.locator('#previous-pc-rigs-tab').waitFor({ state: 'visible' });
      }
      await window.locator('.close').click();
      await window.waitFor({ state: 'detached' });
    }
    await page.locator('[data-window-id="about-me"]').click();
    await page.locator('#window-about-me').waitFor({ state: 'visible' });
    await page.locator('#window-about-me .minimize').click();
    await page.locator('#window-about-me').waitFor({ state: 'hidden' });
    await page.locator('[data-window-id="about-me"]').click();
    await page.locator('#window-about-me').waitFor({ state: 'visible' });
    assert.deepEqual(errors, [], 'The production page must not throw browser errors');
    assert.deepEqual(missing, [], 'All production page assets must load');
    assert.equal((await page.request.get(origin + '/missing-page')).status(), 404);
    await context.close();
  }
  console.log(JSON.stringify({ outcome: 'pass', viewports: 2, windows: 5, fixtures: ['projects', 'spotlight', 'presence'], productionDirectory: 'dist' }));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
