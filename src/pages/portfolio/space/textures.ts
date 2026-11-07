import * as THREE from 'three';

/** Small deterministic PRNG (mulberry32) so the sky looks the same on every visit. */
export function makeRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

/** Soft radial glow, white centre fading to the given colour and then to nothing. */
export function glowTexture(color: string, core = 'rgba(255,255,255,1)', size = 128) {
  const [c, g] = canvas(size, size);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, core);
  grad.addColorStop(0.18, color);
  grad.addColorStop(0.5, colorWithAlpha(color, 0.25));
  grad.addColorStop(1, colorWithAlpha(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Irregular coloured cloud for nebulae. */
export function nebulaTexture(colors: string[], seed: number, size = 256) {
  const rand = makeRandom(seed);
  const [c, g] = canvas(size, size);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const x = size * (0.25 + rand() * 0.5);
    const y = size * (0.25 + rand() * 0.5);
    const r = size * (0.12 + rand() * 0.3);
    const col = colors[i % colors.length];
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, colorWithAlpha(col, 0.16));
    grad.addColorStop(1, colorWithAlpha(col, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface PlanetLook {
  base: string;
  bands?: string[];
  spots?: string[];
  clouds?: boolean;
}

/** Equirectangular texture with bands, spots and optional clouds. */
export function planetTexture(look: PlanetLook, seed: number) {
  const rand = makeRandom(seed);
  const w = 256;
  const h = 128;
  const [c, g] = canvas(w, h);
  g.fillStyle = look.base;
  g.fillRect(0, 0, w, h);
  if (look.bands) {
    let y = 0;
    while (y < h) {
      const bh = 3 + rand() * 12;
      g.fillStyle = colorWithAlpha(look.bands[Math.floor(rand() * look.bands.length)], 0.35 + rand() * 0.45);
      g.fillRect(0, y, w, bh);
      y += bh;
    }
  }
  if (look.spots) {
    for (let i = 0; i < 70; i++) {
      const col = look.spots[Math.floor(rand() * look.spots.length)];
      g.fillStyle = colorWithAlpha(col, 0.35 + rand() * 0.5);
      g.beginPath();
      g.ellipse(rand() * w, h * (0.12 + rand() * 0.76), 3 + rand() * 22, 2 + rand() * 9, rand() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (look.clouds) {
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(255,255,255,${0.15 + rand() * 0.35})`;
      g.beginPath();
      g.ellipse(rand() * w, rand() * h, 6 + rand() * 26, 1.5 + rand() * 4, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Saturn-like ring: transparent bands along the radius. */
export function ringTexture(seed: number) {
  const rand = makeRandom(seed);
  const [c, g] = canvas(256, 8);
  for (let x = 0; x < 256; x++) {
    const a = 0.15 + 0.6 * rand() * Math.sin((x / 256) * Math.PI);
    g.fillStyle = `rgba(226,205,160,${a.toFixed(3)})`;
    g.fillRect(x, 0, 1, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** '#rrggbb' + alpha -> 'rgba(...)' (sRGB values, as canvas expects). */
export function colorWithAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
