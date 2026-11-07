/* Step 4 of the extra penguins: every clip of the base penguin, for each identity, packed
 * into atlases the game loads like any other character atlas.
 *   node tools/extras/build.cjs [--character=id] [--rebuild-rig]
 *
 * Contract (from the base rig's animations.json): same clip names, frame counts, fps,
 * loops and origin; anchors (hands, head) per frame in logical 256-cell units. Frames are
 * trimmed, identical frames share one rectangle, and every rectangle is even-aligned so the
 * phone atlases are an exact half. There is no `clip__right`: facing right, the game mirrors
 * the drawing (sprite.flipX) exactly as it does for the base penguins, so a penguin walking
 * right looks right instead of walking backwards (decision of 2026-11-06).
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const registry = require('../../src/game/extraPenguins.json');
const base = require('../../assets_overrides/characters/animations.json');
const defs = require('./puppets.cjs');
const { pose } = require('./poses.cjs');
const { loadRig, renderFrame, OUT, CELL } = require('./render.cjs');
const { GEN } = require('./puppet.cjs');

const root = path.resolve(__dirname, '../..');
// intro clips the home behaviour still uses; the rest of the intro is choreography that
// ends before anyone can be summoned, packed apart and never loaded for an extra
const HOME_TASKS = new Set(['carry_ladder', 'place_ladder', 'hold_ladder', 'climb', 'celebrate', 'wipe']);
const PAGE = 2048;
const even = v => v + (v & 1);
const round = v => Math.round(v * 100) / 100;

function contract() {
  const groupOf = {};
  for (const atlas of base.atlases) if (atlas.variant === 'penguin') for (const c of atlas.clips) groupOf[c] = atlas.group;
  return Object.entries(base.characters.penguin).map(([clip, def]) => {
    const g = groupOf[clip];
    return { clip, def, group: g === 'intro' && HOME_TASKS.has(clip) ? 'tasks' : g };
  });
}

/** Opaque bounds of a frame, padded and even-aligned. */
async function trim(png) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) throw new Error('empty frame');
  x0 = Math.max(0, (x0 - 2) & ~1); y0 = Math.max(0, (y0 - 2) & ~1);
  const w = Math.min(info.width - x0, even(x1 - x0 + 3)), h = Math.min(info.height - y0, even(y1 - y0 + 3));
  const buf = await sharp(png).extract({ left: x0, top: y0, width: w, height: h }).png().toBuffer();
  const hash = crypto.createHash('sha256').update(await sharp(buf).raw().toBuffer()).digest('hex');
  return { buf, x: x0, y: y0, w, h, hash };
}

/** Shelf packing into as few pages as needed. */
function pack(items) {
  const pages = [];
  let page = null;
  for (const it of [...items].sort((a, b) => b.h - a.h)) {
    if (!page || (page.x + it.w > PAGE && page.y + page.row + it.h > PAGE)) {
      page = { x: 0, y: 0, row: 0, items: [], w: 0, h: 0 };
      pages.push(page);
    }
    if (page.x + it.w > PAGE) { page.x = 0; page.y += page.row; page.row = 0; }
    it.page = pages.length - 1; it.px = page.x; it.py = page.y;
    page.items.push(it);
    page.x += it.w; page.row = Math.max(page.row, it.h);
    page.w = Math.max(page.w, page.x); page.h = Math.max(page.h, page.y + page.row);
  }
  return pages;
}

async function build(person, { rebuildRig }) {
  const def = defs[person.id];
  const rig = await loadRig(person.id, def, { rebuild: rebuildRig });
  const variant = person.variant;
  const dir = path.join(GEN, person.id, 'atlases');
  fs.rmSync(dir, { recursive: true, force: true }); // stale pages must not survive a rebuild
  fs.mkdirSync(dir, { recursive: true });
  const result = { atlases: [], characters: { [variant]: {} }, referenceSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, person.reference))).digest('hex') };
  const byGroup = new Map();
  for (const c of contract()) {
    if (!byGroup.has(c.group)) byGroup.set(c.group, []);
    byGroup.get(c.group).push(c);
  }
  for (const [group, clips] of byGroup) {
    const unique = new Map(), frames = [];
    for (const { clip, def: bdef } of clips) {
      const n = bdef.frames.length;
      const names = [], anchors = [];
      for (let i = 0; i < n; i++) {
        const z = pose(clip, i, n);
        const { png, anchors: a } = await renderFrame(rig, z);
        const t = await trim(png);
        const name = `${clip}_${String(i).padStart(3, '0')}`;
        if (!unique.has(t.hash)) unique.set(t.hash, t);
        frames.push({ name, hash: t.hash, x: t.x, y: t.y, w: t.w, h: t.h, origin: bdef.origin });
        names.push(name);
        anchors.push({ frame: name, handNear: a.hn.map(round), handFar: a.hf.map(round), helmet: a.head.map(round), ground: [128, 230] });
      }
      const entry = { atlasKey: null, frames: names, frameAnchors: anchors, frameRate: bdef.frameRate, repeat: bdef.repeat, origin: bdef.origin, group, flipSafe: true };
      result.characters[variant][clip] = entry;
    }
    const pages = pack([...unique.values()]);
    for (const [pi, page] of pages.entries()) {
      const id = `${variant}_${group}_${String(pi).padStart(2, '0')}`;
      const w = even(page.w), h = even(page.h);
      const img = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite(page.items.map(it => ({ input: it.buf, left: it.px, top: it.py }))).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
      const map = { frames: {}, meta: { app: 'oziel_extra_puppet', version: '2', image: `${id}.png`, format: 'RGBA8888', size: { w, h }, scale: String(OUT / CELL) } };
      const clipsHere = new Set();
      for (const f of frames) {
        const it = unique.get(f.hash);
        if (it.page !== pi) continue;
        map.frames[f.name] = { frame: { x: it.px, y: it.py, w: it.w, h: it.h }, rotated: false, trimmed: true, spriteSourceSize: { x: f.x, y: f.y, w: f.w, h: f.h }, sourceSize: { w: OUT, h: OUT }, pivot: { x: f.origin[0], y: f.origin[1] } };
        clipsHere.add(f.name.replace(/_\d{3}$/, ''));
      }
      fs.writeFileSync(path.join(dir, `${id}.png`), img);
      fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(map));
      const rel = `ExtraPenguins/generated/${person.id}/atlases/${id}`;
      result.atlases.push({ id, png: `${rel}.png`, json: `${rel}.json`, variant, group, clips: [...clipsHere], width: w, height: h, textureScale: OUT / CELL });
      for (const c of clipsHere) result.characters[variant][c].atlasKey = id;
    }
    // a clip must live on one page (Phaser plays frames of a single texture)
    for (const { clip } of clips) {
      const e = result.characters[variant][clip];
      const pagesUsed = new Set(e.frames.map(f => unique.get(frames.find(x => x.name === f).hash).page));
      if (pagesUsed.size !== 1) throw new Error(`${variant}:${clip} repartido en varias páginas`);
    }
  }
  fs.writeFileSync(path.join(GEN, person.id, 'manifest.json'), JSON.stringify(result));
  return result;
}

async function main() {
  const only = process.argv.find(a => a.startsWith('--character='))?.split('=')[1];
  const rebuildRig = process.argv.includes('--rebuild-rig');
  for (const person of registry) {
    if (only && only !== person.id) continue;
    const t0 = Date.now();
    const r = await build(person, { rebuildRig });
    console.log(`[extras] ${person.id}: ${Object.keys(r.characters[person.variant]).length} clips, ${r.atlases.length} atlas, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  if (registry.every(p => fs.existsSync(path.join(GEN, p.id, 'manifest.json')))) {
    const all = { generatedBy: 'tools/extras/build.cjs', atlases: [], characters: {}, references: {} };
    for (const p of registry) {
      const m = JSON.parse(fs.readFileSync(path.join(GEN, p.id, 'manifest.json')));
      all.atlases.push(...m.atlases);
      Object.assign(all.characters, m.characters);
      all.references[p.id] = m.referenceSha256;
    }
    fs.writeFileSync(path.join(GEN, 'animations.json'), JSON.stringify(all));
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
