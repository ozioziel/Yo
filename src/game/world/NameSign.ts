import Phaser from 'phaser';
import { bridge } from '../bridge';
import type { RopeHandle } from '../bridge';
import { drawFrost } from '../frost';
import { worldToCss } from '../layout';
import { sfx } from '../sfx';
import type { World } from './World';

export const FULL_NAME = 'Oziel Rodman Ramos Torrez';
export const DISPLAY_FONT = '"Fredoka Variable", "Fredoka", "Trebuchet MS", sans-serif';
const LETTER_FILL = '#f7efdf';
const O_FILL = '#efb83d';
const INK = '#080c0b';
const ROPE = 0xb58c55;
const GRAVITY = 2300;

interface Letter {
  t: Phaser.GameObjects.Text;
  ch: string;
  line: number;
  hx: number; // hanging x (centre)
  hy: number; // hanging top y
  phase: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  va: number;
  restY: number;
  resting: boolean;
  hit: boolean;
  frost: Phaser.GameObjects.Image | null;
  frostPad?: number;
}

let frostSerial = 0;

interface Rope {
  img: Phaser.GameObjects.Image;
  x: number;
  y0: number;
  y1: number;
  cut: boolean;
}

export type Cutter = 'visitor' | 'climber' | 'timeout';

export class NameSign {
  letters: Letter[] = [];
  ropes: Rope[] = [];
  private garlands: { x0: number; x1: number; y: number }[] = [];
  private gfx: Phaser.GameObjects.Graphics;
  private anchors: Phaser.GameObjects.Image[] = [];
  private hint: Phaser.GameObjects.Image | null = null;
  private debris: { img: Phaser.GameObjects.Image; vx: number; vy: number; va: number }[] = [];
  private frostKeys: string[] = [];
  fontSize = 100;
  isCut = false;
  cutBy: Cutter | null = null;
  formed = false;
  private cutAt = 0;
  private forming = false;
  /** Rope the climber cuts, and where the ladder goes. */
  ladderRope = 0;
  ladderX = 0;
  cutY = 0;
  garlandY = 0;

  constructor(readonly world: World) {
    this.gfx = world.scene.add.graphics().setDepth(2990);
    this.build();
  }

  private get scene() {
    return this.world.scene;
  }

  private style(size: number, fill: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: DISPLAY_FONT,
      fontSize: `${Math.round(size)}px`,
      fontStyle: '600',
      color: fill,
      stroke: INK,
      strokeThickness: Math.max(4, Math.round(size * 0.09)),
      padding: { x: 4, y: 4 },
    };
  }

  private build() {
    const l = this.world.layout;
    // Widths at 100px with the same per-letter layout used below (garland ends included).
    const lineWidth = (text: string) =>
      [...text].reduce((s, ch) => s + (ch === ' ' ? 32 : this.measure(ch, 100)) + 4, -4) + 70;
    const full = lineWidth(FULL_NAME);
    const half = Math.max(lineWidth('Oziel Rodman'), lineWidth('Ramos Torrez'));
    // Leave room on the right for the ladder that will reach the last rope.
    const margin = l.viewW * 0.05;
    const reserve = l.portrait ? 170 : 250;
    const room = l.viewW - margin * 2 - reserve;
    let lines = [FULL_NAME];
    let size = Math.min(118, (room / full) * 100);
    if (size < 74) {
      lines = ['Oziel Rodman', 'Ramos Torrez'];
      size = Math.min(122, (room / half) * 100);
    }
    this.fontSize = size;
    const bottomY = l.portrait ? 560 : 500;
    const gap = size * 1.75;
    const cx = l.left + margin + room / 2;
    const top = l.top - 12;
    lines.forEach((text, line) => {
      const gy = bottomY - (lines.length - 1 - line) * gap;
      const widths = [...text].map(ch => (ch === ' ' ? size * 0.32 : this.measure(ch, size)));
      const spacing = size * 0.04;
      const total = widths.reduce((a, b) => a + b, 0) + spacing * (widths.length - 1);
      let x = cx - total / 2;
      [...text].forEach((ch, i) => {
        const w = widths[i];
        if (ch !== ' ') {
          const isO = ch === 'O';
          const t = this.scene.add.text(x + w / 2, gy + size * 0.12, ch, this.style(size, isO ? O_FILL : LETTER_FILL)).setOrigin(0.5, 0).setDepth(3000);
          t.setShadow(0, size * 0.04, 'rgba(8,12,11,0.25)', 0, true, true);
          this.letters.push({ t, ch, line, hx: t.x, hy: t.y, phase: Math.random() * 6, x: t.x, y: t.y, vx: 0, vy: 0, va: 0, restY: 0, resting: false, hit: false, frost: null });
        }
        x += w + spacing;
      });
      const x0 = cx - total / 2 - size * 0.35;
      const x1 = cx + total / 2 + size * 0.35;
      this.garlands.push({ x0, x1, y: gy });
      const ropeXs = line === 0 && lines.length === 1 ? [x0, x0 + (x1 - x0) / 3, x0 + ((x1 - x0) * 2) / 3, x1] : [x0, x1];
      for (const rx of ropeXs) {
        const y0 = line === 0 ? top : this.garlands[line - 1].y;
        this.addRope(rx, y0, gy);
        if (line === 0) this.anchors.push(this.scene.add.image(rx, top + 6, 'anchor').setScale(0.55).setDepth(2995));
      }
    });
    this.garlandY = bottomY;
    this.ladderRope = this.ropes.length - 1; // right end of the lowest line
    const rope = this.ropes[this.ladderRope];
    this.cutY = bottomY - size * 0.45;
    this.ladderX = Math.min(rope.x + 46, l.right - 110);
    if (this.world.season === 0) this.frostLetters();
    this.emitHandles();
  }

  private measure(ch: string, size: number) {
    const t = this.scene.add.text(0, 0, ch, { ...this.style(size, LETTER_FILL), padding: { x: 0, y: 0 } }).setVisible(false);
    const w = t.width - Math.max(4, Math.round(size * 0.09));
    t.destroy();
    return w;
  }

  private addRope(x: number, y0: number, y1: number) {
    const img = this.scene.add.image(x, y0, 'rope_intact').setOrigin(0.5, 0).setDepth(2980);
    img.setScale(0.62, (y1 - y0) / 512);
    this.ropes.push({ img, x, y0, y1, cut: false });
  }

  /** Winter: each hanging letter gets snow and icicles that follow its own top edge. */
  private frostLetters() {
    for (const L of this.letters) {
      L.t.setTint(0xe3f4ff);
      const src = L.t.canvas;
      const pad = Math.round(this.fontSize * 0.24);
      const key = `frost_letter_${frostSerial++}`;
      const tex = this.scene.textures.createCanvas(key, src.width, src.height + pad);
      if (!tex) continue;
      const mask = src.getContext('2d')!.getImageData(0, 0, src.width, src.height);
      drawFrost(tex.context, mask, pad, { em: this.fontSize, thickness: 0.1, seed: frostSerial * 13 });
      tex.refresh();
      this.frostKeys.push(key);
      L.frostPad = pad;
      L.frost = this.scene.add.image(L.t.x, L.t.y, key).setOrigin(0.5, pad / (src.height + pad)).setDepth(3001);
    }
  }

  onSeason() {
    // The hanging name only exists during the intro, when the season cannot change.
  }

  emitHandles() {
    if (this.isCut) {
      bridge.emit('ropes', []);
      return;
    }
    const l = this.world.layout;
    const handles: RopeHandle[] = this.ropes.map((r, id) => {
      const a = worldToCss(l, r.x, r.y0);
      const b = worldToCss(l, r.x, r.y1);
      return { id, cssX: a.x, cssY: Math.max(0, a.y), cssH: b.y - Math.max(0, a.y) };
    });
    bridge.emit('ropes', handles);
  }

  ropeAt(wx: number, wy: number, slop: number) {
    if (this.isCut) return -1;
    return this.ropes.findIndex(r => Math.abs(wx - r.x) <= slop && wy >= r.y0 && wy <= r.y1 + 10);
  }

  showTouchHint() {
    if (this.isCut || this.hint || !this.scene.textures.exists('scissors_touch')) return;
    const r = this.ropes[this.ladderRope];
    this.hint = this.scene.add.image(r.x + 44, (r.y0 + r.y1) / 2 + 120, 'scissors_touch').setScale(0.6).setAlpha(0).setDepth(3050);
    this.scene.tweens.add({ targets: this.hint, alpha: 0.9, duration: 400 });
    this.scene.tweens.add({ targets: this.hint, x: r.x + 30, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Idempotent: one cut — on any rope, by anyone — drops the whole name. */
  cut(index: number, by: Cutter, touchAt?: { x: number; y: number }) {
    if (this.isCut) return false;
    this.isCut = true;
    this.cutBy = by;
    this.cutAt = this.scene.time.now;
    const rope = this.ropes[Math.max(0, index)];
    const cutY = by === 'climber' ? this.cutY : touchAt ? Phaser.Math.Clamp(touchAt.y, rope.y0 + 40, rope.y1 - 10) : Math.min(rope.y1 - 30, this.world.layout.top + (rope.y1 - this.world.layout.top) * 0.75);
    sfx.snip();
    if (touchAt && this.scene.textures.exists('scissors_touch')) {
      const s = this.scene.add.image(rope.x + 30, cutY, 'scissors_touch').setScale(0.55).setDepth(3060);
      this.scene.tweens.add({ targets: s, alpha: 0, scale: 0.7, delay: 250, duration: 400, onComplete: () => s.destroy() });
    }
    this.hint?.destroy();
    this.hint = null;
    if (this.scene.anims.exists('fx:fx_cut')) {
      const fx = this.scene.add.sprite(rope.x, cutY, 'fx_cut', 'fx_cut_000').setScale(0.7).setDepth(3100);
      fx.play('fx:fx_cut').once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
    }
    // every rope goes slack: the cut one keeps a frayed top, the others swing free
    this.ropes.forEach((r, i) => {
      r.cut = true;
      const end = i === index ? cutY : r.y0 + (r.y1 - r.y0) * 0.55;
      if (r.y0 > this.world.layout.top) {
        // a rope hanging from the upper line falls with it
        this.debris.push({ img: r.img, vx: Phaser.Math.Between(-60, 60), vy: 0, va: Phaser.Math.Between(-90, 90) });
        return;
      }
      r.img.setTexture('rope_cut_top').setScale(0.62, Math.max(0.2, (end - r.y0) / 256));
      this.scene.tweens.add({ targets: r.img, angle: { from: i % 2 ? 7 : -7, to: 0 }, duration: 1800, ease: 'Elastic.easeOut', easeParams: [1.2, 0.3] });
      if (i === index) {
        const frag = this.scene.add.image(r.x, cutY + 20, 'rope_fragment').setScale(0.6).setDepth(3000);
        this.debris.push({ img: frag, vx: Phaser.Math.Between(-40, 40), vy: 60, va: Phaser.Math.Between(-200, 200) });
      }
    });
    // the garland snaps into pieces
    for (const g of this.garlands) {
      for (let k = 0; k < 3; k++) {
        const frag = this.scene.add.image(g.x0 + ((g.x1 - g.x0) * (k + 0.5)) / 3, g.y, 'rope_fragment').setScale(0.55).setAngle(90).setDepth(3000);
        this.debris.push({ img: frag, vx: Phaser.Math.Between(-80, 80), vy: Phaser.Math.Between(0, 60), va: Phaser.Math.Between(-160, 160) });
      }
    }
    this.gfx.clear();
    const l = this.world.layout;
    for (const L of this.letters) {
      const h = L.t.height;
      L.t.setOrigin(0.5, 0.5);
      L.x = L.t.x;
      L.y = L.t.y + h / 2;
      L.vx = Phaser.Math.Between(-70, 70);
      L.vy = Phaser.Math.Between(0, 90);
      L.va = Phaser.Math.Between(-140, 140);
      L.restY = Phaser.Math.Between(l.laneMin, l.laneMax) - h * 0.36;
      if (L.frost) L.frost.setOrigin(0.5, ((L.frostPad ?? 0) + h / 2) / (h + (L.frostPad ?? 0)));
    }
    this.anchors.forEach(a => this.scene.tweens.add({ targets: a, alpha: 0.6, duration: 600 }));
    bridge.emit('ropes', []);
    this.world.director.onCut(by);
    return true;
  }

  update(dt: number) {
    const now = this.scene.time.now;
    if (!this.isCut) {
      const swing = this.world.reducedMotion ? 0 : 2.2;
      this.gfx.clear();
      for (const g of this.garlands) {
        this.gfx.lineStyle(9, 0x080c0b, 1);
        this.strokeGarland(g);
        this.gfx.lineStyle(5, ROPE, 1);
        this.strokeGarland(g);
      }
      this.gfx.lineStyle(3, 0x6d5233, 1);
      for (const L of this.letters) {
        const a = Math.sin(now / 620 + L.phase) * swing;
        L.t.setAngle(a);
        this.gfx.lineBetween(L.hx, L.hy - this.fontSize * 0.12 + 4, L.hx, L.hy + 6);
        if (L.frost) L.frost.setPosition(L.hx, L.hy).setAngle(a);
      }
      return;
    }
    const l = this.world.layout;
    let allRest = true;
    for (const L of this.letters) {
      if (this.forming) break;
      if (!L.resting) {
        allRest = false;
        L.vy += GRAVITY * dt;
        L.x += L.vx * dt;
        L.y += L.vy * dt;
        const rot = L.t.angle + L.va * dt;
        L.t.setAngle(rot);
        const half = L.t.width * 0.4;
        if (L.x < l.left + half || L.x > l.right - half) {
          L.x = Phaser.Math.Clamp(L.x, l.left + half, l.right - half);
          L.vx = -L.vx * 0.5;
        }
        if (L.y >= L.restY) {
          L.y = L.restY;
          if (Math.abs(L.vy) > 170) {
            L.vy = -Math.abs(L.vy) * 0.42;
            L.vx *= 0.7;
            L.va = -L.va * 0.5 + L.vx * 0.4;
            sfx.tok(0.8 + (L.ch.charCodeAt(0) % 7) * 0.08);
          } else {
            L.vy = 0;
            L.vx = 0;
            L.va = 0;
            L.resting = true;
            const settle = Math.round(L.t.angle / 90) * 90;
            this.scene.tweens.add({ targets: L.t, angle: Math.abs(settle) > 90 ? 0 : settle, duration: 220 });
          }
        }
        this.hitPenguins(L);
      }
      L.t.setPosition(L.x, L.y).setDepth(L.resting || L.y > 860 ? 1000 + L.restY + L.t.height * 0.36 : 3000);
      if (L.frost) L.frost.setPosition(L.x, L.y).setAngle(L.t.angle).setDepth(L.t.depth + 1);
    }
    for (const d of this.debris) {
      d.vy += GRAVITY * 0.7 * dt;
      d.img.x += d.vx * dt;
      d.img.y += d.vy * dt;
      d.img.angle += d.va * dt;
      if (d.img.y > 1090) d.img.setVisible(false);
    }
    if (!this.forming && !this.formed && (allRest || now - this.cutAt > 3000) && now - this.cutAt > 1300) void this.formTitle();
  }

  private strokeGarland(g: { x0: number; x1: number; y: number }) {
    const pts: Phaser.Math.Vector2[] = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push(new Phaser.Math.Vector2(g.x0 + (g.x1 - g.x0) * t, g.y + Math.sin(t * Math.PI) * this.fontSize * 0.08));
    }
    this.gfx.strokePoints(pts, false);
  }

  private hitPenguins(L: Letter) {
    if (L.hit || L.vy < 220) return;
    for (const p of this.world.penguins) {
      if (!p.present || !p.grounded || p.swimming) continue;
      if (Math.abs(L.x - p.x) > p.halfW + L.t.width * 0.25) continue;
      const bottom = L.y + L.t.height * 0.35;
      if (bottom < p.headY || L.y > p.y - 60 * p.size) continue;
      L.hit = true;
      L.vy = -Math.abs(L.vy) * 0.35;
      L.vx += (L.x < p.x ? -1 : 1) * 90;
      sfx.tok(1.4);
      if (Math.random() < 0.35) p.knockDown(L.x, 0.25, 1);
      else {
        p.say('surprise', 900);
        this.world.stagger(p, L.x);
      }
      return;
    }
  }

  /** The real O from the name flies into the hOme title; the rest fade away. */
  private async formTitle() {
    this.forming = true;
    const O = this.letters.find(L => L.ch === 'O');
    for (const L of this.letters) {
      if (L === O) continue;
      L.frost?.destroy();
      this.scene.tweens.add({
        targets: L.t,
        alpha: 0,
        y: L.t.y + 24,
        delay: Phaser.Math.Between(0, 450),
        duration: 650,
        onStart: () => this.world.env.puff(L.t.x, L.t.y + L.t.height * 0.2, 0.35),
        onComplete: () => L.t.destroy(),
      });
    }
    bridge.emit('phase', 'falling');
    if (!O) {
      this.finish();
      return;
    }
    O.frost?.destroy();
    O.frost = null;
    O.t.clearTint();
    // let React lay out the title before measuring it
    await this.world.delay(120);
    const target = bridge.titleOTarget();
    const l = this.world.layout;
    let tx = l.left + l.viewW / 2;
    let ty = l.top + l.viewH * 0.32;
    let scale = 1.2;
    if (target) {
      tx = l.scrollX + target.cx / l.zoomCss;
      ty = l.scrollY + target.cy / l.zoomCss;
      scale = target.fontSize / l.zoomCss / this.fontSize;
    }
    const sx = O.t.x;
    const sy = O.t.y;
    const s0 = O.t.scale;
    const a0 = O.t.angle;
    const cx = (sx + tx) / 2;
    const cy = Math.min(sy, ty) - 260;
    O.t.setDepth(6800);
    const dur = this.world.reducedMotion ? 500 : 1150;
    await new Promise<void>(resolve => {
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: dur,
        ease: 'Sine.easeInOut',
        onUpdate: tw => {
          const t = tw.getValue() ?? 0;
          const u = 1 - t;
          O.t.setPosition(u * u * sx + 2 * u * t * cx + t * t * tx, u * u * sy + 2 * u * t * cy + t * t * ty);
          O.t.setScale(s0 + (scale - s0) * t);
          O.t.setAngle(a0 * u);
        },
        onComplete: () => resolve(),
      });
    });
    O.t.setAngle(0);
    sfx.sparkle();
    if (this.scene.anims.exists('fx:fx_o_glow')) {
      const glow = this.scene.add.sprite(tx, ty, 'fx_o_glow', 'fx_o_glow_000').setScale((this.fontSize * scale) / 90).setDepth(6790);
      glow.play('fx:fx_o_glow').once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => glow.destroy());
    }
    this.finish();
    this.scene.tweens.add({ targets: O.t, alpha: 0, delay: 420, duration: 260, onComplete: () => O.t.destroy() });
  }

  private finish() {
    // the frayed ropes and anchors were part of the intro set: they retract and go
    const leftovers = [...this.ropes.map(r => r.img), ...this.anchors, ...this.debris.map(d => d.img)];
    this.scene.tweens.add({
      targets: leftovers,
      alpha: 0,
      y: `-=${80}`,
      delay: 900,
      duration: 1100,
      ease: 'Sine.easeIn',
      onComplete: () => leftovers.forEach(o => o.setVisible(false)),
    });
    this.formed = true;
    this.world.titleFormed = true;
    this.world.setPhase('reveal');
    this.world.director.onTitleFormed();
  }

  relayout() {
    if (this.isCut) return;
    this.letters.forEach(L => {
      L.t.destroy();
      L.frost?.destroy();
    });
    this.ropes.forEach(r => r.img.destroy());
    this.anchors.forEach(a => a.destroy());
    this.hint?.destroy();
    this.hint = null;
    this.letters = [];
    this.ropes = [];
    this.anchors = [];
    this.garlands = [];
    this.build();
  }

  destroy() {
    this.letters.forEach(L => {
      L.t.destroy();
      L.frost?.destroy();
    });
    this.ropes.forEach(r => r.img.destroy());
    this.anchors.forEach(a => a.destroy());
    this.debris.forEach(d => d.img.destroy());
    this.hint?.destroy();
    this.gfx.destroy();
    this.frostKeys.forEach(k => this.scene.textures.exists(k) && this.scene.textures.remove(k));
  }
}
