import * as THREE from 'three';
import { PROJECTS } from '../projects';
import { silhouetteVertex, starFragment, starVertex, sunFragment, sunVertex } from './shaders';
import silhouetteJson from './silhouette.json';
import { glowTexture, makeRandom, nebulaTexture, planetTexture, ringTexture, type PlanetLook } from './textures';

export type Quality = 'high' | 'low';

/** The scroll maps to a journey time t in [0, T_END]. */
export const T_END = 10;

/** Moments of the journey, in journey time. */
export const STAGES = {
  disperse: [1.0, 2.8],
  gather: [7.3, 9.3],
  cores: [8.6, 9.4],
} as const;

const FIG_H = 9; // Oziel's height in world units
const SOLAR = new THREE.Vector3(0, -12, -330);
const CONSTELLATION = new THREE.Vector3(60, 160, -2150);
/** where the camera starts its final approach: the stars condense along this stretch */
const APPROACH = new THREE.Vector3(40, 170, -1750);
const RING_R = 16;

const GALAXIES = [
  { pos: new THREE.Vector3(-300, 230, -1350), radius: 260, branches: 3, twist: 4.6, tilt: new THREE.Euler(1.15, 0.25, 0.2), inside: '#ffd2a1', outside: '#4f6bff', count: [26000, 11000] },
  { pos: new THREE.Vector3(470, -150, -1850), radius: 190, branches: 2, twist: 5.2, tilt: new THREE.Euler(0.8, -0.5, 0.35), inside: '#ffb0e0', outside: '#7a4dff', count: [16000, 7000] },
  { pos: new THREE.Vector3(-90, 540, -2650), radius: 150, branches: 4, twist: 4.0, tilt: new THREE.Euler(1.45, 0.1, -0.4), inside: '#fff3cf', outside: '#3fd4ff', count: [11000, 5000] },
];

interface PlanetSpec {
  radius: number;
  orbit: number;
  look: PlanetLook;
  ring?: boolean;
  moon?: boolean;
}

const PLANETS: PlanetSpec[] = [
  { radius: 0.75, orbit: 11, look: { base: '#9c938a', spots: ['#6f6760', '#b8b0a6'] } },
  { radius: 1.15, orbit: 15, look: { base: '#e3c48b', bands: ['#c9a66b', '#f0dcae'] } },
  { radius: 1.25, orbit: 20, look: { base: '#2f6fd1', spots: ['#3f8f4a', '#5aa35a', '#c9b37a'], clouds: true }, moon: true },
  { radius: 0.95, orbit: 26, look: { base: '#c4532d', spots: ['#8e3a1f', '#e07a4f'] } },
  { radius: 3.4, orbit: 42, look: { base: '#d8b48c', bands: ['#a8744e', '#f1dcc0', '#c98f5f', '#8a5a3a'] } },
  { radius: 2.9, orbit: 55, look: { base: '#e6cf9c', bands: ['#c9ab72', '#f4e6c2', '#b89a64'] }, ring: true },
  { radius: 1.9, orbit: 66, look: { base: '#9fe3ea', bands: ['#86d0d8', '#b9f0f4'] } },
  { radius: 1.85, orbit: 75, look: { base: '#3f63e0', bands: ['#2f4fbf', '#5a82f0'] } },
];

export interface Frame {
  /** journey time 0..T_END */
  t: number;
  /** seconds since start */
  time: number;
  dt: number;
  /** 0..1 intro: the stars come together into Oziel */
  assemble: number;
  /** 0..1 journey camera -> project viewer camera */
  viewer: number;
  viewerPos: THREE.Vector3;
  viewerLook: THREE.Vector3;
  /** project in focus (index), -1 for none */
  active: number;
  /** 0..1 how much the active project stands out */
  focus: number;
  /** pointer, -1..1 */
  pointer: THREE.Vector2;
  /** false with reduced motion: no twinkle drift on the figure */
  motion: boolean;
}

export const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function starMaterial(opacity: number, sizeMul: number, wrap = false) {
  return new THREE.ShaderMaterial({
    vertexShader: starVertex,
    fragmentShader: starFragment,
    defines: wrap ? { WRAP: '' } : {},
    uniforms: {
      uTime: { value: 0 },
      uProj: { value: 1000 },
      uOpacity: { value: opacity },
      uSizeMul: { value: sizeMul },
      ...(wrap ? { uCam: { value: new THREE.Vector3() }, uBox: { value: 260 } } : {}),
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * Everything drawn with three.js: Oziel's silhouette made of stars, the sky,
 * the solar system, three galaxies and the constellation of projects.
 * It knows nothing about scrolling: the Journey controller feeds it a Frame.
 */
export class SpaceScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 7000);
  private readonly quality: Quality;
  private readonly disposables: { dispose(): void }[] = [];
  private readonly starMats: THREE.ShaderMaterial[] = [];

  private silhouette!: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private fig = { minX: 0, maxX: 0 };
  private sky = new THREE.Group();
  private dust!: THREE.ShaderMaterial;
  private solar = new THREE.Group();
  private sunMat!: THREE.ShaderMaterial;
  private planets: { mesh: THREE.Mesh; spec: PlanetSpec; phase: number; moon?: THREE.Mesh }[] = [];
  private galaxies: THREE.Points[] = [];
  private cores: { glow: THREE.Sprite; core: THREE.Sprite; base: number }[] = [];
  private ring!: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  /** setters that fade the solar system / the galaxies in (they stay hidden behind Oziel at the start) */
  private solarFaders: ((v: number) => void)[] = [];
  private galaxyFaders: ((v: number) => void)[] = [];
  private galaxyHolders: THREE.Group[] = [];

  private keys: { t: number; pos: THREE.Vector3; look: THREE.Vector3 }[] = [];
  private posCurve!: THREE.CatmullRomCurve3;
  private lookCurve!: THREE.CatmullRomCurve3;
  private tmpPos = new THREE.Vector3();
  private tmpLook = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private width = 1;
  private height = 1;

  constructor(canvas: HTMLCanvasElement, quality: Quality) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x02030a, 1);
    this.scene.add(this.camera);

    this.buildSky();
    this.buildSolarSystem();
    this.buildGalaxies();
    this.buildConstellation();
    this.buildSilhouette();
  }

  get count() {
    return PROJECTS.length;
  }

  // ---------------------------------------------------------------- building

  private hi<T>(high: T, low: T) {
    return this.quality === 'high' ? high : low;
  }

  private buildSilhouette() {
    const rand = makeRandom(7);
    const { data, scale, count: total } = silhouetteJson as { data: number[]; scale: number; count: number };
    const n = Math.min(total, this.hi(total, 6500));
    const home = new Float32Array(n * 3);
    const scatter = new Float32Array(n * 3);
    const cloud = new Float32Array(n * 3);
    const center = new Float32Array(n * 3);
    const offset = new Float32Array(n * 3);
    const rnd = new Float32Array(n * 4);
    const proj = new Float32Array(n);
    const color = new Float32Array(n * 3);
    const colors = PROJECTS.map(p => hexToRgb(p.color));
    const ring = PROJECTS.map((_, i) => this.ringPosition(i, new THREE.Vector3()));
    let minX = Infinity;
    let maxX = -Infinity;

    for (let i = 0; i < n; i++) {
      const X = data[i * 3] / scale - 0.5;
      const Y = data[i * 3 + 1] / scale;
      const b = data[i * 3 + 2] / 9;
      const hx = X * FIG_H;
      const hy = (Y - 0.5) * FIG_H;
      minX = Math.min(minX, hx);
      maxX = Math.max(maxX, hx);
      home.set([hx, hy, (rand() - 0.5) * 0.32], i * 3);

      // dispersal: every star drifts straight out from the body, in every
      // direction, while the camera holds back (it must not fly into him)
      // (most stay close, so he reads as a cloud that expands instead of vanishing)
      const dx = hx + (rand() - 0.5) * 2;
      const dy = hy + (rand() - 0.5) * 2;
      const dz = (rand() - 0.5) * 3;
      const len = Math.hypot(dx, dy, dz) || 1;
      const r = 2.5 + Math.pow(rand(), 1.7) * 30;
      scatter.set([hx + (dx / len) * r, hy + (dy / len) * r * 0.85, Math.min(5, (dz / len) * r)], i * 3);

      // the cloud the project stars condense from: around the final approach,
      // so they stream past the camera and come together ahead of it
      const along = Math.pow(rand(), 0.75);
      const u = rand() * 2 - 1;
      const phi = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const cr = 6 + Math.pow(rand(), 0.7) * 60;
      cloud.set(
        [
          APPROACH.x + (CONSTELLATION.x - APPROACH.x) * along + Math.cos(phi) * s * cr,
          APPROACH.y + (CONSTELLATION.y - APPROACH.y) * along + Math.sin(phi) * s * cr,
          APPROACH.z + (CONSTELLATION.z - APPROACH.z) * along + u * cr,
        ],
        i * 3,
      );

      // project star: a bright core plus a small spiral disc around it
      const p = i % PROJECTS.length;
      proj[i] = p;
      center.set([ring[p].x, ring[p].y, ring[p].z], i * 3);
      const isCore = rand() < 0.36;
      if (isCore) {
        const cu = rand() * 2 - 1;
        const cphi = rand() * Math.PI * 2;
        const cs = Math.sqrt(1 - cu * cu);
        const rr = Math.pow(rand(), 1.8) * 0.5;
        offset.set([Math.cos(cphi) * cs * rr, Math.sin(cphi) * cs * rr, cu * rr], i * 3);
      } else {
        const arm = Math.floor(rand() * 2);
        const rr = 0.55 + Math.pow(rand(), 1.4) * 2.3;
        const a = arm * Math.PI + rr * 1.7 + (rand() - 0.5) * 0.7;
        offset.set([Math.cos(a) * rr, Math.sin(a) * rr, (rand() - 0.5) * 0.25], i * 3);
      }
      const mixW = isCore ? 0.55 : 0.08;
      const c = colors[p];
      color.set([c[0] + (1 - c[0]) * mixW, c[1] + (1 - c[1]) * mixW, c[2] + (1 - c[2]) * mixW], i * 3);

      // delay: the head lets go first and the wave runs down to the feet
      rnd.set([0.62 * (1 - Y) + 0.28 * rand(), rand(), 0.7 + rand() * 0.6, 0.25 + b * 0.75], i * 4);
    }
    this.fig = { minX, maxX };

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(home, 3));
    geo.setAttribute('aHome', new THREE.BufferAttribute(home, 3));
    geo.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
    geo.setAttribute('aCloud', new THREE.BufferAttribute(cloud, 3));
    geo.setAttribute('aCenter', new THREE.BufferAttribute(center, 3));
    geo.setAttribute('aOffset', new THREE.BufferAttribute(offset, 3));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4));
    geo.setAttribute('aProj', new THREE.BufferAttribute(proj, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    const mat = new THREE.ShaderMaterial({
      vertexShader: silhouetteVertex,
      fragmentShader: starFragment,
      uniforms: {
        uTime: { value: 0 },
        uProj: { value: 1000 },
        uSize: { value: 0.05 },
        uAssemble: { value: 0 },
        uDisperse: { value: 0 },
        uGather: { value: 0 },
        uActive: { value: -1 },
        uFocus: { value: 0 },
        uScan: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.silhouette = new THREE.Points(geo, mat);
    this.silhouette.frustumCulled = false;
    this.scene.add(this.silhouette);
    this.disposables.push(geo, mat);
  }

  private buildSky() {
    const rand = makeRandom(11);
    // far stars: a shell that travels with the camera (stars at "infinity")
    const n = this.hi(6500, 3200);
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const phase = new Float32Array(n);
    const palette = [hexToRgb('#ffffff'), hexToRgb('#cfe0ff'), hexToRgb('#ffe7c4'), hexToRgb('#ffc2b0'), hexToRgb('#b8c8ff')];
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1;
      const phi = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 2000 + rand() * 700;
      pos.set([Math.cos(phi) * s * r, u * r, Math.sin(phi) * s * r], i * 3);
      col.set(palette[Math.floor(Math.pow(rand(), 2) * palette.length)], i * 3);
      size[i] = 1.6 + Math.pow(rand(), 4) * 5.5;
      phase[i] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const mat = starMaterial(0.95, 1);
    const stars = new THREE.Points(geo, mat);
    stars.frustumCulled = false;
    this.sky.add(stars);
    this.starMats.push(mat);
    this.disposables.push(geo, mat);

    // nebulae: big soft clouds of colour far away
    const nebulae = [
      { dir: [-0.6, 0.35, -1], colors: ['#5b2bd6', '#c2398a', '#2b4fd6'], size: 2200, opacity: 0.5 },
      { dir: [0.8, -0.2, -1], colors: ['#1fa3b5', '#3b2bd6'], size: 1900, opacity: 0.45 },
      { dir: [0.1, 0.9, -0.7], colors: ['#d63b6a', '#7a2bd6'], size: 1700, opacity: 0.35 },
      { dir: [-0.9, -0.5, 0.2], colors: ['#2b6fd6', '#6a2bd6'], size: 2000, opacity: 0.4 },
      { dir: [0.7, 0.3, 0.8], colors: ['#c23939', '#d6862b'], size: 1600, opacity: 0.3 },
    ];
    nebulae.forEach((neb, i) => {
      const tex = nebulaTexture(neb.colors, 100 + i);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: neb.opacity, depthWrite: false, blending: THREE.AdditiveBlending });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(neb.dir[0], neb.dir[1], neb.dir[2]).normalize().multiplyScalar(2400);
      sprite.scale.setScalar(neb.size);
      sprite.frustumCulled = false;
      this.sky.add(sprite);
      this.disposables.push(tex, mat);
    });
    this.scene.add(this.sky);

    // dust: close stars wrapped around the camera, they give the sense of speed
    const dn = this.hi(2600, 1300);
    const box = 260;
    const dpos = new Float32Array(dn * 3);
    const dcol = new Float32Array(dn * 3);
    const dsize = new Float32Array(dn);
    const dphase = new Float32Array(dn);
    for (let i = 0; i < dn; i++) {
      dpos.set([rand() * box, rand() * box, rand() * box], i * 3);
      dcol.set(palette[Math.floor(rand() * 3)], i * 3);
      dsize[i] = 0.06 + rand() * 0.14;
      dphase[i] = rand();
    }
    const dgeo = new THREE.BufferGeometry();
    dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    dgeo.setAttribute('aColor', new THREE.BufferAttribute(dcol, 3));
    dgeo.setAttribute('aSize', new THREE.BufferAttribute(dsize, 1));
    dgeo.setAttribute('aPhase', new THREE.BufferAttribute(dphase, 1));
    this.dust = starMaterial(0.9, 1, true);
    this.dust.uniforms.uBox.value = box;
    const dust = new THREE.Points(dgeo, this.dust);
    dust.frustumCulled = false;
    this.scene.add(dust);
    this.starMats.push(this.dust);
    this.disposables.push(dgeo, this.dust);
  }

  private buildSolarSystem() {
    const rand = makeRandom(23);
    this.solar.position.copy(SOLAR);
    this.solar.rotation.set(0.18, 0, -0.06);
    this.scene.add(this.solar);

    const sunGeo = new THREE.SphereGeometry(7, 64, 32);
    this.sunMat = new THREE.ShaderMaterial({
      vertexShader: sunVertex,
      fragmentShader: sunFragment,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 } },
      transparent: true,
    });
    const sunMat = this.sunMat;
    this.solarFaders.push(v => (sunMat.uniforms.uOpacity.value = v));
    this.solar.add(new THREE.Mesh(sunGeo, this.sunMat));
    this.disposables.push(sunGeo, this.sunMat);
    for (const [color, scale, opacity] of [
      ['#ffb347', 46, 0.95],
      ['#ff7a2f', 120, 0.45],
    ] as const) {
      const tex = glowTexture(color);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
      const glow = new THREE.Sprite(mat);
      glow.scale.setScalar(scale);
      this.solar.add(glow);
      this.solarFaders.push(v => (mat.opacity = opacity * v));
      this.disposables.push(tex, mat);
    }

    this.solar.add(new THREE.PointLight(0xfff1dc, 2.6, 0, 0));
    this.scene.add(new THREE.AmbientLight(0x8090c0, 0.12));

    const orbitMat = new THREE.LineBasicMaterial({ color: 0x8fb0ff, transparent: true, opacity: 0.16, depthWrite: false });
    this.disposables.push(orbitMat);
    this.solarFaders.push(v => (orbitMat.opacity = 0.16 * v));
    PLANETS.forEach((spec, i) => {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k < 160; k++) {
        const a = (k / 160) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * spec.orbit, 0, Math.sin(a) * spec.orbit));
      }
      const og = new THREE.BufferGeometry().setFromPoints(pts);
      this.solar.add(new THREE.LineLoop(og, orbitMat));
      this.disposables.push(og);

      const tex = planetTexture(spec.look, 300 + i);
      const geo = new THREE.SphereGeometry(spec.radius, 40, 20);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0, transparent: true });
      this.solarFaders.push(v => (mat.opacity = v));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.z = 0.2 + rand() * 0.3;
      this.solar.add(mesh);
      this.disposables.push(tex, geo, mat);

      if (spec.ring) {
        const rtex = ringTexture(500 + i);
        const rgeo = new THREE.RingGeometry(spec.radius * 1.35, spec.radius * 2.3, 96, 1);
        // map the texture along the radius
        const uv = rgeo.attributes.uv;
        const p = rgeo.attributes.position;
        for (let k = 0; k < uv.count; k++) {
          const r = Math.hypot(p.getX(k), p.getY(k));
          uv.setXY(k, (r - spec.radius * 1.35) / (spec.radius * 0.95), 0.5);
        }
        const rmat = new THREE.MeshBasicMaterial({ map: rtex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
        this.solarFaders.push(v => (rmat.opacity = v));
        const ring = new THREE.Mesh(rgeo, rmat);
        ring.rotation.x = -Math.PI / 2 + 0.45;
        mesh.add(ring);
        this.disposables.push(rtex, rgeo, rmat);
      }
      let moon: THREE.Mesh | undefined;
      if (spec.moon) {
        const mgeo = new THREE.SphereGeometry(0.34, 20, 10);
        const mmat = new THREE.MeshStandardMaterial({ color: 0xbfbab2, roughness: 1, transparent: true });
        this.solarFaders.push(v => (mmat.opacity = v));
        moon = new THREE.Mesh(mgeo, mmat);
        this.solar.add(moon);
        this.disposables.push(mgeo, mmat);
      }
      this.planets.push({ mesh, spec, phase: rand() * Math.PI * 2, moon });
    });

    // asteroid belt between Mars and Jupiter
    const n = this.hi(2000, 900);
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const phase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const r = 30.5 + rand() * 4.5;
      pos.set([Math.cos(a) * r, (rand() - 0.5) * 1.2, Math.sin(a) * r], i * 3);
      const g = 0.55 + rand() * 0.35;
      col.set([g, g * 0.92, g * 0.82], i * 3);
      size[i] = 0.12 + rand() * 0.2;
      phase[i] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const mat = starMaterial(0.8, 1);
    this.solar.add(new THREE.Points(geo, mat));
    this.solarFaders.push(v => (mat.uniforms.uOpacity.value = 0.8 * v));
    this.starMats.push(mat);
    this.disposables.push(geo, mat);
  }

  private buildGalaxies() {
    GALAXIES.forEach((spec, gi) => {
      const rand = makeRandom(40 + gi);
      const n = this.hi(spec.count[0], spec.count[1]);
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      const size = new Float32Array(n);
      const phase = new Float32Array(n);
      const cin = hexToRgb(spec.inside);
      const cout = hexToRgb(spec.outside);
      for (let i = 0; i < n; i++) {
        const bulge = rand() < 0.1;
        let x: number;
        let y: number;
        let z: number;
        let k: number;
        if (bulge) {
          const r = Math.pow(rand(), 2) * spec.radius * 0.16;
          const u = rand() * 2 - 1;
          const phi = rand() * Math.PI * 2;
          const s = Math.sqrt(1 - u * u);
          x = Math.cos(phi) * s * r;
          y = u * r * 0.6;
          z = Math.sin(phi) * s * r;
          k = 0;
        } else {
          const r = Math.pow(rand(), 1.5) * spec.radius;
          const branch = ((i % spec.branches) / spec.branches) * Math.PI * 2;
          const spin = (r / spec.radius) * spec.twist;
          const spread = (rr: number) => Math.pow(rand(), 2.6) * (rand() < 0.5 ? 1 : -1) * rr;
          x = Math.cos(branch + spin) * r + spread(0.32 * r + 4);
          y = spread(0.06 * r + 2);
          z = Math.sin(branch + spin) * r + spread(0.32 * r + 4);
          k = r / spec.radius;
        }
        pos.set([x, y, z], i * 3);
        const m = Math.min(1, k * 1.15);
        col.set([cin[0] + (cout[0] - cin[0]) * m, cin[1] + (cout[1] - cin[1]) * m, cin[2] + (cout[2] - cin[2]) * m], i * 3);
        size[i] = spec.radius * 0.0078 * (0.5 + rand());
        phase[i] = rand();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
      const mat = starMaterial(0.85, 1);
      const points = new THREE.Points(geo, mat);
      const holder = new THREE.Group();
      holder.position.copy(spec.pos);
      holder.rotation.copy(spec.tilt);
      holder.add(points);
      const tex = glowTexture(spec.inside);
      const gmat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
      const glow = new THREE.Sprite(gmat);
      glow.scale.setScalar(spec.radius * 0.95);
      holder.add(glow);
      this.scene.add(holder);
      this.galaxies.push(points);
      this.galaxyHolders.push(holder);
      this.galaxyFaders.push(v => {
        mat.uniforms.uOpacity.value = 0.85 * v;
        gmat.opacity = 0.7 * v;
      });
      this.starMats.push(mat);
      this.disposables.push(geo, mat, tex, gmat);
    });
  }

  private buildConstellation() {
    const pts: THREE.Vector3[] = [];
    PROJECTS.forEach((p, i) => {
      const at = this.ringPosition(i, new THREE.Vector3());
      pts.push(at);
      const tex = glowTexture(p.color);
      const gmat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const glow = new THREE.Sprite(gmat);
      glow.position.copy(at);
      glow.scale.setScalar(4.4);
      const cmat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const core = new THREE.Sprite(cmat);
      core.position.copy(at);
      core.scale.setScalar(1.3);
      this.scene.add(glow, core);
      this.cores.push({ glow, core, base: 4.4 });
      this.disposables.push(tex, gmat, cmat);
    });
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x9fb6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.ring = new THREE.LineLoop(geo, mat);
    this.scene.add(this.ring);
    this.disposables.push(geo, mat);
  }

  // ---------------------------------------------------------------- layout

  /** Position of project i on the ring of stars (the "O" of Oziel). */
  ringPosition(i: number, out: THREE.Vector3) {
    const a = Math.PI / 2 - (i / PROJECTS.length) * Math.PI * 2;
    return out.set(
      CONSTELLATION.x + Math.cos(a) * RING_R,
      CONSTELLATION.y + Math.sin(a) * RING_R,
      CONSTELLATION.z + Math.sin(i * 1.7) * 1.6,
    );
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const proj = (height * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    this.silhouette.material.uniforms.uProj.value = proj;
    for (const m of this.starMats) m.uniforms.uProj.value = proj;
    this.layout();
  }

  private get portrait() {
    return this.camera.aspect < 0.9;
  }

  /** Camera path of the journey, recomputed when the screen shape changes. */
  private layout() {
    const aspect = this.camera.aspect;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const figW = this.fig.maxX - this.fig.minX;
    // phones: Oziel fills the upper ~56% (name and buttons below); wide screens: ~77%, centred
    const z0 = this.portrait
      ? Math.max(FIG_H / 0.56 / (2 * tan), (figW * 1.3) / (2 * tan * aspect))
      : Math.max((FIG_H * 1.3) / (2 * tan), (figW * 1.16) / (2 * tan * aspect));
    // on wide screens the name sits bottom-left, so Oziel stands a bit to the right
    const fx = (this.fig.minX + this.fig.maxX) / 2 - (this.portrait ? 0 : 0.16 * z0 * tan * aspect);
    const fy = this.portrait ? -0.13 * (2 * z0 * tan) : -FIG_H * 0.02; // phones: centred at 37% from the top
    // the whole ring plus its labels must fit; on phones the labels need more room
    const end = Math.max(48 / (2 * tan), (this.portrait ? 54 : 48) / (2 * tan * aspect));
    const C = CONSTELLATION;
    const G1 = GALAXIES[0].pos;
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    this.keys = [
      { t: 1.0, pos: v(fx, fy, z0), look: v(fx, fy, 0) },
      // the stars scatter while the camera slowly backs away, then it leaves for the Sun
      { t: 2.8, pos: v(fx, fy + 0.3, z0 + 5), look: v(fx * 0.5, fy * 0.5, -6) },
      { t: 3.6, pos: v(14, 34, -175), look: SOLAR.clone() },
      { t: 4.35, pos: v(-38, 52, -255), look: SOLAR.clone() },
      { t: 5.1, pos: v(-120, 26, -330), look: SOLAR.clone() },
      { t: 6.0, pos: v(-140, 140, -650), look: G1.clone() },
      { t: 7.1, pos: v(-60, 210, -1100), look: G1.clone().lerp(C, 0.35) },
      { t: 8.2, pos: APPROACH.clone(), look: C.clone() },
      { t: 9.3, pos: v(C.x, C.y, C.z + end), look: C.clone() },
    ];
    this.posCurve = new THREE.CatmullRomCurve3(this.keys.map(k => k.pos), false, 'centripetal');
    this.lookCurve = new THREE.CatmullRomCurve3(this.keys.map(k => k.look), false, 'centripetal');
  }

  private journeyPose(t: number, pos: THREE.Vector3, look: THREE.Vector3) {
    const keys = this.keys;
    const last = keys.length - 1;
    let u: number;
    if (t <= keys[0].t) u = 0;
    else if (t >= keys[last].t) u = 1;
    else {
      let i = 0;
      while (t > keys[i + 1].t) i++;
      const f = (t - keys[i].t) / (keys[i + 1].t - keys[i].t);
      u = (i + f) / last;
    }
    this.posCurve.getPoint(u, pos);
    this.lookCurve.getPoint(u, look);
  }

  /** Where the camera sits to show project i next to its panel. */
  viewerPose(i: number, pos: THREE.Vector3, look: THREE.Vector3) {
    const at = this.ringPosition(i, this.tmp);
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    if (this.portrait) {
      const d = 14;
      pos.set(at.x, at.y, at.z + d);
      look.set(at.x, at.y - 0.54 * d * tan, at.z); // star in the upper quarter
    } else {
      const d = 10;
      pos.set(at.x, at.y, at.z + d);
      look.set(at.x + 0.44 * d * tan * this.camera.aspect, at.y, at.z); // star on the left
    }
  }

  /** Screen position (CSS px) of the label spot just outside project i's star. */
  labelPosition(i: number, out: { x: number; y: number; visible: boolean; side: number }) {
    const at = this.ringPosition(i, this.tmp);
    const dx = at.x - CONSTELLATION.x;
    const dy = at.y - CONSTELLATION.y;
    const len = Math.hypot(dx, dy) || 1;
    at.x += (dx / len) * 3;
    at.y += (dy / len) * 3;
    out.side = dx / len; // -1 left of the ring, 1 right: the text grows outwards
    at.project(this.camera);
    out.visible = at.z < 1 && Math.abs(at.x) < 1.2 && Math.abs(at.y) < 1.2;
    out.x = ((at.x + 1) / 2) * this.width;
    out.y = ((1 - at.y) / 2) * this.height;
    return out;
  }

  // ---------------------------------------------------------------- frame

  update(f: Frame) {
    const disperse = smooth(STAGES.disperse[0], STAGES.disperse[1], f.t);
    const gather = smooth(STAGES.gather[0], STAGES.gather[1], f.t);
    const coreFade = smooth(STAGES.cores[0], STAGES.cores[1], f.t);

    const su = this.silhouette.material.uniforms;
    su.uTime.value = f.motion ? f.time : 0;
    su.uAssemble.value = f.assemble;
    su.uDisperse.value = disperse;
    su.uGather.value = gather;
    su.uActive.value = f.active;
    su.uFocus.value = f.focus;
    su.uScan.value = f.motion ? 1 : 0;
    // a slight turn towards the pointer while he is still a figure
    const still = 1 - disperse;
    this.silhouette.rotation.y = f.pointer.x * 0.2 * still;
    this.silhouette.rotation.x = -f.pointer.y * 0.06 * still;

    for (const m of this.starMats) m.uniforms.uTime.value = f.time;
    const solarFade = smooth(2.3, 3.2, f.t);
    const galaxyFade = smooth(2.6, 3.7, f.t);
    this.solar.visible = solarFade > 0.001;
    this.galaxyHolders.forEach(g => (g.visible = galaxyFade > 0.001));
    this.solarFaders.forEach(set => set(solarFade));
    this.galaxyFaders.forEach(set => set(galaxyFade));
    this.sunMat.uniforms.uTime.value = f.time;

    // camera
    this.journeyPose(f.t, this.tmpPos, this.tmpLook);
    this.tmpPos.x += f.pointer.x * 0.5 * still;
    this.tmpPos.y += f.pointer.y * 0.3 * still;
    if (f.viewer > 0) {
      this.tmpPos.lerp(f.viewerPos, f.viewer);
      this.tmpLook.lerp(f.viewerLook, f.viewer);
    }
    this.camera.position.copy(this.tmpPos);
    this.camera.lookAt(this.tmpLook);
    this.sky.position.copy(this.camera.position);
    this.dust.uniforms.uCam.value.copy(this.camera.position);

    // solar system: the scroll also turns the planets
    for (const p of this.planets) {
      const speed = Math.pow(11 / p.spec.orbit, 1.5);
      const a = p.phase + (f.time * 0.05 + f.t * 0.45) * speed;
      p.mesh.position.set(Math.cos(a) * p.spec.orbit, 0, Math.sin(a) * p.spec.orbit);
      p.mesh.rotation.y += f.dt * 0.35;
      if (p.moon) {
        const ma = f.time * 0.6 + f.t;
        p.moon.position.set(p.mesh.position.x + Math.cos(ma) * 2.4, 0.3, p.mesh.position.z + Math.sin(ma) * 2.4);
      }
    }
    this.galaxies.forEach((g, i) => {
      g.rotation.y = f.time * (0.012 + i * 0.004) + f.t * 0.04;
    });

    // constellation
    this.cores.forEach((c, i) => {
      const isActive = i === f.active ? f.focus : 0;
      const pulse = 1 + Math.sin(f.time * 2 + i) * 0.06;
      c.glow.material.opacity = coreFade * (0.75 - 0.35 * f.focus + 0.6 * isActive);
      c.core.material.opacity = coreFade;
      c.glow.scale.setScalar(c.base * pulse * (1 + 0.5 * isActive));
      c.core.scale.setScalar(1.3 * (1 + 0.4 * isActive));
    });
    this.ring.material.opacity = smooth(8.9, 9.6, f.t) * (0.3 - 0.15 * f.focus);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
  }
}
