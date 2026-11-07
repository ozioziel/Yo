import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { bridge } from '../game/bridge';
import { normalizePenguinName, resolvePenguinName } from '../game/characters';

/**
 * A quiet text field shown once the world can take arrivals. It says nothing about what
 * it is for: a registered name drops that penguin into the scene, "oziel" makes every
 * penguin look up while the scene sparkles, "pop" bursts them all, anything else is ignored. Text is only
 * matched against the registry, never used as a path. Enter (or Go on a phone) submits.
 */
export default function SummonPenguin() {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  // a submit is in flight: never two arrivals for one Enter
  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const done = () => {
    setValue('');
    // on touch screens close the keyboard so the scene is visible
    if (window.matchMedia('(pointer: coarse)').matches) input.current?.blur();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending.current) return;
    const typed = normalizePenguinName(value);
    if (!typed) return;
    if (typed === 'oziel') {
      if (bridge.marvel()) done();
      return;
    }
    if (typed === 'pop') {
      if (bridge.popAll() > 0) done();
      return;
    }
    const character = resolvePenguinName(typed);
    if (!character) return;
    pending.current = true;
    setBusy(true);
    try {
      const result = await bridge.summon(character.id);
      if (alive.current && (result === 'falling' || result === 'present')) done();
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };

  return (
    <form className="summon" data-ui onSubmit={submit} aria-busy={busy} autoComplete="off">
      <input
        ref={input}
        className="summon-input"
        type="text"
        aria-label="Texto"
        value={value}
        onChange={e => setValue(e.target.value)}
        maxLength={40}
        enterKeyHint="go"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
    </form>
  );
}
