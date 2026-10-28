import Phaser from 'phaser';
import type { GameData, Season, Variant } from './types';
import { SEASON_KEYS } from './types';

export const ASSET_BASE = '/assets';

/** 1 = 256 px cells, 0.5 = half-resolution atlases for phones. */
export let TEX_SCALE = 1;
export function chooseTextureQuality() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('hd') === '1') return (TEX_SCALE = 1);
  if (params.get('sd') === '1') return (TEX_SCALE = 0.5);
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  const small = Math.min(window.screen.width, window.screen.height) < 600;
  TEX_SCALE = small || memory <= 3 ? 0.5 : 1;
  return TEX_SCALE;
}

const CORE_GROUPS = ['base', 'intro', 'daily', 'weather'];

/**
 * Atlases needed while a season is active. Only one dressed variant is resident:
 * the bare `penguin` variant is kept in winter/autumn just for the clips an
 * ex-engineer needs before dressing (falls, recovery, put on scarf/boots).
 */
export function atlasesForSeason(data: GameData, level: Season): Set<string> {
  const season = SEASON_KEYS[level];
  const keep = new Set<string>();
  for (const atlas of data.manifest.atlases) {
    if (!atlas.variant) continue;
    const g = atlas.group ?? '';
    const core = CORE_GROUPS.some(c => g === c);
    if (atlas.variant === 'engineer' && (core || g === season)) keep.add(atlas.id);
    if (level >= 2 && atlas.variant === 'penguin' && (core || g === season)) keep.add(atlas.id);
    if (level === 0) {
      if (atlas.variant === 'penguin_winter') keep.add(atlas.id);
      if (atlas.variant === 'penguin' && (atlas.id.endsWith('base_00') || atlas.id.endsWith('base_01') || g === 'winter')) keep.add(atlas.id);
    }
    if (level === 1) {
      if (atlas.variant === 'penguin_autumn') keep.add(atlas.id);
      if (atlas.variant === 'penguin' && (atlas.id.endsWith('base_00') || atlas.id.endsWith('base_01') || g === 'autumn')) keep.add(atlas.id);
    }
  }
  return keep;
}

export const EFFECT_ATLASES = ['fx_cut', 'fx_dust', 'fx_impact', 'fx_o_glow', 'autumn_ripple', 'autumn_splash', 'spring_butterfly', 'summer_wave', 'summer_water_splash'];

function atlasUrls(data: GameData, id: string) {
  const entry = data.manifest.atlases.find(a => a.id === id)!;
  if (entry.variant && TEX_SCALE < 1) {
    const sd = (p: string) => p.replace(/atlases\/([^/]+)$/, 'atlases/sd/$1');
    return { png: `${ASSET_BASE}/${sd(entry.png)}`, json: `${ASSET_BASE}/${sd(entry.json)}` };
  }
  return { png: `${ASSET_BASE}/${entry.png}`, json: `${ASSET_BASE}/${entry.json}` };
}

/** Queue atlases that are not resident yet. Returns the ids queued. */
export function queueAtlases(scene: Phaser.Scene, data: GameData, ids: Iterable<string>) {
  const queued: string[] = [];
  for (const id of ids) {
    if (scene.textures.exists(id)) continue;
    const { png, json } = atlasUrls(data, id);
    scene.load.atlas(id, png, json);
    queued.push(id);
  }
  return queued;
}

export function loadAtlases(scene: Phaser.Scene, data: GameData, ids: Iterable<string>): Promise<void> {
  const queued = queueAtlases(scene, data, ids);
  if (!queued.length) return Promise.resolve();
  return new Promise(resolve => {
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      registerCharacterAnims(scene, data);
      resolve();
    });
    scene.load.start();
  });
}

export const animKey = (variant: Variant, clip: string) => `${variant}:${clip}`;

/** Registers every clip whose atlas is resident. Safe to call repeatedly. */
export function registerCharacterAnims(scene: Phaser.Scene, data: GameData) {
  for (const [variant, clips] of Object.entries(data.anims.characters) as [Variant, GameData['anims']['characters'][Variant]][]) {
    for (const [clip, def] of Object.entries(clips)) {
      const key = animKey(variant, clip);
      if (scene.anims.exists(key) || !scene.textures.exists(def.atlas)) continue;
      const tex = scene.textures.get(def.atlas);
      if (!def.frames.every(f => tex.has(f))) {
        console.warn(`[oziel] clip incompleto ${key}`);
        continue;
      }
      scene.anims.create({
        key,
        frames: def.frames.map(frame => ({ key: def.atlas, frame })),
        frameRate: def.fps,
        repeat: def.repeat,
      });
    }
  }
}

export function registerEffectAnims(scene: Phaser.Scene, data: GameData) {
  for (const [name, def] of Object.entries(data.anims.effects)) {
    const key = `fx:${name}`;
    if (scene.anims.exists(key) || !scene.textures.exists(def.atlasKey)) continue;
    scene.anims.create({
      key,
      frames: def.frames.map(frame => ({ key: def.atlasKey, frame })),
      frameRate: def.frameRate,
      repeat: def.repeat,
    });
  }
}

/** Frees atlases (and their animations) that the next season no longer needs. */
export function unloadAtlases(scene: Phaser.Scene, data: GameData, keep: Set<string>, inUse: Set<string>) {
  for (const atlas of data.manifest.atlases) {
    if (!atlas.variant || keep.has(atlas.id) || inUse.has(atlas.id) || !scene.textures.exists(atlas.id)) continue;
    for (const [variant, clips] of Object.entries(data.anims.characters) as [Variant, Record<string, { atlas: string }>][]) {
      for (const [clip, def] of Object.entries(clips)) {
        if (def.atlas === atlas.id) scene.anims.remove(animKey(variant, clip));
      }
    }
    scene.textures.remove(atlas.id);
  }
}

export function imageKey(id: string) {
  return id;
}

export function queueImages(scene: Phaser.Scene, data: GameData, ids: string[]) {
  for (const id of ids) {
    if (scene.textures.exists(id)) continue;
    const img = data.manifest.images[id];
    if (!img) {
      console.warn(`[oziel] imagen desconocida ${id}`);
      continue;
    }
    scene.load.image(id, `${ASSET_BASE}/${img.path}`);
  }
}
