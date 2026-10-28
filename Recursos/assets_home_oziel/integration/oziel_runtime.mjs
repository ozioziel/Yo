/* Integration helpers for Phaser 3.90.0; no global Phaser import required. */
export const SEASONS = ['winter', 'autumn', 'spring', 'summer'];
export const FALLS = ['fall_normal', 'fall_spin', 'fall_flap'];
export const animationKey = (variant, clip) => `${variant}:${clip}`;
export const impactForSpeed = speed => Math.abs(speed) < 330 ? 'impact_light' : Math.abs(speed) < 650 ? 'impact_medium' : 'impact_heavy';
export const variantForSeason = (engineer, level) => engineer ? 'engineer' : ['penguin_winter', 'penguin_autumn', 'penguin', 'penguin'][level];
export function chooseFall(random = Math.random) { return FALLS[Math.min(2, Math.max(0, Math.floor(random() * 3)))]; }
const url = (base, path) => `${base.replace(/\/$/, '')}/${path}`;

/** Call in preload(), with manifest obtained by import or an earlier boot Scene. */
export function preloadAssets(scene, manifest, baseURL = './assets_home_oziel') {
  const entries = Array.isArray(manifest) ? manifest : manifest.assets;
  const seen = new Set();
  for (const asset of entries) {
    if (seen.has(asset.id) || asset.type === 'preview' || !/\.png$/i.test(asset.path)) continue;
    // Individual frame PNGs and strips are delivery sources; atlases serve them at runtime.
    if (/\/(frames|clips)\//.test(asset.path) || /^reference\//.test(asset.path)) continue;
    if (asset.type === 'atlas') {
      scene.load.atlas(asset.id, url(baseURL, asset.path), url(baseURL, asset.jsonPath));
    } else {
      scene.load.image(asset.id, url(baseURL, asset.path));
    }
    seen.add(asset.id);
  }
}

/** Uses exact ordered frame names from animations.json, including multi-atlas clips. */
export function registerAnimations(scene, config) {
  for (const [variant, clips] of Object.entries(config.characters)) {
    for (const [clip, def] of Object.entries(clips)) {
      const key = animationKey(variant, clip);
      if (scene.anims.exists(key)) continue;
      const frames = def.frames.map(frame => typeof frame === 'string'
        ? { key: def.atlasKey, frame }
        : { key: frame.atlasKey ?? frame.key ?? def.atlasKey, frame: frame.frame ?? frame.name });
      for (const entry of frames) {
        if (!scene.textures.exists(entry.key) || !scene.textures.get(entry.key).has(entry.frame)) {
          throw new Error(`Missing real atlas frame: ${entry.key}/${entry.frame}`);
        }
      }
      scene.anims.create({ key, frames, frameRate: def.frameRate, repeat: def.repeat, skipMissedFrames: false });
    }
  }
}

/** Environment and intro effects use the same atlas schema as characters. */
export function registerEffectAnimations(scene, effects) {
  for (const [name, def] of Object.entries(effects)) {
    const key = `effect:${name}`;
    if (scene.anims.exists(key)) continue;
    const frames = def.frames.map(frame => ({ key: def.atlasKey, frame }));
    for (const frame of frames) {
      if (!scene.textures.exists(frame.key) || !scene.textures.get(frame.key).has(frame.frame)) throw new Error(`Missing effect frame ${frame.key}/${frame.frame}`);
    }
    scene.anims.create({ key, frames, frameRate: def.frameRate, repeat: def.repeat, skipMissedFrames: false });
  }
}

/** One controller per existing Arcade Sprite; keep it when weather changes. */
export class PenguinController {
  constructor(scene, sprite, config, options = {}) {
    this.scene = scene;
    this.sprite = sprite;
    this.config = config;
    this.engineer = !!options.engineer;
    this.variant = options.variant ?? (this.engineer ? 'engineer' : 'penguin');
    this.random = options.random ?? Math.random;
    this.propFloor = options.propFloor ?? null;
    this.umbrellaTexture = options.umbrellaTexture ?? 'umbrella_closed';
    this.umbrellaScale = options.umbrellaScale ?? 0.7;
    this.state = 'activity';
    this.task = { clip: 'idle', velocityX: 0, flipX: false };
    this.previousTask = { ...this.task };
    this.sequence = 0;
    this.pendingWeather = null;
    this.maxFallSpeed = 0;
    this.collisionUntil = 0;
    this.disposed = false;
    this.sprite.ozielController = this;
    this.sprite.setOrigin(0.5, 0.9).setInteractive({ draggable: true });
    scene.input.setDraggable(this.sprite);
    // Source-cell units, independent of display scale; bottom is y230.
    this.sprite.body.setSize(108, 164, false).setOffset(74, 66);
    this.sprite.setCollideWorldBounds(true).setBounce(0);
    this.onDragStart = () => this.beginDrag();
    this.onDrag = (_pointer, x, y) => {
      if (this.state === 'dragged') {
        const anchor = this.dragOrigin ?? [this.sprite.originX, this.sprite.originY];
        this.sprite.setPosition(x + (this.sprite.originX - anchor[0]) * 256 * this.sprite.scaleX,
          y + (this.sprite.originY - anchor[1]) * 256 * this.sprite.scaleY);
      }
    };
    this.onDragEnd = () => this.release();
    this.sprite.on('dragstart', this.onDragStart);
    this.sprite.on('drag', this.onDrag);
    this.sprite.on('dragend', this.onDragEnd);
    this.play('idle');
  }

  definition(clip) { return this.config.characters[this.variant]?.[clip]; }
  play(clip, ignoreIfPlaying = false) {
    const def = this.definition(clip);
    if (!def) throw new Error(`Missing animation ${this.variant}:${clip}`);
    // Preserve the cell's world-space top left if an aerial clip uses another origin.
    const oldX = this.sprite.originX, oldY = this.sprite.originY;
    const [ox, oy] = def.origin ?? [0.5, 0.9];
    this.sprite.setOrigin(ox, oy);
    this.sprite.x += (ox - oldX) * 256 * this.sprite.scaleX;
    this.sprite.y += (oy - oldY) * 256 * this.sprite.scaleY;
    this.sprite.play(animationKey(this.variant, clip), ignoreIfPlaying);
    this.currentClip = clip;
    return def;
  }

  cancelSequence() {
    this.sequence++;
    if (this.cancelWait) this.cancelWait();
  }

  /** Finite clips resolve false if interrupted; no stale completion listener survives. */
  once(clip, token = this.sequence) {
    if (token !== this.sequence || this.disposed) return Promise.resolve(false);
    const def = this.definition(clip);
    if (!def || def.repeat === -1) return Promise.reject(new Error(`Expected finite clip ${this.variant}:${clip}`));
    return new Promise(resolve => {
      const event = `animationcomplete-${animationKey(this.variant, clip)}`;
      const finish = () => { clean(); resolve(token === this.sequence && !this.disposed); };
      const cancel = () => { clean(); resolve(false); };
      const clean = () => {
        this.sprite.off(event, finish);
        if (this.cancelWait === cancel) this.cancelWait = null;
      };
      this.cancelWait = cancel;
      this.sprite.once(event, finish);
      this.play(clip);
    });
  }

  setTask(clip, { velocityX = 0, flipX = false } = {}) {
    // Narrative timers can advance while a visitor holds or drops this penguin.
    // Remember the newest task, without breaking the visitor's interaction.
    if (this.state !== 'activity') {
      this.previousTask = { clip, velocityX, flipX };
      return;
    }
    this.cancelSequence();
    this.state = 'activity';
    this.task = { clip, velocityX, flipX };
    this.sprite.setFlipX(flipX).setVelocityX(velocityX);
    this.play(clip);
  }

  beginDrag() {
    if (this.state === 'activity') this.previousTask = { ...this.task };
    if (this.state === 'weather' && this.weatherTarget !== undefined && this.pendingWeather === null) this.pendingWeather = this.weatherTarget;
    this.cancelSequence();
    const token = this.sequence;
    this.state = 'dragged';
    this.dragOrigin = [this.sprite.originX, this.sprite.originY];
    this.foldUmbrella();
    this.sprite.body.enable = false;
    this.sprite.body.setVelocity(0, 0);
    this.sprite.setFlipX(false); // Both enlarged eyes face the visitor.
    this.once('scared', token).then(ok => { if (ok && this.state === 'dragged') this.play('dragged'); });
  }

  release() {
    if (this.state !== 'dragged') return;
    this.cancelSequence();
    this.state = 'falling';
    this.sprite.body.enable = true;
    this.sprite.body.reset(this.sprite.x, this.sprite.y);
    this.sprite.body.setAllowGravity(true);
    this.sprite.body.setVelocity(0, 0);
    this.maxFallSpeed = 0;
    this.play(chooseFall(this.random));
  }

  /** Call before stepping the next frame; a collider callback can also call landed(). */
  update() {
    if (this.state === 'falling') {
      this.maxFallSpeed = Math.max(this.maxFallSpeed, this.sprite.body.velocity.y);
      if (this.sprite.body.blocked.down || this.sprite.body.touching.down) this.landed();
    }
  }

  /** Use pre-collision velocity (cached in update) because Arcade zeroes velocity on contact. */
  async landed(speed = this.maxFallSpeed) {
    if (this.state !== 'falling') return;
    this.cancelSequence();
    const token = this.sequence;
    this.state = 'recovering';
    this.sprite.setVelocity(0, 0);
    if (!await this.once(impactForSpeed(speed), token)) return;
    if (!await this.once('get_up', token)) return;
    this.resume();
  }

  resume() {
    this.clearUmbrella();
    this.state = 'activity';
    this.task = { ...this.previousTask };
    if (this.pendingWeather !== null) {
      const level = this.pendingWeather;
      this.pendingWeather = null;
      void this.changeWeather(level);
      return;
    }
    const task = this.previousTask;
    this.sprite.setFlipX(task.flipX).setVelocityX(task.velocityX);
    this.play(this.definition(task.clip) ? task.clip : 'idle');
  }

  /** Called by one shared penguin-vs-penguin collider; cooldown permits chain reactions. */
  async bump(other, relativeSpeed) {
    if (this.state !== 'activity' || this.scene.time.now < this.collisionUntil) return;
    this.collisionUntil = this.scene.time.now + 650;
    this.previousTask = { ...this.task };
    this.cancelSequence();
    const token = this.sequence;
    const knockdown = relativeSpeed > 90 && this.random() < 0.34;
    this.sprite.setVelocityX(0);
    if (knockdown) {
      this.state = 'reacting';
      if (!await this.once('stumble', token)) return;
      this.state = 'falling';
      this.foldUmbrella();
      this.sprite.setVelocity((this.sprite.x < other.sprite.x ? -1 : 1) * 110, -110);
      this.maxFallSpeed = Math.max(330, relativeSpeed);
      this.play(chooseFall(this.random));
    } else {
      this.state = 'reacting';
      if (!await this.once(this.random() < 0.5 ? 'push' : 'bump', token)) return;
      this.resume();
    }
  }

  /** Queue one latest climate while held/falling; the same Sprite and body survive. */
  async changeWeather(level) {
    if (!Number.isInteger(level) || level < 0 || level > 3) throw new RangeError('Weather level must be 0..3');
    if (this.state !== 'activity') { this.pendingWeather = level; return false; }
    this.weatherTarget = level;
    this.previousTask = { ...this.task };
    this.cancelSequence();
    const token = this.sequence;
    this.state = 'weather';
    this.clearUmbrella();
    this.sprite.setVelocityX(0);
    if (!await this.once('notice_weather', token)) return false;
    if (!await this.once('weather_confused', token)) return false;
    if (!this.engineer && this.variant !== 'penguin' && this.definition('remove_accessories')) {
      if (!await this.once('remove_accessories', token)) return false;
    }
    this.variant = variantForSeason(this.engineer, level);
    // The target variant's equipment clip shows the transition to the dressed rig.
    const equip = level === 3 ? 'apply_sunscreen' : this.engineer ? null : level === 0 ? 'put_scarf' : level === 1 ? 'put_boots' : null;
    if (equip && this.definition(equip) && !await this.once(equip, token)) return false;
    if (!this.engineer && level === 1 && this.definition('open_umbrella')) {
      if (!await this.once('open_umbrella', token)) return false;
    }
    if (this.definition('resume_after_weather') && !await this.once('resume_after_weather', token)) return false;
    this.weatherTarget = undefined;
    this.resume();
    return true;
  }

  destroy() {
    this.disposed = true;
    this.cancelSequence();
    this.clearUmbrella();
    this.sprite.off('dragstart', this.onDragStart).off('drag', this.onDrag).off('dragend', this.onDragEnd);
    delete this.sprite.ozielController;
  }

  /** Closed umbrella is a temporary scene prop, never part of the engineer outfit. */
  foldUmbrella() {
    if (this.engineer || this.variant !== 'penguin_autumn' || this.looseUmbrella) return;
    if (!this.scene.textures?.exists(this.umbrellaTexture) || !this.scene.physics?.add.image) return;
    const def = this.definition(this.currentClip);
    const index = Math.max(0, (this.sprite.anims?.currentFrame?.index ?? 1) - 1);
    const anchor = def?.frameAnchors?.[index]?.handNear ?? [170, 130];
    const ax = Array.isArray(anchor) ? anchor[0] : anchor.x;
    const ay = Array.isArray(anchor) ? anchor[1] : anchor.y;
    const localX = ((this.sprite.flipX ? 256 - ax : ax) - this.sprite.originX * 256) * this.sprite.scaleX;
    const localY = (ay - this.sprite.originY * 256) * this.sprite.scaleY;
    const angle = this.sprite.rotation ?? 0;
    const x = this.sprite.x + localX * Math.cos(angle) - localY * Math.sin(angle);
    const y = this.sprite.y + localX * Math.sin(angle) + localY * Math.cos(angle);
    this.looseUmbrella = this.scene.physics.add.image(x, y, this.umbrellaTexture)
      .setScale(Math.abs(this.sprite.scaleX) * this.umbrellaScale)
      .setDepth(this.sprite.depth + 1).setBounce(0.25).setCollideWorldBounds(true)
      .setVelocity(this.sprite.flipX ? -60 : 60, -90).setAngularVelocity(70);
    if (this.propFloor) this.umbrellaCollider = this.scene.physics.add.collider(this.looseUmbrella, this.propFloor);
  }
  clearUmbrella() {
    this.umbrellaCollider?.destroy(); this.umbrellaCollider = null;
    this.looseUmbrella?.destroy(); this.looseUmbrella = null;
  }
}

/** Relative speeds are sampled before Arcade resolves each pair. */
export function connectPenguinCollisions(scene, group) {
  const speeds = new WeakMap();
  return scene.physics.add.collider(group, group, (a, b) => {
    const speed = speeds.get(a)?.get(b) ?? 0;
    if (a.ozielController && b.ozielController) {
      void a.ozielController.bump(b.ozielController, speed);
      void b.ozielController.bump(a.ozielController, speed);
    }
  }, (a, b) => {
    if (!a.ozielController || !b.ozielController) return false;
    let map = speeds.get(a);
    if (!map) speeds.set(a, map = new WeakMap());
    map.set(b, Math.hypot(a.body.velocity.x - b.body.velocity.x, a.body.velocity.y - b.body.velocity.y));
    return true;
  });
}

/** Assets stay in 1920x1080 logical space. Apply responsive camera/layout externally. */
export class EnvironmentController {
  constructor(scene, manifest, environmentMetadata, options = {}) {
    this.scene = scene;
    this.assets = new Map(manifest.assets.map(a => [a.id, a]));
    this.metadata = environmentMetadata;
    this.layers = [];
    this.emitters = [];
    this.ambientSprites = [];
    this.level = null;
    this.night = false;
    this.particleIds = {
      winter: 'environments_winter_particles_snowflake_0',
      autumn: 'environments_autumn_particles_rain_streak',
      spring: 'environments_spring_particles_petal_0',
      ...options.particleIds
    };
    this.width = options.width ?? 1920;
    this.height = options.height ?? 1080;
  }
  set(level, night = this.night) {
    if (!Number.isInteger(level) || level < 0 || level > 3) throw new RangeError('Season must be 0..3');
    const oldLayers = this.layers;
    const season = SEASONS[level], mode = night ? 'night' : 'day';
    const composition = this.metadata.seasons[season][mode];
    this.layers = composition.layers.map((entry, index) => {
      const id = typeof entry === 'string' ? entry : entry.id;
      const asset = this.assets.get(id);
      if (!asset) throw new Error(`Missing environment asset ${id}`);
      const image = this.scene.add.image(0, 0, id).setOrigin(0).setDepth(asset.depth ?? index * 10 - 100);
      image.setAlpha(0);
      this.scene.tweens.add({ targets: image, alpha: 1, duration: 400 });
      return image;
    });
    for (const image of oldLayers) {
      this.scene.tweens.add({ targets: image, alpha: 0, duration: 400, onComplete: () => image.destroy() });
    }
    // Day/night toggles keep the same emitter: autumn rain has no interruption.
    if (level !== this.level) {
      this.emitters.forEach(e => e.destroy());
      this.emitters = [];
      this.ambientSprites.forEach(sprite => sprite.destroy());
      this.ambientSprites = [];
      const particle = this.particleIds[season];
      if (particle) {
        const rainy = season === 'autumn';
        const emitter = this.scene.add.particles(0, -40, particle, {
          x: { min: -100, max: this.width + 100 }, y: 0,
          speedX: rainy ? -45 : { min: -25, max: 30 },
          speedY: rainy ? { min: 550, max: 750 } : { min: 30, max: 80 },
          lifespan: rainy ? 2300 : 22000,
          frequency: rainy ? 22 : 160,
          scale: rainy ? { min: 0.45, max: 0.75 } : { min: 0.2, max: 0.45 },
          alpha: rainy ? 0.7 : 0.8,
          rotate: rainy ? -8 : { min: -180, max: 180 },
          maxParticles: rainy ? 160 : 200,
          emitting: true
        }).setDepth(85);
        this.emitters.push(emitter);
      }
      if (season === 'autumn') {
        this.emitters.push(this.scene.add.particles(0, -40, 'environments_autumn_particles_leaf_0', {
          x: { min: 0, max: this.width }, speedX: { min: -45, max: -10 }, speedY: { min: 50, max: 90 },
          lifespan: 22000, frequency: 700, scale: { min: 0.3, max: 0.5 }, rotate: { min: -180, max: 180 }, maxParticles: 45
        }).setDepth(84));
      }
      if (season === 'summer' && this.scene.anims.exists('effect:summer_wave')) {
        for (let x = 192; x < this.width + 192; x += 384) {
          const wave = this.scene.add.sprite(x, 700, 'summer_wave', 'wave_000').setDepth(25).play('effect:summer_wave');
          this.ambientSprites.push(wave);
        }
      }
    }
    this.level = level;
    this.night = !!night;
  }
  destroy() { this.layers.forEach(x => x.destroy()); this.emitters.forEach(x => x.destroy()); this.ambientSprites.forEach(x => x.destroy()); }
}

/** Canvas text remains editable; mirror the full name in accessible HTML outside canvas. */
export function createEditableName(scene, text = 'Oziel Rodman Ramos Torrez', options = {}) {
  const letters = [], style = { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '66px', color: '#2b3033', ...options.style };
  let x = options.x ?? 220;
  const y = options.y ?? 210;
  for (const character of text) {
    if (character === ' ') { x += 25; continue; }
    const letter = scene.add.text(x, y, character, style).setOrigin(0.5).setDepth(50);
    scene.physics.add.existing(letter);
    letter.body.setAllowGravity(false).setImmovable(true).setBounce(0.4, 0.5);
    letters.push(letter);
    x += letter.width + 4;
  }
  return letters;
}

/** Register before starting any intro timeline so all ropes work from the first frame. */
export function makeInteractiveRopes(scene, ropes, letters, options = {}) {
  let cut = false;
  const cursor = `url("${options.cursorURL ?? './assets_home_oziel/ui/scissors_cursor.png'}") 27 15, pointer`;
  const marker = scene.add.image(0, 0, options.touchTexture ?? 'scissors_touch').setVisible(false).setDepth(10000);
  const dropAll = () => {
    if (cut) return false;
    cut = true;
    for (const rope of ropes) rope.disableInteractive();
    marker.setVisible(false);
    scene.input.setDefaultCursor('default');
    for (const [index, letter] of letters.entries()) {
      letter.body.setImmovable(false).setAllowGravity(true).setVelocity((index % 3 - 1) * 25, 25);
    }
    options.onCut?.(letters);
    return true;
  };
  ropes.forEach(rope => {
    // Widen narrow rope hitboxes to at least 44 source units for touch.
    rope.setInteractive({ cursor });
    const area = rope.input.hitArea;
    if (area && 'width' in area && area.width < 44) {
      area.x -= (44 - area.width) / 2;
      area.width = 44;
    }
    rope.on('pointerover', pointer => {
      marker.setPosition(pointer.worldX + 28, pointer.worldY).setVisible(true);
    });
    rope.on('pointerout', () => marker.setVisible(false));
    rope.on('pointerdown', (pointer, _x, _y, event) => {
      marker.setPosition(pointer.worldX + 28, pointer.worldY).setVisible(true);
      event?.stopPropagation();
      // On touch, keep scissors visible while the finger selects the rope.
      if (!pointer.wasTouch) dropAll();
    });
    rope.on('pointerup', pointer => { if (pointer.wasTouch) dropAll(); });
  });
  return { dropAll, get cut() { return cut; }, destroy: () => marker.destroy() };
}

/** Reuse the actual capital O from the hanging name after its physical bounce. */
export function formHomeFromLetters(scene, letters, options = {}) {
  const capitalO = letters.find(letter => letter.text === 'O');
  if (!capitalO) throw new Error('The hanging name must contain an editable capital O');
  const x = options.x ?? 960, y = options.y ?? 380;
  const style = { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '88px', color: '#2b3033', ...options.style };
  const h = scene.add.text(x - 85, y, 'h', style).setOrigin(0.5).setAlpha(0).setDepth(60);
  const me = scene.add.text(x + 100, y, 'me', style).setOrigin(0.5).setAlpha(0).setDepth(60);
  for (const letter of letters) {
    letter.body.enable = false;
    if (letter !== capitalO) {
      scene.tweens.add({ targets: letter, alpha: 0, y: letter.y + 80, duration: 450 });
    }
  }
  capitalO.setDepth(60);
  scene.tweens.add({ targets: capitalO, x, y, angle: 0, duration: 700, ease: 'Back.Out', onComplete: () => options.onReady?.({ h, capitalO, me }) });
  scene.tweens.add({ targets: [h, me], alpha: 1, delay: 250, duration: 400 });
  return { h, capitalO, me };
}

/** Independent flash: never modifies the permanent environment's day/night state. */
export function createBlackout(scene) {
  const cover = scene.add.rectangle(0, 0, 1920, 1080, 0x000000).setOrigin(0).setAlpha(0).setDepth(9000);
  let generation = 0;
  const waits = new Set();
  const reset = () => {
    generation++;
    scene.tweens.killTweensOf(cover);
    waits.forEach(resolve => resolve());
    waits.clear();
    cover.setAlpha(0);
  };
  const tween = alpha => new Promise(resolve => {
    const complete = () => { waits.delete(complete); resolve(); };
    waits.add(complete);
    scene.tweens.add({ targets: cover, alpha, duration: 160, onComplete: complete });
  });
  return {
    cover,
    async pulse(duration = 650) {
      reset();
      const token = generation;
      await tween(1);
      if (token !== generation) return;
      await new Promise(resolve => scene.time.delayedCall(duration, resolve));
      if (token !== generation) return;
      await tween(0);
    },
    reset,
    destroy: () => { reset(); cover.destroy(); }
  };
}

/** The integrator places props. Hooks perform world translation and ladder alignment. */
export function startIntroTimeline(scene, { engineer, helpers, ropes, blackout, hooks = {} }) {
  let cancelled = false;
  const timers = [];
  const schedule = (at, callback) => timers.push(scene.time.delayedCall(at, () => { if (!cancelled && !ropes.cut) callback(); }));
  schedule(0, () => { engineer.setTask('enter', { velocityX: 65 }); hooks.enter?.(); });
  schedule(2300, () => { engineer.setTask('notice_name'); hooks.stopAtSwitch?.(); });
  schedule(3200, () => { engineer.setTask('switch_light'); void blackout.pulse(); hooks.switch?.(); });
  schedule(4600, () => { helpers.forEach((p, i) => { p.setTask('enter', { velocityX: 45 + i * 8 }); }); hooks.arrive?.(); });
  schedule(7000, () => { helpers.forEach(p => p.setTask('group_look_up')); });
  schedule(8400, () => { helpers[0]?.setTask('carry_ladder', { velocityX: 40 }); hooks.carryLadder?.(); });
  schedule(10400, () => { helpers[0]?.setTask('place_ladder'); hooks.placeLadder?.(); });
  schedule(11400, () => { helpers[0]?.setTask('assemble_ladder'); hooks.assembleLadder?.(); });
  schedule(12600, () => { helpers[0]?.setTask('hold_ladder'); helpers[1]?.setTask('climb'); hooks.climb?.(); });
  schedule(15100, () => { helpers[1]?.setTask('reach_rope'); hooks.reachRope?.(); });
  schedule(16000, () => { helpers[1]?.setTask('cut_rope'); hooks.cutTool?.(); });
  schedule(16600, () => ropes.dropAll());
  return {
    // Call cancel on interactive cut; preserve every Sprite for Home.
    cancel() { cancelled = true; timers.forEach(timer => timer.remove(false)); },
    get cancelled() { return cancelled; }
  };
}
