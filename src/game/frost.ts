/**
 * Snow and icicles that follow the real top contour of each letter.
 * Works on any rendered glyph image (HTML title via canvas, Phaser Text canvases):
 * it scans the alpha mask column by column, finds the "roofs" (flat-ish tops) and
 * draws a cartoon snow cap on them, with a few icicles where a roof ends.
 */
export interface FrostOptions {
  em: number; // font size in the same pixel units as the mask
  thickness?: number; // cap thickness in em
  icicles?: boolean;
  seed?: number;
}

const INK = '#080c0b';

export function drawFrost(ctx: CanvasRenderingContext2D, mask: ImageData, offsetY: number, opts: FrostOptions) {
  const { width: w, height: h, data } = mask;
  const em = opts.em;
  const thick = (opts.thickness ?? 0.075) * em;
  // 1. top contour per column
  const top = new Float32Array(w).fill(-1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (data[(y * w + x) * 4 + 3] > 140) {
        top[x] = y;
        break;
      }
    }
  }
  // 2. smooth and find roof runs (not steep, not empty)
  const smooth = new Float32Array(w).fill(-1);
  const k = Math.max(2, Math.round(em * 0.03));
  for (let x = 0; x < w; x++) {
    if (top[x] < 0) continue;
    let s = 0;
    let n = 0;
    for (let d = -k; d <= k; d++) {
      const v = top[x + d];
      if (v !== undefined && v >= 0) {
        s += v;
        n++;
      }
    }
    smooth[x] = s / n;
  }
  const maxSlope = 1.15;
  const runs: [number, number][] = [];
  let start = -1;
  for (let x = 0; x <= w; x++) {
    let ok = x < w && smooth[x] >= 0;
    if (ok) {
      const a = smooth[Math.max(0, x - k)];
      const b = smooth[Math.min(w - 1, x + k)];
      ok = a >= 0 && b >= 0 && Math.abs(b - a) / (2 * k) < maxSlope;
    }
    if (ok && start < 0) start = x;
    if (!ok && start >= 0) {
      if (x - start > em * 0.1) runs.push([start, x - 1]);
      start = -1;
    }
  }
  // 3. draw each cap
  let seed = opts.seed ?? 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const [x0, x1] of runs) {
    const len = x1 - x0;
    const phase = rnd() * Math.PI * 2;
    const lumps = Math.max(1, Math.round(len / (em * 0.13)));
    const upper: [number, number][] = [];
    const lower: [number, number][] = [];
    const step = Math.max(1, Math.round(len / 60));
    for (let x = x0; x <= x1; x += step) {
      const u = (x - x0) / Math.max(1, len);
      // even thickness with rounded ends, and a soft scalloped (puffy) top
      const env = Math.sqrt(Math.min(1, Math.sin(Math.PI * Math.min(1, Math.max(0, u))) * 2.4));
      const lump = 0.82 + 0.26 * Math.abs(Math.sin(u * lumps * Math.PI + phase));
      const t = smooth[x] + offsetY;
      upper.push([x, t - thick * env * lump]);
      lower.push([x, t + em * 0.035 * env]);
    }
    upper.push([x1, smooth[x1] + offsetY]);
    // drips on the lower edge
    const drips = Math.max(1, Math.round(len / (em * 0.3)));
    const path = new Path2D();
    path.moveTo(upper[0][0], upper[0][1]);
    for (const [x, y] of upper) path.lineTo(x, y);
    for (let i = lower.length - 1; i >= 0; i--) {
      const [x, y] = lower[i];
      const u = i / Math.max(1, lower.length - 1);
      const near = Math.abs(((u * drips) % 1) - 0.5) < 0.12 && u > 0.1 && u < 0.9;
      path.lineTo(x, y + (near ? em * 0.035 : 0));
    }
    path.closePath();
    ctx.fillStyle = '#f5fbff';
    ctx.fill(path);
    ctx.lineWidth = Math.max(1.2, em * 0.03);
    ctx.strokeStyle = INK;
    ctx.stroke(path);
    // soft blue shade under the top edge
    ctx.beginPath();
    for (let i = 0; i < lower.length; i++) {
      const [x, y] = lower[i];
      if (i === 0) ctx.moveTo(x, y - em * 0.02);
      else ctx.lineTo(x, y - em * 0.02);
    }
    ctx.lineWidth = Math.max(1, em * 0.022);
    ctx.strokeStyle = 'rgba(150, 200, 225, 0.85)';
    ctx.stroke();
    // icicles where the roof ends
    if (opts.icicles !== false) {
      const spots = [x0 + em * 0.04, x1 - em * 0.04];
      if (len > em * 0.45) spots.push(x0 + len * (0.4 + rnd() * 0.2));
      for (const sx of spots) {
        const xi = Math.round(Math.min(x1, Math.max(x0, sx)));
        const y = smooth[xi] + offsetY + em * 0.02;
        const lenI = em * (0.1 + rnd() * 0.09);
        const wI = em * 0.035;
        const ic = new Path2D();
        ic.moveTo(xi - wI, y);
        ic.quadraticCurveTo(xi - wI * 0.4, y + lenI * 0.6, xi, y + lenI);
        ic.quadraticCurveTo(xi + wI * 0.4, y + lenI * 0.6, xi + wI, y);
        ic.closePath();
        ctx.fillStyle = '#c4e8f6';
        ctx.fill(ic);
        ctx.lineWidth = Math.max(1, em * 0.022);
        ctx.strokeStyle = INK;
        ctx.stroke(ic);
      }
    }
  }
  ctx.restore();
}
