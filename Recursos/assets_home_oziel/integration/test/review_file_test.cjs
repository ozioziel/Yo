const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const assert = require('node:assert/strict');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(process.env.OZIEL_PLAYWRIGHT_MODULE ?? 'C:/Users/jojoj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
(async () => {
  const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await playwright.chromium.launch({ headless: true, ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => errors.push(request.url()));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../../previews/animation_review.html')).href);
    await page.selectOption('#variant', 'penguin_autumn');
    await page.selectOption('#clip', 'open_umbrella');
    await page.waitForFunction(() => img.complete && img.naturalWidth > 0 && cfg.frames.length === 8);
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => ({
      variant: document.querySelector('#variant').value, clip: document.querySelector('#clip').value,
      atlasWidth: img.naturalWidth, frames: cfg.frames.length, animatedIndex: index,
      canvasWidth: canvas.width, description: document.querySelector('#meta').textContent.split('\n')[0]
    }));
    assert.equal(result.variant, 'penguin_autumn');
    assert.equal(result.clip, 'open_umbrella');
    assert.ok(result.atlasWidth > 0);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ...result, errors, source: 'file://', status: 'PASS' }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
