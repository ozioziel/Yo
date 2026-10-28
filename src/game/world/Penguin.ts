import Phaser from 'phaser';
import { animKey, TEX_SCALE } from '../assets';
import { sfx } from '../sfx';
import type { ClipDef, Point, Season, Variant } from '../types';
import { seasonVariant } from '../types';
import type { World } from './World';

/** Thrown into a routine when something with higher priority takes the penguin. */
export class Cancelled extends Error {
  constructor() {
    super('cancelled');
  }
}

export type Mode = 'normal' | 'reaction' | 'grabbed' | 'airborne' | 'down';
export type FallClip = 'fall_normal' | 'fall_spin' | 'fall_flap';
const FALLS: FallClip[] = ['fall_normal', 'fall_spin', 'fall_flap'];

export interface Act {
  readonly p: Penguin;
  alive(): boolean;
  play(clip: string): void;
  once(clip: string, hooks?: Record<number, () => void>): Promise<void>;
  loop(clip: string, ms: number): Promise<void>;
  wait(ms: number): Promise<void>;
  walkTo(x: number, opts?: { speed?: number; clip?: string; offscreen?: boolean; tolerance?: number }): Promise<void>;
  moveTo(x: number, y: number, ms: number, ease?: string): Promise<void>;
  until(cond: () => boolean, timeoutMs?: number): Promise<boolean>;
  face(dir: 1 | -1): void;
  faceX(x: number): void;
  /** Cleanup that runs when this routine ends for any reason. */
  defer(fn: () => void): void;
}

export interface Task {
  name: string;
  /** Runs from the start each time; must be restartable after an interruption. */
  run(act: Act): Promise<void>;
  onDone?(p: Penguin): void;
  /** Tasks owned by the intro director are not replaced by the home brain. */
  owner?: 'director' | 'brain' | 'world';
  tag?: string;
}

interface Waiter {
  reject(e: Cancelled): void;
}

interface Poll {
  token: number;
  cond: () => boolean;
  until: number;
  resolve: (ok: boolean) => void;
}

export interface Attachment {
  obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  anchor: 'hn' | 'hf' | 'hm';
  dx?: number;
  dy?: number;
  /** Called when the penguin loses the object because it was interrupted. */
  onLost?: () => void;
  follow?: (pos: { x: number; y: number }, p: Penguin) => void;
  depthOffset?: number;
}

const ORIGIN: Point = [128, 230.4];
const AERIAL = new Set(['dragged', 'fall_normal', 'fall_spin', 'fall_flap']);
const AERIAL_SCALE = 0.87;
const AERIAL_PIVOT = 46; // cell y of the point the aerial rig was scaled around
const GRAVITY = 2600;
let nextId = 1;

export class Penguin {
  readonly id = nextId++;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  variant: Variant;
  engineer: boolean;
  /** World units per 256 px cell. */
  readonly size: number;
  x: number;
  y: number;
  laneY: number;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = -1;
  mode: Mode = 'normal';
  task: Task | null = null;
  wantsTask = false;
  clip = 'idle';
  present = false; // false while waiting off-stage before its intro entrance
  /** Season whose outfit this penguin is already wearing. */
  seasonApplied: Season = 2;
  needsDressing = false;
  collisionCooldownUntil = 0;
  chainDepth = 0;
  minImpact: 0 | 1 | 2 = 0;
  lastTaskName = '';
  swimming = false;
  /** Cell row (0..256) where the water surface cuts the body; null when dry. */
  waterCut: number | null = null;
  /**
   * In the sea: the shoreline's world y and how fast it deepens. The waterline then follows
   * the penguin's position, so it only sinks once it is past the shore, never on the sand.
   */
  wading: { shore: (x: number) => number; k: number } | null = null;
  /** Swimming keeps this many world units below the shoreline (head out of the water). */
  swimOffset = 0;
  /** While walking into the sea and back the lane follows the feet (depth and shadow). */
  freeLane = false;
  /** True while grab()/launch() are taking the penguin, so cleanups can tell. */
  lifting = false;
  layerBias = 0;

  private token = 0;
  private waiters = new Set<Waiter>();
  private deferred: { token: number; fn: () => void }[] = [];
  private polls: Poll[] = [];
  private walk: { target: number; speed: number; resolve: () => void; offscreen: boolean; tol: number; token: number } | null = null;
  private attachments: Attachment[] = [];
  private grabOffset = { x: 0, y: 0 };
  private dragTarget = { x: 0, y: 0 };
  private dragHistory: { t: number; x: number; y: number }[] = [];
  private bubble: Phaser.GameObjects.Image | null = null;
  private ring: Phaser.GameObjects.Image | null = null;
  private stars: Phaser.GameObjects.Image[] = [];
  private squash = { sx: 1, sy: 1 };
  private bob = 0;

  constructor(readonly world: World, opts: { variant: Variant; engineer: boolean; x: number; laneY: number; size: number }) {
    const scene = world.scene;
    this.variant = opts.variant;
    this.engineer = opts.engineer;
    this.size = opts.size;
    this.x = opts.x;
    this.laneY = opts.laneY;
    this.y = opts.laneY;
    const def = this.def('idle')!;
    this.shadow = scene.add.image(this.x, this.laneY, 'environments_common_props_contact_shadow').setAlpha(0.32);
    this.sprite = scene.add.sprite(this.x, this.y, def.atlas, def.frames[0]).setOrigin(0.5, 0.9);
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.onAnimUpdate, this);
    this.applyScale();
    this.play('idle');
    this.sync();
  }

  // ------------------------------------------------------------------ basics
  get scene() {
    return this.world.scene;
  }

  def(clip: string, variant: Variant = this.variant): ClipDef | undefined {
    return this.world.data.anims.characters[variant]?.[clip];
  }

  /** A clip is playable only when its atlas is resident. */
  can(clip: string, variant: Variant = this.variant) {
    return this.scene.anims.exists(animKey(variant, clip));
  }

  get busy() {
    return this.mode !== 'normal';
  }

  get grounded() {
    return this.mode === 'normal' || this.mode === 'reaction';
  }

  get free() {
    return this.present && this.mode === 'normal' && !this.swimming;
  }

  get headY() {
    return this.y - 200 * this.size;
  }

  get halfW() {
    return 44 * this.size;
  }

  /**
   * Codex drew the aerial clips (dragged, falls) with the rig scaled to 0.87 around the
   * helmet point (128,46). Undo that here so the body keeps its size when it is lifted,
   * falls and lands, instead of popping smaller/bigger.
   */
  private get aerial() {
    return AERIAL.has(this.clip);
  }

  applyScale() {
    const k = this.aerial ? 1 / AERIAL_SCALE : 1;
    this.sprite.setScale((this.size / TEX_SCALE) * this.squash.sx * k, (this.size / TEX_SCALE) * this.squash.sy * k);
  }

  play(clip: string) {
    let key = animKey(this.variant, clip);
    if (!this.scene.anims.exists(key)) {
      // Missing clip for this variant (not resident): fall back without breaking the state machine.
      const fallback = ['idle', 'look_around'].find(c => this.scene.anims.exists(animKey(this.variant, c)));
      if (!fallback) return;
      key = animKey(this.variant, fallback);
      clip = fallback;
    }
    this.clip = clip;
    this.sprite.play(key, false);
  }

  setVariant(variant: Variant) {
    if (variant === this.variant) return;
    this.variant = variant;
    const frame = this.sprite.anims.currentFrame?.index ?? 0;
    this.play(this.can(this.clip) ? this.clip : 'idle');
    if (frame > 1 && this.sprite.anims.currentAnim) {
      const total = this.sprite.anims.currentAnim.frames.length;
      this.sprite.anims.setProgress(Math.min(1, (frame - 1) / Math.max(1, total - 1)));
    }
  }

  face(dir: 1 | -1) {
    this.facing = dir;
    this.sprite.setFlipX(dir === 1);
  }

  /** World position of a per-frame anchor (cell coordinates from Codex frameAnchors). */
  anchor(name: 'hn' | 'hf' | 'hm'): { x: number; y: number } {
    const def = this.def(this.clip);
    const idx = def ? Math.max(0, def.frames.indexOf(this.sprite.frame.name)) : 0;
    const a = def?.anchors[idx]?.[name] ?? (name === 'hm' ? [128, 46] : name === 'hn' ? [164, 190] : [88, 179]);
    const ax = this.sprite.flipX ? 256 - a[0] : a[0];
    return {
      x: this.x + (ax - ORIGIN[0]) * this.size * this.squash.sx,
      y: this.y + (a[1] - ORIGIN[1]) * this.size * this.squash.sy,
    };
  }

  hitTest(wx: number, wy: number, slop: number) {
    if (!this.present) return false;
    const cx = this.x;
    const cy = this.y - 102 * this.size;
    const rx = 64 * this.size + slop;
    const ry = 108 * this.size + slop;
    const dx = (wx - cx) / rx;
    const dy = (wy - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }

  // ------------------------------------------------------------------ routines
  private cancelAll() {
    this.token++;
    const waiters = [...this.waiters];
    this.waiters.clear();
    waiters.forEach(w => w.reject(new Cancelled()));
    this.walk = null;
    this.vx = 0;
    this.runDeferred(t => t < this.token);
    for (const poll of this.polls) poll.resolve(false);
    this.polls = [];
    this.loseAttachments();
  }

  private runDeferred(match: (token: number) => boolean) {
    const run = this.deferred.filter(d => match(d.token));
    this.deferred = this.deferred.filter(d => !match(d.token));
    run.forEach(d => {
      try {
        d.fn();
      } catch (e) {
        console.error(e);
      }
    });
  }

  private makeAct(token: number): Act {
    const p = this;
    const guard = <T>(setup: (resolve: (v: T) => void) => void | (() => void)): Promise<T> => {
      if (token !== p.token) {
        const rejected = Promise.reject(new Cancelled());
        rejected.catch(() => undefined);
        return rejected;
      }
      const promise = new Promise<T>((resolve, reject) => {
        let cleanup: void | (() => void);
        const waiter: Waiter = {
          reject: e => {
            if (cleanup) cleanup();
            reject(e);
          },
        };
        p.waiters.add(waiter);
        cleanup = setup(v => {
          p.waiters.delete(waiter);
          if (cleanup) cleanup();
          if (token !== p.token) reject(new Cancelled());
          else resolve(v);
        });
      });
      // A routine may start a clip without awaiting it; a cancellation is not an error.
      promise.catch(() => undefined);
      return promise;
    };
    const act: Act = {
      p,
      alive: () => token === p.token,
      play: clip => {
        if (token === p.token) p.play(clip);
      },
      once: (clip, hooks) =>
        guard<void>(resolve => {
          if (!p.can(clip)) {
            // Clip not available for this variant: hold a neutral pose for its nominal length.
            p.play('idle');
            const def = p.def(clip) ?? p.def(clip, 'penguin');
            const ms = def ? (def.frames.length / def.fps) * 1000 : 500;
            const timer = p.scene.time.delayedCall(ms, () => resolve());
            return () => timer.remove(false);
          }
          p.play(clip);
          p.frameHooks = hooks ? { key: animKey(p.variant, clip), hooks, fired: new Set() } : null;
          const key = p.sprite.anims.currentAnim?.key;
          const done = (anim: Phaser.Animations.Animation) => {
            if (anim.key === key) resolve();
          };
          // looping clips count as "once" after one full cycle
          p.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, done);
          p.sprite.on(Phaser.Animations.Events.ANIMATION_REPEAT, done);
          return () => {
            p.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, done);
            p.sprite.off(Phaser.Animations.Events.ANIMATION_REPEAT, done);
            p.frameHooks = null;
          };
        }),
      loop: (clip, ms) =>
        guard<void>(resolve => {
          p.play(clip);
          const timer = p.scene.time.delayedCall(ms, () => resolve());
          return () => timer.remove(false);
        }),
      wait: ms =>
        guard<void>(resolve => {
          const timer = p.scene.time.delayedCall(ms, () => resolve());
          return () => timer.remove(false);
        }),
      walkTo: (x, opts = {}) =>
        guard<void>(resolve => {
          const speed = opts.speed ?? 150;
          const clip = opts.clip ?? (speed > 230 ? 'run' : 'walk');
          const bounded = opts.offscreen ? x : p.world.clampX(x, p.halfW + 10);
          const tol = opts.tolerance ?? 4;
          if (Math.abs(bounded - p.x) <= tol) {
            resolve();
            return;
          }
          p.face(bounded > p.x ? 1 : -1);
          p.play(clip);
          p.walk = { target: bounded, speed, resolve, offscreen: !!opts.offscreen, tol, token };
          return () => {
            if (p.walk?.token === token) p.walk = null;
            p.vx = 0;
          };
        }),
      moveTo: (x, y, ms, ease = 'Sine.easeInOut') =>
        guard<void>(resolve => {
          const tween = p.scene.tweens.add({ targets: p, x, y, duration: ms, ease, onComplete: () => resolve() });
          return () => tween.stop();
        }),
      until: (cond, timeoutMs = 60000) =>
        guard<boolean>(resolve => {
          if (cond()) {
            resolve(true);
            return;
          }
          const poll: Poll = { token, cond, until: p.scene.time.now + timeoutMs, resolve };
          p.polls.push(poll);
          return () => {
            p.polls = p.polls.filter(x => x !== poll);
          };
        }),
      face: dir => {
        if (token === p.token) p.face(dir);
      },
      faceX: x => {
        if (token === p.token && Math.abs(x - p.x) > 2) p.face(x > p.x ? 1 : -1);
      },
      defer: fn => {
        if (token === p.token) p.deferred.push({ token, fn });
        else fn();
      },
    };
    return act;
  }

  private frameHooks: { key: string; hooks: Record<number, () => void>; fired: Set<number> } | null = null;

  private onAnimUpdate(anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) {
    const h = this.frameHooks;
    if (!h || anim.key !== h.key) return;
    const index = anim.frames.indexOf(frame);
    for (const [k, fn] of Object.entries(h.hooks)) {
      const at = Number(k);
      if (index >= at && !h.fired.has(at)) {
        h.fired.add(at);
        fn();
      }
    }
  }

  private finishRoutine(token: number) {
    this.runDeferred(t => t === token);
  }

  /** Assign (or replace) the current long-running task. */
  setTask(task: Task | null) {
    this.task = task;
    this.wantsTask = false;
    if (this.mode === 'normal') this.resumeTask();
  }

  resumeTask() {
    this.cancelAll();
    this.mode = 'normal';
    const token = this.token;
    const task = this.task;
    if (!task) {
      this.play(this.world.restClip(this));
      this.wantsTask = true;
      return;
    }
    this.lastTaskName = task.name;
    const act = this.makeAct(token);
    task
      .run(act)
      .then(() => {
        if (token !== this.token) return;
        this.finishRoutine(token);
        if (this.task === task) {
          this.task = null;
          task.onDone?.(this);
          if (this.task === null) {
            this.play(this.world.restClip(this));
            this.wantsTask = true;
            // it was up a ladder when the season changed: dress now
            if (this.seasonApplied !== this.world.season && this.present) this.afterRecovery();
          }
        }
      })
      .catch(e => {
        if (!(e instanceof Cancelled)) {
          console.error(`[oziel] tarea ${task.name}`, e);
          this.finishRoutine(token);
          if (this.task === task) this.task = null;
          this.wantsTask = true;
        }
      });
  }

  /** Short higher-priority sequence (bumps, weather, dressing). The task resumes afterwards. */
  react(fn: (act: Act) => Promise<void>, opts: { force?: boolean } = {}) {
    if (this.mode === 'grabbed' || this.mode === 'airborne' || this.mode === 'down') return false;
    if (this.mode === 'reaction' && !opts.force) return false;
    this.cancelAll();
    this.mode = 'reaction';
    const token = this.token;
    const act = this.makeAct(token);
    fn(act)
      .then(() => {
        if (token !== this.token) return;
        this.finishRoutine(token);
        this.mode = 'normal';
        this.afterRecovery();
      })
      .catch(e => {
        if (!(e instanceof Cancelled)) {
          console.error('[oziel] reacción', e);
          this.finishRoutine(token);
          this.mode = 'normal';
          this.afterRecovery();
        }
      });
    return true;
  }

  private afterRecovery() {
    if (this.needsDressing) {
      this.needsDressing = false;
      this.react(act => this.world.dressRoutine(this, act), { force: true });
      return;
    }
    if (this.seasonApplied !== this.world.season && this.present) {
      // The season changed while it was held or falling: catch up now.
      const level = this.world.season;
      this.react(act => this.world.weatherRoutine(this, act, level), { force: true });
      return;
    }
    this.resumeTask();
  }

  // ------------------------------------------------------------------ attachments & expressions
  attach(a: Attachment) {
    this.attachments.push(a);
    this.updateAttachments();
  }

  detach(obj: Attachment['obj']) {
    this.attachments = this.attachments.filter(a => a.obj !== obj);
  }

  private loseAttachments() {
    const lost = this.attachments;
    this.attachments = [];
    lost.forEach(a => a.onLost?.());
  }

  private updateAttachments() {
    for (const a of this.attachments) {
      const pos = this.anchor(a.anchor);
      pos.x += (a.dx ?? 0) * (this.sprite.flipX ? -1 : 1);
      pos.y += a.dy ?? 0;
      if (a.follow) a.follow(pos, this);
      else a.obj.setPosition(pos.x, pos.y);
      a.obj.setDepth(this.sprite.depth + (a.depthOffset ?? 1));
    }
  }

  say(kind: 'question' | 'surprise', ms = 1400) {
    this.bubble?.destroy();
    const key = kind === 'question' ? 'expression_curiosity' : 'expression_surprise';
    if (!this.scene.textures.exists(key)) return;
    const b = this.scene.add.image(0, 0, key).setScale(this.size * 1.1).setAlpha(0);
    this.bubble = b;
    this.scene.tweens.add({ targets: b, alpha: 1, duration: 140 });
    this.scene.time.delayedCall(ms, () => {
      if (this.bubble !== b) return;
      this.scene.tweens.add({ targets: b, alpha: 0, duration: 200, onComplete: () => b.destroy() });
      this.bubble = null;
    });
  }

  private dizzy(ms: number) {
    this.stars.forEach(s => s.destroy());
    this.stars = [];
    for (let i = 0; i < 3; i++) {
      const s = this.scene.add.image(this.x, this.headY, 'environments_common_particles_star').setScale(this.size * 0.5);
      s.setData('phase', (i / 3) * Math.PI * 2);
      this.stars.push(s);
    }
    this.scene.time.delayedCall(ms, () => {
      const stars = this.stars;
      this.stars = [];
      this.scene.tweens.add({ targets: stars, alpha: 0, duration: 250, onComplete: () => stars.forEach(s => s.destroy()) });
    });
  }

  // ------------------------------------------------------------------ physical modes
  grab(px: number, py: number) {
    if (!this.present) return false;
    this.lifting = true;
    this.cancelAll();
    this.lifting = false;
    this.walk = null;
    this.swimming = false;
    this.waterCut = null;
    this.wading = null;
    this.sprite.clearMask();
    this.sprite.setCrop();
    this.mode = 'grabbed';
    this.world.onGrab(this);
    this.grabOffset = { x: this.x - px, y: this.y - py };
    this.dragTarget = { x: this.x, y: this.y };
    this.dragHistory = [{ t: this.scene.time.now, x: px, y: py }];
    this.vx = this.vy = 0;
    this.face(-1);
    this.sprite.setFlipX(false); // both enlarged eyes look straight at the visitor
    sfx.squeak();
    const token = this.token;
    const scared = animKey(this.variant, 'scared');
    if (this.scene.anims.exists(scared)) {
      this.play('scared');
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (token === this.token && this.mode === 'grabbed') this.play('dragged');
      });
    } else {
      this.play('dragged');
    }
    return true;
  }

  drag(px: number, py: number) {
    if (this.mode !== 'grabbed') return;
    const l = this.world.layout;
    this.dragTarget.x = Phaser.Math.Clamp(px + this.grabOffset.x, l.left + this.halfW, l.right - this.halfW);
    this.dragTarget.y = Phaser.Math.Clamp(py + this.grabOffset.y, l.top + 230 * this.size, this.laneY);
    const now = this.scene.time.now;
    this.dragHistory.push({ t: now, x: px, y: py });
    while (this.dragHistory.length > 2 && this.dragHistory[0].t < now - 110) this.dragHistory.shift();
  }

  release() {
    if (this.mode !== 'grabbed') return;
    const h = this.dragHistory;
    let vx = 0;
    let vy = 0;
    if (h.length >= 2) {
      const a = h[0];
      const b = h[h.length - 1];
      const dt = Math.max(16, b.t - a.t) / 1000;
      vx = (b.x - a.x) / dt;
      vy = (b.y - a.y) / dt;
      if (this.scene.time.now - b.t > 120) vx = vy = 0; // held still before letting go
    }
    const max = 2400;
    this.launch(Phaser.Math.Clamp(vx, -max, max) * 0.85, Phaser.Math.Clamp(vy, -max, max) * 0.85, 0);
    sfx.whoosh(Math.min(1, Math.hypot(vx, vy) / 2000));
  }

  /** Enter free flight (released by the visitor or knocked over). */
  launch(vx: number, vy: number, minImpact: 0 | 1 | 2, chainDepth = 0) {
    this.lifting = true;
    this.cancelAll();
    this.lifting = false;
    this.mode = 'airborne';
    this.vx = vx;
    this.vy = vy;
    this.minImpact = minImpact;
    this.chainDepth = chainDepth;
    this.swimming = false;
    this.waterCut = null;
    this.wading = null;
    this.sprite.setCrop();
    // A fresh random choice for every fall.
    const fall = FALLS[Math.floor(Math.random() * FALLS.length)];
    this.play(fall);
    if (Math.abs(vx) > 40) this.face(vx > 0 ? 1 : -1);
  }

  /** Grounded penguin gets knocked over by something. */
  knockDown(fromX: number, strength: number, chainDepth: number) {
    if (!this.grounded || !this.present || this.swimming) return false;
    const dir = this.x >= fromX ? 1 : -1;
    this.world.onGrab(this, true);
    this.launch(dir * (160 + strength * 120), -(380 + strength * 180), 1, chainDepth);
    this.y -= 2;
    return true;
  }

  private land(speed: number) {
    let level: 0 | 1 | 2 = speed < 900 ? 0 : speed < 1500 ? 1 : 2;
    if (level < this.minImpact) level = this.minImpact;
    this.mode = 'down';
    this.y = this.laneY;
    this.vx = 0;
    this.vy = 0;
    const token = ++this.token;
    this.world.onLanded(this, level, speed);
    sfx.thud(level);
    const sq = [
      [1.06, 0.92],
      [1.14, 0.82],
      [1.24, 0.7],
    ][level];
    this.squash = { sx: sq[0], sy: sq[1] };
    this.scene.tweens.add({ targets: this.squash, sx: 1, sy: 1, duration: 260 + level * 140, ease: 'Elastic.easeOut', easeParams: [1.1, 0.5] });
    if (level === 2) this.dizzy(1700);
    const act = this.makeAct(token);
    (async () => {
      await act.once(`impact_${['light', 'medium', 'heavy'][level]}`);
      if (level === 2) await act.wait(420);
      await act.once('get_up');
    })()
      .then(() => {
        if (token !== this.token) return;
        this.mode = 'normal';
        this.chainDepth = 0;
        this.afterRecovery();
      })
      .catch(e => {
        if (!(e instanceof Cancelled)) console.error(e);
      });
  }

  // ------------------------------------------------------------------ per frame
  update(dtMs: number) {
    const dt = Math.min(dtMs, 50) / 1000;
    const l = this.world.layout;
    if (this.mode === 'grabbed') {
      const k = 1 - Math.pow(0.0005, dt); // fast but not rigid follow
      const px = this.x;
      const py = this.y;
      this.x += (this.dragTarget.x - this.x) * k;
      this.y += (this.dragTarget.y - this.y) * k;
      if (dt > 0) {
        // smoothed swing velocity, used when the visitor sweeps it into others
        this.vx = this.vx * 0.6 + ((this.x - px) / dt) * 0.4;
        this.vy = this.vy * 0.6 + ((this.y - py) / dt) * 0.4;
      }
      this.bob += dt * 9;
    } else if (this.mode === 'airborne') {
      this.vy += GRAVITY * dt;
      this.vx *= Math.pow(0.7, dt);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const minX = l.left + this.halfW;
      const maxX = l.right - this.halfW;
      if (this.x < minX || this.x > maxX) {
        this.x = Phaser.Math.Clamp(this.x, minX, maxX);
        this.vx = -this.vx * 0.45;
        sfx.tok(0.6);
      }
      const ceiling = l.top + 200 * this.size;
      if (this.y < ceiling) {
        this.y = ceiling;
        this.vy = Math.abs(this.vy) * 0.3;
      }
      if (this.vy > 0 && this.y >= this.laneY) this.land(this.vy);
    } else if (this.walk) {
      const w = this.walk;
      const dir = Math.sign(w.target - this.x) || 1;
      this.vx = dir * w.speed;
      this.x += this.vx * dt;
      if ((dir > 0 && this.x >= w.target - w.tol) || (dir < 0 && this.x <= w.target + w.tol)) {
        this.x = w.target;
        this.vx = 0;
        this.walk = null;
        w.resolve();
      }
    }
    if (!this.walk && this.mode !== 'airborne' && this.mode !== 'grabbed') this.vx = 0;
    if (this.grounded) {
      if (this.swimming && this.wading) this.y = this.wading.shore(this.x) - this.swimOffset;
      if (this.freeLane) this.laneY = this.y;
    }

    if (this.polls.length) {
      const now = this.scene.time.now;
      for (const poll of [...this.polls]) {
        const ok = poll.cond();
        if (ok || now > poll.until) {
          this.polls = this.polls.filter(p => p !== poll);
          poll.resolve(ok);
        }
      }
    }
    this.sync();
  }

  sync() {
    const lifted = this.mode === 'grabbed' || this.mode === 'airborne';
    const bob = this.mode === 'grabbed' ? Math.sin(this.bob) * 3 : 0;
    if (this.aerial) {
      this.sprite.setOrigin(0.5, AERIAL_PIVOT / 256);
      this.sprite.setPosition(this.x, this.y + bob + (AERIAL_PIVOT - ORIGIN[1]) * this.size * this.squash.sy);
    } else {
      this.sprite.setOrigin(0.5, 0.9);
      this.sprite.setPosition(this.x, this.y + bob);
    }
    this.applyScale();
    this.syncWater();
    const depth = lifted ? 6000 + this.id : 1000 + this.laneY * 1 + this.layerBias + this.id * 0.01;
    this.sprite.setDepth(depth);
    const height = Math.max(0, this.laneY - this.y);
    const k = Phaser.Math.Clamp(1 - height / 700, 0.25, 1);
    this.shadow
      .setPosition(this.x, this.laneY + 3)
      .setScale(this.size * 0.8 * k, this.size * 0.75 * k)
      .setAlpha(this.present && !this.swimming && !this.inWater ? 0.3 * k : 0)
      .setDepth(1000 + this.laneY - 2);
    this.sprite.setVisible(this.present);
    this.updateAttachments();
    if (this.bubble) this.bubble.setPosition(this.x + 34 * this.size * (this.sprite.flipX ? 1 : -1), this.headY - 34 * this.size).setDepth(depth + 2);
    if (this.stars.length) {
      const t = this.scene.time.now / 260;
      this.stars.forEach(s => {
        const ph = (s.getData('phase') as number) + t;
        s.setPosition(this.x + Math.cos(ph) * 52 * this.size, this.y - 150 * this.size + Math.sin(ph) * 14 * this.size).setDepth(depth + 1);
      });
    }
  }

  /** The body below the water surface is hidden and a ripple ring marks the waterline. */
  get inWater() {
    return !!this.wading && this.y < this.wading.shore(this.x) - 1;
  }

  /** Depth below the surface at the current position, as a cell row of the sprite. */
  private currentCut(): number | null {
    if (this.wading) {
      const depth = Math.max(0, (this.wading.shore(this.x) - this.y) * this.wading.k);
      if (depth < 1) return null;
      return Math.max(this.swimming ? 132 : 140, ORIGIN[1] - depth / this.size);
    }
    return this.waterCut;
  }

  private syncWater() {
    const cutRow = this.currentCut();
    if (cutRow === null || this.aerial) {
      if (this.sprite.isCropped) this.sprite.setCrop();
      this.ring?.setVisible(false);
      return;
    }
    const f = this.sprite.frame;
    const cut = Math.max(0, Math.min(256, cutRow));
    this.sprite.setCrop(0, 0, f.realWidth, (f.realHeight * cut) / 256);
    if (!this.ring) this.ring = this.scene.add.image(0, 0, 'water_ring');
    const y = this.y + (cut - ORIGIN[1]) * this.size;
    const t = this.scene.time.now / 380 + this.id;
    this.ring
      .setVisible(true)
      .setPosition(this.x + Math.sin(t * 0.7) * 2, y)
      .setScale(this.size * (1.05 + 0.06 * Math.sin(t)), this.size * (0.95 + 0.08 * Math.cos(t)))
      .setAlpha(0.9)
      .setTint(this.sprite.tintTopLeft)
      .setDepth(this.sprite.depth + 0.5);
  }

  /** Change outfit for a season, used by the weather routine. */
  targetVariant(level: Season): Variant {
    return this.engineer ? 'engineer' : seasonVariant(level);
  }

  destroy() {
    this.cancelAll();
    this.sprite.destroy();
    this.shadow.destroy();
    this.bubble?.destroy();
    this.ring?.destroy();
    this.stars.forEach(s => s.destroy());
  }
}
