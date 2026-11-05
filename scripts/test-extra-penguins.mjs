/** Local browser integration checks; no test dependency or production hook required.
 * Start npm run dev first. CHROME_PATH may point at Chromium on other systems.
 *   node scripts/test-extra-penguins.mjs              intro, name field and all eight identities
 *   node scripts/test-extra-penguins.mjs --baseline   intro and home only
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';

const root = process.cwd();
const out = path.join(root, 'docs/extra_penguins/evidence');
fs.mkdirSync(out, { recursive: true });
const executable = process.env.CHROME_PATH ?? (process.platform === 'win32'
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'chromium');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'oziel-browser-'));
const proc = spawn(executable, ['--headless=new', '--remote-debugging-port=9338', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-dev-shm-usage', '--window-size=1440,1000',
  '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws;
let sequence = 0;
const pending = new Map();
const errors = [];
const phases = [];
try {
  let tabs;
  for (let i = 0; i < 100; i++) {
    try { tabs = await (await fetch('http://127.0.0.1:9338/json')).json(); break; } catch { await sleep(100); }
  }
  assert(tabs?.length, 'Chromium CDP startup');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await once(ws, 'open');
  ws.addEventListener('message', event => {
    const m = JSON.parse(event.data);
    if (m.id) {
      const job = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) job?.reject(new Error(JSON.stringify(m.error)));
      else job?.resolve(m.result);
    }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
      errors.push({ type: m.params.type, message: m.params.args.map(a => a.value ?? a.description).join(' ') });
    }
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) errors.push(m.params.response.url);
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const waitFor = async (expression, timeout = 30000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await evaluate(expression)) return;
      await sleep(150);
    }
    throw new Error(`Timeout: ${expression}`);
  };
  const screenshot = async name => {
    const { data } = await command('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(data, 'base64'));
  };
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Network.enable');
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await command('Page.navigate', { url: 'http://127.0.0.1:5173/?loop=timeout' });
  await waitFor('!!window.__oziel');
  await screenshot('baseline-intro-start');
  // The name field must stay hidden until the intro is over and its set is cleared.
  const begun = Date.now();
  let early = null;
  while (Date.now() - begun < 140000) {
    const snapshot = await evaluate(`({phase:window.__oziel.phase,ready:window.__oziel.ready,form:!!document.querySelector('.summon'),present:window.__oziel.penguins.filter(p=>p.present).length})`);
    phases.push({ ms: Date.now() - begun, ...snapshot });
    if (snapshot.form && !snapshot.ready) early = snapshot;
    if (snapshot.form) break;
    if (phases.length === 10) await screenshot('baseline-intro-active');
    await sleep(250);
  }
  assert.equal(early, null, 'name field hidden until the scene is ready');
  assert.equal(await evaluate('window.__oziel.phase'), 'home', 'normal intro completes');
  assert(await evaluate('window.__oziel.sign.cleared'), 'intro set cleared before the field shows');
  await screenshot('baseline-home');
  const before = await evaluate('window.__oziel.penguins.map(p=>({x:p.x,clip:p.clip,frame:p.sprite.frame.name}))');
  await sleep(3000);
  const after = await evaluate('window.__oziel.penguins.map(p=>({x:p.x,clip:p.clip,frame:p.sprite.frame.name}))');
  assert.notDeepEqual(before, after, 'penguins move after intro');
  if (process.argv.includes('--baseline')) {
    fs.writeFileSync(path.join(out, 'baseline-report.json'), JSON.stringify({ phases, errors, result: 'passed' }, null, 2));
    assert.deepEqual(errors, [], 'browser has no warnings, exceptions or failed responses');
    console.log(JSON.stringify({ result: 'passed', duration: Date.now() - begun, evidence: out, errors }));
  } else {
    // Types into the real field (React input event) and submits the form. The field gives
    // no messages: the result is read from the world (an arrival, or nothing) and from the
    // field itself, which empties when a name was taken.
    const submit = (name, double = false) => evaluate(`(async () => {
      const input = document.querySelector('.summon-input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(name)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 60));
      const before = window.__oziel.penguins.length;
      document.querySelector('.summon').requestSubmit();
      // a second Enter while the first is still loading must not bring a second penguin
      if (${double}) document.querySelector('.summon').requestSubmit();
      const t = performance.now();
      const busy = () => document.querySelector('.summon').getAttribute('aria-busy') === 'true';
      // taken: the field empties once the arrival is under way; ignored: it stays as typed
      while (performance.now() - t < 15000 && (busy() || (input.value && performance.now() - t < 1500))) await new Promise(r => setTimeout(r, 30));
      await new Promise(r => setTimeout(r, 400));
      return { added: window.__oziel.penguins.length - before, cleared: input.value === '' };
    })()`);
    const count = () => evaluate('window.__oziel.penguins.length');
    const original = await count();
    assert.deepEqual(await submit('   '), { added: 0, cleared: false }, 'empty name: nothing happens');
    assert.deepEqual(await submit('pingüino genérico'), { added: 0, cleared: false }, 'unknown name: nothing happens, no fallback penguin');
    assert.equal(await evaluate("document.querySelector('.summon').innerText.trim()"), '', 'the field shows no text or messages');
    assert.equal(await evaluate("document.querySelector('.summon-input').placeholder"), '', 'no hint of what it is for');
    // Every identity, typed with different case, spacing and hyphenation.
    const typed = { aylen: 'Aylen ', boris: 'BORIS', chalquits: 'chalquits', chiquito: ' Chiquito', oror: 'OROR',
      'shadow-frederick': '  shadow   FREDERICK ', tats: 'tats', 'zorro-negro': 'Zorro-Negro' };
    const lifecycle = {};
    for (const [id, name] of Object.entries(typed)) {
      assert.deepEqual(await submit(name, id === 'aylen'), { added: 1, cleared: true }, `summon ${id}`);
      lifecycle[id] = await evaluate(`(async () => {
        const p = window.__oziel.extras.get(${JSON.stringify(id)});
        const seen = [], tex = new Set();
        let below = 0, mirrored = false, t = performance.now();
        while (performance.now() - t < 9000) {
          const s = p.mode + ':' + p.clip;
          if (seen[seen.length - 1] !== s) seen.push(s);
          tex.add(p.sprite.texture.key);
          below = Math.max(below, p.y - p.laneY);
          mirrored ||= p.sprite.flipX;
          if (p.mode === 'normal' && seen.some(x => x.startsWith('down:get_up'))) break;
          await new Promise(r => setTimeout(r, 20));
        }
        return { seen, below, mirrored, tex: [...tex], variant: p.variant, scale: p.sprite.scaleX / (p.size / p.texScale) };
      })()`);
      const life = lifecycle[id];
      assert(life.seen[0].startsWith('airborne:fall_'), `${id} enters falling: ${life.seen}`);
      assert(life.seen.some(s => s.startsWith('down:impact_')), `${id} lands`);
      assert(life.seen.some(s => s.startsWith('down:get_up')), `${id} gets up`);
      assert(life.seen[life.seen.length - 1].startsWith('normal:'), `${id} back to normal`);
      assert.equal(life.below, 0, `${id} never goes through the ground`);
      assert.equal(life.mirrored, false, `${id} is never mirrored`);
      assert(life.tex.every(k => k.startsWith(`extra_${id}__penguin_`)), `${id} keeps its own textures: ${life.tex}`);
      assert.equal(life.variant, `extra_${id}__penguin`);
    }
    assert.deepEqual(await submit('tats'), { added: 0, cleared: true }, 'repeated name: no second Tats');
    assert.equal(await count(), original + 8, 'one arrival per identity, also for a double send');
    await screenshot('extras-home');
    // Normal life afterwards: identities and originals share the brain and collisions.
    const life = await evaluate(`(async () => {
      const w = window.__oziel, seen = new Set(), facing = new Set();
      let textures = true, mirrored = false;
      for (let k = 0; k < 120; k++) {
        for (const [id, p] of w.extras) {
          seen.add(p.clip); facing.add(p.facing);
          textures &&= p.sprite.texture.key.startsWith('extra_' + id + '__penguin_');
          mirrored ||= p.sprite.flipX;
        }
        await new Promise(r => setTimeout(r, 60));
      }
      return { clips: [...seen], facing: [...facing], textures, mirrored };
    })()`);
    assert(life.textures, 'appearance kept during normal behaviour');
    assert.equal(life.mirrored, false, 'identities are never mirrored, whichever way they walk');
    await screenshot('extras-life');
    // "oziel": every penguin that can stops to look up, the O lights up, then life goes on
    await sleep(1500);
    const marvel = await evaluate(`(async () => {
      const input = document.querySelector('.summon-input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ' Oziel ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 60));
      document.querySelector('.summon').requestSubmit();
      await new Promise(r => setTimeout(r, 900));
      const w = window.__oziel, ps = w.penguins.filter(p => p.present && p.grounded && !p.swimming && p.y >= p.laneY - 6);
      const up = ps.filter(p => p.clip === 'look_up').length;
      const glow = document.querySelector('.home').dataset.marvel === 'true';
      await new Promise(r => setTimeout(r, 3500));
      return { up, of: ps.length, glow, cleared: input.value === '', after: w.penguins.filter(p => p.clip === 'look_up').length };
    })()`);
    assert(marvel.up >= marvel.of - 2 && marvel.up > 0, `oziel: penguins look up (${marvel.up}/${marvel.of})`);
    assert(marvel.glow && marvel.cleared, 'oziel: the O glows and the field empties');
    assert.equal(marvel.after, 0, 'oziel: they go back to what they were doing');
    fs.writeFileSync(path.join(out, 'integration-report.json'), JSON.stringify({ phases, lifecycle, life, marvel, errors, result: 'passed' }, null, 2));
    assert.deepEqual(errors, [], 'browser has no warnings, exceptions or failed responses');
    console.log(JSON.stringify({ result: 'passed', duration: Date.now() - begun, evidence: out, life }));
  }
} finally {
  ws?.close();
  proc.kill();
  // Leave the profile in the OS temp directory: Chrome subprocesses may still hold it.
}
