import Phaser from 'phaser';
import { bridge } from '../bridge';
import type { Layout } from '../layout';
import { computeLayout, cssToWorld } from '../layout';
import { sfx } from '../sfx';
import type { GameData, Season } from '../types';
import { World } from '../world/World';

/** Elements that keep their own pointer behaviour (the canvas sits above the content). */
const UI_SELECTOR = 'button, a, input, select, textarea, label, [data-ui]';

export class WorldScene extends Phaser.Scene {
  world!: World;
  private layout!: Layout;
  private offs: (() => void)[] = [];

  constructor() {
    super('world');
  }

  create({ data }: { data: GameData }) {
    this.layout = this.measure();
    this.applyCamera();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(window.location.search).get('reduced') === '1';
    this.world = new World(this, data, this.layout, {
      season: (bridge.get('season') ?? 2) as Season,
      night: bridge.get('night') ?? false,
      reducedMotion,
    });
    if (import.meta.env.DEV) (window as unknown as { __oziel?: unknown }).__oziel = this.world; // debugging/tests

    this.offs.push(
      bridge.on('season', s => void this.world.setSeason(s), false),
      bridge.on('night', n => this.world.setNight(n), false),
      bridge.on('muted', m => sfx.setMuted(m)),
      bridge.on('cutRope', id => this.world.sign.cut(id, 'visitor'), false),
    );
    this.bindPointer();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardown());
    this.world.director.start();
    this.world.setPhase('intro');
  }

  private measure() {
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const dpr = this.game.canvas.width / Math.max(1, rect.width);
    return computeLayout(rect.width, rect.height, dpr);
  }

  private applyCamera() {
    const l = this.layout;
    const cam = this.cameras.main;
    cam.setSize(this.scale.width, this.scale.height);
    cam.setZoom(l.zoom);
    cam.centerOn(l.scrollX + l.viewW / 2, l.scrollY + l.viewH / 2);
    bridge.emit('camera', { zoomCss: l.zoomCss, scrollX: l.scrollX, scrollY: l.scrollY, viewW: l.viewW, viewH: l.viewH, cssW: l.cssW, cssH: l.cssH });
  }

  private onResize() {
    this.layout = this.measure();
    this.applyCamera();
    this.world.relayout(this.layout);
  }

  private toWorld(e: PointerEvent) {
    const rect = this.game.canvas.getBoundingClientRect();
    return cssToWorld(this.layout, e.clientX - rect.left, e.clientY - rect.top);
  }

  private bindPointer() {
    const down = (e: PointerEvent) => {
      if (e.button > 0) return;
      const target = e.target as Element | null;
      if (target?.closest?.(UI_SELECTOR)) return;
      const p = this.toWorld(e);
      if (this.world.pointerDown(e.pointerId, p.x, p.y, e.pointerType !== 'mouse')) {
        e.preventDefault();
      }
    };
    const move = (e: PointerEvent) => {
      const p = this.toWorld(e);
      const target = e.target as Element | null;
      const overUi = !!target?.closest?.(UI_SELECTOR);
      this.world.pointerMove(e.pointerId, p.x, p.y, e.pointerType === 'mouse' && !overUi);
    };
    const up = (e: PointerEvent) => this.world.pointerUp(e.pointerId);
    window.addEventListener('pointerdown', down, { passive: false });
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    this.offs.push(() => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    });
  }

  update(_time: number, delta: number) {
    this.world.update(delta);
  }

  private teardown() {
    this.offs.forEach(off => off());
    this.offs = [];
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.world?.destroy();
  }
}
