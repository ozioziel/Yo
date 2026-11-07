import gsap from 'gsap';
import type { CSSProperties } from 'react';
import { useLayoutEffect, useRef } from 'react';
import type { Project } from './projects';

export interface RepoMeta {
  language: string | null;
  pushed_at: string;
}

interface Props {
  projects: Project[];
  meta: Record<string, RepoMeta | undefined>;
  open: boolean;
  index: number;
  reduced: boolean;
  onPrev(): void;
  onNext(): void;
  onSelect(i: number): void;
  onClose(): void;
}

const pad = (n: number) => String(n).padStart(2, '0');

function Arrow({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={dir === 'left' ? 'M19 12H6M11 6l-6 6 6 6' : 'M5 12h13M13 6l6 6-6 6'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * One full screen per project, next to its star. Every project is in the DOM
 * (search engines read them all); only the active one is visible.
 */
export default function ProjectViewer({ projects, meta, open, index, reduced, onPrev, onNext, onSelect, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const prevIndex = useRef(index);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const n = projects.length;

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !open) return;
    const article = panel.querySelector<HTMLElement>(`[data-project="${index}"]`);
    if (!article) return;
    panel.scrollTop = 0;
    article.scrollTop = 0;
    const forward = index > prevIndex.current || (prevIndex.current === n - 1 && index === 0);
    prevIndex.current = index;
    if (reduced) return;
    const items = article.querySelectorAll('[data-reveal]');
    const tween = gsap.fromTo(
      items,
      { opacity: 0, x: forward ? 36 : -36, filter: 'blur(6px)' },
      { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.75, stagger: 0.055, ease: 'power3.out', delay: 0.15, clearProps: 'filter' },
    );
    return () => {
      tween.kill();
    };
  }, [index, open, n, reduced]);

  return (
    <section
      className="pf-viewer"
      data-open={open ? 'true' : 'false'}
      aria-roledescription="carrusel"
      aria-label="Proyectos de Oziel"
      aria-hidden={!open}
      inert={!open}
    >
      <div
        className="pf-panel"
        ref={panelRef}
        data-lenis-prevent
        onTouchStart={e => {
          const t = e.touches[0];
          touch.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={e => {
          const start = touch.current;
          touch.current = null;
          if (!start) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - start.x;
          const dy = t.clientY - start.y;
          if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) (dx < 0 ? onNext : onPrev)();
        }}
      >
        {projects.map((p, i) => {
          const m = meta[p.repo];
          const updated = m ? new Date(m.pushed_at).toLocaleDateString('es-BO', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
          return (
            <article
              key={p.repo}
              className="pf-project"
              data-project={i}
              hidden={i !== index}
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${n}: ${p.name}`}
              style={{ '--star': p.color } as CSSProperties}
            >
              <p className="pf-project-kicker" data-reveal>
                <span>
                  Proyecto {pad(i + 1)} / {pad(n)}
                </span>
                {p.badges.map(b => (
                  <span key={b} className="pf-badge">
                    {b}
                  </span>
                ))}
              </p>
              <h2 className="pf-project-name" data-reveal>
                {p.name}
              </h2>
              <p className="pf-project-tagline" data-reveal>
                {p.tagline}
              </p>
              <div className="pf-project-body" data-reveal>
                {p.summary.map(s => (
                  <p key={s.slice(0, 24)}>{s}</p>
                ))}
              </div>
              {p.highlights.length > 0 && (
                <div className="pf-project-block" data-reveal>
                  <h3>Qué hace</h3>
                  <ul className="pf-list">
                    {p.highlights.map(h => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}
              {p.stack.length > 0 && (
                <div className="pf-project-block" data-reveal>
                  <h3>Tecnologías</h3>
                  <ul className="pf-chips">
                    {p.stack.map(s => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {p.media && p.media.length > 0 && (
                <div className="pf-project-block pf-media" data-reveal>
                  {p.media.map(item =>
                    item.type === 'video' ? (
                      <video key={item.src} src={item.src} controls preload="metadata" aria-label={item.alt} />
                    ) : (
                      <img key={item.src} src={item.src} alt={item.alt} loading="lazy" />
                    ),
                  )}
                </div>
              )}
              {p.note && (
                <p className="pf-note" data-reveal>
                  {p.note}
                </p>
              )}
              <div className="pf-project-foot" data-reveal>
                <p className="pf-project-meta">
                  {m?.language && <span>{m.language}</span>}
                  {updated && <span>Actualizado el {updated}</span>}
                </p>
                <div className="pf-project-links">
                  {p.links.map(l => (
                    <a key={l.href} href={l.href} target="_blank" rel="noreferrer" tabIndex={i === index ? 0 : -1}>
                      {l.label}
                      <span aria-hidden="true"> ↗</span>
                    </a>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <nav className="pf-nav" aria-label="Cambiar de proyecto">
        <button type="button" className="pf-arrow" onClick={onPrev} aria-label="Proyecto anterior">
          <Arrow dir="left" />
        </button>
        <div className="pf-nav-mid">
          <p className="pf-count" aria-live="polite">
            <b>{pad(index + 1)}</b> / {pad(n)}
          </p>
          <div className="pf-dots">
            {projects.map((p, i) => (
              <button
                key={p.repo}
                type="button"
                className="pf-dot"
                aria-label={`Ir a ${p.name}`}
                aria-current={i === index ? 'true' : undefined}
                style={{ '--star': p.color } as CSSProperties}
                onClick={() => onSelect(i)}
              />
            ))}
          </div>
        </div>
        <button type="button" className="pf-arrow" onClick={onNext} aria-label="Proyecto siguiente">
          <Arrow dir="right" />
        </button>
      </nav>

      <button type="button" className="pf-close" onClick={onClose}>
        Ver la constelación
      </button>
    </section>
  );
}
