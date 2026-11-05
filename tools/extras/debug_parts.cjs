/* Authoring aid: tints each moving part over the cut-out and draws cuts, seams and pivots.
 *   node tools/extras/debug_parts.cjs [id] [out.png]
 */
const path = require('node:path');
const sharp = require('sharp');
const { buildParts } = require('./puppet.cjs');
const defs = require('./puppets.cjs');

async function overlay(id) {
  const def = defs[id];
  const p = await buildParts(id, def);
  const { W, H } = p;
  const tint = Buffer.alloc(W * H * 4);
  const paint = (mask, rgb, a) => { for (let i = 0; i < W * H; i++) if (mask(i)) { tint[i * 4] = rgb[0]; tint[i * 4 + 1] = rgb[1]; tint[i * 4 + 2] = rgb[2]; tint[i * 4 + 3] = a; } };
  for (const [key, arm] of Object.entries(p.arms)) {
    const r = arm.region;
    paint(i => r.region[i] && p.original[i], key === 'armL' ? [230, 40, 40] : [40, 90, 230], 110);
    if (r.hair) paint(i => r.region[i] && r.hair[i] && p.original[i], [240, 200, 0], 120);
    for (const e of r.extras) paint(i => e.mask[i] && p.original[i], [200, 0, 200], 110);
  }
  p.feet.forEach(f => paint(i => f.part.px[i * 4 + 3] > 0 && p.original[i], [20, 180, 60], 120));
  const lines = [];
  for (const k of ['armL', 'armR']) {
    const a = def[k];
    if (!a) continue;
    if (a.seam) lines.push(`<polyline points="${a.seam.map(q => q.join(',')).join(' ')}" fill="none" stroke="#ff00aa" stroke-width="3"/>`);
    if (a.piece) lines.push(`<polygon points="${a.piece.map(q => q.join(',')).join(' ')}" fill="none" stroke="#ff00aa" stroke-width="3"/>`);
    const pv = p.arms[k].pivot;
    lines.push(`<circle cx="${pv[0]}" cy="${pv[1]}" r="9" fill="#00e5ff" stroke="#000"/>`, `<circle cx="${a.tip[0]}" cy="${a.tip[1]}" r="9" fill="#ffee00" stroke="#000"/>`);
  }
  p.feet.forEach(f => lines.push(`<circle cx="${f.pivot[0]}" cy="${f.pivot[1]}" r="9" fill="#22ff66" stroke="#000"/>`));
  const svg = Buffer.from(`<svg width="${W}" height="${H}">${lines.join('')}</svg>`);
  const cut = await sharp(path.join(__dirname, '../../assets_overrides/ExtraPenguins/generated', id, 'cutout.png')).toBuffer();
  return sharp({ create: { width: W, height: H, channels: 4, background: '#dfe8e2' } })
    .composite([{ input: cut }, { input: tint, raw: { width: W, height: H, channels: 4 } }, { input: svg }]).png().toBuffer();
}

async function main() {
  const [id, out] = process.argv.slice(2);
  const ids = id && id !== 'all' ? [id] : Object.keys(defs);
  const S = 300;
  const tiles = [];
  for (const k of ids) tiles.push(await sharp(await overlay(k)).resize(S, Math.round(S * 1.4), { fit: 'contain', background: '#ffffff' }).toBuffer());
  const cols = Math.min(4, tiles.length);
  await sharp({ create: { width: cols * S, height: Math.ceil(tiles.length / cols) * Math.round(S * 1.4), channels: 4, background: '#fff' } })
    .composite(tiles.map((b, i) => ({ input: b, left: (i % cols) * S, top: Math.floor(i / cols) * Math.round(S * 1.4) }))).png().toFile(out);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
