import Phaser from 'phaser';
import { chooseTextureQuality } from './assets';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';

function pixelRatio() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

/**
 * The canvas is transparent and sits above the HTML content: the backgrounds are
 * HTML layers underneath, so penguins can walk in front of everything while buttons
 * keep working (the canvas ignores pointer events; the scene listens on window).
 */
export function createGame(parent: HTMLElement) {
  chooseTextureQuality();
  const dpr = pixelRatio();
  const rect = parent.getBoundingClientRect();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    transparent: true,
    banner: false,
    disableContextMenu: false,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
    // ?loop=timeout keeps the loop alive in hidden/background previews (testing only)
    fps: { target: 60, smoothStep: true, forceSetTimeOut: new URLSearchParams(window.location.search).get('loop') === 'timeout' },
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.max(1, Math.round(rect.width * dpr)),
      height: Math.max(1, Math.round(rect.height * dpr)),
      zoom: 1 / dpr,
    },
    scene: [BootScene, WorldScene],
  });

  const resize = () => {
    const r = parent.getBoundingClientRect();
    const d = pixelRatio();
    game.scale.resize(Math.max(1, Math.round(r.width * d)), Math.max(1, Math.round(r.height * d)));
    game.scale.setZoom(1 / d);
  };
  const observer = new ResizeObserver(() => resize());
  observer.observe(parent);

  return {
    game,
    destroy() {
      observer.disconnect();
      game.destroy(true);
    },
  };
}
