/* Review sheets made from the generated atlases (what the game loads):
 *   docs/extra_penguins/compare.png       each reference next to frames of several actions
 *   docs/extra_penguins/<id>.png          the same strip for one character, at cell size
 *   docs/extra_penguins/review/<id>.png   every action: first, middle and last frame
 *   node tools/extras/review.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const registry = require('../../src/game/extraPenguins.json');

const root = path.resolve(__dirname, '../..');
const data = require('../../assets_overrides/ExtraPenguins/generated/animations.json');
const out = path.join(root, 'docs/extra_penguins');
const maps = new Map();

/** A full 192 cell rebuilt from a trimmed frame. */
async function cell(atlasKey, name) {
  const atlas = data.atlases.find(a => a.id === atlasKey);
  if (!maps.has(atlasKey)) maps.set(atlasKey, JSON.parse(fs.readFileSync(path.join(root, 'assets_overrides', atlas.json))));
  const f = maps.get(atlasKey).frames[name];
  const piece = await sharp(path.join(root, 'assets_overrides', atlas.png)).extract({ left: f.frame.x, top: f.frame.y, width: f.frame.w, height: f.frame.h }).toBuffer();
  return sharp({ create: { width: f.sourceSize.w, height: f.sourceSize.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: piece, left: f.spriteSourceSize.x, top: f.spriteSourceSize.y }]).png().toBuffer();
}

async function sheet(file, cells, { cols, size, label = true, bg = '#d7e4dc' }) {
  const lh = label ? 15 : 0, rows = Math.ceil(cells.length / cols), w = cols * size, h = rows * (size + lh);
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const text = label ? `<svg width="${w}" height="${h}">${cells.map((c, i) => `<text x="${(i % cols) * size + 3}" y="${Math.floor(i / cols) * (size + lh) + size + 11}" font-family="Arial" font-size="10">${esc(c.label)}</text>`).join('')}</svg>` : null;
  const layers = await Promise.all(cells.map(async (c, i) => ({ input: await sharp(c.buf).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(), left: (i % cols) * size, top: Math.floor(i / cols) * (size + lh) })));
  if (text) layers.push({ input: Buffer.from(text), left: 0, top: 0 });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp({ create: { width: w, height: h, channels: 4, background: bg } }).composite(layers).png().toFile(file);
}

async function main() {
  const compare = [];
  const SHOW = [['idle', 0], ['walk', 2], ['greet', 3], ['celebrate', 2], ['fall_flap', 2], ['impact_heavy', 3], ['sit_idle', 1], ['laugh', 2], ['climb', 2]];
  for (const p of registry) {
    const clips = data.characters[p.variant];
    const strip = [{ buf: await sharp(path.join(root, p.reference)).resize(192, 192).toBuffer(), label: `${p.name} (referencia)` }];
    for (const [clip, i] of SHOW) strip.push({ buf: await cell(clips[clip].atlasKey, clips[clip].frames[i]), label: `${clip} ${i}` });
    compare.push(...strip);
    await sheet(path.join(out, `${p.id}.png`), strip, { cols: strip.length, size: 192 });
    const cells = [];
    for (const [clip, def] of Object.entries(clips)) {
      if (clip.endsWith('__right')) continue;
      const n = def.frames.length;
      for (const i of [0, Math.floor(n / 2), n - 1]) cells.push({ buf: await cell(def.atlasKey, def.frames[i]), label: `${clip} ${i}` });
    }
    await sheet(path.join(out, 'review', `${p.id}.png`), cells, { cols: 18, size: 96 });
    console.log(`[review] ${p.id}`);
  }
  await sheet(path.join(out, 'compare.png'), compare, { cols: SHOW.length + 1, size: 150 });
}
main().catch(e => { console.error(e); process.exitCode = 1; });
