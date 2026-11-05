/* Step 1 of the extra penguins: cut each reference PNG out of its light background.
 * The references are never modified. Output: generated/<id>/cutout.png (RGBA, cropped to
 * the character) and cutout.json (crop box in reference pixels).
 *
 * Background = pixels close to the paper colour that are reachable from the image border.
 * The thick dark outline closes every shape, so white clothes inside it are kept. Border
 * pixels get alpha from how dark they are (antialiased outline over the paper) and take the
 * outline colour, so there is no light halo on the game background.
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '../..');
const registry = require('../../src/game/extraPenguins.json');
const outDir = path.join(root, 'assets_overrides/ExtraPenguins/generated');

async function cutout(person) {
  const { data, info } = await sharp(path.join(root, person.reference)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  // paper colour: median of the border
  const border = [];
  for (let x = 0; x < W; x += 7) border.push(x, x + (H - 1) * W);
  for (let y = 0; y < H; y += 7) border.push(y * W, y * W + W - 1);
  const med = c => border.map(i => data[i * 3 + c]).sort((a, b) => a - b)[border.length >> 1];
  const bg = [med(0), med(1), med(2)];
  const dist = i => Math.hypot(data[i * 3] - bg[0], data[i * 3 + 1] - bg[1], data[i * 3 + 2] - bg[2]);
  const lum = i => 0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2];

  // flood the paper from the border
  const paper = new Uint8Array(N);
  const queue = new Int32Array(N);
  let head = 0, tail = 0;
  const push = i => { if (!paper[i] && dist(i) < 20) { paper[i] = 1; queue[tail++] = i; } };
  for (let x = 0; x < W; x++) { push(x); push(x + (H - 1) * W); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (head < tail) {
    const i = queue[head++], x = i % W, y = (i / W) | 0;
    if (x > 0) push(i - 1);
    if (x < W - 1) push(i + 1);
    if (y > 0) push(i - W);
    if (y < H - 1) push(i + W);
  }

  // keep the character: the largest connected non-paper component (drops stray marks)
  const comp = new Int32Array(N).fill(-1);
  const sizes = [];
  for (let s = 0; s < N; s++) {
    if (paper[s] || comp[s] >= 0) continue;
    const id = sizes.length;
    let h = 0, t = 0, n = 0;
    queue[t++] = s; comp[s] = id;
    while (h < t) {
      const i = queue[h++], x = i % W, y = (i / W) | 0; n++;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j >= 0 && !paper[j] && comp[j] < 0) { comp[j] = id; queue[t++] = j; }
      }
    }
    sizes.push(n);
  }
  const main = sizes.indexOf(Math.max(...sizes));

  // outline colour: darkest tenth of the character's edge pixels
  const rgba = Buffer.alloc(N * 4);
  const edge = [];
  for (let i = 0; i < N; i++) {
    if (comp[i] !== main) continue;
    const x = i % W, y = (i / W) | 0;
    const nearPaper = (x > 0 && paper[i - 1]) || (x < W - 1 && paper[i + 1]) || (y > 0 && paper[i - W]) || (y < H - 1 && paper[i + W]);
    if (nearPaper) edge.push(i);
  }
  const darkest = edge.slice().sort((a, b) => lum(a) - lum(b)).slice(0, Math.max(1, edge.length / 10 | 0));
  const ink = [0, 1, 2].map(c => Math.round(darkest.reduce((s, i) => s + data[i * 3 + c], 0) / darkest.length));
  const inkLum = 0.299 * ink[0] + 0.587 * ink[1] + 0.114 * ink[2];
  const bgLum = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2];
  const edgeSet = new Uint8Array(N);
  edge.forEach(i => (edgeSet[i] = 1));

  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let i = 0; i < N; i++) {
    if (comp[i] !== main) continue;
    let a = 255, r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    if (edgeSet[i]) {
      // antialiased outline over the paper: unmix it into outline colour + coverage
      const k = Math.min(1, Math.max(0, (bgLum - lum(i)) / (bgLum - inkLum)));
      a = Math.round(255 * Math.min(1, k * 1.15));
      [r, g, b] = ink;
    }
    if (a === 0) continue;
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
    const x = i % W, y = (i / W) | 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const pad = 4;
  const box = { left: Math.max(0, minX - pad), top: Math.max(0, minY - pad) };
  box.width = Math.min(W, maxX + pad + 1) - box.left;
  box.height = Math.min(H, maxY + pad + 1) - box.top;
  const dir = path.join(outDir, person.id);
  fs.mkdirSync(dir, { recursive: true });
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).extract(box).png().toFile(path.join(dir, 'cutout.png'));
  const dropped = sizes.filter((n, i) => i !== main);
  const meta = { reference: person.reference, size: [W, H], box, paper: bg, ink, droppedComponents: dropped.length, droppedPixels: dropped.reduce((s, n) => s + n, 0) };
  fs.writeFileSync(path.join(dir, 'cutout.json'), JSON.stringify(meta, null, 2));
  return meta;
}

async function main() {
  const only = process.argv.find(a => a.startsWith('--character='))?.split('=')[1];
  for (const person of registry) {
    if (only && only !== person.id) continue;
    const meta = await cutout(person);
    console.log(person.id, JSON.stringify(meta.box), 'dropped', meta.droppedComponents, meta.droppedPixels);
  }
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { cutout };
