/* Review aid: one row per character with frames from representative clips.
 *   node tools/extras/pose_test.cjs out.png [ids,comma,separated|all] [--rebuild]
 */
const sharp = require('sharp');
const defs = require('./puppets.cjs');
const { pose } = require('./poses.cjs');
const { loadRig, renderFrame } = require('./render.cjs');

const SAMPLES = [['idle', 0, 6], ['walk', 2, 8], ['walk', 6, 8], ['greet', 3, 6], ['celebrate', 2, 6], ['fall_normal', 1, 8], ['fall_spin', 4, 12], ['impact_heavy', 3, 8], ['sit_idle', 1, 4], ['laugh', 2, 6], ['scared', 3, 4], ['climb', 2, 8], ['hide_rain', 1, 6], ['throw_snowball', 3, 8], ['swim', 2, 8], ['sleep', 1, 8]];

async function main() {
  const out = process.argv[2];
  const arg = process.argv[3];
  const ids = arg && !arg.startsWith('--') && arg !== 'all' ? arg.split(',') : Object.keys(defs);
  const rebuild = process.argv.includes('--rebuild');
  const C = 128, cells = [];
  for (const id of ids) {
    const rig = await loadRig(id, defs[id], { rebuild });
    for (const [clip, i, n] of SAMPLES) cells.push(await sharp((await renderFrame(rig, pose(clip, i, n))).png).resize(C, C).toBuffer());
  }
  const cols = SAMPLES.length;
  await sharp({ create: { width: cols * C, height: Math.ceil(cells.length / cols) * C, channels: 4, background: '#cfe0d6' } })
    .composite(cells.map((b, i) => ({ input: b, left: (i % cols) * C, top: Math.floor(i / cols) * C }))).png().toFile(out);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
