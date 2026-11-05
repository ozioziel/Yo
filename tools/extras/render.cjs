/* Step 3 of the extra penguins: pose the puppet parts and rasterise game cells.
 * The identities are scaled so their penguin body (not the hair) is as big as a base
 * penguin, so hair and raised flippers need more room than the base 256 cell: their
 * cells are 320×320 logical units with the feet at the same fraction (0.9 → y=288),
 * centred on x=160. The game positions sprites by that fraction, so nothing changes for
 * it; anchors are written in the base 256-cell convention (feet 128,230.4).
 * Cells are rasterised at OUT px (textureScale OUT/CELL); the runtime scales back.
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { buildParts, loadCutout, GEN } = require('./puppet.cjs');

sharp.cache({ memory: 64, files: 0, items: 64 });
sharp.concurrency(1);

/** Cut-out px → cell units at which a reference fits a base cell; × bodyScale (registry). */
const FIT = 0.172;
const CELL = 320, FEET = 288, MID = 160, OUT = 240, SUPER = 2;
/** Base cell convention for anchors: feet at (128, 230.4). */
const toBase = ([x, y]) => [x - (MID - 128), y - (FEET - 230.4)];
const INK = '#080c0b', UMBRELLA = '#668681';

async function crop(l, scale) {
  const { W, H, px } = l;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  // parts are stored at 1.5× the size they are rasterised at: sharp, and light to embed
  const k = scale * (OUT / CELL) * SUPER * 1.5;
  const png = await sharp(px, { raw: { width: W, height: H, channels: 4 } }).extract({ left: x0, top: y0, width: w, height: h })
    .resize(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)), { kernel: 'lanczos3' }).png().toBuffer();
  return { x: x0, y: y0, w, h, href: `data:image/png;base64,${png.toString('base64')}` };
}

/** Skin colour around an eye: the light pixels just outside it, averaged. */
function skinAround(cut, e) {
  const { W, px } = cut, acc = [0, 0, 0];
  let n = 0;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const x = Math.round(e.c[0] + Math.cos(a) * (e.r[0] + 8)), y = Math.round(e.c[1] + Math.sin(a) * (e.r[1] + 8));
    const i = (y * W + x) * 4;
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    if (px[i + 3] < 250 || lum < 90) continue;
    for (let c = 0; c < 3; c++) acc[c] += px[i + c];
    n++;
  }
  return n ? `rgb(${acc.map(v => Math.round(v / n)).join(',')})` : '#e8e8e8';
}

/** Build (or load) the rig of one character: cropped parts + pivots, cached on disk. */
async function loadRig(id, def, { rebuild = false } = {}) {
  const dir = path.join(GEN, id, 'rig');
  const file = path.join(dir, 'rig.json');
  const person = require('../../src/game/extraPenguins.json').find(p => p.id === id);
  const scale = FIT * (person?.bodyScale ?? 1);
  if (!rebuild && fs.existsSync(file)) {
    const cached = JSON.parse(fs.readFileSync(file));
    if (cached.scale === scale && cached.cell === CELL) return cached;
  }
  const p = await buildParts(id, def);
  const cut = await loadCutout(id);
  const rig = { id, W: p.W, H: p.H, scale, cell: CELL, bodyScale: person?.bodyScale ?? 1, ground: p.ground, outline: p.outline, parts: {} };
  rig.eyes = (def.eyes ?? []).map(e => ({ ...e, skin: skinAround(cut, e) }));
  rig.parts.body = await crop(p.body, scale);
  for (const [k, a] of Object.entries(p.arms)) {
    const src = def[k];
    rig.parts[k] = { ...(await crop(a.part, scale)), pivot: a.pivot, top: a.top, layer: a.layer, tip: a.tip, gain: src.gain ?? 1, both: !!src.both, lift: src.lift ?? 0 };
  }
  for (const [i, f] of p.feet.entries()) rig.parts[i ? 'footR' : 'footL'] = { ...(await crop(f.part, scale)), pivot: f.pivot };
  // the top of the drawing (hair), for the head anchor
  let top = p.H;
  for (let y = 0; y < p.H && top === p.H; y++) for (let x = 0; x < p.W; x++) if (p.original[y * p.W + x]) { top = y; break; }
  rig.headTop = [p.ground[0], top];
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(rig));
  return rig;
}

const f2 = n => Math.round(n * 1000) / 1000;
const img = part => `<image x="${part.x}" y="${part.y}" width="${part.w}" height="${part.h}" preserveAspectRatio="none" href="${part.href}"/>`;

/** Matrix helpers (SVG order: [a b c d e f]). */
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const T = (x, y) => [1, 0, 0, 1, x, y];
const S = (sx, sy = sx) => [sx, 0, 0, sy, 0, 0];
const R = deg => { const a = (deg * Math.PI) / 180; return [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]; };
const about = (m, [x, y]) => mul(T(x, y), mul(m, T(-x, -y)));
const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const mat = m => `matrix(${m.map(f2).join(' ')})`;

/** Eyes drawn over the original ones: blink, closed, happy (^ ^) or surprised. */
function eyesSvg(rig, z) {
  if (!rig.eyes.length) return '';
  const w = Math.max(5, rig.outline.width * 0.6);
  const open = z.eye ?? 1, big = z.big ?? 0;
  return rig.eyes.map(e => {
    const [cx, cy] = e.c, [rx, ry] = e.r;
    if (z.happy) {
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx + 5}" ry="${ry + 5}" fill="${e.skin}"/><path d="M ${cx - rx * 1.2} ${cy + ry * 0.35} Q ${cx} ${cy - ry * 0.95} ${cx + rx * 1.2} ${cy + ry * 0.35}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/>`;
    }
    if (open < 0.85) {
      const cover = `<ellipse cx="${cx}" cy="${cy}" rx="${rx + 5}" ry="${ry + 5}" fill="${e.skin}"/>`;
      if (open <= 0.35) return cover + `<path d="M ${cx - rx * 1.2} ${cy - ry * 0.05} Q ${cx} ${cy + ry * 0.85} ${cx + rx * 1.2} ${cy - ry * 0.05}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/>`;
      const h = ry * open, top = cy + ry - 2 * h;
      return cover + `<ellipse cx="${cx}" cy="${cy + ry - h}" rx="${rx}" ry="${h}" fill="${INK}"/><path d="M ${cx - rx * 1.25} ${top} L ${cx + rx * 1.25} ${top}" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/>`;
    }
    if (big > 0.05) {
      const k = 1 + 0.75 * big;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx * k + 4}" ry="${ry * k + 4}" fill="#fbfbf7" stroke="${INK}" stroke-width="${w * 0.8}"/><ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.95}" ry="${ry * 0.95}" fill="${INK}"/><ellipse cx="${cx - rx * 0.3}" cy="${cy - ry * 0.35}" rx="${rx * 0.25}" ry="${ry * 0.25}" fill="#ffffff"/>`;
    }
    return '';
  }).join('');
}

/** Hand props in cell units, drawn at the flipper's end (k: the identity's body scale). */
function propSvg(prop, at, k) {
  const [x, y] = at;
  if (prop.kind === 'snowball') {
    const r = 8 * k * (prop.r ?? 1);
    return `<circle cx="${f2(x)}" cy="${f2(y - r * 0.6)}" r="${f2(r)}" fill="#f8fbff" stroke="${INK}" stroke-width="2"/><path d="M ${f2(x - r * 0.4)} ${f2(y - r)} q ${f2(r * 0.3)} ${f2(-r * 0.3)} ${f2(r * 0.6)} 0" fill="none" stroke="#c9d8e6" stroke-width="1.4"/>`;
  }
  if (prop.kind === 'umbrella') {
    const open = 0.16 + 0.84 * (prop.open ?? 1), top = y - 62 * k;
    return `<path d="M ${f2(x)} ${f2(y + 4)} L ${f2(x)} ${f2(top)}" stroke="${INK}" stroke-width="${f2(2.6 * k)}" stroke-linecap="round"/>` +
      `<g transform="translate(${f2(x)} ${f2(top)}) scale(${f2(open * 0.9 * k)} ${f2(0.9 * k)})"><path d="M-65 0Q-46 -42 0 -45Q46 -42 65 0Q48 -13 33 0Q17 -13 0 0Q-17 -13 -33 0Q-49 -13 -65 0Z" fill="${UMBRELLA}" stroke="${INK}" stroke-width="3"/><path d="M-33 0Q-28 -31 0 -45Q28 -31 33 0" fill="none" stroke="${INK}" stroke-width="1.3"/><path d="M0 -45L0 0" stroke="${INK}" stroke-width="1.3"/></g>`;
  }
  return '';
}

/**
 * z (from poses.cjs): body {dx,dy,rot,sx,sy,jump}, L/R flipper raises, footL/footR {dx,dy,rot},
 * spin, air, eye/big/happy, props. Returns the SVG and anchors in logical cell units.
 */
function frameSvg(rig, z = {}) {
  const g = rig.ground;
  let world = mul(T(MID, FEET), mul(S(rig.scale), T(-g[0], -g[1])));
  if (z.spin) world = mul(about(R(z.spin), [MID, FEET - (rig.H * rig.scale) / 2]), world);
  // aerial clips: the game shows them with the origin at 46/256 of the cell height and
  // scaled by 1/0.87 (base rig contract). Draw them so that comes back to the standing size.
  if (z.air) world = mul(mul(T(MID, (46 / 256) * CELL), mul(S(0.87), T(-MID, -(FEET - (230.4 - 46))))), world);
  const b = z.body ?? {};
  const bodyM = mul(T(b.dx ?? 0, b.dy ?? 0), about(mul(R(b.rot ?? 0), S(b.sx ?? 1, b.sy ?? 1)), g));
  const full = mul(world, bodyM);
  const parts = [];
  // planted feet stay on the ground (a jump lifts them); in the air they follow the body
  const feetBase = z.air ? full : mul(world, T(0, b.jump ?? 0));
  for (const k of ['footL', 'footR']) {
    const f = rig.parts[k];
    if (!f) continue;
    const p = z[k] ?? {};
    const m = mul(feetBase, mul(T(p.dx ?? 0, p.dy ?? 0), about(R(p.rot ?? 0), f.pivot)));
    parts.push(`<g transform="${mat(m)}">${img(f)}</g>`);
  }
  const anchors = {};
  const raise = { armL: z.L ?? 0, armR: -(z.R ?? 0) };
  const arm = k => {
    const a = rig.parts[k];
    if (!a) return '';
    let ang = raise[k];
    let lift = 0;
    if (a.both) ang = ((z.L ?? 0) + (z.R ?? 0)) / 2;
    if (a.lift) lift = -a.lift * Math.max(-0.5, Math.min(1.5, ang / 90));
    ang *= a.gain ?? 1;
    const m = mul(full, mul(T(0, lift), about(R(ang), a.pivot)));
    anchors[k] = apply(m, a.tip);
    // the shoulder cut gets its outline as the flipper turns (invisible at rest)
    const op = Math.min(1, Math.abs(ang) / 20);
    const cap = a.top && op > 0.02
      ? `<path d="M ${a.top.map(q => q.map(f2).join(' ')).join(' L ')}" fill="none" stroke="rgb(${rig.outline.color.join(',')})" stroke-opacity="${f2(op)}" stroke-width="${rig.outline.width}" stroke-linecap="round"/>`
      : '';
    return `<g transform="${mat(m)}">${img(a)}${cap}</g>`;
  };
  // flippers hanging at the side turn behind the torso; held objects stay in front
  for (const k of ['armL', 'armR']) if (rig.parts[k]?.layer === 'back') parts.push(arm(k));
  parts.push(`<g transform="${mat(full)}">${img(rig.parts.body)}${eyesSvg(rig, z)}</g>`);
  for (const k of ['armL', 'armR']) if (rig.parts[k] && rig.parts[k].layer !== 'back') parts.push(arm(k));
  anchors.head = apply(full, rig.headTop);
  // the acting flipper is the right one when it is free (Tats, Shadow hold things in the left)
  anchors.hn = anchors.armR ?? anchors.armL ?? anchors.head;
  anchors.hf = anchors.armL ?? anchors.hn;
  const props = (z.props ?? []).map(pr => propSvg(pr, pr.hand === 'armL' ? anchors.hf : anchors.hn, rig.bodyScale)).join('');
  for (const k of ['hn', 'hf', 'head']) anchors[k] = toBase(anchors[k]);
  const size = OUT * SUPER;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${CELL} ${CELL}">${parts.join('')}${props}</svg>`;
  return { svg, anchors };
}

async function renderFrame(rig, z) {
  const { svg, anchors } = frameSvg(rig, z);
  const png = await sharp(Buffer.from(svg)).resize(OUT, OUT, { kernel: 'lanczos3' }).png().toBuffer();
  return { png, anchors };
}

module.exports = { loadRig, renderFrame, frameSvg, CELL, OUT };
