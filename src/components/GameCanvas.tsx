import { useEffect, useRef } from 'react';
import { bridge } from '../game/bridge';

/** Hosts the Phaser game; it is created on mount and fully destroyed on unmount. */
export default function GameCanvas() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let handle: { destroy(): void } | null = null;
    void import('../game/createGame').then(({ createGame }) => {
      if (disposed || !host.current) return;
      handle = createGame(host.current);
    });
    return () => {
      disposed = true;
      handle?.destroy();
      bridge.reset();
    };
  }, []);

  return <div ref={host} className="game-canvas" aria-hidden="true" />;
}
