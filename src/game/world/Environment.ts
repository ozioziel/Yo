import Phaser from 'phaser';
import { ASSET_BASE } from '../assets';
import { sfx } from '../sfx';
import type { Season } from '../types';
import { SEASON_KEYS } from '../types';
import type { World } from './World';

type Img = Phaser.GameObjects.Image;

export interface Spot {
  x: number;
  laneY: number;
  img: Img | null;
  stage: number;
  busy: Penguin | null;
}
type Penguin = import('./Penguin').Penguin;

export interface BeachBall {
  img: Img;
  x: number;
  y: number;
  vx: number;
  vy: number;
  laneY: number;
  busy: Penguin | null;
  held: boolean;
}

export interface Spots {
  snowman: Spot | null;
  ice: { x0: number; x1: number; laneY: number; img: Img } | null;
  puddles: Spot[];
  leafPile: Spot | null;
  flowers: Spot[];
  bloom: Spot | null;
  sandcastle: Spot | null;
  ball: BeachBall | null;
  seats: Spot[];
  shoreY: number;
}

const PROP = (season: string, name: string) => `environments_${season}_props_${name}`;

/**
 * Where the painted summer sea meets the sand (world y every 32 px of x), measured from
 * environments/summer/day/midground.png (same in night); the two palm-trunk columns are interpolated.
 */
const SHORELINE = [850, 846, 843, 840, 838, 836, 835, 835, 835, 836, 837, 839, 841, 844, 848, 852, 857, 861, 866, 869, 872, 875, 876, 877, 878, 878, 877, 875, 873, 870, 867, 863, 858, 853, 848, 844, 841, 838, 836, 834, 833, 832, 832, 833, 834, 836, 839, 842, 846, 850, 854, 858, 861, 864, 866, 867, 867, 865, 863, 858, 850];
export function shoreAt(x: number) {
  const f = Phaser.Math.Clamp(x, 0, 1920) / 32;
  const i = Math.min(SHORELINE.length - 2, Math.floor(f));
  return SHORELINE[i] + (SHORELINE[i + 1] - SHORELINE[i]) * (f - i);
}
const PART = (season: string, name: string) => `environments_${season}_particles_${name}`;

export class Environment {
  spots: Spots = this.emptySpots();
  private foreground: Img | null = null;
  private appliedSeason: Season | null = null;
  private appliedNight: boolean | null = null;
  private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private props: Img[] = [];
  private ambient: Phaser.GameObjects.Sprite[] = [];
  private butterflies: { s: Phaser.GameObjects.Sprite; tx: number; ty: number; t: number; owner: Penguin | null }[] = [];
  private fireflies: { img: Img; ph: number; x: number; y: number }[] = [];
  private splashTimer = 0;
  private surf: Phaser.GameObjects.Graphics | null = null;
  private rippleTimer = 0;
  private tint = 0xffffff;

  constructor(readonly world: World) {
    const scene = world.scene;
    if (!scene.textures.exists('firefly')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      for (let r = 12; r > 0; r--) {
        g.fillStyle(0xfff3a0, (1 - r / 12) * 0.22);
        g.fillCircle(12, 12, r);
      }
      g.fillStyle(0xfffbe0, 1).fillCircle(12, 12, 2.4);
      g.generateTexture('firefly', 24, 24);
      g.destroy();
    }
    this.makeWaterTextures();
  }

  /** Small procedural textures in the same flat style: waterline ring, droplet, surf foam. */
  private makeWaterTextures() {
    const scene = this.scene;
    if (!scene.textures.exists('water_ring')) {
      // sea-coloured surface around the body: faint far edge, foamy wavy front edge
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x6fb3c4, 0.85).fillEllipse(70, 20, 132, 28);
      g.lineStyle(2, 0xd9f0f2, 0.7).beginPath();
      for (let a = Math.PI; a <= Math.PI * 2 + 0.001; a += 0.1) g.lineTo(70 + Math.cos(a) * 64, 20 + Math.sin(a) * 13);
      g.strokePath();
      const front: Phaser.Math.Vector2[] = [];
      for (let a = 0; a <= Math.PI + 0.001; a += 0.06) {
        const wob = Math.sin(a * 9) * 1.6;
        front.push(new Phaser.Math.Vector2(70 + Math.cos(a) * (64 + wob), 20 + Math.sin(a) * (13 + wob)));
      }
      g.lineStyle(4.5, 0xf6fcfb, 1).strokePoints(front, false);
      g.fillStyle(0xf6fcfb, 0.9).fillCircle(14, 27, 2.2).fillCircle(126, 26, 2.4).fillCircle(40, 33, 1.8);
      g.generateTexture('water_ring', 140, 40);
      g.destroy();
    }
    if (!scene.textures.exists('droplet')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x080c0b, 1).fillCircle(8, 9, 7);
      g.fillStyle(0x9ed6e2, 1).fillCircle(8, 9, 5.4);
      g.fillStyle(0xffffff, 0.9).fillCircle(6, 7, 1.8);
      g.generateTexture('droplet', 16, 18);
      g.destroy();
    }
  }

  private get scene() {
    return this.world.scene;
  }

  private emptySpots(): Spots {
    return { snowman: null, ice: null, puddles: [], leafPile: null, flowers: [], bloom: null, sandcastle: null, ball: null, seats: [], shoreY: 0 };
  }

  private fgKey(season: Season, night: boolean) {
    return `environments_${SEASON_KEYS[season]}_${night ? 'night' : 'day'}_foreground`;
  }

  /** Applies the current season/night; gradual crossfades, never a blank frame. */
  apply(initial: boolean) {
    const { season, night } = this.world;
    const seasonChanged = season !== this.appliedSeason;
    const nightChanged = night !== this.appliedNight;
    if (!seasonChanged && !nightChanged) return;
    this.appliedSeason = season;
    this.appliedNight = night;
    this.swapForeground(this.fgKey(season, night), initial);
    if (seasonChanged) {
      this.buildProps(initial);
      this.buildWeather(initial);
      sfx.setAmbient(season === 1 ? 'rain' : season === 3 ? 'waves' : null);
    }
    this.buildNightLife();
  }

  private swapForeground(key: string, initial: boolean) {
    const scene = this.scene;
    const show = () => {
      const old = this.foreground;
      const img = scene.add.image(0, 0, key).setOrigin(0).setDepth(4200).setAlpha(initial ? 1 : 0);
      this.foreground = img;
      if (!initial) scene.tweens.add({ targets: img, alpha: 1, duration: 900 });
      if (old) {
        const oldKey = old.texture.key;
        scene.tweens.add({
          targets: old,
          alpha: 0,
          duration: 900,
          onComplete: () => {
            old.destroy();
            if (oldKey !== this.foreground?.texture.key && scene.textures.exists(oldKey)) scene.textures.remove(oldKey);
          },
        });
      }
    };
    if (scene.textures.exists(key)) show();
    else {
      const img = this.world.data.manifest.images[key];
      scene.load.image(key, `${ASSET_BASE}/${img.path}`);
      scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
        if (key === this.fgKey(this.world.season, this.world.night)) show();
      });
      scene.load.start();
    }
  }

  // ------------------------------------------------------------------ seasonal props
  private place(key: string, x: number, laneY: number, scale = 0.6, originY = 1) {
    const img = this.scene.add.image(x, laneY, key).setOrigin(0.5, originY).setScale(scale).setDepth(1000 + laneY - 1).setTint(this.tint);
    this.props.push(img);
    return img;
  }

  private fadeIn(objs: Img[], initial: boolean) {
    if (initial) return;
    objs.forEach(o => {
      const a = o.alpha;
      o.setAlpha(0);
      this.scene.tweens.add({ targets: o, alpha: a, duration: 900, delay: 200 });
    });
  }

  private clearProps(initial: boolean) {
    const old = this.props;
    this.props = [];
    if (this.spots.ball) this.spots.ball.img.destroy();
    for (const o of old) {
      if (initial) o.destroy();
      else this.scene.tweens.add({ targets: o, alpha: 0, duration: 700, onComplete: () => o.destroy() });
    }
    // a melting snowman leaves a puddle for a moment
    const s = this.spots.snowman;
    if (s?.img && s.stage > 0 && !initial) {
      const melt = this.scene.add.image(s.x, s.laneY, PROP('winter', 'melt_water')).setOrigin(0.5, 0.6).setScale(0.6).setDepth(1000 + s.laneY - 2);
      this.scene.tweens.add({ targets: melt, alpha: 0, delay: 1500, duration: 1500, onComplete: () => melt.destroy() });
    }
    this.spots = this.emptySpots();
  }

  private buildProps(initial: boolean) {
    this.clearProps(initial);
    const l = this.world.layout;
    const W = l.viewW;
    const at = (f: number) => l.left + W * f;
    const back = l.laneMin + 4;
    const mid = (l.laneMin + l.laneMax) / 2;
    const front = l.laneMax - 4;
    const s = this.spots;
    const made: Img[] = [];
    switch (this.world.season) {
      case 0: {
        made.push(this.place(PROP('winter', 'snowbank'), at(0.07), front + 18, 0.55));
        const ice = this.place(PROP('winter', 'ice_patch'), at(0.62), mid + 6, 0.9, 0.5);
        ice.setDepth(1000 + l.laneMin - 20);
        made.push(ice);
        s.ice = { x0: at(0.62) - 120, x1: at(0.62) + 120, laneY: mid, img: ice };
        s.snowman = { x: at(0.3), laneY: back, img: null, stage: 0, busy: null };
        break;
      }
      case 1: {
        for (const f of [0.26, 0.74]) {
          const img = this.place(PROP('autumn', 'puddle'), at(f), mid + 4, 0.75, 0.5);
          img.setDepth(1000 + l.laneMin - 20);
          made.push(img);
          s.puddles.push({ x: at(f), laneY: mid, img, stage: 0, busy: null });
        }
        const pile = this.place(PROP('autumn', 'leaf_pile'), at(0.5), back, 0.6);
        made.push(pile);
        s.leafPile = { x: at(0.5), laneY: back, img: pile, stage: 0, busy: null };
        break;
      }
      case 2: {
        made.push(this.place(PROP('spring', 'bush'), at(0.06), front + 22, 0.55));
        const fl = [
          [0.18, 'flower_0'],
          [0.52, 'flower_1'],
          [0.86, 'flower_2'],
        ] as const;
        for (const [f, k] of fl) {
          const img = this.place(PROP('spring', k), at(f), back, 0.42);
          made.push(img);
          s.flowers.push({ x: at(f), laneY: back, img, stage: 0, busy: null });
        }
        for (const f of [0.34, 0.7]) made.push(this.place(PROP('spring', 'grass_tuft'), at(f), front + 10, 0.4));
        const bloom = this.place(PROP('spring', 'flower_stage_0'), at(0.4), back, 0.42);
        made.push(bloom);
        s.bloom = { x: at(0.4), laneY: back, img: bloom, stage: 0, busy: null };
        break;
      }
      case 3: {
        made.push(this.place(PROP('summer', 'bucket'), at(0.3), back + 8, 0.42));
        made.push(this.place(PROP('summer', 'shovel'), at(0.33), back + 6, 0.38));
        made.push(this.place(PROP('summer', 'seashell'), at(0.8), front + 6, 0.32));
        made.push(this.place(PROP('summer', 'coastal_grass'), at(0.95), front + 20, 0.5));
        s.sandcastle = { x: at(0.22), laneY: back, img: null, stage: 0, busy: null };
        const ball = this.scene.add.image(at(0.62), mid, PROP('summer', 'beach_ball')).setScale(0.36).setDepth(1000 + mid).setTint(this.tint);
        s.ball = { img: ball, x: at(0.62), y: mid - 23, vx: 0, vy: 0, laneY: mid, busy: null, held: false };
        made.push(ball);
        s.shoreY = 902;
        break;
      }
    }
    // a log and a rock to sit on / poke at, every season
    const log = this.place('environments_common_props_log_seat', at(0.9), back + 2, 0.5);
    s.seats.push({ x: at(0.9), laneY: back + 2, img: log, stage: 0, busy: null });
    made.push(log);
    made.push(this.place('environments_common_props_rock', at(0.12), back - 2, 0.4));
    this.fadeIn(made, initial);
  }

  /** Advance a build spot (snowman / sandcastle / bloom) to a given stage. */
  setStage(spot: Spot, stage: number, kind: 'snowman' | 'sandcastle' | 'bloom') {
    // the season may have changed mid-gesture: that spot no longer exists
    if (!Object.values(this.spots).some(v => v === spot) || (spot.img && !spot.img.active)) return;
    if (stage <= spot.stage && kind !== 'bloom') return;
    spot.stage = stage;
    const key = kind === 'snowman' ? PROP('winter', `snowman_stage_${stage}`)
      : kind === 'sandcastle' ? PROP('summer', `sandcastle_stage_${stage}`)
      : PROP('spring', `flower_stage_${Math.min(2, stage)}`);
    if (!this.scene.textures.exists(key)) return;
    if (!spot.img) {
      spot.img = this.place(key, spot.x, spot.laneY, kind === 'bloom' ? 0.42 : 0.55);
    } else {
      spot.img.setTexture(key);
    }
    const img = spot.img;
    const base = img.scaleX;
    img.setScale(base * 0.85, base * 1.12);
    this.scene.tweens.add({ targets: img, scaleX: base, scaleY: base, duration: 380, ease: 'Back.easeOut' });
    this.puff(spot.x, spot.laneY - 10, 0.45);
  }

  // ------------------------------------------------------------------ weather
  private stopEmitters(initial: boolean) {
    for (const e of this.emitters) {
      if (initial) e.destroy();
      else {
        e.stop();
        this.scene.time.delayedCall(6000, () => e.destroy());
      }
    }
    this.emitters = [];
    for (const s of this.ambient) {
      if (initial) s.destroy();
      else this.scene.tweens.add({ targets: s, alpha: 0, duration: 800, onComplete: () => s.destroy() });
    }
    this.ambient = [];
    const surf = this.surf;
    this.surf = null;
    if (surf) {
      if (initial) surf.destroy();
      else this.scene.tweens.add({ targets: surf, alpha: 0, duration: 800, onComplete: () => surf.destroy() });
    }
    this.butterflies.forEach(b => b.s.destroy());
    this.butterflies = [];
  }

  private buildWeather(initial: boolean) {
    this.stopEmitters(initial);
    const l = this.world.layout;
    const q = this.world.quality;
    const scene = this.scene;
    const xr = { min: l.left - 80, max: l.right + 80 };
    const fallH = 1080 - l.top + 80;
    const kill = new Phaser.Geom.Rectangle(l.left - 400, 1075, l.viewW + 800, 400);
    const deathZone = { type: 'onEnter' as const, source: kill };
    const add = (key: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth = 7000) => {
      if (!scene.textures.exists(key)) return;
      const e = scene.add.particles(0, l.top - 60, key, { ...cfg, deathZone }).setDepth(depth);
      if (!initial) e.setAlpha(0);
      if (!initial) scene.tweens.add({ targets: e, alpha: 1, duration: 1500 });
      this.emitters.push(e);
    };
    switch (this.world.season) {
      case 0:
        add(PART('winter', 'snowflake_0'), { x: xr, speedY: { min: 40, max: 95 }, speedX: { min: -25, max: 30 }, lifespan: (fallH / 40) * 1000, frequency: 200 / q, scale: { min: 0.2, max: 0.42 }, rotate: { min: 0, max: 360 }, alpha: 1, tint: 0xd2e3f0, maxParticles: Math.round(140 * q), advance: initial ? 12000 : 0 });
        add(PART('winter', 'snow_grain'), { x: xr, speedY: { min: 60, max: 130 }, speedX: { min: -30, max: 20 }, lifespan: (fallH / 60) * 1000, frequency: 120 / q, scale: { min: 0.35, max: 0.75 }, alpha: 0.95, tint: 0xd8e6f2, maxParticles: Math.round(170 * q), advance: initial ? 12000 : 0 });
        break;
      case 1:
        add(PART('autumn', 'rain_streak'), { x: xr, speedY: { min: 980, max: 1250 }, speedX: -110, lifespan: (fallH / 980) * 1000, frequency: 14 / q, quantity: 2, scaleX: 0.55, scaleY: { min: 0.55, max: 0.9 }, rotate: 6, alpha: { min: 0.45, max: 0.75 }, maxParticles: Math.round(240 * q), advance: initial ? 3000 : 0 });
        add(PART('autumn', 'leaf_1'), { x: xr, speedY: { min: 60, max: 110 }, speedX: { min: -70, max: -15 }, lifespan: (fallH / 60) * 1000, frequency: 1500 / q, scale: { min: 0.26, max: 0.4 }, rotate: { start: 0, end: 540 }, maxParticles: Math.round(16 * q) });
        add(PART('autumn', 'leaf_3'), { x: xr, speedY: { min: 60, max: 100 }, speedX: { min: -60, max: -10 }, lifespan: (fallH / 60) * 1000, frequency: 1900 / q, scale: { min: 0.26, max: 0.4 }, rotate: { start: 0, end: -480 }, maxParticles: Math.round(12 * q) });
        break;
      case 2:
        for (const k of ['petal_0', 'petal_1']) {
          add(PART('spring', k), { x: xr, speedY: { min: 45, max: 85 }, speedX: { min: -30, max: 40 }, lifespan: (fallH / 45) * 1000, frequency: 700 / q, scale: { min: 0.3, max: 0.5 }, rotate: { start: 0, end: 360 }, alpha: 0.9, maxParticles: Math.round(30 * q), advance: initial ? 8000 : 0 });
        }
        if (scene.anims.exists('fx:spring_butterfly')) {
          const n = Math.max(1, Math.round(3 * q));
          for (let i = 0; i < n; i++) this.spawnButterfly(null);
        }
        break;
      case 3:
        // surf washing up and down the painted shoreline
        this.surf = scene.add.graphics().setDepth(1880);
        if (!initial) {
          this.surf.setAlpha(0);
          scene.tweens.add({ targets: this.surf, alpha: 1, duration: 1200 });
        }
        break;
    }
  }

  spawnButterfly(owner: Penguin | null, x?: number, y?: number) {
    const l = this.world.layout;
    const s = this.scene.add.sprite(x ?? Phaser.Math.Between(l.left + 100, l.right - 100), y ?? Phaser.Math.Between(700, 860), 'spring_butterfly', 'butterfly_000');
    s.setScale(0.42).setDepth(5500).play({ key: 'fx:spring_butterfly', startFrame: Phaser.Math.Between(0, 7) });
    const b = { s, tx: s.x, ty: s.y, t: 0, owner };
    this.butterflies.push(b);
    return b;
  }

  releaseButterfly(b: { s: Phaser.GameObjects.Sprite; owner: Penguin | null; ty: number }) {
    b.owner = null;
    b.ty = 640;
  }

  private buildNightLife() {
    this.fireflies.forEach(f => f.img.destroy());
    this.fireflies = [];
    const { season, night, layout: l, quality } = this.world;
    if (!night || season === 0 || season === 1) return;
    const n = Math.round(10 * quality);
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Between(l.left + 40, l.right - 40);
      const y = Phaser.Math.Between(760, 1000);
      const img = this.scene.add.image(x, y, 'firefly').setDepth(5200).setBlendMode(Phaser.BlendModes.ADD);
      this.fireflies.push({ img, ph: Math.random() * 10, x, y });
    }
  }

  setQuality(q: number) {
    // Called when the frame rate drops: thin out the weather, never the characters.
    void q;
    for (const e of this.emitters) {
      if (e.frequency > 0) e.frequency = e.frequency / 0.7;
      e.maxParticles = Math.max(10, Math.round(e.maxParticles * 0.7));
    }
  }

  // ------------------------------------------------------------------ effects
  dust(x: number, y: number, level: 0 | 1 | 2) {
    const scene = this.scene;
    if (scene.anims.exists('fx:fx_dust')) {
      const d = scene.add.sprite(x, y - 10, 'fx_dust', 'fx_dust_000').setScale(0.5 + level * 0.3).setDepth(1000 + y + 5).setTint(this.dustTint());
      d.play('fx:fx_dust').once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => d.destroy());
    }
    if (level >= 1 && scene.anims.exists('fx:fx_impact')) {
      const i = scene.add.sprite(x, y - 20, 'fx_impact', 'fx_impact_000').setScale(0.45 + level * 0.25).setDepth(1000 + y + 6);
      i.play('fx:fx_impact').once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => i.destroy());
    }
    if (this.world.season === 0) this.burst(PART('winter', 'snow_grain'), x, y - 8, 6 + level * 6, 0.5);
  }

  private dustTint() {
    return [0xeef6ff, 0xd9c3a0, 0xe4ead2, 0xf3dfb0][this.world.season];
  }

  puff(x: number, y: number, scale = 0.5) {
    if (!this.scene.anims.exists('fx:fx_dust')) return;
    const d = this.scene.add.sprite(x, y, 'fx_dust', 'fx_dust_000').setScale(scale).setDepth(6900).setAlpha(0.85);
    d.play('fx:fx_dust').once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => d.destroy());
  }

  burst(key: string, x: number, y: number, count: number, scale = 0.4, depth = 6900) {
    if (!this.scene.textures.exists(key)) return;
    const e = this.scene.add.particles(x, y, key, {
      speed: { min: 90, max: 260 },
      angle: { min: 200, max: 340 },
      gravityY: 900,
      lifespan: 700,
      scale: { start: scale, end: scale * 0.3 },
      rotate: { min: 0, max: 360 },
      emitting: false,
    }).setDepth(depth);
    e.explode(count);
    this.scene.time.delayedCall(900, () => e.destroy());
  }

  splash(x: number, y: number, water = false) {
    const scene = this.scene;
    // a burst of outlined droplets reads at any size, plus an expanding ring on the surface
    const drops = scene.add.particles(x, y - 6, 'droplet', {
      speed: { min: 140, max: 330 },
      angle: { min: 215, max: 325 },
      gravityY: 1300,
      lifespan: 650,
      scale: { start: water ? 0.9 : 0.75, end: 0.35 },
      emitting: false,
    }).setDepth(1000 + y + 9);
    drops.setParticleTint(this.tint);
    drops.explode(water ? 12 : 8);
    scene.time.delayedCall(800, () => drops.destroy());
    const ring = scene.add.image(x, y, 'water_ring').setScale(0.3, 0.3).setAlpha(0.9).setDepth(1000 + y - 1).setTint(this.tint);
    scene.tweens.add({ targets: ring, scaleX: water ? 1 : 0.7, scaleY: water ? 0.8 : 0.55, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    sfx.splash();
  }

  sparkle(x: number, y: number) {
    for (let i = 0; i < 4; i++) {
      const st = this.scene.add.image(x + Phaser.Math.Between(-30, 30), y + Phaser.Math.Between(-20, 20), 'environments_common_particles_star')
        .setScale(0.05).setDepth(6950).setAlpha(0.95);
      this.scene.tweens.add({ targets: st, scale: 0.16, alpha: 0, angle: 90, y: st.y - 20, duration: 600, delay: i * 90, onComplete: () => st.destroy() });
    }
  }

  onLanding(p: Penguin) {
    if (this.world.season === 1) {
      const pud = this.spots.puddles.find(s => Math.abs(s.x - p.x) < 70);
      if (pud) this.splash(p.x, pud.laneY, false);
    }
  }

  tintProps(tint: number) {
    this.tint = tint;
    this.props.forEach(p => p.setTint(tint));
    this.ambient.forEach(a => a.setTint(tint));
    for (const s of [this.spots.snowman, this.spots.sandcastle]) s?.img?.setTint(tint);
  }

  // ------------------------------------------------------------------ frame
  update(dtMs: number) {
    const dt = dtMs / 1000;
    const now = this.scene.time.now;
    const l = this.world.layout;
    if (this.world.season === 1) {
      this.splashTimer -= dtMs;
      if (this.splashTimer <= 0 && this.scene.anims.exists('fx:autumn_splash')) {
        this.splashTimer = 260 / this.world.quality;
        const x = Phaser.Math.Between(l.left, l.right);
        const y = Phaser.Math.Between(l.laneMin - 10, 1060);
        const s = this.scene.add.sprite(x, y, 'autumn_splash', 'splash_000').setOrigin(0.5, 0.85).setScale(0.22).setAlpha(0.55).setDepth(1000 + y - 30).setTint(this.tint);
        s.play('fx:autumn_splash').once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
      }
      this.rippleTimer -= dtMs;
      if (this.rippleTimer <= 0 && this.spots.puddles.length && this.scene.anims.exists('fx:autumn_ripple')) {
        this.rippleTimer = Phaser.Math.Between(180, 420);
        const pud = Phaser.Utils.Array.GetRandom(this.spots.puddles);
        const r = this.scene.add.sprite(pud.x + Phaser.Math.Between(-60, 60), pud.laneY + 4 + Phaser.Math.Between(-6, 6), 'autumn_ripple', 'ripple_000')
          .setScale(0.4).setAlpha(0.7).setDepth(1000 + l.laneMin - 19).setTint(this.tint);
        r.play('fx:autumn_ripple').once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => r.destroy());
      }
    }
    for (const b of this.butterflies) {
      b.t -= dtMs;
      if (!b.owner && b.t <= 0) {
        b.t = Phaser.Math.Between(900, 2200);
        b.tx = Phaser.Math.Clamp(b.s.x + Phaser.Math.Between(-260, 260), l.left + 40, l.right - 40);
        b.ty = Phaser.Math.Between(640, 880);
      }
      const k = 1 - Math.pow(0.25, dt);
      b.s.x += (b.tx - b.s.x) * k;
      b.s.y += (b.ty - b.s.y) * k + Math.sin(now / 140 + b.s.x) * 0.8;
      b.s.setFlipX(b.tx < b.s.x);
    }
    for (const f of this.fireflies) {
      f.ph += dt;
      f.img.setPosition(f.x + Math.sin(f.ph * 0.7) * 40, f.y + Math.cos(f.ph * 0.9) * 22).setAlpha(0.35 + 0.65 * Math.max(0, Math.sin(f.ph * 2.1)));
    }
    if (this.surf) this.drawSurf(now);
    this.updateBall(dt);
  }

  /** A foamy edge that follows the painted shoreline and washes up and down the sand. */
  private drawSurf(now: number) {
    const g = this.surf!;
    const l = this.world.layout;
    const night = this.world.night;
    const wash = Math.sin(now / 1500) * 5 + 3; // the water reaches up the sand and retreats
    g.clear();
    const line = (offset: number, width: number, color: number, alpha: number, ripple: number) => {
      g.lineStyle(width, color, alpha);
      g.beginPath();
      for (let x = l.left - 16; x <= l.right + 16; x += 12) {
        const y = shoreAt(x) + offset + Math.sin(x / 46 + now / 700) * ripple;
        if (x === l.left - 16) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
    };
    // wet sand darkening behind the wash, then the bright foam edge
    line(wash + 5, 9, night ? 0x8a8c7c : 0xd9bf8c, 0.45, 1.5);
    line(wash, 4.5, night ? 0xc9d6d8 : 0xfcfbf2, 0.95, 2);
    line(wash - 9, 2.5, night ? 0xb7cbd0 : 0xf2fbf8, 0.6, 3);
  }

  /** Steer a butterfly in front of a chasing penguin. */
  leadButterfly(b: { tx: number; ty: number }, x: number, y: number) {
    b.tx = x;
    b.ty = y;
  }

  private updateBall(dt: number) {
    const b = this.spots.ball;
    if (!b || b.held) return;
    const ground = b.laneY - 22;
    if (b.y < ground || Math.abs(b.vy) > 1 || Math.abs(b.vx) > 1) {
      b.vy += 1500 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > ground) {
        b.y = ground;
        b.vy = Math.abs(b.vy) > 140 ? -b.vy * 0.55 : 0;
        b.vx *= 0.75;
        if (Math.abs(b.vx) < 8) b.vx = 0;
      }
      const l = this.world.layout;
      if (b.x < l.left + 30 || b.x > l.right - 30) {
        b.x = Phaser.Math.Clamp(b.x, l.left + 30, l.right - 30);
        b.vx = -b.vx * 0.6;
      }
      b.img.angle += b.vx * dt * 2.2;
    }
    b.img.setPosition(b.x, b.y).setDepth(1000 + b.laneY + 1);
  }

  relayout() {
    // Props/emitters depend on the visible slice: rebuild quietly for the new size.
    if (this.appliedSeason === null) return;
    this.buildProps(true);
    this.buildWeather(true);
    this.buildNightLife();
  }

  destroy() {
    this.stopEmitters(true);
    this.clearProps(true);
    this.foreground?.destroy();
    this.fireflies.forEach(f => f.img.destroy());
  }
}
