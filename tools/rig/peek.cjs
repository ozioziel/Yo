/* Full-size review strip: node tools/rig/peek.cjs out.png walk:0 walk:4 climb:2 [variant=engineer] */
const sharp = require('sharp');
const { pose, svg, groups } = require('./build_characters.cjs');
(async () => {
  const [out, ...specs] = process.argv.slice(2);
  const tiles = [];
  for (const spec of specs) {
    const [clip, i, variant = 'penguin'] = spec.split(':');
    const group = Object.keys(groups).find(g => clip in groups[g]);
    const z = pose(clip, +i, groups[group][clip]);
    z.clip = clip;
    tiles.push(await sharp(Buffer.from(svg(z, variant))).resize(256, 256).png().toBuffer());
  }
  await sharp({ create: { width: 256 * tiles.length, height: 256, channels: 4, background: '#cfe3d4' } })
    .composite(tiles.map((input, k) => ({ input, left: k * 256, top: 0 }))).png().toFile(out);
})();
