import 'lenis/dist/lenis.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/portfolio.css';
import ProjectViewer, { type RepoMeta } from './portfolio/ProjectViewer';
import snapshot from './portfolio/github-snapshot.json';
import { PROJECTS } from './portfolio/projects';
import { Journey, type ViewerState } from './portfolio/space/Journey';

const LINKS = [
  { label: 'GitHub', href: 'https://github.com/ozioziel' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/oziel-rodman-ramos-torrez-98b914403' },
  { label: 'Instagram', href: 'https://www.instagram.com/oziel_ramos_torrez' },
];

/** Texts that appear along the journey; band = journey times (fade in from-to, fade out from-to). */
const CAPTIONS = [
  { band: '1.45,1.9,2.6,3.0', kicker: 'Origen', text: 'Del frontend al backend, de la web al móvil.' },
  { band: '3.7,4.1,4.8,5.2', kicker: 'Full Stack Developer', text: 'React · NestJS · Flutter · Python · IA & Cloud' },
  { band: '5.75,6.2,6.95,7.4', kicker: 'Lo que construyo', text: 'Juegos, blockchain, inteligencia artificial, mapas y hardware.' },
  { band: '8.0,8.45,9.15,9.55', kicker: 'Constelación', text: `${PROJECTS.length} proyectos. Cada uno, una estrella.` },
];

const META: Record<string, RepoMeta | undefined> = Object.fromEntries(
  snapshot.repos.map(r => [r.name, { language: r.language, pushed_at: r.pushed_at }]),
);

function prefersReducedMotion() {
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    new URLSearchParams(window.location.search).get('reduced') === '1'
  );
}

/**
 * /portafolio: Oziel's silhouette made of stars. Scrolling scatters it across
 * the solar system and the galaxies until the stars gather into one star per
 * project; then each project gets its own screen, changed with the arrows.
 */
export default function Portfolio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const captionRefs = useRef<HTMLElement[]>([]);
  const labelRefs = useRef<HTMLButtonElement[]>([]);
  const journeyRef = useRef<Journey | null>(null);
  const [reduced] = useState(prefersReducedMotion);
  const [viewer, setViewer] = useState<ViewerState>({ open: false, index: 0 });

  useEffect(() => {
    const restore = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    document.documentElement.classList.add('pf-dark');
    const journey = new Journey({
      canvas: canvasRef.current!,
      track: trackRef.current!,
      intro: introRef.current!,
      captions: captionRefs.current,
      labels: labelRefs.current,
      hud: hudRef.current!,
      count: PROJECTS.length,
      reduced,
      onViewer: setViewer,
    });
    journeyRef.current = journey;
    return () => {
      journey.destroy();
      journeyRef.current = null;
      document.documentElement.classList.remove('pf-dark');
      history.scrollRestoration = restore;
      window.scrollTo(0, 0);
    };
  }, [reduced]);

  useEffect(() => {
    if (!viewer.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') journeyRef.current?.next();
      else if (e.key === 'ArrowLeft') journeyRef.current?.prev();
      else if (e.key === 'Escape') journeyRef.current?.closeViewer();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer.open]);

  const prev = useCallback(() => journeyRef.current?.prev(), []);
  const next = useCallback(() => journeyRef.current?.next(), []);
  const select = useCallback((i: number) => journeyRef.current?.goTo(i), []);
  const close = useCallback(() => journeyRef.current?.closeViewer(), []);

  return (
    <div className="pf-space" data-viewer={viewer.open ? 'open' : 'closed'}>
      <canvas ref={canvasRef} className="pf-canvas" aria-hidden="true" />

      <header className="pf-bar">
        <Link to="/" className="pf-home" viewTransition>
          <img src="/assets/overrides/brand/mark.png" alt="" width={34} height={34} />
          <span>
            Volver a h<b>O</b>me
          </span>
        </Link>
        <nav className="pf-social" aria-label="Perfiles de Oziel">
          {LINKS.map(l => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
              {l.label}
            </a>
          ))}
        </nav>
      </header>

      <section className="pf-intro" ref={introRef} aria-labelledby="pf-name">
        <p className="pf-kicker" data-intro>
          Portafolio · 2026
        </p>
        <h1 id="pf-name">Oziel Rodman Ramos Torrez</h1>
        <p className="pf-role" data-intro>
          Full Stack Developer · La Paz, Bolivia
        </p>
        <div className="pf-intro-actions" data-intro>
          <span className="pf-scroll-hint" aria-hidden="true">
            <i />
            Desliza para explorar
          </span>
          <button type="button" className="pf-skip" onClick={() => journeyRef.current?.skipToProjects()}>
            Ir directo a los proyectos
          </button>
        </div>
      </section>

      <div className="pf-captions">
        {CAPTIONS.map((c, i) => (
          <p
            key={c.band}
            className="pf-caption"
            data-band={c.band}
            ref={el => {
              if (el) captionRefs.current[i] = el;
            }}
          >
            <span className="pf-caption-kicker" data-kicker>
              {c.kicker}
            </span>
            <span className="pf-caption-text" data-split>
              {c.text}
            </span>
          </p>
        ))}
      </div>

      <div className="pf-labels">
        {PROJECTS.map((p, i) => (
          <button
            key={p.repo}
            type="button"
            className="pf-label"
            aria-label={`Ver ${p.name}`}
            style={{ color: p.color }}
            ref={el => {
              if (el) labelRefs.current[i] = el;
            }}
            onClick={() => select(i)}
          >
            <span className="pf-label-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="pf-label-name">{p.name}</span>
          </button>
        ))}
      </div>

      <div className="pf-hud" ref={hudRef} aria-hidden="true">
        <span data-hud-stage>01 · Origen</span>
        <span className="pf-hud-bar">
          <i />
        </span>
        <span data-hud-pct>0%</span>
      </div>

      <div className="pf-track" ref={trackRef} aria-hidden="true" />

      <ProjectViewer
        projects={PROJECTS}
        meta={META}
        open={viewer.open}
        index={viewer.index}
        reduced={reduced}
        onPrev={prev}
        onNext={next}
        onSelect={select}
        onClose={close}
      />
    </div>
  );
}
