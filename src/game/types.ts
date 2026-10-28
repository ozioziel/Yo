export type Season = 0 | 1 | 2 | 3;
export const SEASON_KEYS = ['winter', 'autumn', 'spring', 'summer'] as const;
export type SeasonKey = (typeof SEASON_KEYS)[number];

export type Variant = 'penguin' | 'engineer' | 'penguin_winter' | 'penguin_autumn';

export type Point = [number, number];

export interface ClipAnchor {
  hn: Point; // near flipper (the one on the back side of the left-facing rig)
  hf: Point; // far flipper
  hm: Point; // helmet / top of head
}

export interface ClipDef {
  atlas: string;
  frames: string[];
  fps: number;
  repeat: number;
  origin: Point;
  flipSafe: boolean;
  anchors: ClipAnchor[];
}

export interface EffectDef {
  atlasKey: string;
  frames: string[];
  frameRate: number;
  repeat: number;
  origin: Point;
}

export interface AnimData {
  characters: Record<Variant, Record<string, ClipDef>>;
  effects: Record<string, EffectDef>;
}

export interface AtlasEntry {
  id: string;
  png: string;
  json: string;
  variant: Variant | null;
  group: string | null;
  clips: string[];
  width: number;
  height: number;
}

export interface ManifestLite {
  atlases: AtlasEntry[];
  images: Record<string, { path: string; w?: number; h?: number; type: string }>;
}

export interface EnvLayer { id: string; path: string }
export type EnvData = Record<SeasonKey, Record<'day' | 'night', { layers: EnvLayer[]; ambient: string | null }>>;

export interface GameData {
  anims: AnimData;
  manifest: ManifestLite;
  env: EnvData;
}

export function seasonVariant(level: Season): Variant {
  return level === 0 ? 'penguin_winter' : level === 1 ? 'penguin_autumn' : 'penguin';
}
