/* Step 2 of the extra penguins: split each cut-out reference into puppet parts.
 *
 * The art is the user's own drawing: parts are cut from it, nothing is redrawn. A part
 * at rest sits exactly where it was, so a neutral frame is pixel-identical to the PNG.
 *   body      everything that does not move on its own (head, hair, torso, clothes)
 *   armL/armR forearm + cuff + flipper + held object, cut at the elbow along the sleeve
 *             seam; a half-ellipse of sleeve above the cut is the elbow joint, so turning
 *             it never opens a gap. Where the forearm leaves the torso, the torso gets the
 *             seam as its new outline (clipped to the original silhouette, never floating).
 *   footL/R   orange feet below the body's own bottom outline; they are drawn behind the
 *             body, and extended upward so a dangling foot never shows a cut edge.
 * Definitions per character live in puppets.cjs (cut-out pixel coordinates).
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '../..');
const GEN = path.join(root, 'assets_overrides/ExtraPenguins/generated');

async function loadCutout(id) {
  const { data, info } = await sharp(path.join(GEN, id, 'cutout.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { W: info.width, H: info.height, px: data };
}

/** Even-odd scanline fill of a polygon into a W×H mask. */
function polyMask(W, H, pts) {
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[j];
      if ((y1 > yc) !== (y2 > yc)) xs.push(x1 + ((yc - y1) * (x2 - x1)) / (y2 - y1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil(xs[k] - 0.5)), b = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = a; x <= b; x++) m[y * W + x] = 1;
    }
  }
  return m;
}

const lum = (px, i) => 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
function isOrange(px, i) {
  const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], a = px[i * 4 + 3];
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return a > 200 && r > 150 && r - b > 90 && r - g > 35 && g > 55 && (max - min) / max > 0.62;
}

/** Outline thickness and colour of the drawing (dark run lengths across the silhouette edge). */
function outlineOf(cut) {
  const { W, H, px } = cut, runs = [], ink = [0, 0, 0];
  let n = 0;
  for (let y = 0; y < H; y += 9) {
    for (let x = 1; x < W; x++) {
      const i = y * W + x;
      if (px[(i - 1) * 4 + 3] < 128 && px[i * 4 + 3] >= 128) {
        let k = 0;
        while (x + k < W && px[(i + k) * 4 + 3] >= 128 && lum(px, i + k) < 70) k++;
        if (k > 2 && k < 40) {
          runs.push(k);
          const j = i + (k >> 1);
          for (let c = 0; c < 3; c++) ink[c] += px[j * 4 + c];
          n++;
        }
        break;
      }
    }
  }
  runs.sort((a, b) => a - b);
  return { width: runs[runs.length >> 1] || 10, color: ink.map(v => Math.round(v / Math.max(1, n))) };
}

/** Feet: the two largest orange regions near the bottom, plus their own side/bottom outline. */
function findFeet(cut, outline) {
  const { W, H, px } = cut, N = W * H, zone = H - 170;
  const orange = new Uint8Array(N);
  for (let y = zone; y < H; y++) for (let x = 0; x < W; x++) if (isOrange(px, y * W + x)) orange[y * W + x] = 1;
  const label = new Int32Array(N).fill(-1), comps = [];
  for (let s = 0; s < N; s++) {
    if (!orange[s] || label[s] >= 0) continue;
    const id = comps.length, stack = [s], pts = [];
    label[s] = id;
    while (stack.length) {
      const i = stack.pop(), x = i % W, y = (i / W) | 0;
      pts.push(i);
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > zone ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j >= 0 && orange[j] && label[j] < 0) { label[j] = id; stack.push(j); }
      }
    }
    comps.push(pts);
  }
  comps.sort((a, b) => b.length - a.length);
  const feet = comps.slice(0, 2).map(pts => {
    let x0 = W, x1 = 0, y1 = 0;
    const top = new Map();
    for (const i of pts) {
      const x = i % W, y = (i / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y > y1) y1 = y;
      if (!top.has(x) || y < top.get(x)) top.set(x, y);
    }
    return { pts, x0, x1, y1, top };
  }).sort((a, b) => a.x0 - b.x0);
  const r = Math.ceil(outline.width * 1.3);
  return feet.map(f => {
    // the foot's own outline: around the orange, but never above its top edge (the dark
    // band above the orange is the body's bottom outline, drawn over the foot)
    const mask = new Uint8Array(N);
    const topAt = x => f.top.get(Math.min(f.x1, Math.max(f.x0, x)));
    for (let y = zone; y < H; y++) {
      for (let x = Math.max(0, f.x0 - r); x <= Math.min(W - 1, f.x1 + r); x++) {
        const i = y * W + x;
        if (px[i * 4 + 3] === 0 || y < topAt(x) - 1) continue;
        if (orange[i] && label[i] === label[f.pts[0]]) { mask[i] = 1; continue; }
        // dark outline pixels within r of this foot's orange
        if (lum(px, i) < 90) {
          let near = false;
          for (let dy = -r; dy <= r && !near; dy += 2) for (let dx = -r; dx <= r && !near; dx += 2) {
            const xx = x + dx, yy = y + dy;
            if (xx >= 0 && xx < W && yy >= zone && yy < H && label[yy * W + xx] === label[f.pts[0]]) near = true;
          }
          if (near) mask[i] = 1;
        }
      }
    }
    let topY = H;
    for (let x = f.x0; x <= f.x1; x++) topY = Math.min(topY, f.top.get(x) ?? H);
    return { mask, x0: f.x0 - r, x1: f.x1 + r, top: topY, bottom: f.y1 + r, pivot: [(f.x0 + f.x1) / 2, topY + 6] };
  });
}

/** Outer silhouette x on a row, walking in from the side the arm is on. */
function outerX(cut, y, side) {
  const { W, px } = cut;
  const yy = Math.max(0, Math.min(cut.H - 1, Math.round(y)));
  if (side < 0) { for (let x = 0; x < W; x++) if (px[(yy * W + x) * 4 + 3] > 128) return x; return 0; }
  for (let x = W - 1; x >= 0; x--) if (px[(yy * W + x) * 4 + 3] > 128) return x;
  return W - 1;
}

/**
 * Regions of one arm.
 *  seam arm  (sleeve hanging at the side): everything outside the sleeve seam, from the
 *            shoulder line down to the flipper end. It turns at the outer shoulder, so the
 *            armpit opens like a real flipper, and it is drawn behind the torso.
 *  piece arm (holding something in front): explicit outline, drawn in front of the torso.
 */
function armRegions(cut, arm) {
  const { W, H } = cut;
  const FAR = arm.side * 4000;
  let outline, pivot, top = null;
  if (arm.seam) {
    const s = arm.seam, a = s[0], z = s[s.length - 1];
    outline = [...s, [z[0] + FAR, z[1]], [a[0] + FAR, a[1]]];
    const ox = outerX(cut, a[1] + 2, arm.side), width = Math.abs(a[0] - ox);
    pivot = arm.pivot ?? [ox + arm.side * -0.3 * width, a[1] + 0.18 * width];
    top = [a, [ox, a[1]]];
  } else {
    outline = arm.piece;
    pivot = arm.pivot;
  }
  const region = polyMask(W, H, outline);
  const hair = arm.hair ? polyMask(W, H, arm.hair) : null;
  const extras = (arm.extras ?? []).map(e => ({ ...e, mask: polyMask(W, H, e.poly) }));
  return { region, hair, extras, pivot, top, layer: arm.layer ?? (arm.seam ? 'back' : 'front') };
}

/** Fill removed pixels from their nearest kept neighbours in 4 directions (flat garments),
 * or only left/right (`rows`), which keeps horizontal bands such as face over hoodie. */
function diffuseFill(cut, hole, keep, alpha, rows = false) {
  const { W, H, px } = cut;
  const src = Buffer.from(px);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!hole[i]) continue;
    let wsum = 0;
    const acc = [0, 0, 0];
    for (const [ddx, ddy] of rows ? [[1, 0], [-1, 0]] : [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let xx = x, yy = y, d = 0;
      while (true) {
        xx += ddx; yy += ddy; d++;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || d > 400) { d = -1; break; }
        const j = yy * W + xx;
        if (!hole[j] && keep[j]) break;
      }
      if (d < 0) continue;
      const j = (y + ddy * d) * W + (x + ddx * d), w = 1 / (d * d);
      for (let c = 0; c < 3; c++) acc[c] += src[j * 4 + c] * w;
      wsum += w;
    }
    if (!wsum) continue;
    for (let c = 0; c < 3; c++) px[i * 4 + c] = Math.round(acc[c] / wsum);
    px[i * 4 + 3] = alpha ? alpha[i * 4 + 3] : 255;
  }
}

/** Rasterise outline strokes and paint them only inside `clip` (the original silhouette). */
async function paintStrokes(cut, paths, outline, clip) {
  const { W, H, px } = cut;
  if (!paths.length) return;
  const d = paths.map(p => 'M' + p.map(q => q.join(' ')).join('L')).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><path d="${d}" fill="none" stroke="rgb(${outline.color.join(',')})" stroke-width="${outline.width}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < W * H; i++) {
    const a = (data[i * 4 + 3] / 255) * (clip[i] ? 1 : 0);
    if (!a) continue;
    const ba = px[i * 4 + 3] / 255, oa = a + ba * (1 - a);
    for (let c = 0; c < 3; c++) px[i * 4 + c] = Math.round((data[i * 4 + c] * a + px[i * 4 + c] * ba * (1 - a)) / oa);
    px[i * 4 + 3] = Math.round(oa * 255);
  }
}

/** Square dilation of a predicate by r pixels (separable max filter). */
function dilate(W, H, pred, r) {
  const a = new Uint8Array(W * H), b = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) a[i] = pred(i) ? 1 : 0;
  for (let y = 0; y < H; y++) {
    let run = -1e9;
    for (let x = 0; x < W; x++) { if (a[y * W + x]) run = x; if (x - run <= r) b[y * W + x] = 1; }
    run = 1e9;
    for (let x = W - 1; x >= 0; x--) { if (a[y * W + x]) run = x; if (run - x <= r) b[y * W + x] = 1; }
  }
  const c = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    let run = -1e9;
    for (let y = 0; y < H; y++) { if (b[y * W + x]) run = y; if (y - run <= r) c[y * W + x] = 1; }
    run = 1e9;
    for (let y = H - 1; y >= 0; y--) { if (b[y * W + x]) run = y; if (run - y <= r) c[y * W + x] = 1; }
  }
  return c;
}

function layer(W, H) { return { W, H, px: Buffer.alloc(W * H * 4) }; }
function copyMasked(dst, src, mask) {
  for (let i = 0; i < src.W * src.H; i++) if (mask[i]) for (let c = 0; c < 4; c++) dst.px[i * 4 + c] = src.px[i * 4 + c];
}

/** Build every part of one character. Returns raw layers plus rig metadata. */
async function buildParts(id, def) {
  const cut = await loadCutout(id);
  const { W, H, px } = cut;
  const N = W * H;
  const outline = def.outline ?? outlineOf(cut);
  const original = new Uint8Array(N);
  for (let i = 0; i < N; i++) original[i] = px[i * 4 + 3] > 0 ? 1 : 0;
  const body = { W, H, px: Buffer.from(px) };
  const removed = new Uint8Array(N);
  const arms = {}, strokes = [];
  for (const key of ['armL', 'armR']) {
    const arm = def[key];
    if (!arm) continue;
    const r = armRegions(cut, arm);
    const part = layer(W, H), pieceMask = new Uint8Array(N), hairHole = new Uint8Array(N);
    // which pixels inside `hair` are hair: dark hair over a light sleeve by default; with
    // hairTone 'warm', orange/brown locks and their white shine over a dark sleeve, plus
    // their own ink outline
    let isHair = i => lum(px, i) < 120;
    if (r.hair && arm.hairTone === 'warm') {
      const warm = i => px[i * 4 + 3] > 0 && ((px[i * 4] - px[i * 4 + 2] > 40 && px[i * 4] > 80) || lum(px, i) > 170);
      const near = dilate(W, H, i => r.hair[i] && warm(i), Math.ceil(outline.width));
      isHair = i => near[i] === 1;
    }
    for (let i = 0; i < N; i++) {
      if (!px[i * 4 + 3]) continue;
      let inArm = r.region[i];
      for (const e of r.extras) if (e.mask[i]) inArm = 1;
      if (!inArm) continue;
      // hair falling over the sleeve stays with the head, in front; the sleeve under it is
      // completed from the sleeve's own colours
      if (r.hair && r.hair[i] && isHair(i)) { hairHole[i] = 1; pieceMask[i] = 1; continue; }
      pieceMask[i] = 1;
      removed[i] = 1;
    }
    copyMasked(part, cut, pieceMask);
    if (r.hair) {
      const keep = new Uint8Array(N);
      for (let i = 0; i < N; i++) keep[i] = pieceMask[i] && !hairHole[i] ? 1 : 0;
      diffuseFill(part, hairHole, keep, px);
    }
    // a full outline along the seam on both sides of the cut
    if (arm.seam) {
      await paintStrokes(part, [arm.seam], outline, pieceMask);
      strokes.push(arm.seam);
    } else if (arm.seamStroke) {
      await paintStrokes(part, [arm.seamStroke], outline, pieceMask);
      strokes.push(arm.seamStroke);
    }
    for (const e of r.extras) if (e.stroke) strokes.push(e.stroke);
    arms[key] = { part, pivot: r.pivot, top: r.top, layer: r.layer, tip: arm.tip, region: r };
  }
  const feet = findFeet(cut, outline);
  const footParts = feet.map(f => {
    const part = layer(W, H);
    copyMasked(part, cut, f.mask);
    for (let i = 0; i < N; i++) if (f.mask[i]) removed[i] = 1;
    // extend each foot upward behind the body by repeating its top pixel per column
    const ext = def.footExtend ?? 60;
    for (let x = f.x0; x <= f.x1; x++) {
      let y = f.top;
      while (y < f.bottom && !f.mask[y * W + x]) y++;
      if (y >= f.bottom) continue;
      const i = y * W + x;
      for (let k = 1; k <= ext && y - k >= 0; k++) {
        const j = (y - k) * W + x;
        for (let c = 0; c < 4; c++) part.px[j * 4 + c] = part.px[i * 4 + c];
      }
    }
    return { part, pivot: f.pivot, box: [f.x0, f.top - (def.footExtend ?? 60), f.x1, f.bottom] };
  });
  for (let i = 0; i < N; i++) if (removed[i]) body.px[i * 4 + 3] = 0;
  // where a stroke may go: inside the original silhouette and touching what is left of the
  // body (an outline along a flipper that is gone would float in the air)
  const reach = Math.ceil(outline.width / 2) + 2;
  const nearBody = dilate(W, H, i => body.px[i * 4 + 3] > 0, reach);
  const clip = new Uint8Array(N);
  for (let i = 0; i < N; i++) clip[i] = original[i] && nearBody[i] ? 1 : 0;
  // torso areas that were under a moving piece and lie inside the body
  for (const f of def.fills ?? []) {
    const m = polyMask(W, H, f.poly), hole = new Uint8Array(N), keep = new Uint8Array(N);
    // only where the drawing had something: gaps between locks or around the piece stay empty
    for (let i = 0; i < N; i++) { hole[i] = m[i] && removed[i] && px[i * 4 + 3] > 0 ? 1 : 0; keep[i] = body.px[i * 4 + 3] === 255 ? 1 : 0; }
    diffuseFill(body, hole, keep, px, f.rows);
    if (f.stroke) strokes.push(f.stroke);
  }
  await paintStrokes(body, strokes, outline, clip);
  // ground point: bottom centre of the feet
  const ground = footParts.length ? [(footParts[0].pivot[0] + footParts[footParts.length - 1].pivot[0]) / 2, Math.max(...footParts.map(f => f.box[3]))] : [W / 2, H];
  return { id, W, H, outline, body, arms, feet: footParts, ground, original };
}

async function savePng(l, file) {
  await sharp(l.px, { raw: { width: l.W, height: l.H, channels: 4 } }).png().toFile(file);
}

module.exports = { loadCutout, polyMask, buildParts, savePng, outlineOf, GEN };
