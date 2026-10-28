import Phaser from 'phaser';
import { sfx } from '../sfx';
import type { Penguin } from './Penguin';
import type { World } from './World';

export type LadderState = 'away' | 'carried' | 'lying' | 'raising' | 'upright';

const LEN = 512; // source px (rails), rungs at y = 37 + 48 i from the top
const CARRY_ANGLE = 72; // degrees from vertical, extending behind the carrier
const GRIP = 0.18; // fraction of the length from the bottom where it is held

/**
 * One ladder for the whole page. Its origin is the bottom-centre so every state
 * (carried, lying, upright) is expressed as bottom position + angle.
 */
export class Ladder {
  state: LadderState = 'away';
  readonly img: Phaser.GameObjects.Image;
  private feet: Phaser.GameObjects.Image[] = [];
  x = 0; // bottom centre
  y = 0;
  angle = 0;
  laneY = 0;
  scale = 1;
  carrier: Penguin | null = null;
  holders = new Set<Penguin>();
  assembled = false;
  private wobble = 0;
  private tween: Phaser.Tweens.Tween | null = null;

  constructor(readonly world: World) {
    this.img = world.scene.add.image(0, 0, 'ladder_complete').setOrigin(0.5, 1).setVisible(false);
    for (let i = 0; i < 2; i++) this.feet.push(world.scene.add.image(0, 0, 'ladder_foot').setOrigin(0.5, 1).setVisible(false));
  }

  get length() {
    return LEN * this.scale;
  }

  /** World y of a rung, counted from the bottom (0 = lowest). */
  rungY(i: number) {
    const fromTop = 37 + 48 * (9 - i);
    return this.y - (LEN - fromTop) * this.scale;
  }

  get topY() {
    return this.y - this.length;
  }

  setScaleFor(feetTargetY: number, baseY: number) {
    // a climber stands two rungs below the top (rung 7 from the bottom)
    this.scale = Phaser.Math.Clamp((baseY - feetTargetY) / (LEN - 37 - 48 * 2), 0.6, 1.6);
  }

  setTint(t: number) {
    this.img.setTint(t);
    this.feet.forEach(f => f.setTint(t));
  }

  private stopTween() {
    this.tween?.stop();
    this.tween = null;
  }

  /** Attach to a penguin's back flipper; the ladder trails behind it. */
  pickUp(p: Penguin) {
    this.stopTween();
    this.state = 'carried';
    this.carrier = p;
    this.assembled = false;
    this.holders.clear();
    this.img.setVisible(true);
    this.feet.forEach(f => f.setVisible(false));
    this.laneY = p.laneY;
    p.attach({
      obj: this.img,
      anchor: 'hn',
      depthOffset: -0.5,
      follow: (hand, who) => {
        const dir = who.sprite.flipX ? -1 : 1; // trailing side
        this.angle = dir * CARRY_ANGLE;
        const rad = Phaser.Math.DegToRad(this.angle);
        const grip = GRIP * this.length;
        this.x = hand.x - Math.sin(rad) * grip;
        this.y = hand.y + Math.cos(rad) * grip;
        this.laneY = who.laneY;
      },
      onLost: () => this.drop(),
    });
  }

  /** Let go: it falls flat on the ground. */
  drop() {
    if (this.state !== 'carried' && this.state !== 'raising') return;
    this.carrier = null;
    this.stopTween();
    this.state = 'lying';
    const target = this.angle >= 0 ? 90 : -90;
    this.tween = this.world.scene.tweens.add({
      targets: this,
      angle: target,
      y: this.laneY,
      duration: 380,
      ease: 'Quad.easeIn',
      onComplete: () => {
        sfx.thud(1);
        this.world.env.dust(this.x + Math.sign(target) * this.length * 0.5, this.laneY, 1);
      },
    });
  }

  /** Grip point on a lying ladder, where a penguin can pick it up. */
  gripX() {
    return this.x + Math.sin(Phaser.Math.DegToRad(this.angle)) * GRIP * this.length;
  }

  /** Swing upright at x, then it stands on its own (the helpers hold it). */
  raise(x: number, ms: number): Promise<void> {
    this.stopTween();
    const carrier = this.carrier;
    if (carrier) carrier.detach(this.img);
    this.carrier = null;
    this.state = 'raising';
    return new Promise(resolve => {
      this.tween = this.world.scene.tweens.add({
        targets: this,
        x,
        y: this.laneY,
        angle: 0,
        duration: ms,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.state = 'upright';
          this.tween = null;
          sfx.tok(0.7);
          resolve();
        },
      });
    });
  }

  /** Lower an upright ladder into a carry pose for p. */
  takeDown(p: Penguin) {
    this.stopTween();
    this.feet.forEach(f => f.setVisible(false));
    this.assembled = false;
    this.pickUp(p);
  }

  showFoot(i: 0 | 1) {
    const f = this.feet[i];
    f.setVisible(true).setScale(this.scale * 0.5).setAlpha(0);
    this.world.scene.tweens.add({ targets: f, alpha: 1, duration: 120 });
    sfx.tok(1.1);
  }

  hide() {
    this.stopTween();
    this.state = 'away';
    this.carrier = null;
    this.holders.clear();
    this.assembled = false;
    this.img.setVisible(false);
    this.feet.forEach(f => f.setVisible(false));
  }

  shake() {
    this.wobble = 1;
  }

  update() {
    if (this.state === 'away') return;
    let angle = this.angle;
    if (this.state === 'upright') {
      // Nobody holding while someone climbs: it wobbles (never falls by itself).
      if (this.holders.size === 0 && this.world.penguins.some(p => p.task?.tag === 'climb' && p.y < p.laneY - 10)) this.wobble = Math.min(1, this.wobble + 0.05);
      this.wobble *= 0.96;
      angle += Math.sin(this.world.scene.time.now / 90) * 3 * this.wobble;
    }
    this.img
      .setPosition(this.x, this.y)
      .setAngle(angle)
      .setScale(this.scale)
      .setDepth(this.carrier ? this.carrier.sprite.depth - 0.5 : 1000 + this.laneY - 3);
    if (this.state === 'upright') {
      const dx = 58 * this.scale;
      this.feet[0].setPosition(this.x - dx, this.y + 2).setDepth(1000 + this.laneY - 2);
      this.feet[1].setPosition(this.x + dx, this.y + 2).setDepth(1000 + this.laneY - 2);
    }
  }

  relayout() {
    if (this.state === 'away') return;
    this.x = this.world.clampX(this.x, 40);
  }

  destroy() {
    this.stopTween();
    this.img.destroy();
    this.feet.forEach(f => f.destroy());
  }
}
