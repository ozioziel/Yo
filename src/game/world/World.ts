import Phaser from 'phaser';
import { atlasesForSeason, loadAtlases, unloadAtlases } from '../assets';
import { bridge } from '../bridge';
import type { IntroPhase } from '../bridge';
import type { Layout } from '../layout';
import { sfx } from '../sfx';
import type { GameData, Season, Variant } from '../types';
import { seasonVariant } from '../types';
import { Brain } from './Brain';
import { Director } from './Director';
import { Environment } from './Environment';
import { Ladder } from './Ladder';
import { NameSign } from './NameSign';
import type { Act } from './Penguin';
import { Penguin } from './Penguin';

interface Helmet {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  va: number;
  laneY: number;
  resting: boolean;
  claimedBy: Penguin | null;
  carried: boolean;
}

export interface WorldOptions {
  season: Season;
  night: boolean;
  reducedMotion: boolean;
}

export class World {
  readonly penguins: Penguin[] = [];
  readonly env: Environment;
  readonly sign: NameSign;
  readonly ladder: Ladder;
  readonly director: Director;
  readonly brain: Brain;
  season: Season;
  night: boolean;
  phase: IntroPhase = 'intro';
  reducedMotion: boolean;
  helmet: Helmet | null = null;
  quality = 1;
  nextAccidentAt = 0;
  nextBumpAt = 0;
  titleFormed = false;
  private readyLevels = new Set<Season>();
  private unloadCheckAt = 0;
  private dragging = new Map<number, Penguin>();
  private polls: { cond: () => boolean; resolve: (ok: boolean) => void; until: number }[] = [];
  private fps = { frames: 0, since: 0, low: 0 };
  private hover: 'penguin' | 'rope' | null = null;

  constructor(readonly scene: Phaser.Scene, readonly data: GameData, public layout: Layout, opts: WorldOptions) {
    this.season = opts.season;
    this.night = opts.night;
    this.reducedMotion = opts.reducedMotion;
    this.readyLevels.add(opts.season);
    this.quality = layout.compact ? 0.55 : 1;
    if (opts.reducedMotion) this.quality *= 0.5;
    this.env = new Environment(this);
    this.ladder = new Ladder(this);
    this.sign = new NameSign(this);
    this.brain = new Brain(this);
    this.spawn();
    this.director = new Director(this);
    this.env.apply(true);
    this.applyTint();
  }

  // ------------------------------------------------------------------ setup
  private spawn() {
    const total = this.layout.compact ? 10 : 15;
    const l = this.layout;
    // on a narrow portrait slice the world is zoomed out: penguins get a bit bigger
    const k = l.portrait ? 1.18 : 1;
    for (let i = 0; i < total; i++) {
      const engineer = i === 0;
      const size = (engineer ? 0.58 : Phaser.Math.FloatBetween(0.5, 0.6)) * k;
      const laneY = Phaser.Math.Between(l.laneMin, l.laneMax);
      const fromLeft = engineer || i % 2 === 0;
      const p = new Penguin(this, {
        variant: engineer ? 'engineer' : seasonVariant(this.season),
        engineer,
        x: fromLeft ? l.left - 140 : l.right + 140,
        laneY,
        size,
      });
      p.seasonApplied = this.season;
      p.present = false;
      this.penguins.push(p);
    }
  }

  get engineerPenguin() {
    return this.penguins.find(p => p.engineer && p.present) ?? null;
  }

  restClip(_p: Penguin) {
    return 'idle';
  }

  clampX(x: number, margin: number) {
    return Phaser.Math.Clamp(x, this.layout.left + margin, this.layout.right - margin);
  }

  /** Random x in the visible ground, preferring places with fewer penguins. */
  freeX(p: Penguin, opts: { min?: number; max?: number; near?: number; spread?: number } = {}) {
    const l = this.layout;
    const min = opts.min ?? l.left + 70;
    const max = opts.max ?? l.right - 70;
    let best = (min + max) / 2;
    let bestScore = -Infinity;
    for (let i = 0; i < 8; i++) {
      const x = opts.near !== undefined
        ? Phaser.Math.Clamp(opts.near + Phaser.Math.FloatBetween(-1, 1) * (opts.spread ?? 200), min, max)
        : Phaser.Math.FloatBetween(min, max);
      let crowd = 0;
      for (const o of this.penguins) {
        if (o === p || !o.present) continue;
        const d = Math.abs(o.x - x);
        if (d < 120) crowd += (120 - d) / 120;
      }
      const score = -crowd + Math.random() * 0.3 - Math.abs(x - p.x) / 4000;
      if (score > bestScore) {
        bestScore = score;
        best = x;
      }
    }
    return best;
  }

  until(cond: () => boolean, timeoutMs = 60000): Promise<boolean> {
    if (cond()) return Promise.resolve(true);
    return new Promise(resolve => this.polls.push({ cond, resolve, until: this.scene.time.now + timeoutMs }));
  }

  delay(ms: number): Promise<void> {
    return new Promise(resolve => this.scene.time.delayedCall(ms, resolve));
  }

  setPhase(phase: IntroPhase) {
    this.phase = phase;
    bridge.emit('phase', phase);
  }

  // ------------------------------------------------------------------ preferences from React
  setNight(night: boolean) {
    if (night === this.night) return;
    this.night = night;
    this.env.apply(false);
    this.applyTint();
  }

  applyTint() {
    const tint = this.night ? 0xb9c4d6 : 0xffffff;
    for (const p of this.penguins) p.sprite.setTint(tint);
    this.env.tintProps(tint);
    this.ladder.setTint(tint);
    if (this.helmet) this.helmet.img.setTint(tint);
  }

  async setSeason(level: Season) {
    if (level === this.season) return;
    const previous = this.season;
    this.season = level;
    this.readyLevels.delete(level);
    sfx.chime();
    this.env.apply(false);
    this.sign.onSeason();
    // Same penguins: pause, look up confused, change outfit, resume.
    for (const p of this.penguins) {
      if (!p.present) {
        p.setVariant(p.targetVariant(level));
        p.seasonApplied = level;
        continue;
      }
      // someone up a ladder finishes first and changes afterwards (swimmers come out)
      if (p.y < p.laneY - 6 && !p.swimming) continue;
      if (p.task?.owner === 'brain' && p.task.tag !== 'ladder') p.task = null;
      const delay = Phaser.Math.Between(0, 650);
      this.scene.time.delayedCall(delay, () => {
        if (this.season !== level || (p.y < p.laneY - 6 && !p.swimming)) return;
        p.react(act => this.weatherRoutine(p, act, level), { force: true });
      });
    }
    await loadAtlases(this.scene, this.data, atlasesForSeason(this.data, level));
    if (this.season === level) this.readyLevels.add(level);
    this.unloadCheckAt = this.scene.time.now + 1500;
    void previous;
  }

  /** notice_weather → weather_confused → remove/equip → resume_after_weather. */
  async weatherRoutine(p: Penguin, act: Act, level: Season) {
    p.vx = 0;
    await act.once('notice_weather');
    if (Math.random() < 0.6) p.say('question', 1500);
    await act.once('weather_confused');
    if (!this.readyLevels.has(level)) {
      act.play('look_around');
      await act.until(() => this.readyLevels.has(level) || this.season !== level, 15000);
    }
    if (this.season !== level) return; // a newer season will run its own routine
    if (p.engineer) {
      if (level === 3 && p.can('apply_sunscreen')) await act.once('apply_sunscreen');
      else if (level === 0 && p.can('shiver')) await act.loop('shiver', 1000);
    } else {
      const target = seasonVariant(level);
      if (p.variant !== target) {
        if (p.variant !== 'penguin' && p.can('remove_accessories')) await act.once('remove_accessories');
        await this.equip(p, act, level);
      } else if (level === 3 && p.can('apply_sunscreen')) {
        await act.once('apply_sunscreen');
      }
    }
    p.seasonApplied = level;
    if (p.can('resume_after_weather')) await act.once('resume_after_weather');
  }

  /** From the bare rig to the dressed variant of the season (scarf, boots + umbrella, sunscreen). */
  private async equip(p: Penguin, act: Act, level: Season) {
    const target: Variant = seasonVariant(level);
    if (level === 0) {
      p.setVariant('penguin');
      if (p.can('put_scarf')) await act.once('put_scarf');
      p.setVariant(target);
    } else if (level === 1) {
      p.setVariant('penguin');
      if (p.can('put_boots')) await act.once('put_boots');
      if (p.can('open_umbrella')) await act.once('open_umbrella');
      p.setVariant(target);
    } else {
      p.setVariant(target);
      if (level === 3 && p.can('apply_sunscreen')) await act.once('apply_sunscreen');
    }
  }

  /** An ex-engineer dresses for the current season after getting up. */
  async dressRoutine(p: Penguin, act: Act) {
    const level = this.season;
    if (!this.readyLevels.has(level)) await act.until(() => this.readyLevels.has(level), 15000);
    await this.equip(p, act, level);
    p.seasonApplied = level;
  }

  // ------------------------------------------------------------------ engineer helmet swap
  onGrab(p: Penguin, knocked = false) {
    if (p.engineer && !knocked) this.popHelmet(p);
    this.director.onUnavailable(p);
  }

  private popHelmet(p: Penguin) {
    if (this.helmet) return;
    const head = p.anchor('hm');
    p.engineer = false;
    this.director.onLostHelmet(p);
    p.setVariant('penguin');
    if (this.season === 0 || this.season === 1) p.needsDressing = true;
    else p.seasonApplied = this.season;
    const img = this.scene.add.image(head.x, head.y, 'helmet').setScale(p.size * 0.95).setDepth(6500);
    if (this.night) img.setTint(0xb9c4d6);
    this.helmet = {
      img,
      x: head.x,
      y: head.y,
      vx: Phaser.Math.Between(-170, 170),
      vy: -520,
      va: Phaser.Math.FloatBetween(-8, 8),
      laneY: p.laneY,
      resting: false,
      claimedBy: null,
      carried: false,
    };
    sfx.pop();
  }

  /** Called by the claimer's task: the helmet leaves the ground. */
  takeHelmet(p: Penguin) {
    if (!this.helmet) return null;
    this.helmet.carried = true;
    this.helmet.claimedBy = p;
    return this.helmet.img;
  }

  /** The claimer lost it on the way (grabbed, knocked): it drops and can be claimed again. */
  dropHelmet(x: number, y: number) {
    const h = this.helmet;
    if (!h) return;
    h.carried = false;
    h.claimedBy = null;
    h.resting = false;
    h.x = x;
    h.y = y;
    h.vx = Phaser.Math.Between(-80, 80);
    h.vy = -200;
  }

  wearHelmet(p: Penguin) {
    const h = this.helmet;
    if (!h) return;
    h.img.destroy();
    this.helmet = null;
    p.engineer = true;
    p.needsDressing = false;
    p.setVariant('engineer');
    p.seasonApplied = this.season;
    this.env.puff(p.x, p.headY + 20 * p.size, 0.6);
    sfx.pop();
    this.director.onNewEngineer(p);
  }

  private updateHelmet(dt: number) {
    const h = this.helmet;
    if (!h || h.carried) return;
    if (!h.resting) {
      h.vy += 2600 * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.img.angle += h.va;
      const ground = h.laneY - 12;
      if (h.y >= ground) {
        h.y = ground;
        if (Math.abs(h.vy) > 260) {
          h.vy = -h.vy * 0.35;
          h.vx *= 0.6;
          sfx.tok(1.3);
        } else {
          h.resting = true;
          h.vx = h.vy = 0;
          this.scene.tweens.add({ targets: h.img, angle: 0, duration: 200 });
        }
      }
      h.x = this.clampX(h.x, 20);
      h.img.setPosition(h.x, h.y).setDepth(1000 + h.laneY + 1);
      return;
    }
    if (h.claimedBy && (h.claimedBy.task?.tag !== 'helmet' || !h.claimedBy.present)) h.claimedBy = null;
    if (!h.claimedBy) {
      let best: Penguin | null = null;
      let bestD = Infinity;
      for (const p of this.penguins) {
        if (!p.free || p.engineer) continue;
        const d = Math.abs(p.x - h.x) + (p.task?.tag === 'climb' ? 2000 : 0);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      if (best) {
        h.claimedBy = best;
        this.brain.fetchHelmet(best, h);
      }
    }
  }

  helmetPos() {
    return this.helmet ? { x: this.helmet.x, laneY: this.helmet.laneY } : null;
  }

  // ------------------------------------------------------------------ input (window pointer events)
  pointerDown(id: number, wx: number, wy: number, touch: boolean) {
    const slop = (touch ? 18 : 6) / this.layout.zoomCss;
    const ordered = [...this.penguins].sort((a, b) => b.sprite.depth - a.sprite.depth);
    for (const p of ordered) {
      if (p.mode === 'grabbed' || !p.hitTest(wx, wy, slop)) continue;
      if (p.grab(wx, wy)) {
        this.dragging.set(id, p);
        this.setCursor('grabbing');
        return true;
      }
    }
    const rope = this.sign.ropeAt(wx, wy, Math.max(22 / this.layout.zoomCss, 12));
    if (rope >= 0) {
      this.sign.cut(rope, 'visitor', touch ? { x: wx, y: wy } : undefined);
      return true;
    }
    return false;
  }

  pointerMove(id: number, wx: number, wy: number, mouse: boolean) {
    const p = this.dragging.get(id);
    if (p) {
      p.drag(wx, wy);
      return;
    }
    if (!mouse) return;
    let hover: 'penguin' | 'rope' | null = null;
    if (this.penguins.some(q => q.mode !== 'grabbed' && q.hitTest(wx, wy, 4 / this.layout.zoomCss))) hover = 'penguin';
    else if (this.sign.ropeAt(wx, wy, Math.max(22 / this.layout.zoomCss, 12)) >= 0) hover = 'rope';
    if (hover !== this.hover) {
      this.hover = hover;
      this.setCursor(hover === 'penguin' ? 'grab' : hover === 'rope' ? 'scissors' : null);
    }
  }

  pointerUp(id: number) {
    const p = this.dragging.get(id);
    if (!p) return;
    this.dragging.delete(id);
    p.release();
    this.setCursor(this.hover === 'penguin' ? 'grab' : null);
  }

  private setCursor(kind: 'grab' | 'grabbing' | 'scissors' | null) {
    const root = document.documentElement;
    root.dataset.cursor = kind ?? '';
  }

  // ------------------------------------------------------------------ physics between bodies
  private collisions() {
    const now = this.scene.time.now;
    const ps = this.penguins.filter(p => p.present && !p.swimming);
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i];
        const b = ps[j];
        const dx = b.x - a.x;
        if (Math.abs(dx) > a.halfW + b.halfW) continue;
        const aFly = a.mode === 'airborne' || this.isSwinging(a);
        const bFly = b.mode === 'airborne' || this.isSwinging(b);
        if (aFly !== bFly) {
          this.projectileHit(aFly ? a : b, aFly ? b : a, now);
          continue;
        }
        if (aFly || !a.grounded || !b.grounded) continue;
        if (Math.abs(a.laneY - b.laneY) > 14) continue;
        if (a.y < a.laneY - 6 || b.y < b.laneY - 6) continue; // climbing a ladder
        const approach = (a.vx - b.vx) * Math.sign(dx || 1);
        if (approach > 40) this.groundCollision(a, b, approach, now);
      }
    }
  }

  /** A penguin the visitor is swinging fast acts like a projectile. */
  private isSwinging(p: Penguin) {
    return p.mode === 'grabbed' && Math.hypot(p.vx, p.vy) > 700;
  }

  private projectileHit(fly: Penguin, g: Penguin, now: number) {
    if (!g.grounded || g.collisionCooldownUntil > now) return;
    if (Math.abs(fly.laneY - g.laneY) > 70) return;
    if (fly.y < g.headY - 8 || fly.y > g.y + 4) return;
    const speed = Math.hypot(fly.vx, fly.vy);
    if (speed < 320) return;
    g.collisionCooldownUntil = now + 900;
    const chance = speed > 900 ? 0.82 : 0.5;
    if (fly.chainDepth < 3 && Math.random() < chance) {
      g.knockDown(fly.x, Math.min(1, speed / 1600), fly.chainDepth + 1);
      sfx.tok(0.8);
    } else {
      this.stagger(g, fly.x);
    }
    if (fly.mode === 'airborne') {
      fly.vy = -Math.abs(fly.vy) * 0.35 - 140;
      fly.vx = (fly.x < g.x ? -1 : 1) * (Math.abs(fly.vx) * 0.45 + 120);
    }
  }

  private groundCollision(a: Penguin, b: Penguin, approach: number, now: number) {
    if (a.collisionCooldownUntil > now || b.collisionCooldownUntil > now) return;
    if (now < this.nextBumpAt) return;
    if (a.mode !== 'normal' || b.mode !== 'normal') return;
    // penguins on a job (ladder crew, helmet, chases) keep going; idle strollers bump
    if (this.onJob(a) || this.onJob(b)) return;
    const mover = Math.abs(a.vx) >= Math.abs(b.vx) ? a : b;
    const other = mover === a ? b : a;
    a.collisionCooldownUntil = b.collisionCooldownUntil = now + 3500;
    this.nextBumpAt = now + (this.phase === 'home' ? 1300 : 2600);
    const r = Math.random();
    const accidents = now > this.nextAccidentAt && approach > 90;
    if (accidents && r < 0.18) {
      this.nextAccidentAt = now + 8000;
      other.knockDown(mover.x, 0.35, 1);
      mover.react(async act => {
        await act.once('bump');
        await act.once(Math.random() < 0.5 ? 'laugh' : 'confused');
      });
    } else if (accidents && r < 0.26) {
      this.nextAccidentAt = now + 8000;
      mover.react(async act => {
        await act.once('stumble');
        mover.knockDown(other.x, 0.2, 1);
      });
    } else if (r < 0.62) {
      mover.react(async act => {
        await act.once('bump');
        if (Math.random() < 0.4) mover.say('surprise', 900);
      });
      other.react(async act => {
        act.faceX(mover.x);
        await act.once('confused');
      });
    } else {
      other.react(async act => {
        act.faceX(mover.x);
        await act.once('push');
      });
      this.stagger(mover, other.x);
    }
  }

  private onJob(p: Penguin) {
    const t = p.task;
    if (!t) return false;
    if (t.owner === 'world') return true;
    if (t.owner === 'director') return t.tag !== 'gather' && t.tag !== 'aftermath';
    return ['ladder', 'polish', 'polish-hold', 'beachball', 'beachball-partner', 'chase', 'flee', 'iceslide'].includes(t.name);
  }

  stagger(p: Penguin, fromX: number) {
    p.react(async act => {
      act.faceX(fromX);
      const back = p.x + (p.x >= fromX ? 1 : -1) * 26;
      const stumble = act.once('stumble');
      await act.moveTo(this.clampX(back, p.halfW), p.y, 300, 'Quad.easeOut');
      await stumble;
    });
  }

  onLanded(p: Penguin, level: 0 | 1 | 2, _speed: number) {
    this.env.dust(p.x, p.laneY, level);
    this.env.onLanding(p);
  }

  // ------------------------------------------------------------------ frame
  update(dtMs: number) {
    const dt = Math.min(dtMs, 50) / 1000;
    for (const p of this.penguins) p.update(dtMs);
    this.collisions();
    this.sign.update(dt);
    this.updateHelmet(dt);
    this.ladder.update();
    this.env.update(dtMs);
    if (this.phase === 'home') this.brain.update();
    this.director.update();
    if (this.polls.length) {
      const now = this.scene.time.now;
      for (const poll of [...this.polls]) {
        const ok = poll.cond();
        if (ok || now > poll.until) {
          this.polls.splice(this.polls.indexOf(poll), 1);
          poll.resolve(ok);
        }
      }
    }
    if (this.unloadCheckAt && this.scene.time.now > this.unloadCheckAt) {
      this.unloadCheckAt = this.scene.time.now + 1500;
      if (this.penguins.every(p => p.seasonApplied === this.season && (p.mode === 'normal' || p.mode === 'reaction'))) {
        const inUse = new Set(this.penguins.map(p => p.def(p.clip)?.atlas).filter(Boolean) as string[]);
        unloadAtlases(this.scene, this.data, atlasesForSeason(this.data, this.season), inUse);
        this.unloadCheckAt = 0;
      }
    }
    this.monitorFps(dtMs);
  }

  private monitorFps(dtMs: number) {
    const f = this.fps;
    f.frames++;
    f.since += dtMs;
    if (f.since < 2000) return;
    const fps = (f.frames * 1000) / f.since;
    f.frames = 0;
    f.since = 0;
    if (fps < 42 && this.quality > 0.3) {
      f.low++;
      if (f.low >= 2) {
        this.quality = Math.max(0.3, this.quality * 0.7);
        this.env.setQuality(this.quality);
        f.low = 0;
      }
    } else f.low = 0;
  }

  relayout(layout: Layout) {
    this.layout = layout;
    for (const p of this.penguins) {
      if (!p.present) continue;
      p.x = this.clampX(p.x, p.halfW);
      p.laneY = Phaser.Math.Clamp(p.laneY, layout.laneMin, layout.laneMax);
      if (p.mode === 'normal' || p.mode === 'reaction') p.y = Math.min(p.y, p.laneY);
    }
    this.env.relayout();
    this.sign.relayout();
    this.ladder.relayout();
    this.director.relayout();
  }

  destroy() {
    this.director.cancel();
    this.penguins.forEach(p => p.destroy());
    this.env.destroy();
    this.sign.destroy();
    this.ladder.destroy();
    this.helmet?.img.destroy();
    document.documentElement.dataset.cursor = '';
  }
}
