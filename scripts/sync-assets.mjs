#!/usr/bin/env node
/**
 * Copies ONLY the runtime subset of the Codex library (Recursos/assets_home_oziel)
 * into public/assets, plus our own corrections (assets_overrides/), and writes slim
 * data files the game loads at boot. The original library is never modified.
 *
 *   node scripts/sync-assets.mjs              full sync
 *   node scripts/sync-assets.mjs --if-missing skip only when sources and runtime match
 *   node scripts/sync-assets.mjs --check-sources validate inputs without changing files
 *
 * Half-resolution atlases for phones (atlases/sd/) are made here with sharp, so the
 * build needs nothing besides Node (the Docker image has no Python). Phones request
 * them directly: a missing one would draw as Phaser's green "missing texture" box.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'Recursos', 'assets_home_oziel');
const OVERRIDES = path.join(ROOT, 'assets_overrides');
const OUT = path.join(ROOT, 'public', 'assets');
const DATA = path.join(OUT, 'data');

const extraData = path.join(OVERRIDES, 'ExtraPenguins', 'generated', 'animations.json');
const stamp = path.join(DATA, 'assets-source-stamp');
if (!fs.existsSync(SRC)) {
  console.error(`[assets] No se encontró la biblioteca de Codex en ${SRC}`);
  process.exit(1);
}

const readJSON = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const manifest = readJSON(path.join(SRC, 'asset_manifest.json'));
const animations = readJSON(path.join(SRC, 'animations.json'));
const environments = readJSON(path.join(SRC, 'metadata', 'environments.json'));

const isFrameDuplicate = rel => /\/(frames|clips)\//.test(rel)
  || /_strip\.png$/.test(rel)
  || /particles\/(ripple|splash|butterfly|wave|water_splash)\//.test(rel)
  || /letters_fx\/fx_[a-z_]+\/frames\//.test(rel);
const runtimeAssets = manifest.assets.filter(asset => asset.type !== 'preview'
  && !asset.path.startsWith('reference/') && !isFrameDuplicate(asset.path));
const rigInputs = [path.join(OVERRIDES, 'characters', 'animations.json'), extraData]
  .filter(file => fs.existsSync(file)).map(file => ({ file, rig: readJSON(file) }));
sharp.cache({ memory: 32, files: 16, items: 32 });
sharp.concurrency(1);
const isExtraAtlas = atlas => atlas.variant?.startsWith('extra_') === true;

// Character discovery is manifest-only. Do not even descend into references or
// generated frames while collecting ordinary overrides.
function ordinaryOverrides(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    if (folder === OVERRIDES && ['characters', 'ExtraPenguins'].includes(entry.name)) return [];
    const full = path.join(folder, entry.name);
    return entry.isDirectory() ? ordinaryOverrides(full) : full.endsWith('.md') ? [] : [full];
  });
}
const overrideFiles = fs.existsSync(OVERRIDES) ? ordinaryOverrides(OVERRIDES) : [];

// Validate source spelling on Windows too, before replacing the runtime copy.
const directoryNames = new Map();
function exactSource(base, rel) {
  if (path.isAbsolute(rel) || rel.split(/[\\/]/).some(part => !part || part === '..')) throw new Error(`Invalid asset path: ${rel}`);
  let full = base;
  for (const part of rel.split('/')) {
    let names = directoryNames.get(full);
    if (!names) directoryNames.set(full, (names = fs.readdirSync(full)));
    if (!names.includes(part)) throw new Error(`Asset missing or incorrect case: ${path.join(base, rel)}`);
    full = path.join(full, part);
  }
  return full;
}
const sourceFiles = [path.join(SRC, 'asset_manifest.json'), path.join(SRC, 'animations.json'),
  path.join(SRC, 'metadata', 'environments.json'), ...rigInputs.map(input => input.file),
  ...overrideFiles, fileURLToPath(import.meta.url)];
const requiredOutputs = ['data/animations.json', 'data/manifest.json', 'data/environments.json'];
const addSource = (base, rel) => { sourceFiles.push(exactSource(base, rel)); requiredOutputs.push(rel); };
const sdPath = rel => rel.replace(/atlases\/([^/]+)$/, 'atlases/sd/$1');
for (const asset of runtimeAssets) {
  addSource(SRC, asset.path);
  if (asset.type === 'atlas') {
    addSource(SRC, asset.jsonPath);
    if (asset.characterVariant) requiredOutputs.push(sdPath(asset.path), sdPath(asset.jsonPath));
  }
}
for (const { rig } of rigInputs) for (const atlas of rig.atlases) {
  if (isExtraAtlas(atlas)) {
    sourceFiles.push(exactSource(OVERRIDES, atlas.png), exactSource(OVERRIDES, atlas.json));
    requiredOutputs.push(atlas.png, atlas.json, sdPath(atlas.png), sdPath(atlas.json));
  } else {
    addSource(OVERRIDES, atlas.png); addSource(OVERRIDES, atlas.json);
    if (atlas.variant) requiredOutputs.push(sdPath(atlas.png), sdPath(atlas.json));
  }
}
for (const file of overrideFiles) requiredOutputs.push(`overrides/${path.relative(OVERRIDES, file).replace(/\\/g, '/')}`);
const sourceStamp = crypto.createHash('sha256').update(JSON.stringify([...new Set(sourceFiles)].sort().map(file => {
  const stat = fs.statSync(file);
  return [path.relative(ROOT, file).replace(/\\/g, '/'), stat.size, stat.mtimeMs];
}))).digest('hex');
const upToDate = fs.existsSync(stamp)
  && fs.readFileSync(stamp, 'utf8') === sourceStamp
  && requiredOutputs.every(rel => fs.existsSync(path.join(OUT, rel)));
if (process.argv.includes('--check-sources')) {
  console.log(JSON.stringify({ sourceFiles: new Set(sourceFiles).size, runtimeFiles: new Set(requiredOutputs).size,
    extraCharacters: Object.keys(rigInputs.find(input => input.file === extraData)?.rig.references ?? {}).length, upToDate }));
  process.exit(0);
}
if (process.argv.includes('--if-missing') && upToDate) process.exit(0);

// OUT is fixed inside this repository; never remove a caller-supplied path.
if (path.resolve(OUT) !== path.join(ROOT, 'public', 'assets')) throw new Error('Unsafe asset output');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(DATA, { recursive: true });

let copied = 0;
let bytes = 0;
function copy(rel) {
  const from = path.join(SRC, rel);
  const to = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  copied++;
  bytes += fs.statSync(to).size;
}

// Runtime selection: atlases (+json), backgrounds, props, particles that are not
// per-frame duplicates of an atlas, and UI. Frames, strips, previews, sources,
// reference sheets and scripts stay in the library.
const lite = { atlases: [], images: {} };
for (const asset of runtimeAssets) {
  if (asset.type === 'atlas') {
    copy(asset.path);
    copy(asset.jsonPath);
    lite.atlases.push({
      id: asset.id,
      png: asset.path,
      json: asset.jsonPath,
      variant: asset.characterVariant ?? null,
      group: asset.group ?? null,
      clips: asset.clips ?? [],
      width: asset.width,
      height: asset.height,
    });
  } else {
    copy(asset.path);
    lite.images[asset.id] = { path: asset.path, w: asset.width, h: asset.height, type: asset.type };
  }
}

// Our own additions/corrections live outside the Codex library and win on conflict.
if (overrideFiles.length) {
  for (const file of overrideFiles) {
    const rel = path.relative(OVERRIDES, file).replace(/\\/g, '/');
    if (rel.endsWith('.md') || rel.startsWith('characters/') || rel.startsWith('ExtraPenguins/')) continue; // explicit character manifests only
    const to = path.join(OUT, 'overrides', rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(file, to);
    copied++;
    bytes += fs.statSync(to).size;
    if (rel.endsWith('.png')) {
      const id = `ovr_${path.basename(rel, '.png')}`;
      lite.images[id] = { path: `overrides/${rel}`, type: 'override' };
    }
  }
}

// Slim animation data: exact ordered frames + the anchors the game uses.
const round = v => Math.round(v * 10) / 10;
const slim = { characters: {}, effects: animations.effects };
for (const [variant, clips] of Object.entries(animations.characters)) {
  slim.characters[variant] = {};
  for (const [clip, def] of Object.entries(clips)) {
    slim.characters[variant][clip] = {
      atlas: def.atlasKey,
      frames: def.frames,
      fps: def.frameRate,
      repeat: def.repeat,
      origin: def.origin,
      flipSafe: def.flipSafe,
      anchors: (def.frameAnchors ?? []).map(a => ({
        hn: a.handNear.map(round),
        hf: a.handFar.map(round),
        hm: a.helmet.map(round),
      })),
    };
  }
}

// Extra identities (tools/extras/build.cjs) are cut-out puppets of the user's own
// drawings, trimmed and drawn at 192 px per 256-unit cell (textureScale 0.75). Desktop
// loads that page as it is; phones load an exact half from atlases/sd/, like the other
// characters. Rectangles are even-aligned, so halving them never rounds.
async function publishExtraAtlas(atlas) {
  for (const rel of [atlas.png, atlas.json]) {
    const to = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(OVERRIDES, rel), to);
    copied++;
    bytes += fs.statSync(to).size;
  }
  const png = sdPath(atlas.png), json = sdPath(atlas.json);
  const target = path.join(OUT, png);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await sharp(path.join(OVERRIDES, atlas.png)).ensureAlpha()
    .resize(atlas.width / 2, atlas.height / 2, { kernel: 'lanczos3' })
    .png().toFile(target);
  const map = readJSON(path.join(OVERRIDES, atlas.json));
  for (const frame of Object.values(map.frames)) {
    for (const field of ['frame', 'spriteSourceSize']) {
      for (const key of ['x', 'y', 'w', 'h']) frame[field][key] /= 2;
    }
    frame.sourceSize = { w: frame.sourceSize.w / 2, h: frame.sourceSize.h / 2 };
  }
  map.meta.size = { w: atlas.width / 2, h: atlas.height / 2 };
  map.meta.scale = String(atlas.textureScale / 2);
  map.meta.image = path.basename(png);
  fs.writeFileSync(path.join(OUT, json), JSON.stringify(map));
  copied += 2;
  bytes += fs.statSync(target).size + fs.statSync(path.join(OUT, json)).size;
  return { id: atlas.id, png: atlas.png, json: atlas.json, variant: atlas.variant, group: atlas.group,
    clips: atlas.clips, width: atlas.width, height: atlas.height, textureScale: atlas.textureScale };
}

// Corrected character rig (tools/rig/build_characters.cjs): its atlases replace the
// runtime copies of Codex's ones and its clip data (frames, anchors, new clips) wins.
for (const { rig } of rigInputs) {
  for (const atlas of rig.atlases) {
    let entry;
    if (isExtraAtlas(atlas)) entry = await publishExtraAtlas(atlas);
    else {
      for (const rel of [atlas.png, atlas.json]) {
        const to = path.join(OUT, rel);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(path.join(OVERRIDES, rel), to);
      }
      entry = { id: atlas.id, png: atlas.png, json: atlas.json, variant: atlas.variant, group: atlas.group, clips: atlas.clips, width: atlas.width, height: atlas.height };
    }
    const i = lite.atlases.findIndex(a => a.id === atlas.id);
    if (i >= 0) lite.atlases[i] = entry;
    else lite.atlases.push(entry);
  }
  for (const [variant, clips] of Object.entries(rig.characters)) {
    slim.characters[variant] ??= {};
    for (const [clip, def] of Object.entries(clips)) {
      slim.characters[variant][clip] = {
        atlas: def.atlasKey,
        frames: def.frames,
        fps: def.frameRate,
        repeat: def.repeat,
        origin: def.origin,
        flipSafe: def.flipSafe,
        anchors: def.frameAnchors.map(a => ({ hn: a.handNear.map(round), hf: a.handFar.map(round), hm: a.helmet.map(round) })),
      };
    }
  }
  console.log(`[assets] rig corregido: ${rig.atlases.length} atlases`);
}

const envSlim = {};
for (const [season, modes] of Object.entries(environments.seasons)) {
  envSlim[season] = {};
  for (const [mode, comp] of Object.entries(modes)) {
    envSlim[season][mode] = {
      layers: comp.layers.map(id => (typeof id === 'string' ? id : id.id)).map(id => ({ id, path: lite.images[id].path })),
      ambient: comp.ambient ?? null,
    };
  }
}

fs.writeFileSync(path.join(DATA, 'animations.json'), JSON.stringify(slim));
fs.writeFileSync(path.join(DATA, 'manifest.json'), JSON.stringify(lite));
fs.writeFileSync(path.join(DATA, 'environments.json'), JSON.stringify(envSlim));
// Half-resolution copies of the character atlases for phones (256 → 128 px cells).
// Extras already got their exact half in publishExtraAtlas. sharp premultiplies alpha
// while resizing, so transparent edges do not bleed dark fringes.
let sdCount = 0;
for (const atlas of lite.atlases) {
  if (!atlas.variant || atlas.textureScale) continue;
  const png = path.join(OUT, atlas.png), json = path.join(OUT, atlas.json);
  const folder = path.join(path.dirname(png), 'sd');
  fs.mkdirSync(folder, { recursive: true });
  const meta = await sharp(png).metadata();
  const w = Math.floor(meta.width / 2), h = Math.floor(meta.height / 2);
  await sharp(png).ensureAlpha().resize(w, h, { kernel: 'lanczos3' }).png().toFile(path.join(folder, path.basename(png)));
  const map = readJSON(json);
  for (const frame of Object.values(map.frames)) {
    for (const key of ['frame', 'spriteSourceSize']) for (const k of ['x', 'y', 'w', 'h']) frame[key][k] = Math.floor(frame[key][k] / 2);
    frame.sourceSize = { w: Math.floor(frame.sourceSize.w / 2), h: Math.floor(frame.sourceSize.h / 2) };
  }
  map.meta.size = { w, h };
  map.meta.scale = '0.5';
  fs.writeFileSync(path.join(folder, path.basename(json)), JSON.stringify(map));
  sdCount++;
}
console.log(`[assets] ${sdCount} atlases SD`);
// a missing SD page must not mark the sync as complete: the next build would ship it
if (!requiredOutputs.every(rel => fs.existsSync(path.join(OUT, rel)))) throw new Error('Runtime asset copy incomplete');
fs.writeFileSync(stamp, sourceStamp);

console.log(`[assets] ${copied} archivos (${(bytes / 1048576).toFixed(1)} MiB) → public/assets`);
