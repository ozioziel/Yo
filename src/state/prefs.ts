import { useCallback, useState } from 'react';
import type { Season } from '../game/types';

/** Visitor preferences, remembered between visits on this browser. */
export interface Prefs {
  season: Season;
  night: boolean;
  muted: boolean;
}

const KEY = 'oziel.home.prefs.v1';
const DEFAULTS: Prefs = { season: 2, night: false, muted: false };

function read(): Prefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const v = JSON.parse(raw) as Partial<Prefs>;
    const season = [0, 1, 2, 3].includes(v.season as number) ? (v.season as Season) : DEFAULTS.season;
    return { season, night: !!v.night, muted: !!v.muted };
  } catch {
    return DEFAULTS;
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(read);
  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* private mode: keep it in memory only */
      }
      return next;
    });
  }, []);
  return [prefs, update] as const;
}
