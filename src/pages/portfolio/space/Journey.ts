import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import * as THREE from 'three';
import { SpaceScene, T_END, smooth, type Quality } from './SpaceScene';

gsap.registerPlugin(ScrollTrigger, SplitText);

export interface ViewerState {
  open: boolean;
  index: number;
}

export interface JourneyOptions {
  canvas: HTMLCanvasElement;
  /** tall element whose scroll drives the journey */
  track: HTMLElement;
  intro: HTMLElement;
  /** captions with data-band="inStart,inEnd,outStart,outEnd" (journey time) */
  captions: HTMLElement[];
  /** one label per project, placed next to its star */
  labels: HTMLElement[];
  hud: HTMLElement;
  count: number;
  reduced: boolean;
  onViewer: (state: ViewerState) => void;
}

interface Caption {
  el: HTMLElement;
  band: number[];
  split: SplitText;
  tl: gsap.core.Timeline;
  shown: number;
}

const STAGE_NAMES: [number, string][] = [
  [0, 'Origen'],
  [1.25, 'Dispersión'],
  [3.1, 'Sistema solar'],
  [5.4, 'Galaxias'],
  [7.5, 'Constelación'],
];

const OPEN_AT = 9.85; // the constellation is formed: the project viewer opens
const CLOSE_BELOW = 9.7;
const REARM_BELOW = 9.5;

/**
 * Drives the /portafolio journey: Lenis smooth scroll -> ScrollTrigger ->
 * journey time t -> SpaceScene (camera + stars), captions, labels and the
 * project viewer. React only renders the DOM and listens to onViewer.
 */
export class Journey {
  private readonly o: JourneyOptions;
  private scene: SpaceScene | null = null;
  private lenis: Lenis | null = null;
  private trigger: ScrollTrigger;
  private captions: Caption[] = [];
  private introSplit: SplitText | null = null;
  private tweens: gsap.core.Animation[] = [];

  private target = 0;
  private t = 0;
  private time = 0;
  private assemble = { v: 0 };
  private blend = { v: 0 };
  private focus = { v: 0 };
  private open = false;
  private index = 0;
  private armed = true;
  private viewerPos = new THREE.Vector3();
  private viewerLook = new THREE.Vector3();
  private pointer = new THREE.Vector2();
  private pointerTarget = new THREE.Vector2();
  private label = { x: 0, y: 0, visible: false, side: 0 };
  private hudStage = '';
  private hudPct = -1;

  constructor(options: JourneyOptions) {
    this.o = options;
    const quality: Quality =
      Math.min(window.innerWidth, window.innerHeight) < 700 || window.matchMedia('(pointer: coarse)').matches ? 'low' : 'high';
    try {
      this.scene = new SpaceScene(options.canvas, quality);
    } catch (err) {
      console.warn('[portafolio] WebGL no disponible, se muestra sin el espacio 3D', err);
      options.canvas.style.display = 'none';
    }
    this.onResize();

    if (!options.reduced) {
      this.lenis = new Lenis({ lerp: 0.075, wheelMultiplier: 0.9, smoothWheel: true });
      this.lenis.on('scroll', ScrollTrigger.update);
    }
    this.trigger = ScrollTrigger.create({
      trigger: options.track,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: self => {
        this.target = self.progress * T_END;
      },
    });
    this.target = this.trigger.progress * T_END;
    this.t = this.target;

    this.setupCaptions();
    this.setupIntro();

    gsap.ticker.add(this.tick);
    gsap.ticker.lagSmoothing(0);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointermove', this.onPointer, { passive: true });
  }

  // ---------------------------------------------------------------- public

  next() {
    this.goTo((this.index + 1) % this.o.count);
  }

  prev() {
    this.goTo((this.index - 1 + this.o.count) % this.o.count);
  }

  /** Focus project i: opens the viewer if needed, flies to its star otherwise. */
  goTo(i: number) {
    if (!this.open) {
      this.openViewer(i);
      return;
    }
    if (i === this.index) return;
    const prev = this.index;
    this.index = i;
    this.emit();
    if (!this.scene) return;
    const fromPos = this.viewerPos.clone();
    const fromLook = this.viewerLook.clone();
    const toPos = new THREE.Vector3();
    const toLook = new THREE.Vector3();
    this.scene.viewerPose(i, toPos, toLook);
    const hop = Math.min(6, Math.abs(i - prev)) * 1.2 + 2;
    const k = { v: 0 };
    this.track(
      gsap.to(k, {
        v: 1,
        duration: this.o.reduced ? 0.01 : 1.25,
        ease: 'power3.inOut',
        onUpdate: () => {
          this.viewerPos.lerpVectors(fromPos, toPos, k.v);
          this.viewerPos.z += Math.sin(k.v * Math.PI) * hop; // pull back a little while travelling
          this.viewerLook.lerpVectors(fromLook, toLook, k.v);
        },
      }),
    );
  }

  /** Leave the viewer and show the whole constellation (labels clickable). */
  closeViewer() {
    if (!this.open) return;
    this.open = false;
    this.armed = false;
    this.animateBlend(0);
    this.emit();
  }

  /** "Ir directo a los proyectos": fly through the whole journey quickly. */
  skipToProjects() {
    const max = ScrollTrigger.maxScroll(window);
    if (this.lenis) this.lenis.scrollTo(max, { duration: 4.2, easing: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2) });
    else window.scrollTo(0, max);
  }

  destroy() {
    gsap.ticker.remove(this.tick);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointer);
    this.tweens.forEach(t => t.kill());
    this.captions.forEach(c => {
      c.tl.kill();
      c.split.revert();
    });
    this.introSplit?.revert();
    gsap.set(this.o.intro.querySelectorAll('[data-intro], [data-kicker]'), { clearProps: 'all' });
    gsap.ticker.lagSmoothing(500, 33);
    this.trigger.kill();
    this.lenis?.destroy();
    this.scene?.dispose();
  }

  // ---------------------------------------------------------------- internals

  private track<T extends gsap.core.Animation>(tween: T) {
    this.tweens.push(tween);
    if (this.tweens.length > 40) this.tweens = this.tweens.filter(t => t.isActive());
    return tween;
  }

  private emit() {
    this.o.onViewer({ open: this.open, index: this.index });
  }

  private openViewer(i: number) {
    this.open = true;
    this.index = i;
    this.scene?.viewerPose(i, this.viewerPos, this.viewerLook);
    this.animateBlend(1);
    this.emit();
  }

  private animateBlend(to: number) {
    const duration = this.o.reduced ? 0.01 : 1.4;
    this.track(gsap.to(this.blend, { v: to, duration, ease: 'power2.inOut', overwrite: true }));
    this.track(gsap.to(this.focus, { v: to, duration, ease: 'power2.inOut', overwrite: true }));
  }

  private setupCaptions() {
    this.captions = this.o.captions.map(el => {
      const band = (el.dataset.band ?? '0,0,0,0').split(',').map(Number);
      const text = el.querySelector<HTMLElement>('[data-split]') ?? el;
      const split = new SplitText(text, { type: 'words,chars' });
      const tl = gsap.timeline({ paused: true });
      tl.from(split.chars, {
        opacity: 0,
        yPercent: 55,
        filter: this.o.reduced ? 'none' : 'blur(10px)',
        duration: 0.5,
        stagger: 0.018,
        ease: 'power2.out',
      });
      const kicker = el.querySelector('[data-kicker]');
      if (kicker) tl.fromTo(kicker, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4 }, 0);
      el.style.visibility = 'hidden';
      return { el, band, split, tl, shown: -1 };
    });
  }

  private setupIntro() {
    const intro = this.o.intro;
    const h1 = intro.querySelector('h1');
    const rest = intro.querySelectorAll('[data-intro]');
    if (this.o.reduced) {
      this.assemble.v = 1;
      return;
    }
    this.track(gsap.to(this.assemble, { v: 1, duration: 3.4, ease: 'power2.out', delay: 0.15 }));
    if (h1) {
      this.introSplit = new SplitText(h1, { type: 'words,chars' });
      this.track(
        gsap.from(this.introSplit.chars, { opacity: 0, yPercent: 70, filter: 'blur(12px)', duration: 0.9, stagger: 0.028, ease: 'power3.out', delay: 1.3 }),
      );
    }
    // fromTo, not from: React mounts twice in development and a killed
    // from-tween would leave opacity 0 as the 'current' value
    this.track(gsap.fromTo(rest, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: 'power2.out', delay: 1.9 }));
  }

  private onPointer = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    this.pointerTarget.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  };

  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.75);
    this.scene?.resize(w, h, dpr);
    if (this.open && this.scene) this.scene.viewerPose(this.index, this.viewerPos, this.viewerLook);
  };

  private tick = (time: number, deltaMs: number) => {
    this.lenis?.raf(time * 1000); // Lenis runs on GSAP's clock so ScrollTrigger and the scene stay in sync
    const dt = Math.min(0.1, deltaMs / 1000);
    if (!this.o.reduced) this.time += dt;
    this.t += (this.target - this.t) * (1 - Math.exp(-dt * 7));
    if (Math.abs(this.target - this.t) < 1e-4) this.t = this.target;
    const t = this.t;
    this.pointer.lerp(this.pointerTarget, 1 - Math.exp(-dt * 3));

    // the viewer opens by itself once the constellation is formed
    if (t < REARM_BELOW) this.armed = true;
    if (!this.open && this.armed && t >= OPEN_AT) this.openViewer(this.index);
    if (this.open && t < CLOSE_BELOW) {
      this.open = false;
      this.animateBlend(0);
      this.emit();
    }

    this.scene?.update({
      t,
      time: this.time,
      dt,
      assemble: this.assemble.v,
      viewer: this.blend.v,
      viewerPos: this.viewerPos,
      viewerLook: this.viewerLook,
      active: this.open || this.blend.v > 0.01 ? this.index : -1,
      focus: this.focus.v,
      pointer: this.pointer,
      motion: !this.o.reduced,
    });
    this.scene?.render();

    this.updateOverlay(t);
  };

  private updateOverlay(t: number) {
    const intro = this.o.intro;
    const out = smooth(0.35, 1.0, t);
    intro.style.opacity = String(1 - out);
    intro.style.transform = `translate3d(0, ${(-out * 40).toFixed(1)}px, 0)`;
    intro.style.visibility = out >= 1 ? 'hidden' : 'visible';

    for (const c of this.captions) {
      const [a, b, cc, d] = c.band;
      const inP = Math.min(1, Math.max(0, (t - a) / (b - a)));
      const outP = Math.min(1, Math.max(0, (t - cc) / (d - cc)));
      const shown = inP * (1 - outP);
      if (Math.abs(shown - c.shown) < 0.002) continue;
      c.shown = shown;
      c.tl.progress(inP);
      c.el.style.opacity = String(1 - outP);
      c.el.style.visibility = shown <= 0 ? 'hidden' : 'visible';
    }

    // labels around the constellation when the viewer is closed
    const labelsOn = smooth(9.3, 9.75, t) * (1 - this.blend.v);
    this.o.labels.forEach((el, i) => {
      if (labelsOn <= 0.01 || !this.scene) {
        if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden';
        return;
      }
      this.scene.labelPosition(i, this.label);
      el.style.visibility = this.label.visible ? 'visible' : 'hidden';
      el.style.opacity = labelsOn.toFixed(3);
      const side = this.label.side > 0.15 ? 'r' : this.label.side < -0.15 ? 'l' : 'c';
      const anchor = side === 'r' ? '0%' : side === 'l' ? '-100%' : '-50%';
      if (el.dataset.side !== side) el.dataset.side = side;
      el.style.transform = `translate3d(${this.label.x.toFixed(1)}px, ${this.label.y.toFixed(1)}px, 0) translate(${anchor}, -50%)`;
    });

    // HUD: stage name and how far along the journey
    let stage = STAGE_NAMES[0][1];
    for (const [at, name] of STAGE_NAMES) if (t >= at) stage = name;
    const pct = Math.round((t / T_END) * 100);
    if (stage !== this.hudStage || pct !== this.hudPct) {
      this.hudStage = stage;
      this.hudPct = pct;
      const idx = STAGE_NAMES.findIndex(s => s[1] === stage) + 1;
      this.o.hud.dataset.stage = String(idx);
      const name = this.o.hud.querySelector('[data-hud-stage]');
      const value = this.o.hud.querySelector('[data-hud-pct]');
      if (name) name.textContent = `${String(idx).padStart(2, '0')} · ${stage}`;
      if (value) value.textContent = `${pct}%`;
      this.o.hud.style.setProperty('--progress', String(t / T_END));
    }
  }
}
