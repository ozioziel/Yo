import Phaser from 'phaser';
import { sfx } from '../sfx';
import type { Cutter } from './NameSign';
import type { Act, Penguin, Task } from './Penguin';
import type { World } from './World';

type Slot = 'carrier' | 'placer' | 'assembler0' | 'assembler1';

/**
 * Intro choreography. Story beats are flags; every role is a restartable task, so a
 * visitor can grab anyone at any time and the scene continues: the slot is handed to
 * the nearest free penguin, and the engineer role follows whoever wears the helmet.
 */
export class Director {
  flags = { looked: false, lightsOff: false, lightsDone: false, gathered: false, decided: false, raised: false, assembled: false };
  private cancelled = false;
  private started = false;
  private t0 = 0;
  private T: number;
  private slots: Record<Slot, Penguin | null> = { carrier: null, placer: null, assembler0: null, assembler1: null };
  private holders: [Penguin | null, Penguin | null] = [null, null];
  private stage: 'story' | 'fetch' | 'assemble' | 'hold' | 'done' = 'story';
  private gatherX = new Map<Penguin, number>();
  private arrivals: { p: Penguin; at: number }[] = [];
  private nextWatch = 0;
  private hintShown = false;
  private blackout: Phaser.GameObjects.Rectangle;
  private eyes: Phaser.GameObjects.Graphics;
  private post: Phaser.GameObjects.Graphics;
  private plate: Phaser.GameObjects.Image;
  private postX = 0;
  private postLane = 0;
  private lightsTimer: Phaser.Time.TimerEvent | null = null;

  constructor(readonly world: World) {
    this.T = world.reducedMotion ? 0.55 : 1;
    const scene = world.scene;
    this.blackout = scene.add.rectangle(0, 0, 10, 10, 0x05080c, 1).setOrigin(0).setDepth(8000).setAlpha(0);
    this.eyes = scene.add.graphics().setDepth(8001);
    this.post = scene.add.graphics();
    this.plate = scene.add.image(0, 0, 'switch_on').setScale(0.4);
    this.layoutProps();
  }

  private get l() {
    return this.world.layout;
  }

  private get sign() {
    return this.world.sign;
  }

  private layoutProps() {
    const l = this.l;
    this.blackout.setPosition(l.left - 50, l.top - 50).setSize(l.viewW + 100, l.viewH + 100);
    this.postX = l.left + l.viewW * (l.portrait ? 0.13 : 0.12);
    this.postLane = l.laneMin + 4;
    const handY = this.postLane - 69;
    const g = this.post;
    g.clear();
    g.fillStyle(0x080c0b, 1).fillRoundedRect(this.postX - 11, handY - 30, 22, this.postLane - handY + 34, 6);
    g.fillStyle(0x9a6b3c, 1).fillRoundedRect(this.postX - 7, handY - 26, 14, this.postLane - handY + 26, 4);
    g.fillStyle(0x7c5530, 1).fillRect(this.postX + 1, handY - 20, 4, this.postLane - handY + 18);
    g.setDepth(1000 + this.postLane - 4);
    this.plate.setPosition(this.postX, handY).setDepth(1000 + this.postLane - 3);
    this.plate.setVisible(this.stage !== 'done');
    this.post.setVisible(this.stage !== 'done');
  }

  private get engineerStopX() {
    return this.postX + 48;
  }

  // ------------------------------------------------------------------ start
  start() {
    if (this.started) return;
    this.started = true;
    this.t0 = this.world.scene.time.now;
    const ps = this.world.penguins;
    const eng = ps.find(p => p.engineer)!;
    eng.laneY = this.postLane + 2;
    eng.y = eng.laneY;
    eng.x = this.l.left - 120;
    eng.present = true;
    eng.setTask(this.engineerTask());
    this.planArrivals(ps.filter(p => p !== eng));
    void this.run();
  }

  private planArrivals(helpers: Penguin[]) {
    const l = this.l;
    const spanMin = l.left + l.viewW * (l.portrait ? 0.2 : 0.25);
    const spanMax = Math.min(l.right - 110, this.sign.ladderX - (l.portrait ? 110 : 150));
    const n = helpers.length;
    let at = 8000 * this.T;
    helpers.forEach((p, i) => {
      const fromLeft = i % 2 === 1;
      const slot = spanMin + ((spanMax - spanMin) * (i + 0.5)) / n;
      this.gatherX.set(p, slot + Phaser.Math.Between(-30, 30));
      p.x = fromLeft ? l.left - 140 - Math.random() * 60 : l.right + 140 + Math.random() * 60;
      p.y = p.laneY;
      this.arrivals.push({ p, at });
      if (this.world.reducedMotion) at += 250;
      else if (i < 3) at += 800;
      else at += i % 3 === 2 ? 900 : 300;
    });
  }

  private async run() {
    const w = this.world;
    const T = this.T;
    const ok = () => !this.cancelled;
    await w.until(() => this.flags.lightsDone || this.cancelled, 22000 * T);
    if (!ok()) return;
    this.lightsOn();
    this.flags.lightsDone = true;
    const lastArrival = this.arrivals.length ? this.arrivals[this.arrivals.length - 1].at : 0;
    await w.until(() => this.cancelled || (w.scene.time.now - this.t0 > lastArrival + 2600 * T), 40000);
    if (!ok()) return;
    this.flags.gathered = true;
    // the engineer explains the plan while someone already runs for the ladder
    this.stage = 'fetch';
    await w.until(() => this.flags.raised || this.cancelled, 30000);
    if (!ok()) return;
    if (!this.flags.raised) this.forceRaise();
    this.stage = 'assemble';
    await w.until(() => this.flags.assembled || this.cancelled, 7000 * T + 2000);
    if (!ok()) return;
    if (!this.flags.assembled) {
      w.ladder.showFoot(0);
      w.ladder.showFoot(1);
      this.flags.assembled = true;
    }
    this.stage = 'hold';
    // the engineer climbs and cuts; if anything stalls for too long the rope gives way by itself
    await w.until(() => this.cancelled, 40000);
    if (!ok()) return;
    this.sign.cut(this.sign.ladderRope, 'timeout');
  }

  // ------------------------------------------------------------------ lights
  lightsOff() {
    if (this.flags.lightsOff || this.cancelled) return;
    this.flags.lightsOff = true;
    sfx.click();
    this.plate.setTexture('switch_off');
    this.world.scene.tweens.add({ targets: this.blackout, alpha: 0.94, duration: 140 });
    // the light comes back even if the engineer is whisked away in the dark
    this.lightsTimer = this.world.scene.time.delayedCall(2600 * this.T, () => this.lightsOn());
  }

  lightsOn() {
    this.lightsTimer?.remove(false);
    this.lightsTimer = null;
    if (this.blackout.alpha > 0 || this.plate.texture.key === 'switch_off') {
      if (this.flags.lightsOff && !this.flags.lightsDone) sfx.click();
      this.plate.setTexture('switch_on');
      this.world.scene.tweens.killTweensOf(this.blackout);
      this.world.scene.tweens.add({ targets: this.blackout, alpha: 0, duration: 160 });
    }
    this.flags.lightsDone = true;
  }

  private drawEyes() {
    const g = this.eyes;
    g.clear();
    if (this.blackout.alpha < 0.3) return;
    const t = this.world.scene.time.now;
    const blink = (t % 1700) < 120 ? 0.15 : 1;
    for (const p of this.world.penguins) {
      if (!p.present) continue;
      const cx = p.x + (p.sprite.flipX ? 12 : -12) * p.size;
      const cy = p.y - 150 * p.size;
      for (const s of [-1, 1]) {
        const ex = cx + s * 17 * p.size;
        g.fillStyle(0xffffff, this.blackout.alpha).fillEllipse(ex, cy, 20 * p.size, 26 * p.size * blink);
        g.fillStyle(0x080c0b, this.blackout.alpha).fillEllipse(ex + (p.sprite.flipX ? 3 : -3) * p.size, cy + 2 * p.size, 9 * p.size, 12 * p.size * blink);
      }
    }
  }

  // ------------------------------------------------------------------ tasks
  private engineerTask(): Task {
    return {
      name: 'intro-engineer',
      owner: 'director',
      tag: 'engineer',
      run: async act => {
        const p = act.p;
        if (!this.flags.lightsDone) {
          await act.walkTo(this.engineerStopX, { offscreen: true, speed: 150 });
          if (!this.flags.looked) {
            act.face(1);
            await act.once('notice_name');
            p.say('question', 1700 * this.T);
            await act.once('look_up');
            await act.wait(650 * this.T);
            this.flags.looked = true;
          }
          act.face(1);
          if (!this.flags.lightsOff) {
            await act.once('switch_light', { 3: () => this.lightsOff() });
            await act.wait(1500 * this.T);
          }
          await act.once('switch_light', { 3: () => this.lightsOn() });
          this.lightsOn();
          p.say('surprise', 900);
          await act.once('confused');
          await act.once('laugh');
        }
        if (!this.flags.decided) {
          act.play('look_around');
          await act.until(() => this.flags.gathered, 30000);
          const crowd = this.crowdCenter();
          await act.walkTo(crowd - 150, { speed: 170 });
          act.faceX(crowd);
          await act.once('greet');
          this.flags.decided = true;
        }
        // wait near the ladder spot, looking up at the rope
        if (!this.ladderReady()) {
          await act.walkTo(this.sign.ladderX - 190, { speed: 170 });
          act.faceX(this.sign.ladderX);
          act.play('look_up');
          await act.until(() => this.ladderReady(), 60000);
        }
        await this.climb(act);
      },
    };
  }

  private crowdCenter() {
    const xs = [...this.gatherX.values()];
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : this.l.left + this.l.viewW / 2;
  }

  private ladderReady() {
    const L = this.world.ladder;
    return L.state === 'upright' && this.flags.assembled && L.holders.size > 0;
  }

  private async climb(act: Act) {
    const p = act.p;
    const L = this.world.ladder;
    const tag = p.task;
    if (tag) tag.tag = 'climb';
    if (p.y >= p.laneY - 4) {
      await act.walkTo(L.x, { speed: 170 });
      await act.moveTo(L.x, L.laneY + 1, 220);
      p.laneY = L.laneY + 1;
    }
    p.layerBias = 2;
    act.defer(() => {
      p.layerBias = 0;
    });
    const feetTop = this.sign.cutY + 92 * p.size;
    act.play('climb');
    while (p.y > feetTop + 1) {
      if (L.holders.size === 0) {
        // nobody holds the ladder: cling on and wait for a helper
        p.sprite.anims.pause();
        await act.until(() => L.holders.size > 0, 6000);
        p.sprite.anims.resume();
      }
      const step = Math.min(48 * L.scale, p.y - feetTop);
      await act.moveTo(L.x, p.y - step, (step / 140) * 1000, 'Linear');
    }
    act.face(this.sign.ropes[this.sign.ladderRope].x < p.x ? 1 : -1);
    await act.once('reach_rope');
    await act.once('cut_rope', { 4: () => this.sign.cut(this.sign.ladderRope, 'climber') });
  }

  private gatherTask(p: Penguin): Task {
    return {
      name: 'intro-gather',
      owner: 'director',
      tag: 'gather',
      run: async act => {
        const x = this.gatherX.get(p) ?? this.world.freeX(p);
        const speed = Phaser.Math.Between(140, 200) * (this.world.reducedMotion ? 1.5 : 1);
        await act.walkTo(x, { offscreen: true, speed, clip: Math.random() < 0.25 ? 'run' : 'walk' });
        const eng = this.world.engineerPenguin;
        if (eng) act.faceX(eng.x);
        await act.once('curious');
        act.faceX(this.l.left + this.l.viewW / 2);
        await act.once('group_look_up');
        for (;;) {
          await act.loop('idle', Phaser.Math.Between(900, 2600));
          const r = Math.random();
          if (r < 0.35) await act.once('look_up');
          else if (r < 0.55) await act.once('blink');
          else if (r < 0.65) await act.once('curious');
        }
      },
    };
  }

  private carrierTask(): Task {
    return {
      name: 'intro-carrier',
      owner: 'director',
      tag: 'carrier',
      run: async act => {
        const p = act.p;
        const L = this.world.ladder;
        const spot = this.sign.ladderX;
        if (L.state === 'away') {
          await act.walkTo(this.l.right + 170, { offscreen: true, speed: 310, clip: 'run' });
          L.laneY = p.laneY;
          L.scale = this.ladderScale();
          L.pickUp(p);
          await act.walkTo(spot + 95, { offscreen: true, speed: 150, clip: 'carry_ladder' });
        } else if (L.state === 'lying') {
          await act.walkTo(L.gripX(), { speed: 200 });
          await act.once('pick_up_object', { 3: () => L.pickUp(p) });
          if (L.carrier !== p) L.pickUp(p);
          await act.walkTo(spot + 95, { speed: 125, clip: 'carry_ladder' });
        }
        if (L.state === 'carried' && L.carrier === p) {
          act.face(-1);
          await act.until(() => {
            const helper = this.slots.placer;
            return !!helper && Math.abs(helper.x - (spot - 90)) < 12 && helper.mode === 'normal';
          }, 3500);
          const raised = L.raise(spot, 950 * this.T);
          await act.once('place_ladder');
          await raised;
          this.flags.raised = true;
          sfx.thud(0);
          this.world.env.dust(spot, L.laneY, 0);
        }
        await act.until(() => L.state === 'upright', 5000);
        this.promoteToHolder(p, 0);
        await this.hold(act, 0);
      },
    };
  }

  private placerTask(): Task {
    return {
      name: 'intro-placer',
      owner: 'director',
      tag: 'placer',
      run: async act => {
        const p = act.p;
        const L = this.world.ladder;
        const spot = this.sign.ladderX;
        await act.walkTo(spot - 90, { speed: 170 });
        act.face(1);
        if (L.state !== 'upright') {
          act.play('idle');
          await act.until(() => L.state === 'raising' || L.state === 'upright', 30000);
          if (L.state === 'raising') await act.once('place_ladder');
        }
        await act.until(() => L.state === 'upright', 5000);
        this.promoteToHolder(p, 1);
        await this.hold(act, 1);
      },
    };
  }

  private assemblerTask(i: 0 | 1): Task {
    return {
      name: `intro-assembler${i}`,
      owner: 'director',
      tag: 'assembler',
      run: async act => {
        const p = act.p;
        const L = this.world.ladder;
        const side = i === 0 ? -1 : 1;
        await act.walkTo(L.x + side * (40 + p.halfW), { speed: 170 });
        act.face(side as 1 | -1);
        await act.once('assemble_ladder', { 2: () => L.showFoot(i), 5: () => sfx.tok(1.2) });
        this.assembledBy.add(i);
        if (this.assembledBy.size >= 2) this.flags.assembled = true;
        await act.once('celebrate');
        // back to watching
        this.slots[i === 0 ? 'assembler0' : 'assembler1'] = null;
        p.setTask(this.gatherTask(p));
      },
    };
  }

  private assembledBy = new Set<number>();

  private promoteToHolder(p: Penguin, i: 0 | 1) {
    if (this.slots.carrier === p) this.slots.carrier = null;
    if (this.slots.placer === p) this.slots.placer = null;
    this.holders[i] = p;
  }

  private holderTask(i: 0 | 1): Task {
    return {
      name: `intro-holder${i}`,
      owner: 'director',
      tag: 'holder',
      run: act => this.hold(act, i),
    };
  }

  private async hold(act: Act, i: 0 | 1) {
    const p = act.p;
    const L = this.world.ladder;
    const side = i === 0 ? 1 : -1;
    const hx = L.x + side * (64 * L.scale + 46 * p.size);
    await act.walkTo(hx, { speed: 170 });
    if (Math.abs(p.laneY - (L.laneY + 6)) > 1) {
      await act.moveTo(hx, L.laneY + 6, 200);
      p.laneY = L.laneY + 6;
    }
    act.face(side as 1 | -1);
    L.holders.add(p);
    act.defer(() => L.holders.delete(p));
    act.play('hold_ladder');
    await act.until(() => false, 600000);
  }

  private ladderScale() {
    const L = this.world.ladder;
    const baseY = this.world.penguins.find(p => p.task?.tag === 'carrier')?.laneY ?? this.l.laneMin + 20;
    L.setScaleFor(this.sign.cutY + 92 * 0.58, baseY);
    return L.scale;
  }

  private forceRaise() {
    const L = this.world.ladder;
    if (L.state === 'away') {
      L.laneY = this.l.laneMin + 20;
      L.scale = this.ladderScale();
      L.x = this.sign.ladderX;
      L.y = L.laneY;
      L.angle = 0;
      L.state = 'upright';
      L.img.setVisible(true).setAlpha(0);
      this.world.scene.tweens.add({ targets: L.img, alpha: 1, duration: 400 });
    } else if (L.state !== 'upright') {
      void L.raise(this.sign.ladderX, 600);
    }
    this.flags.raised = true;
  }

  // ------------------------------------------------------------------ role bookkeeping
  private isOut(p: Penguin | null) {
    return !p || !p.present || p.engineer || p.mode === 'grabbed' || p.mode === 'airborne' || p.mode === 'down';
  }

  private candidates(near: number) {
    const taken = new Set([...Object.values(this.slots), ...this.holders].filter(Boolean) as Penguin[]);
    return this.world.penguins
      .filter(p => p.present && !p.engineer && p.mode === 'normal' && !taken.has(p) && (p.task?.tag === 'gather' || !p.task))
      .filter(p => this.arrived(p))
      .sort((a, b) => Math.abs(a.x - near) - Math.abs(b.x - near));
  }

  private arrived(p: Penguin) {
    const gx = this.gatherX.get(p);
    return gx === undefined || Math.abs(p.x - gx) < 30 || p.task?.tag !== 'gather';
  }

  private vacate(p: Penguin) {
    // when it recovers it goes back to watching instead of competing for the role
    p.task = this.gatherTask(p);
  }

  private watch() {
    const L = this.world.ladder;
    const spot = this.sign.ladderX;
    const need: Slot[] = [];
    if (this.stage === 'fetch') {
      if (!this.flags.raised && L.state !== 'raising') need.push('carrier');
      if (!this.flags.raised) need.push('placer');
    }
    if (this.stage === 'assemble' || this.stage === 'hold') {
      if (!this.flags.assembled) need.push('assembler0', 'assembler1');
    }
    for (const slot of Object.keys(this.slots) as Slot[]) {
      const p = this.slots[slot];
      if (p && (this.isOut(p) || !need.includes(slot))) {
        if (this.isOut(p)) this.vacate(p);
        this.slots[slot] = null;
      }
    }
    for (const slot of need) {
      if (this.slots[slot]) continue;
      if (slot.startsWith('assembler') && this.assembledBy.has(slot === 'assembler0' ? 0 : 1)) continue;
      const p = this.candidates(slot === 'carrier' ? this.l.right : spot)[0];
      if (!p) continue;
      this.slots[slot] = p;
      p.setTask(slot === 'carrier' ? this.carrierTask() : slot === 'placer' ? this.placerTask() : this.assemblerTask(slot === 'assembler0' ? 0 : 1));
    }
    if (this.stage === 'assemble' || this.stage === 'hold') {
      for (const i of [0, 1] as const) {
        const h = this.holders[i];
        if (h && this.isOut(h)) {
          this.vacate(h);
          this.holders[i] = null;
        }
        if (!this.holders[i]) {
          const p = this.candidates(spot)[0];
          if (p) {
            this.holders[i] = p;
            p.setTask(this.holderTask(i));
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------ hooks from the world
  onUnavailable(_p: Penguin) {
    this.nextWatch = 0;
  }

  /** The engineer's story role leaves with the helmet; the ex-engineer just watches. */
  onLostHelmet(p: Penguin) {
    if (p.task?.owner !== 'director') return;
    if (p.task.tag === 'engineer' || p.task.tag === 'climb') p.task = this.cancelled ? null : this.gatherTask(p);
  }

  onNewEngineer(p: Penguin) {
    if (this.stage === 'done' || this.cancelled) {
      if (!p.task || p.task.tag === 'helmet') p.setTask(null);
      return;
    }
    for (const slot of Object.keys(this.slots) as Slot[]) if (this.slots[slot] === p) this.slots[slot] = null;
    this.holders = this.holders.map(h => (h === p ? null : h)) as [Penguin | null, Penguin | null];
    p.setTask(this.engineerTask());
  }

  /** Same outcome for the visitor's scissors, the climber's scissors and the safety timeout. */
  onCut(by: Cutter) {
    if (this.cancelled) return;
    this.cancelled = true;
    this.stage = 'done';
    this.lightsOn();
    this.blackout.setAlpha(0);
    this.eyes.clear();
    this.world.setPhase('falling');
    const l = this.l;
    for (const p of this.world.penguins) {
      if (!p.present) {
        p.present = true;
        p.setTask(this.latecomerTask());
      } else if (p.task?.tag !== 'helmet') {
        p.setTask(this.aftermathTask(by));
      }
    }
    // the switch post is part of the intro set: it fades away
    this.world.scene.tweens.add({ targets: [this.post, this.plate], alpha: 0, delay: 2500, duration: 900 });
    void l;
  }

  onTitleFormed() {
    this.world.scene.time.delayedCall(1700, () => this.world.setPhase('home'));
  }

  private aftermathTask(by: Cutter): Task {
    return {
      name: 'intro-aftermath',
      owner: 'director',
      tag: 'aftermath',
      run: async act => {
        const p = act.p;
        const l = this.l;
        if (p.y < p.laneY - 6) {
          // up on the ladder
          await act.once('react_name_fall');
          act.play('climb');
          await act.moveTo(p.x, p.laneY, ((p.laneY - p.y) / 150) * 1000, 'Linear');
          p.layerBias = 0;
        } else {
          await act.wait(Phaser.Math.Between(0, 380));
          act.faceX(l.left + l.viewW / 2);
          await act.once('react_name_fall');
          if (by === 'visitor' && Math.random() < 0.4) p.say('surprise', 1000);
        }
        await act.until(() => this.world.titleFormed, 7000);
        await act.wait(Phaser.Math.Between(0, 600));
        await act.once('celebrate');
      },
    };
  }

  private latecomerTask(): Task {
    return {
      name: 'intro-latecomer',
      owner: 'director',
      tag: 'aftermath',
      run: async act => {
        const p = act.p;
        await act.walkTo(this.world.freeX(p), { offscreen: true, speed: 190 });
        await act.once('curious');
        await act.once('look_around');
      },
    };
  }

  // ------------------------------------------------------------------ frame
  update() {
    if (!this.started) return;
    const now = this.world.scene.time.now;
    if (!this.cancelled) {
      for (const a of this.arrivals) {
        if (!a.p.present && now - this.t0 >= a.at) {
          a.p.present = true;
          a.p.setTask(this.gatherTask(a.p));
        }
      }
      if (!this.hintShown && now - this.t0 > 3000 && window.matchMedia('(pointer: coarse)').matches) {
        this.hintShown = true;
        this.sign.showTouchHint();
      }
      if (now >= this.nextWatch) {
        this.nextWatch = now + 300;
        this.watch();
      }
    }
    this.drawEyes();
  }

  relayout() {
    this.layoutProps();
  }

  cancel() {
    this.cancelled = true;
    this.lightsTimer?.remove(false);
  }
}
