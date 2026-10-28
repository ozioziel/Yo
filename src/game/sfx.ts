/**
 * Procedural sound effects (Web Audio). No music and no audio files: every sound is
 * synthesised, short and quiet. The context starts on the visitor's first gesture,
 * as browsers require.
 */
type Ambient = 'rain' | 'waves' | null;

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  private recent = new Map<string, number>();
  private ambient: { kind: Ambient; nodes: AudioNode[]; gain: GainNode } | null = null;
  private wantedAmbient: Ambient = null;
  private unlockBound = () => this.unlock();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this.unlockBound, { capture: true });
      window.addEventListener('keydown', this.unlockBound, { capture: true });
    }
  }

  private unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.setAmbient(this.wantedAmbient);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }

  /** Avoid machine-gun repeats when many things happen in the same instant. */
  private allow(name: string, gapMs: number) {
    const now = performance.now();
    if ((this.recent.get(name) ?? 0) > now - gapMs) return false;
    this.recent.set(name, now);
    return !!this.ctx && !this.muted && this.ctx.state === 'running';
  }

  private env(gain: GainNode, t: number, peak: number, attack: number, decay: number) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, delay = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, peak, 0.006, dur);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private burst(filter: BiquadFilterType, freq: number, q: number, dur: number, peak: number, delay = 0, sweepTo?: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, peak, 0.004, dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  snip() {
    if (!this.allow('snip', 120)) return;
    this.burst('highpass', 3200, 0.7, 0.05, 0.5);
    this.burst('highpass', 4200, 0.7, 0.06, 0.4, 0.07);
    this.tone('square', 2400, 1800, 0.03, 0.05, 0.07);
  }

  click() {
    if (!this.allow('click', 60)) return;
    this.tone('square', 1500, 900, 0.025, 0.08);
    this.burst('bandpass', 2500, 2, 0.03, 0.12);
  }

  squeak() {
    if (!this.allow('squeak', 140)) return;
    const f = 850 + Math.random() * 250;
    this.tone('sine', f, f * 1.7, 0.14, 0.14);
    this.tone('triangle', f * 2, f * 3, 0.08, 0.03, 0.02);
  }

  whoosh(strength = 0.5) {
    if (!this.allow('whoosh', 150)) return;
    this.burst('bandpass', 400, 0.8, 0.28, 0.12 + 0.18 * strength, 0, 1600);
  }

  thud(level: 0 | 1 | 2) {
    if (!this.allow(`thud${level}`, 70)) return;
    const peak = [0.18, 0.32, 0.5][level];
    this.tone('sine', 140 - level * 20, 45, 0.18 + level * 0.08, peak);
    this.burst('lowpass', 500, 0.7, 0.08 + level * 0.06, peak * 0.6);
    if (level === 2) this.tone('triangle', 1300, 1700, 0.09, 0.05, 0.12); // cartoon "ding"
  }

  tok(pitch = 1) {
    if (!this.allow('tok', 45)) return;
    this.tone('sine', 720 * pitch, 520 * pitch, 0.07, 0.14);
    this.burst('bandpass', 1800 * pitch, 3, 0.03, 0.05);
  }

  sparkle() {
    if (!this.allow('sparkle', 300)) return;
    [1046, 1318, 1568, 2093].forEach((f, i) => this.tone('sine', f, f, 0.22, 0.07, i * 0.07));
  }

  chime() {
    if (!this.allow('chime', 400)) return;
    this.tone('sine', 784, 784, 0.5, 0.06);
    this.tone('sine', 1175, 1175, 0.6, 0.04, 0.1);
  }

  pop() {
    if (!this.allow('pop', 80)) return;
    this.tone('sine', 420, 900, 0.07, 0.12);
  }

  splash() {
    if (!this.allow('splash', 150)) return;
    this.burst('lowpass', 2200, 0.6, 0.25, 0.18, 0, 500);
    this.burst('highpass', 2500, 0.5, 0.12, 0.05, 0.03);
  }

  crunch() {
    if (!this.allow('crunch', 120)) return;
    this.burst('bandpass', 1200, 1.2, 0.09, 0.1);
    this.burst('bandpass', 900, 1.2, 0.07, 0.07, 0.08);
  }

  rustle() {
    if (!this.allow('rustle', 250)) return;
    for (let i = 0; i < 4; i++) this.burst('bandpass', 2500 + Math.random() * 1500, 1.5, 0.05, 0.04, i * 0.05);
  }

  squeegee() {
    if (!this.allow('squeegee', 200)) return;
    this.tone('triangle', 1700, 2300, 0.12, 0.03);
  }

  /** Very quiet continuous texture for rain (autumn) or surf (summer). */
  setAmbient(kind: Ambient) {
    this.wantedAmbient = kind;
    if (!this.ctx || !this.master || !this.noise) return;
    if (this.ambient?.kind === kind) return;
    const ctx = this.ctx;
    if (this.ambient) {
      const old = this.ambient;
      old.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
      setTimeout(() => old.nodes.forEach(n => n.disconnect()), 2500);
      this.ambient = null;
    }
    if (!kind) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    const nodes: AudioNode[] = [src, f, g];
    if (kind === 'rain') {
      f.type = 'bandpass';
      f.frequency.value = 2600;
      f.Q.value = 0.35;
      g.gain.setTargetAtTime(0.05, ctx.currentTime, 1.2);
    } else {
      f.type = 'lowpass';
      f.frequency.value = 650;
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 0.12;
      depth.gain.value = 0.025;
      lfo.connect(depth).connect(g.gain);
      lfo.start();
      nodes.push(lfo, depth);
      g.gain.setTargetAtTime(0.035, ctx.currentTime, 1.5);
    }
    src.connect(f).connect(g).connect(this.master);
    src.start();
    this.ambient = { kind, nodes, gain: g };
  }
}

export const sfx = new Sfx();
