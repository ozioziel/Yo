import { useRef } from 'react';
import type { Season } from '../game/types';

const SEASONS: { level: Season; name: string; hint: string }[] = [
  { level: 0, name: 'Invierno', hint: 'nieve' },
  { level: 1, name: 'Otoño', hint: 'lluvia' },
  { level: 2, name: 'Primavera', hint: 'flores' },
  { level: 3, name: 'Verano', hint: 'playa' },
];

/** Temperature levels 0–3 as an accessible radio group (arrow keys move the choice). */
export function SeasonPicker({ value, onChange }: { value: Season; onChange: (s: Season) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (dir: number) => {
    const next = ((value + dir + 4) % 4) as Season;
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div
      className="season-picker"
      role="radiogroup"
      aria-label="Temperatura del mundo (0 a 3)"
      data-ui
      onKeyDown={e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          move(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {SEASONS.map(s => (
        <button
          key={s.level}
          ref={el => {
            refs.current[s.level] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === s.level}
          tabIndex={value === s.level ? 0 : -1}
          className={`season-btn season-${s.level}`}
          title={`${s.level} · ${s.name}`}
          onClick={() => onChange(s.level)}
        >
          <span className="season-level" aria-hidden="true">
            {s.level}
          </span>
          <span className="sr-only">
            Nivel {s.level}: {s.name} ({s.hint})
          </span>
        </button>
      ))}
    </div>
  );
}

export function DayNightToggle({ night, onChange }: { night: boolean; onChange: (n: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={night}
      aria-label={night ? 'Noche activada: cambiar a día' : 'Día activado: cambiar a noche'}
      className={`daynight ${night ? 'is-night' : 'is-day'}`}
      onClick={() => onChange(!night)}
      data-ui
    />
  );
}

export function SoundToggle({ muted, onChange }: { muted: boolean; onChange: (m: boolean) => void }) {
  return (
    <button
      type="button"
      className="sound-btn"
      aria-pressed={!muted}
      aria-label={muted ? 'Activar efectos de sonido' : 'Silenciar efectos de sonido'}
      title={muted ? 'Sonido apagado' : 'Sonido encendido'}
      onClick={() => onChange(!muted)}
      data-ui
    >
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M9 19h7l9-8v26l-9-8H9z" fill="#efb83d" stroke="#080c0b" strokeWidth="3.2" strokeLinejoin="round" />
        {muted ? (
          <path d="M31 19l10 10M41 19L31 29" stroke="#080c0b" strokeWidth="3.4" strokeLinecap="round" />
        ) : (
          <>
            <path d="M31 18c3 3 3 9 0 12" fill="none" stroke="#080c0b" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M36 13c6 6 6 16 0 22" fill="none" stroke="#080c0b" strokeWidth="3.2" strokeLinecap="round" />
          </>
        )}
      </svg>
    </button>
  );
}
