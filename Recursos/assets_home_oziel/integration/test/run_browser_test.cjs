/* Local QA server, real pinned Phaser 3.90, headless Chromium pointer + physics checks. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(process.env.OZIEL_PLAYWRIGHT_MODULE ?? 'C:/Users/jojoj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const { chromium } = playwright;
const root = path.resolve(__dirname, '../..');
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + pathname);
  if (file !== root && !file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
  fs.readFile(file, (error, bytes) => {
    if (error) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' }); response.end(bytes);
  });
});
let browser;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  browser = await chromium.launch({ headless: true, ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/integration/test/index.html`);
  await page.waitForFunction(() => ['ready', 'failed'].includes(window.smoke?.state), null, { timeout: 180000 });
  assert.equal(await page.evaluate(() => window.smoke.state), 'ready', JSON.stringify(await page.evaluate(() => window.smoke.errors)));
  await page.waitForTimeout(800);
  const bounds = await page.locator('canvas').boundingBox();
  const pos = await page.evaluate(() => ({ x: window.smoke.sprite.x, y: window.smoke.sprite.y - 100 }));
  const point = (x, y) => ({ x: bounds.x + x / 1920 * bounds.width, y: bounds.y + y / 1080 * bounds.height });
  const start = point(pos.x, pos.y), held = point(pos.x + 80, 250);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(held.x, held.y, { steps: 12 });
  await page.waitForFunction(() => window.smoke.p.state === 'dragged', null, { timeout: 4000 });
  await page.waitForTimeout(650);
  assert.equal(await page.evaluate(() => window.smoke.p.currentClip), 'dragged');
  await page.mouse.up();
  await page.waitForFunction(() => window.smoke.history.includes('recovering') && window.smoke.p.state === 'activity', null, { timeout: 12000 });
  await page.evaluate(() => window.smoke.p.changeWeather(0));
  assert.equal(await page.evaluate(() => window.smoke.p.variant), 'penguin_winter');
  await page.evaluate(() => window.smoke.engineer.changeWeather(1));
  assert.equal(await page.evaluate(() => window.smoke.engineer.variant), 'engineer');
  const rain = await page.evaluate(() => {
    const environment = window.smoke.environment;
    environment.set(1, false);
    const firstEmitter = environment.emitters[0];
    environment.set(1, true);
    return firstEmitter === environment.emitters[0] && firstEmitter.emitting;
  });
  assert.equal(rain, true, 'Autumn rain must persist across day/night');
  await page.evaluate(() => window.smoke.p.changeWeather(1));
  assert.equal(await page.evaluate(() => window.smoke.p.variant), 'penguin_autumn');
  const autumnPos = await page.evaluate(() => ({ x: window.smoke.sprite.x, y: window.smoke.sprite.y - 100 }));
  const autumnStart = point(autumnPos.x, autumnPos.y), autumnHeld = point(autumnPos.x + 100, 320);
  await page.mouse.move(autumnStart.x, autumnStart.y); await page.mouse.down();
  await page.mouse.move(autumnHeld.x, autumnHeld.y, { steps: 12 });
  await page.waitForFunction(() => window.smoke.p.state === 'dragged', null, { timeout: 4000 });
  assert.equal(await page.evaluate(() => !!window.smoke.p.looseUmbrella), true, 'Autumn drag must drop the closed prop');
  assert.equal(await page.evaluate(() => !!window.smoke.engineer.looseUmbrella), false);
  await page.waitForTimeout(500); await page.mouse.up();
  await page.waitForFunction(() => window.smoke.p.state === 'activity', null, { timeout: 12000 });
  assert.equal(await page.evaluate(() => window.smoke.p.looseUmbrella), null, 'Recovery must remove the temporary umbrella');
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(__dirname, 'smoke_result.png') });
  const result = await page.evaluate(() => ({
    phaser: Phaser.VERSION, state: window.smoke.state, atlasCount: window.smoke.atlasCount,
    animationCount: window.smoke.animationCount, history: window.smoke.history,
    penguinVariant: window.smoke.p.variant, engineerVariant: window.smoke.engineer.variant,
    errors: window.smoke.errors
  }));
  result.autumnRainPersistsAcrossDayNight = rain;
  result.winterEquipAndAutumnRemovalVerified = true;
  result.autumnUmbrellaDropAndCleanupVerified = true;
  result.pageErrors = pageErrors;
  assert.deepEqual(result.errors, []); assert.deepEqual(pageErrors, []);
  fs.writeFileSync(path.join(__dirname, 'browser_result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  server.closeAllConnections();
  server.close();
});
