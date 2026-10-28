import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Backdrop from '../components/Backdrop';
import Frost from '../components/Frost';
import { DayNightToggle, SeasonPicker, SoundToggle } from '../components/Controls';
import GameCanvas from '../components/GameCanvas';
import type { CameraInfo, IntroPhase, RopeHandle } from '../game/bridge';
import { bridge } from '../game/bridge';
import { SEASON_KEYS } from '../game/types';
import { usePrefs } from '../state/prefs';
import '../styles/home.css';

const GROUND_TOP = 900;
const PENGUIN_ZONE = 175; // world units above the ground kept free for the penguins

export default function Home() {
  const [prefs, update] = usePrefs();
  // Preferences must be on the bridge before the game boots.
  useState(() => {
    bridge.emit('season', prefs.season);
    bridge.emit('night', prefs.night);
    bridge.emit('muted', prefs.muted);
    return null;
  });
  const [phase, setPhase] = useState<IntroPhase>('loading');
  const [progress, setProgress] = useState(0);
  const [ropes, setRopes] = useState<RopeHandle[]>([]);
  const [cam, setCam] = useState<CameraInfo | null>(null);
  const oRef = useRef<HTMLSpanElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const offs = [
      bridge.on('phase', setPhase),
      bridge.on('progress', setProgress),
      bridge.on('ropes', setRopes),
      bridge.on('camera', setCam),
    ];
    bridge.titleOTarget = () => {
      const el = oRef.current;
      if (!el?.firstChild) return null;
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      const fontSize = parseFloat(getComputedStyle(el).fontSize);
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, fontSize };
    };
    bridge.ctaRect = () => ctaRef.current?.getBoundingClientRect() ?? null;
    return () => {
      offs.forEach(off => off());
      bridge.titleOTarget = () => null;
      bridge.ctaRect = () => null;
    };
  }, []);

  useEffect(() => bridge.emit('season', prefs.season), [prefs.season]);
  useEffect(() => bridge.emit('night', prefs.night), [prefs.night]);
  useEffect(() => bridge.emit('muted', prefs.muted), [prefs.muted]);

  const revealed = phase === 'reveal' || phase === 'home';
  const frozen = revealed && prefs.season === 0;
  const heroBottom = cam ? Math.max(cam.cssH * 0.45, (GROUND_TOP - PENGUIN_ZONE - cam.scrollY) * cam.zoomCss) : undefined;

  return (
    <div
      className="home"
      data-season={SEASON_KEYS[prefs.season]}
      data-night={prefs.night ? 'true' : 'false'}
      data-phase={phase}
      style={heroBottom ? ({ '--hero-bottom': `${heroBottom}px` } as CSSProperties) : undefined}
    >
      <Backdrop season={prefs.season} night={prefs.night} />

      <header className={`topbar${revealed ? ' is-visible' : ''}`} aria-hidden={!revealed}>
        <Link to="/" className="brand" aria-label="Inicio, Oziel" tabIndex={revealed ? 0 : -1}>
          <img src="/assets/overrides/brand/mark.png" alt="" width={40} height={40} />
          <span className="brand-word">
            ozi<span>e</span>l
          </span>
        </Link>
        {revealed && (
          <div className="controls">
            <SeasonPicker value={prefs.season} onChange={season => update({ season })} />
            <DayNightToggle night={prefs.night} onChange={night => update({ night })} />
            <SoundToggle muted={prefs.muted} onChange={muted => update({ muted })} />
          </div>
        )}
      </header>

      {!revealed && ropes.length > 0 && (
        <div className="rope-layer">
          {ropes.map(r => (
            <button
              key={r.id}
              type="button"
              className="rope-btn"
              style={{ left: r.cssX - 22, top: r.cssY, height: r.cssH }}
              aria-label="Cortar la cuerda: el nombre cae y aparece el Home"
              onClick={() => bridge.emit('cutRope', r.id)}
            />
          ))}
        </div>
      )}

      <main className="hero">
        <h1 className="hero-heading">
          <span className="home-word" aria-label="Home">
            <span className="hw-side" aria-hidden="true">
              h
            </span>
            <span className="hw-o" ref={oRef} aria-hidden="true">
              O
            </span>
            <span className="hw-side" aria-hidden="true">
              me
            </span>
            <Frost active={frozen} strokeEm={0.09} />
          </span>
          <span className="hero-name">
            Oziel Rodman Ramos Torrez
            <Frost active={frozen} thickness={0.11} icicles={false} />
          </span>
        </h1>
        <p className="hero-tagline">Full Stack Developer · React · NestJS · Flutter · Python · AI &amp; Cloud</p>
        <Link ref={ctaRef} to="/portafolio" className="cta" tabIndex={revealed ? 0 : -1}>
          Ver portafolio
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </main>

      <GameCanvas />

      {phase === 'loading' && (
        <div className="loader" role="status" aria-live="polite">
          <img src="/assets/overrides/brand/mark.png" alt="" width={84} height={84} />
          <div className="loader-bar">
            <span style={{ transform: `scaleX(${Math.max(0.04, progress)})` }} />
          </div>
          <span className="sr-only">Cargando el mundo de los pingüinos…</span>
        </div>
      )}
    </div>
  );
}
