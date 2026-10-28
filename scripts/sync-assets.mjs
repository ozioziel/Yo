#!/usr/bin/env node
/**
 * Copies ONLY the runtime subset of the Codex library (Recursos/assets_home_oziel)
 * into public/assets, plus our own corrections (assets_overrides/), and writes slim
 * data files the game loads at boot. The original library is never modified.
 *
 *   node scripts/sync-assets.mjs              full sync
 *   node scripts/sync-assets.mjs --if-missing skip when public/assets/data exists
 *
 * Half-resolution atlases for phones are produced by tools/make_sd_atlases.py
 * (Python + Pillow). If that step fails the game simply uses the HD atlases.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'Recursos', 'assets_home_oziel');
const OVERRIDES = path.join(ROOT, 'assets_overrides');
const OUT = path.join(ROOT, 'public', 'assets');
const DATA = path.join(OUT, 'data');

if (process.argv.includes('--if-missing') && fs.existsSync(path.join(DATA, 'animations.json'))) {
  process.exit(0);
}
if (!fs.existsSync(SRC)) {
  console.error(`[assets] No se encontró la biblioteca de Codex en ${SRC}`);
  process.exit(1);
}

const readJSON = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const manifest = readJSON(path.join(SRC, 'asset_manifest.json'));
const animations = readJSON(path.join(SRC, 'animations.json'));
const environments = readJSON(path.join(SRC, 'metadata', 'environments.json'));

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
const isFrameDuplicate = rel => /\/(frames|clips)\//.test(rel)
  || /_strip\.png$/.test(rel)
  || /particles\/(ripple|splash|butterfly|wave|water_splash)\//.test(rel)
  || /letters_fx\/fx_[a-z_]+\/frames\//.test(rel);

const lite = { atlases: [], images: {} };
for (const asset of manifest.assets) {
  if (asset.type === 'preview' || asset.path.startsWith('reference/')) continue;
  if (isFrameDuplicate(asset.path)) continue;
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
if (fs.existsSync(OVERRIDES)) {
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
  for (const file of walk(OVERRIDES)) {
    const rel = path.relative(OVERRIDES, file).replace(/\\/g, '/');
    if (rel.endsWith('.md') || rel.startsWith('characters/')) continue; // characters are merged below
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

// Corrected character rig (tools/rig/build_characters.cjs): its atlases replace the
// runtime copies of Codex's ones and its clip data (frames, anchors, new clips) wins.
const rigData = path.join(OVERRIDES, 'characters', 'animations.json');
if (fs.existsSync(rigData)) {
  const rig = readJSON(rigData);
  for (const atlas of rig.atlases) {
    for (const rel of [atlas.png, atlas.json]) {
      const to = path.join(OUT, rel);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(path.join(OVERRIDES, rel), to);
    }
    const entry = { id: atlas.id, png: atlas.png, json: atlas.json, variant: atlas.variant, group: atlas.group, clips: atlas.clips, width: atlas.width, height: atlas.height };
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

// Optional half-resolution character atlases for phones.
const py = spawnSync(process.platform === 'win32' ? 'python' : 'python3',
  ['-I', path.join(ROOT, 'tools', 'make_sd_atlases.py'), OUT], { stdio: 'inherit' });
if (py.status !== 0) console.warn('[assets] Atlases SD no generados; se usarán los HD.');

console.log(`[assets] ${copied} archivos (${(bytes / 1048576).toFixed(1)} MiB) → public/assets`);
