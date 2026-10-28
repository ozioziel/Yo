import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PenguinController, chooseFall, impactForSpeed, variantForSeason, registerAnimations } from './oziel_runtime.mjs';

class TestSprite extends EventEmitter {
  constructor() {
    super();
    this.x = 200; this.y = 400; this.originX = 0.5; this.originY = 0.9; this.scaleX = this.scaleY = 1;
    this.played = [];
    this.body = {
      enable: true, velocity: { x: 0, y: 0 }, blocked: {}, touching: {},
      setSize: () => this.body, setOffset: () => this.body,
      setVelocity: (x, y) => { this.body.velocity = { x, y }; return this.body; },
      reset: (x, y) => { this.x = x; this.y = y; return this.body; }, setAllowGravity: () => this.body
    };
  }
  setOrigin(x, y) { this.originX = x; this.originY = y; return this; }
  setInteractive() { return this; }
  setCollideWorldBounds() { return this; }
  setBounce() { return this; }
  setFlipX(f) { this.flipX = f; return this; }
  setVelocityX(x) { this.body.velocity.x = x; return this; }
  setVelocity(x, y) { this.body.setVelocity(x, y); return this; }
  setPosition(x, y) { this.x = x; this.y = y; return this; }
  play(key) { this.played.push(key); this.last = key; return this; }
  complete() { this.emit(`animationcomplete-${this.last}`); }
}
const clips = ['idle', 'walk', 'enter', 'scared', 'dragged', 'fall_normal', 'fall_spin', 'fall_flap', 'impact_light', 'impact_medium', 'impact_heavy', 'get_up', 'stumble', 'push', 'bump', 'notice_weather', 'weather_confused', 'put_scarf', 'put_boots', 'open_umbrella', 'remove_accessories', 'resume_after_weather', 'apply_sunscreen'];
const config = { characters: Object.fromEntries(['penguin', 'engineer', 'penguin_winter', 'penguin_autumn'].map(variant => [variant,
  Object.fromEntries(clips.map(clip => [clip, { atlasKey: `${variant}_base`, frames: [`${clip}_000`], frameRate: 10, repeat: ['idle', 'walk', 'dragged'].includes(clip) ? -1 : 0, origin: [0.5, 0.9] }]))])) };
const scene = { input: { setDraggable() {} }, time: { now: 1000 } };
const tick = () => new Promise(resolve => setImmediate(resolve));

assert.deepEqual([0, 0.34, 0.99].map(n => chooseFall(() => n)), ['fall_normal', 'fall_spin', 'fall_flap']);
assert.deepEqual([0, 329, 330, 649, 650, -700].map(impactForSpeed), ['impact_light', 'impact_light', 'impact_medium', 'impact_medium', 'impact_heavy', 'impact_heavy']);
assert.equal(variantForSeason(true, 0), 'engineer');
assert.equal(variantForSeason(true, 1), 'engineer');
assert.equal(variantForSeason(false, 0), 'penguin_winter');

const sprite = new TestSprite(), p = new PenguinController(scene, sprite, config, { random: () => 0.4 });
p.setTask('walk', { velocityX: 50, flipX: true });
p.beginDrag();
assert.equal(sprite.body.enable, false);
assert.equal(sprite.flipX, false);
p.setTask('enter', { velocityX: 25 });
assert.equal(p.state, 'dragged', 'Narrative timer must not steal an active drag');
sprite.complete(); await tick();
assert.equal(sprite.last, 'penguin:dragged');
p.release();
assert.equal(sprite.body.enable, true);
assert.equal(sprite.last, 'penguin:fall_spin');
const landing = p.landed(700);
assert.equal(sprite.last, 'penguin:impact_heavy');
sprite.complete(); await tick();
assert.equal(sprite.last, 'penguin:get_up');
sprite.complete(); await landing;
assert.equal(p.state, 'activity');
assert.equal(sprite.last, 'penguin:enter');
assert.equal(sprite.body.velocity.x, 25, 'Newest narrative activity resumes after recovery');

// Drag interrupts recovery; late completions must not resume stale activity.
p.beginDrag(); p.release();
const interrupted = p.landed(400);
p.beginDrag();
sprite.emit('animationcomplete-penguin:impact_medium');
await interrupted;
assert.equal(p.state, 'dragged');
assert.equal(sprite.listenerCount('animationcomplete-penguin:impact_medium'), 0);

// Climate requested while held queues until landing, then uses the same Sprite.
await p.changeWeather(0);
assert.equal(p.pendingWeather, 0);
p.release();
const landAgain = p.landed(100);
sprite.complete(); await tick(); sprite.complete(); await landAgain; await tick();
assert.equal(p.state, 'weather');
for (let i = 0; i < 5; i++) { sprite.complete(); await tick(); }
assert.equal(p.variant, 'penguin_winter');
assert.equal(p.state, 'activity');
assert.equal(p.sprite, sprite);

// Newer climate choices and narrative tasks survive a drag during equipment change.
const climateInterrupted = p.changeWeather(2);
await p.changeWeather(3);
p.setTask('enter', { velocityX: 40 });
p.beginDrag();
assert.equal(p.pendingWeather, 3, 'Drag must preserve the latest climate request');
p.release();
const finalLanding = p.landed(100);
sprite.complete(); await tick(); sprite.complete(); await finalLanding; await climateInterrupted; await tick();
for (let i = 0; i < 5; i++) { sprite.complete(); await tick(); }
assert.equal(p.variant, 'penguin');
assert.equal(p.currentClip, 'enter');
assert.equal(sprite.body.velocity.x, 40, 'Latest narrative task survives queued climate processing');

// Permanent engineer exception across every season: no outfit-changing actions.
const engineerSprite = new TestSprite();
const engineer = new PenguinController(scene, engineerSprite, config, { engineer: true });
for (let level = 0; level < 4; level++) {
  const change = engineer.changeWeather(level);
  for (let i = 0; i < (level === 3 ? 4 : 3); i++) { engineerSprite.complete(); await tick(); }
  await change;
  assert.equal(engineer.variant, 'engineer');
}
assert.ok(!engineerSprite.played.some(key => /put_scarf|put_boots|open_umbrella|remove_accessories/.test(key)));

// Registration rejects missing frame names instead of silently playing a blank.
assert.throws(() => registerAnimations({ anims: { exists: () => false }, textures: { exists: () => false } }, config), /Missing real atlas frame/);
p.destroy(); engineer.destroy();
assert.equal(sprite.listenerCount('dragstart'), 0);
console.log('PASS: fall selection, impact thresholds, drag interruption, narrative resume, queued climate, engineer exception, atlas frame guard, listener cleanup.');
