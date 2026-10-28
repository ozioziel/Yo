import { useEffect, useRef, useState } from 'react';
import type { CameraInfo } from '../game/bridge';
import { bridge } from '../game/bridge';
import type { Season } from '../game/types';
import { SEASON_KEYS } from '../game/types';

const LAYERS = ['sky', 'far_background', 'midground', 'ground'] as const;
/** Top colour of each sky layer, used to extend the sky above y=0 on tall screens. */
const SKY_TOP: Record<string, [string, string]> = {
  'winter-day': ['#c9e4ee', '#dbeef1'],
  'winter-night': ['#16283b', '#243d56'],
  'autumn-day': ['#cbd9d6', '#d9e4df'],
  'autumn-night': ['#1a2738', '#2b3c52'],
  'spring-day': ['#cfe8e6', '#dff1e9'],
  'spring-night': ['#172a3b', '#263e53'],
  'summer-day': ['#bfe4ee', '#d6eff0'],
  'summer-night': ['#152b40', '#243f58'],
};

interface Combo {
  key: string;
  season: Season;
  night: boolean;
  shown: boolean;
}

const src = (c: { season: Season; night: boolean }, layer: string) =>
  `/assets/environments/${SEASON_KEYS[c.season]}/${c.night ? 'night' : 'day'}/${layer}.png`;

/**
 * The four back layers of each season are HTML images under the content and the
 * transparent game canvas. They follow the same camera as the game and crossfade.
 */
export default function Backdrop({ season, night }: { season: Season; night: boolean }) {
  const [cam, setCam] = useState<CameraInfo | null>(() => bridge.get('camera') ?? null);
  const [combos, setCombos] = useState<Combo[]>(() => [{ key: `${season}-${night}`, season, night, shown: true }]);
  const latest = useRef(`${season}-${night}`);

  useEffect(() => bridge.on('camera', setCam), []);

  useEffect(() => {
    const key = `${season}-${night}`;
    latest.current = key;
    setCombos(prev => (prev.some(c => c.key === key) ? prev : [...prev, { key, season, night, shown: false }]));
    const imgs = LAYERS.map(layer => {
      const img = new Image();
      img.src = src({ season, night }, layer);
      return img.decode().catch(() => undefined);
    });
    let cancelled = false;
    void Promise.all(imgs).then(() => {
      if (cancelled || latest.current !== key) return;
      setCombos(prev => prev.map(c => (c.key === key ? { ...c, shown: true } : c)));
      window.setTimeout(() => {
        if (latest.current === key) setCombos(prev => prev.filter(c => c.key === key));
      }, 1000);
    });
    return () => {
      cancelled = true;
    };
  }, [season, night]);

  const z = cam?.zoomCss ?? 1;
  const style = cam
    ? { transform: `translate(${-cam.scrollX * z}px, ${-cam.scrollY * z}px) scale(${z})` }
    : { opacity: 0 };
  const current = combos[combos.length - 1];
  const tall = cam && cam.scrollY < -40;

  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop-world" style={style}>
        {combos.map(c => {
          const [deep, top] = SKY_TOP[`${SEASON_KEYS[c.season]}-${c.night ? 'night' : 'day'}`];
          return (
            <div key={c.key} className="backdrop-combo" style={{ opacity: c.shown ? 1 : 0 }}>
              <div className={`sky-extension${c.night ? ' is-night' : ''}`} style={{ background: `linear-gradient(to bottom, ${deep}, ${top})` }} />
              {LAYERS.map(layer => (
                <img key={layer} className="backdrop-layer" src={src(c, layer)} alt="" draggable={false} />
              ))}
            </div>
          );
        })}
        {tall && cam && (
          <img
            className="backdrop-celestial"
            src={current.night ? '/assets/environments/common/props/moon.png' : '/assets/environments/common/props/sun.png'}
            alt=""
            style={{ left: cam.scrollX + cam.viewW * 0.78, top: cam.scrollY + Math.min(260, cam.viewH * 0.12) }}
            draggable={false}
          />
        )}
      </div>
    </div>
  );
}
