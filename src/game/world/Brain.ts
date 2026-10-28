import Phaser from 'phaser';
import { bridge } from '../bridge';
import { cssToWorld } from '../layout';
import { sfx } from '../sfx';
import type { Spot } from './Environment';
import { shoreAt } from './Environment';
import type { Act, Penguin, Task } from './Penguin';
import type { World } from './World';

interface Activity {
  name: string;
  weight: number;
  seasons?: number[];
  /** Only one penguin at a time (shared props). */
  exclusive?: boolean;
  make(p: Penguin): Task | null;
}

const rand = Phaser.Math.Between;
const PART = (season: string, name: string) => `environments_${season}_particles_${name}`;

/**
 * Picks what each penguin does in the Home: everyday life plus seasonal play.
 * Weights fall for activities others are already doing, so the group never moves
 * in sync, and there is a pause between activities to avoid jittery switching.
 */
export class Brain {
  private nextAt = new Map<Penguin, number>();
  private lastMaintenance = 0;
  private activities: Activity[];

  constructor(readonly world: World) {
    this.activities = this.catalog();
  }

  private get scene() {
    return this.world.scene;
  }

  private get env() {
    return this.world.env;
  }

  update() {
    const now = this.scene.time.now;
    for (const p of this.world.penguins) {
      if (!p.present || p.mode !== 'normal' || p.task || !p.wantsTask) continue;
      const at = this.nextAt.get(p);
      if (at === undefined) {
        this.nextAt.set(p, now + rand(300, 2600));
        if (Math.random() < 0.5) p.play(Math.random() < 0.5 ? 'look_around' : 'idle');
        continue;
      }
      if (now < at) continue;
      this.nextAt.delete(p);
      const task = this.choose(p);
      if (task) p.setTask({ ...task, owner: task.owner ?? 'brain', onDone: q => this.done(q, task) });
    }
  }

  private done(p: Penguin, task: Task) {
    task.onDone?.(p);
    this.nextAt.set(p, this.scene.time.now + rand(700, 3200));
  }

  private choose(p: Penguin): Task | null {
    // keep the stage tidy: a leftover ladder is carried away first
    const L = this.world.ladder;
    if (L.state !== 'away' && !this.world.penguins.some(q => q.task?.tag === 'ladder')) return this.ladderAway(p);
    if (this.scene.time.now - this.lastMaintenance > 70000 && Math.random() < 0.25) {
      const m = this.polishButton(p);
      if (m) {
        this.lastMaintenance = this.scene.time.now;
        return m;
      }
    }
    const season = this.world.season;
    const counts = new Map<string, number>();
    for (const q of this.world.penguins) if (q !== p && q.task) counts.set(q.task.name, (counts.get(q.task.name) ?? 0) + 1);
    const pool: { a: Activity; w: number }[] = [];
    for (const a of this.activities) {
      if (a.seasons && !a.seasons.includes(season)) continue;
      const c = counts.get(a.name) ?? 0;
      if (a.exclusive && c > 0) continue;
      let w = a.weight / (1 + c * 1.6);
      if (p.lastTaskName === a.name) w *= 0.35;
      pool.push({ a, w });
    }
    for (let tries = 0; tries < 6 && pool.length; tries++) {
      const total = pool.reduce((s, x) => s + x.w, 0);
      let r = Math.random() * total;
      const pick = pool.find(x => (r -= x.w) <= 0) ?? pool[0];
      const task = pick.a.make(p);
      if (task) return task;
      pool.splice(pool.indexOf(pick), 1);
    }
    return this.wander(p);
  }

  // ------------------------------------------------------------------ helpers
  private nearbyFriend(p: Penguin, max = 700) {
    const others = this.world.penguins.filter(q => q !== p && q.free && q.task?.owner !== 'world' && Math.abs(q.x - p.x) < max && Math.abs(q.x - p.x) > 90);
    return others.length ? Phaser.Utils.Array.GetRandom(others) : null;
  }

  private walkClip(p: Penguin) {
    return this.world.season === 1 && p.can('walk_umbrella') && Math.random() < 0.6 ? 'walk_umbrella' : 'walk';
  }

  private claim(spot: Spot | null, p: Penguin, act: Act) {
    if (!spot || (spot.busy && spot.busy !== p)) return false;
    spot.busy = p;
    act.defer(() => {
      if (spot.busy === p) spot.busy = null;
    });
    return true;
  }

  private task(name: string, run: (act: Act) => Promise<void>, tag?: string): Task {
    return { name, run, tag };
  }

  // ------------------------------------------------------------------ catalog
  private catalog(): Activity[] {
    return [
      { name: 'wander', weight: 10, make: p => this.wander(p) },
      { name: 'skywatch', weight: 5, make: p => this.task('skywatch', async act => {
        await act.once('look_up');
        if (Math.random() < 0.3) p.say('question', 1200);
        await act.loop('idle', rand(1200, 2600));
        await act.once('look_around');
      }) },
      { name: 'rest', weight: 5, make: p => p.can('sit_down') ? this.task('rest', async act => {
        const seat = this.env.spots.seats[0];
        if (seat && !seat.busy && Math.random() < 0.5 && this.claim(seat, p, act)) {
          await act.walkTo(seat.x + rand(-20, 20), { clip: this.walkClip(p) });
        }
        await act.once('sit_down');
        await act.loop('sit_idle', rand(3500, 7500));
        await act.once('stand_up');
      }) : null },
      { name: 'nap', weight: 3, make: p => p.can('sleep') ? this.task('nap', async act => {
        await act.loop('sleep', rand(5000, 9000));
        await act.once('wake_up');
        if (Math.random() < 0.5) await act.once('blink');
      }) : null },
      { name: 'greet', weight: 4, make: p => {
        const friend = this.nearbyFriend(p, 600);
        if (!friend) return null;
        return this.task('greet', async act => {
          await act.walkTo(friend.x + (p.x < friend.x ? -110 : 110), { clip: this.walkClip(p) });
          act.faceX(friend.x);
          if (friend.free) {
            friend.react(async fa => {
              fa.faceX(p.x);
              await fa.once('greet');
              await fa.once('laugh');
            });
          }
          await act.once('greet');
          await act.once('laugh');
        });
      } },
      { name: 'chase', weight: 3, exclusive: true, make: p => {
        const friend = this.nearbyFriend(p, 800);
        if (!friend || !p.can('chase')) return null;
        return this.task('chase', async act => {
          friend.setTask({ name: 'flee', owner: 'brain', run: async fa => {
            fa.p.say('surprise', 700);
            const away = friend.x + (friend.x > p.x ? 1 : -1) * rand(260, 420);
            await fa.walkTo(away, { speed: 250, clip: 'run' });
            await fa.once('laugh');
          }, onDone: q => this.done(q, { name: 'flee', run: async () => {} }) });
          const end = this.scene.time.now + rand(2500, 4000);
          act.play('chase');
          while (this.scene.time.now < end) {
            await act.walkTo(friend.x + (friend.x > p.x ? -70 : 70), { speed: 235, clip: 'chase', tolerance: 20 });
            if (Math.abs(friend.x - p.x) < 90) break;
          }
          await act.once('laugh');
        });
      } },
      { name: 'play', weight: 3, make: p => p.can('play') ? this.task('play', async act => {
        await act.loop('play', rand(1600, 3200));
        if (Math.random() < 0.5) await act.once('laugh');
      }) : null },
      { name: 'poke', weight: 2, make: p => {
        const rockish = this.env.spots.seats[0];
        if (!rockish || !p.can('interact_object')) return null;
        return this.task('poke', async act => {
          await act.walkTo(rockish.x + (p.x < rockish.x ? -70 : 70), { clip: this.walkClip(p) });
          act.faceX(rockish.x);
          await act.once('interact_object');
          await act.once('curious');
        });
      } },
      { name: 'oops', weight: 1.2, make: p => this.task('oops', async act => {
        // an accidental trip while walking, rate-limited by the world
        const x = this.world.freeX(p);
        const mid = (p.x + x) / 2;
        await act.walkTo(mid, { clip: this.walkClip(p) });
        const now = this.scene.time.now;
        if (now > this.world.nextAccidentAt && Math.random() < 0.45) {
          this.world.nextAccidentAt = now + 9000;
          await act.once('stumble');
          p.knockDown(p.x - p.facing * 20, 0.15, 1);
          return;
        }
        await act.once('stumble');
        p.say('surprise', 800);
        await act.walkTo(x, { clip: this.walkClip(p) });
      }) },

      // ---------------------------------------------------------- winter
      { name: 'snowman', weight: 6, seasons: [0], exclusive: true, make: p => {
        const spot = this.env.spots.snowman;
        if (!spot || spot.stage >= 3 || !p.can('build_snowman')) return null;
        return this.task('snowman', async act => {
          if (!this.claim(spot, p, act)) return;
          await act.walkTo(spot.x + 70, { clip: 'walk' });
          act.face(-1);
          const stage = (n: number) => () => {
            this.env.setStage(spot, n, 'snowman');
            sfx.crunch();
          };
          await act.once('build_snowman', { 3: stage(Math.max(1, spot.stage)), 7: stage(Math.min(3, spot.stage + 1)), 11: stage(3) });
          await act.once('celebrate');
        });
      } },
      { name: 'snowball', weight: 6, seasons: [0], make: p => {
        const target = this.nearbyFriend(p, 750);
        if (!target || !p.can('make_snowball') || !p.can('throw_snowball')) return null;
        return this.snowballFight(p, target);
      } },
      { name: 'iceslide', weight: 4, seasons: [0], exclusive: true, make: p => {
        const ice = this.env.spots.ice;
        if (!ice || !p.can('ice_slide')) return null;
        return this.task('iceslide', async act => {
          const leftToRight = Math.random() < 0.5;
          const start = leftToRight ? ice.x0 - 60 : ice.x1 + 60;
          const end = leftToRight ? ice.x1 + 40 : ice.x0 - 40;
          await act.walkTo(start, { clip: 'walk' });
          if (Math.abs(p.laneY - ice.laneY) > 2) {
            await act.moveTo(p.x, ice.laneY, 250);
            p.laneY = ice.laneY;
          }
          await act.walkTo(start + (end - start) * 0.15, { speed: 230, clip: 'run' });
          await act.walkTo(end, { speed: 330, clip: 'ice_slide' });
          if (Math.random() < 0.3) await act.once('stumble');
          else await act.once('laugh');
        });
      } },
      { name: 'shiver', weight: 2, seasons: [0], make: p => p.can('shiver') ? this.task('shiver', async act => {
        await act.loop('shiver', rand(1400, 2400));
        this.breath(p);
        await act.loop('idle', 900);
      }) : null },

      // ---------------------------------------------------------- autumn
      { name: 'puddle', weight: 6, seasons: [1], make: p => {
        const puddles = this.env.spots.puddles.filter(s => !s.busy);
        if (!puddles.length || !p.can('jump_puddle')) return null;
        const spot = Phaser.Utils.Array.GetRandom(puddles);
        return this.task('puddle', async act => {
          if (!this.claim(spot, p, act)) return;
          await act.walkTo(spot.x + rand(-30, 30), { clip: this.walkClip(p) });
          for (let i = 0; i < rand(1, 3); i++) {
            await act.once('jump_puddle', { 4: () => this.env.splash(p.x, spot.laneY + 6, false) });
          }
          await act.once('laugh');
        });
      } },
      { name: 'leaves', weight: 5, seasons: [1], exclusive: true, make: p => {
        const pile = this.env.spots.leafPile;
        if (!pile || !p.can('play_leaves')) return null;
        return this.task('leaves', async act => {
          if (!this.claim(pile, p, act)) return;
          await act.walkTo(pile.x + (p.x < pile.x ? -60 : 60), { clip: this.walkClip(p) });
          act.faceX(pile.x);
          for (let i = 0; i < 2; i++) {
            await act.once('play_leaves', { 4: () => {
              this.env.burst(PART('autumn', 'leaf_2'), pile.x, pile.laneY - 20, 7, 0.32, 1000 + pile.laneY + 2);
              this.env.burst(PART('autumn', 'leaf_4'), pile.x, pile.laneY - 20, 5, 0.32, 1000 + pile.laneY + 2);
              sfx.rustle();
            } });
          }
        });
      } },
      { name: 'umbrella', weight: 5, seasons: [1], make: p => p.can('hide_rain') ? this.task('umbrella', async act => {
        if (Math.random() < 0.5) await act.walkTo(this.world.freeX(p), { clip: 'walk_umbrella', speed: 120 });
        await act.loop('hide_rain', rand(3000, 6000));
      }) : null },

      // ---------------------------------------------------------- spring
      { name: 'butterfly', weight: 6, seasons: [2], make: p => p.can('chase_butterfly') ? this.task('butterfly', async act => {
        const dir = Math.random() < 0.5 ? -1 : 1;
        const b = this.env.spawnButterfly(p, p.x + dir * 90, p.y - 120 * p.size);
        act.defer(() => this.env.releaseButterfly(b));
        const end = this.scene.time.now + rand(4000, 7000);
        let x = p.x;
        while (this.scene.time.now < end) {
          x = this.world.clampX(x + dir * rand(80, 220) * (Math.random() < 0.2 ? -1 : 1), 80);
          this.env.leadButterfly(b, x + p.facing * 70, p.y - rand(90, 170) * p.size);
          await act.walkTo(x, { clip: 'chase_butterfly', speed: 150, tolerance: 10 });
        }
        await act.once('laugh');
      }) : null },
      { name: 'flower', weight: 5, seasons: [2], make: p => {
        const flowers = this.env.spots.flowers.filter(f => !f.busy);
        if (!flowers.length || !p.can('smell_flower')) return null;
        const f = Phaser.Utils.Array.GetRandom(flowers);
        return this.task('flower', async act => {
          if (!this.claim(f, p, act)) return;
          await act.walkTo(f.x + (p.x < f.x ? -60 : 60), { clip: 'walk' });
          act.faceX(f.x);
          await act.once('smell_flower', { 4: () => this.env.burst(PART('spring', 'petal_2'), f.x, f.laneY - 50, 4, 0.25, 1000 + f.laneY + 3) });
          await act.once('laugh');
        });
      } },
      { name: 'sitgrass', weight: 4, seasons: [2], make: p => p.can('sit_grass') ? this.task('sitgrass', async act => {
        await act.loop('sit_grass', rand(4000, 8000));
      }) : null },
      { name: 'bloom', weight: 4, seasons: [2], exclusive: true, make: p => {
        const spot = this.env.spots.bloom;
        if (!spot || !p.can('watch_bloom')) return null;
        return this.task('bloom', async act => {
          if (!this.claim(spot, p, act)) return;
          await act.walkTo(spot.x + (p.x < spot.x ? -70 : 70), { clip: 'walk' });
          act.faceX(spot.x);
          const next = (spot.stage + 1) % 3;
          await act.once('watch_bloom', { 2: () => this.env.setStage(spot, next, 'bloom') });
          if (next === 2) await act.once('celebrate');
        });
      } },

      // ---------------------------------------------------------- summer
      { name: 'sandcastle', weight: 6, seasons: [3], exclusive: true, make: p => {
        const spot = this.env.spots.sandcastle;
        if (!spot || spot.stage >= 3 || !p.can('build_sandcastle')) return null;
        return this.task('sandcastle', async act => {
          if (!this.claim(spot, p, act)) return;
          await act.walkTo(spot.x + 80, { clip: 'walk' });
          act.face(-1);
          const stage = (n: number) => () => this.env.setStage(spot, n, 'sandcastle');
          await act.once('build_sandcastle', { 3: stage(Math.max(1, spot.stage)), 7: stage(Math.min(3, spot.stage + 1)), 11: stage(3) });
          await act.once('celebrate');
        });
      } },
      { name: 'beachball', weight: 5, seasons: [3], exclusive: true, make: p => {
        const ball = this.env.spots.ball;
        const friend = this.nearbyFriend(p, 900);
        if (!ball || ball.busy || !friend || !p.can('play_beach')) return null;
        return this.beachBall(p, friend);
      } },
      { name: 'swim', weight: 5, seasons: [3], make: p => p.can('enter_water') && p.can('swim') ? this.swim(p) : null },
      { name: 'sunscreen', weight: 1.5, seasons: [3], make: p => p.can('apply_sunscreen') ? this.task('sunscreen', async act => {
        await act.once('apply_sunscreen');
        await act.loop('idle', 900);
      }) : null },
    ];
  }

  private wander(p: Penguin): Task {
    return this.task('wander', async act => {
      const x = this.world.freeX(p);
      const speed = rand(110, 165);
      await act.walkTo(x, { speed, clip: this.walkClip(p) });
      const r = Math.random();
      if (r < 0.3) await act.once('look_around');
      else if (r < 0.5) await act.once('blink');
      await act.loop('idle', rand(900, 2600));
    });
  }

  private breath(p: Penguin) {
    const key = PART('winter', 'breath_puff');
    if (!this.scene.textures.exists(key)) return;
    const head = p.anchor('hm');
    const b = this.scene.add.image(head.x + (p.sprite.flipX ? 40 : -40) * p.size, head.y + 60 * p.size, key).setScale(0.18).setAlpha(0.8).setDepth(p.sprite.depth + 1);
    this.scene.tweens.add({ targets: b, scale: 0.4, alpha: 0, x: b.x + (p.sprite.flipX ? 30 : -30), duration: 1200, onComplete: () => b.destroy() });
  }

  private snowballFight(p: Penguin, target: Penguin): Task {
    return this.task('snowball', async act => {
      const gap = rand(260, 420);
      const x = this.world.clampX(target.x + (p.x < target.x ? -gap : gap), 80);
      await act.walkTo(x, { clip: 'walk' });
      act.faceX(target.x);
      await act.loop('make_snowball', rand(900, 1500));
      act.faceX(target.x);
      await act.once('throw_snowball', { 5: () => this.throwSnowball(p, target) });
    });
  }

  private throwSnowball(p: Penguin, target: Penguin) {
    const hand = p.anchor('hn');
    const ball = this.scene.add.image(hand.x, hand.y, 'environments_winter_props_snowball').setScale(0.32).setDepth(6000);
    const tx = target.x;
    const ty = target.y - 120 * target.size;
    const dur = Phaser.Math.Clamp(Math.abs(tx - hand.x) * 1.4, 380, 900);
    const peak = Math.min(hand.y, ty) - 120;
    sfx.whoosh(0.2);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: dur,
      onUpdate: tw => {
        const t = tw.getValue() ?? 0;
        const u = 1 - t;
        ball.setPosition(hand.x + (tx - hand.x) * t, u * u * hand.y + 2 * u * t * peak + t * t * ty);
        ball.angle += 9;
      },
      onComplete: () => {
        ball.destroy();
        this.env.burst(PART('winter', 'snow_grain'), ball.x, ball.y, 10, 0.5);
        sfx.crunch();
        if (!target.present || target.mode !== 'normal' || Math.abs(target.x - tx) > 60) return;
        if (Math.random() < 0.22 && this.scene.time.now > this.world.nextAccidentAt) {
          this.world.nextAccidentAt = this.scene.time.now + 7000;
          target.knockDown(p.x, 0.25, 1);
        } else {
          target.react(async ta => {
            ta.faceX(p.x);
            await ta.once('bump');
            target.say('surprise', 800);
            await ta.once(Math.random() < 0.5 ? 'laugh' : 'confused');
          });
          // sometimes it answers back
          if (Math.random() < 0.5) {
            this.scene.time.delayedCall(1800, () => {
              if (target.free && target.task?.owner !== 'world' && p.present) target.setTask({ ...this.snowballFight(target, p), owner: 'brain', onDone: q => this.done(q, { name: 'snowball', run: async () => {} }) });
            });
          }
        }
      },
    });
  }

  private beachBall(p: Penguin, friend: Penguin): Task {
    const ball = this.env.spots.ball!;
    return this.task('beachball', async act => {
      ball.busy = p;
      act.defer(() => {
        if (ball.busy === p) ball.busy = null;
      });
      const mid = ball.x;
      const ax = this.world.clampX(mid - 150, 80);
      const bx = this.world.clampX(mid + 150, 80);
      if (friend.free) {
        friend.setTask({ name: 'beachball-partner', owner: 'brain', run: async fa => {
          await fa.walkTo(bx, { clip: 'walk' });
          fa.face(-1);
          await fa.until(() => ball.busy !== p, 14000);
        }, onDone: q => this.done(q, { name: 'beachball', run: async () => {} }) });
      }
      await act.walkTo(ax, { clip: 'walk' });
      act.face(1);
      await act.until(() => Math.abs(friend.x - bx) < 15 || !friend.free, 6000);
      for (let i = 0; i < rand(3, 5); i++) {
        const hitter = i % 2 === 0 ? p : friend;
        const other = hitter === p ? friend : p;
        if (!other.present || other.mode !== 'normal') break;
        if (hitter === p) await act.once('play_beach', { 2: () => this.lob(ball, p, other) });
        else {
          friend.play('play_beach');
          this.lob(ball, friend, p);
          await act.wait(650);
        }
        await act.wait(380);
      }
      await act.once('laugh');
    });
  }

  private lob(ball: NonNullable<World['env']['spots']['ball']>, from: Penguin, to: Penguin) {
    ball.x = from.x + (to.x > from.x ? 40 : -40);
    ball.y = from.y - 120 * from.size;
    const t = 0.9;
    ball.vx = (to.x - ball.x) / t;
    ball.vy = -620;
    sfx.pop();
  }

  /**
   * Walk across the wet sand to the painted shoreline, wade in (the waterline depends on
   * how far past the shore it is, so nothing sinks on the sand), swim along the coast with
   * the head out of the water, then wade back out and shake off on the beach.
   */
  private swim(p: Penguin): Task {
    return this.task('swim', async act => {
      const l = this.world.layout;
      const K = 1.6; // world units of depth gained per unit walked past the shore
      const x0 = this.world.freeX(p, { min: l.left + 120, max: l.right - 120 });
      await act.walkTo(x0, { clip: 'walk' });
      act.defer(() => {
        const wasIn = p.wading !== null || p.freeLane;
        p.wading = null;
        p.swimming = false;
        p.freeLane = false;
        if (wasIn) {
          p.laneY = l.laneMin + 6;
          if (!p.lifting) p.y = p.laneY; // a season change pulls it back to the beach
        }
      });
      // across the wet sand, up to the water's edge
      p.freeLane = true;
      act.play('walk');
      const edge = shoreAt(p.x) + 4;
      await act.moveTo(p.x, edge, (Math.max(10, p.y - edge) / 75) * 1000, 'Linear');
      // into the sea: the deeper it goes, the more of the body is under water
      p.wading = { shore: shoreAt, k: K };
      p.swimOffset = ((230.4 - 134) * p.size) / K;
      this.env.splash(p.x, shoreAt(p.x), true);
      act.play('walk');
      await act.moveTo(p.x, shoreAt(p.x) - p.swimOffset + 4, 1300, 'Sine.easeIn');
      p.swimming = true;
      act.play('swim');
      await act.wait(300);
      // swim along the coast (the y follows the shoreline in Penguin.update)
      const dir = Math.random() < 0.5 ? -1 : 1;
      act.face(dir as 1 | -1);
      const end = this.world.clampX(p.x + dir * rand(220, 420), 120);
      await act.moveTo(end, p.y, (Math.abs(end - p.x) / 70) * 1000, 'Sine.easeInOut');
      act.face((-dir) as 1 | -1);
      await act.loop('swim', 1200);
      // back out
      p.swimming = false;
      act.play('walk');
      await act.moveTo(p.x, shoreAt(p.x) + 4, 1200, 'Sine.easeOut');
      p.wading = null;
      this.env.splash(p.x, shoreAt(p.x) + 6, true);
      const back = rand(l.laneMin + 10, l.laneMax);
      await act.moveTo(p.x, back, ((back - p.y) / 75) * 1000, 'Linear');
      p.freeLane = false;
      p.laneY = back;
      await act.once('shake_water');
    });
  }

  // ------------------------------------------------------------------ world jobs
  /** A free penguin goes for the fallen helmet and becomes the engineer. */
  fetchHelmet(p: Penguin, helmet: { x: number; laneY: number }) {
    p.setTask({
      name: 'helmet',
      tag: 'helmet',
      owner: 'world',
      run: async act => {
        const h = this.world.helmetPos();
        if (!h) return;
        p.say('surprise', 700);
        await act.walkTo(h.x + (p.x < h.x ? -46 : 46) * p.size * 1.6, { speed: 230, clip: 'run' });
        const pos = this.world.helmetPos();
        if (!pos) return;
        act.faceX(pos.x);
        let img: Phaser.GameObjects.Image | null = null;
        await act.once('pick_up_object', { 3: () => {
          img = this.world.takeHelmet(p);
          if (img) p.attach({ obj: img, anchor: 'hn', onLost: () => this.world.dropHelmet(p.x, p.y - 60 * p.size) });
        } });
        if (!img) img = this.world.takeHelmet(p);
        if (!img) return;
        if (p.variant !== 'penguin' && p.can('remove_accessories')) await act.once('remove_accessories');
        p.detach(img);
        const head = p.anchor('hm');
        const held = img as Phaser.GameObjects.Image;
        await new Promise<void>(resolve => this.scene.tweens.add({ targets: held, x: head.x, y: head.y + 8 * p.size, angle: 0, duration: 260, ease: 'Back.easeOut', onComplete: () => resolve() }));
        if (!act.alive()) {
          this.world.dropHelmet(p.x, p.y - 60 * p.size);
          return;
        }
        this.world.wearHelmet(p);
        await act.once('celebrate');
      },
    });
    void helmet;
  }

  private ladderAway(_p: Penguin): Task {
    return this.task('ladder', async act => {
      const p = act.p;
      const L = this.world.ladder;
      if (L.state === 'away') return;
      if (L.state === 'upright' || L.state === 'raising') {
        await act.walkTo(L.x + 64 * L.scale + 46 * p.size, { speed: 160 });
        act.face(1);
        L.holders.clear();
        await act.once('hold_ladder');
        L.takeDown(p);
      } else if (L.state === 'lying') {
        await act.walkTo(L.gripX(), { speed: 170 });
        await act.once('pick_up_object', { 3: () => L.pickUp(p) });
        if (L.carrier !== p) L.pickUp(p);
      }
      if (L.carrier !== p) return;
      await act.walkTo(this.world.layout.right + 200, { offscreen: true, speed: 130, clip: 'carry_ladder' });
      p.detach(L.img);
      L.hide();
      await act.wait(rand(600, 1500));
      await act.walkTo(this.world.freeX(p), { speed: 150, clip: 'walk' });
    }, 'ladder');
  }

  /** Rare maintenance: bring the ladder and polish the portfolio button. */
  private polishButton(p: Penguin): Task | null {
    const rect = bridge.ctaRect();
    const L = this.world.ladder;
    if (!rect || L.state !== 'away') return null;
    const l = this.world.layout;
    const c = cssToWorld(l, rect.left + rect.width / 2, rect.top + rect.height / 2);
    const holder = this.nearbyFriend(p, 2000);
    if (!holder) return null;
    const baseY = Phaser.Math.Clamp(Math.round((l.laneMin + l.laneMax) / 2), l.laneMin, l.laneMax);
    // feet of the climber just below the button's centre; skip if the ladder can't reach
    const feet = c.y + 70 * p.size;
    if (baseY - feet < 160 || baseY - feet > 560) return null;
    // the ladder stands just right of the button's centre so a side flipper reaches it
    const x = this.world.clampX(c.x + 95, 120);
    return this.task('polish', async act => {
      if (L.state === 'away') {
        await act.walkTo(l.right + 170, { offscreen: true, speed: 260, clip: 'run' });
        L.laneY = p.laneY;
        L.setScaleFor(feet, baseY);
        L.pickUp(p);
        await act.walkTo(x + 95, { offscreen: true, speed: 125, clip: 'carry_ladder' });
        await act.moveTo(p.x, baseY, 200);
        p.laneY = baseY;
        L.laneY = baseY;
        const up = L.raise(x, 900);
        await act.once('place_ladder');
        await up;
        if (holder.free) {
          holder.setTask({ name: 'polish-hold', tag: 'ladder', owner: 'brain', run: async ha => {
            const hx = L.x - (64 * L.scale + 46 * holder.size);
            await ha.walkTo(hx, { speed: 170 });
            ha.face(-1);
            L.holders.add(holder);
            ha.defer(() => L.holders.delete(holder));
            ha.play('hold_ladder');
            await ha.until(() => L.state !== 'upright' || !p.present || p.task?.name !== 'polish', 30000);
          }, onDone: q => this.done(q, { name: 'polish-hold', run: async () => {} }) });
        }
      }
      if (L.state !== 'upright') return;
      await act.walkTo(L.x, { speed: 150 });
      await act.moveTo(L.x, L.laneY + 1, 200);
      p.laneY = L.laneY + 1;
      p.layerBias = 2;
      act.defer(() => {
        p.layerBias = 0;
      });
      act.play('climb');
      while (p.y > feet + 1) {
        const step = Math.min(48 * L.scale, p.y - feet);
        await act.moveTo(L.x, p.y - step, (step / 110) * 1000, 'Linear');
      }
      // seen from behind on the ladder, it scrubs the button with the flipper on its side
      act.face(c.x < L.x ? -1 : 1);
      for (let i = 0; i < 4; i++) {
        await act.once('wipe', { 2: () => {
          const hand = p.anchor('hf');
          this.env.sparkle(hand.x, hand.y);
          sfx.squeegee();
        } });
      }
      act.play('climb');
      await act.moveTo(L.x, p.laneY, ((p.laneY - p.y) / 150) * 1000, 'Linear');
      p.layerBias = 0;
      await act.once('celebrate');
      // carry it away again
      await act.walkTo(L.x + 64 * L.scale + 46 * p.size, { speed: 160 });
      act.face(1);
      L.holders.clear();
      L.takeDown(p);
      await act.walkTo(l.right + 200, { offscreen: true, speed: 130, clip: 'carry_ladder' });
      p.detach(L.img);
      L.hide();
      await act.wait(800);
      await act.walkTo(this.world.freeX(p), { speed: 150 });
    }, 'ladder');
  }
}
