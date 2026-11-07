import type { Season } from './types';

/**
 * The only channel between React and Phaser. React owns preferences and the DOM;
 * Phaser owns the world. Neither side touches the other's objects directly.
 */
export interface CameraInfo {
  zoomCss: number; // CSS px per world unit
  scrollX: number; // world x at the left edge
  scrollY: number; // world y at the top edge
  viewW: number; // visible world width
  viewH: number;
  cssW: number;
  cssH: number;
}

export type IntroPhase = 'loading' | 'intro' | 'falling' | 'reveal' | 'home';

/** Outcome of asking the world for a summoned identity. */
export type SummonResult = 'falling' | 'present' | 'not-ready' | 'failed';

export interface RopeHandle {
  id: number;
  cssX: number;
  cssY: number;
  cssH: number;
}

interface Events {
  camera: CameraInfo;
  phase: IntroPhase;
  season: Season;
  night: boolean;
  muted: boolean;
  ropes: RopeHandle[];
  cutRope: number;
  progress: number;
  /** Intro finished and its set cleared: the world can take new arrivals. */
  sceneReady: boolean;
  /** "oziel" was typed: every penguin looks up and the scene sparkles (ms it lasts). */
  marvel: number;
}

type Listener<T> = (value: T) => void;

class Bridge {
  private listeners = new Map<keyof Events, Set<Listener<never>>>();
  private last = new Map<keyof Events, unknown>();

  /** Centre (CSS px, viewport) and font size of the "O" in the hOme title, provided by React. */
  titleOTarget: () => { cx: number; cy: number; fontSize: number } | null = () => null;
  /** DOM rect of the portfolio button (penguins occasionally polish it). */
  ctaRect: () => DOMRect | null = () => null;
  /** Drops a registered identity into the world, provided by the world scene. */
  summon: (id: string) => Promise<SummonResult> = async () => 'not-ready';
  /** Everyone looks up and the scene sparkles; false while the world cannot. */
  marvel: () => boolean = () => false;
  /** Every penguin bursts ("pop"); returns how many ms it takes, 0 when nobody is there. */
  popAll: () => number = () => 0;

  emit<K extends keyof Events>(key: K, value: Events[K]) {
    this.last.set(key, value);
    this.listeners.get(key)?.forEach(fn => (fn as Listener<Events[K]>)(value));
  }

  on<K extends keyof Events>(key: K, fn: Listener<Events[K]>, replay = true): () => void {
    let set = this.listeners.get(key);
    if (!set) this.listeners.set(key, (set = new Set()));
    set.add(fn as Listener<never>);
    if (replay && this.last.has(key)) fn(this.last.get(key) as Events[K]);
    return () => set!.delete(fn as Listener<never>);
  }

  get<K extends keyof Events>(key: K): Events[K] | undefined {
    return this.last.get(key) as Events[K] | undefined;
  }

  reset() {
    this.last.delete('phase');
    this.last.delete('ropes');
    this.last.delete('progress');
    this.last.delete('sceneReady');
    this.last.delete('marvel');
  }
}

export const bridge = new Bridge();
