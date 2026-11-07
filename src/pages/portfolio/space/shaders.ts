/**
 * GLSL for the /portafolio space journey.
 *
 * Point sizes are in world units: `px = size * uProj / distance`, where
 * uProj = drawing-buffer height / (2 tan(fov/2)). Stars smaller than a pixel
 * keep 1px but lose energy (alpha ~ px^2), so far galaxies stay soft.
 */

/** Oziel's silhouette: assembles, disperses, then gathers into project stars. */
export const silhouetteVertex = /* glsl */ `
uniform float uTime;
uniform float uProj;
uniform float uSize;
uniform float uAssemble;
uniform float uDisperse;
uniform float uGather;
uniform float uActive;
uniform float uFocus;
uniform float uScan;
attribute vec3 aHome;
attribute vec3 aScatter;
attribute vec3 aCloud;
attribute vec3 aCenter;
attribute vec3 aOffset;
attribute vec4 aRand;   // x: delay, y: phase, z: size, w: brightness
attribute float aProj;
attribute vec3 aColor;
varying vec3 vColor;
varying float vAlpha;

vec3 rotZ(vec3 v, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z);
}

void main() {
  float d = aRand.x;
  float built = smoothstep(d * 0.55, d * 0.55 + 0.45, uAssemble);
  float k = smoothstep(d * 0.45, d * 0.55 + 0.45, uDisperse);
  vec3 p = mix(aScatter, aHome, built * (1.0 - k));
  float wobble = 0.025 + 0.9 * k;
  p += wobble * vec3(sin(uTime * 0.31 + aRand.y * 6.283), cos(uTime * 0.23 + aRand.y * 4.1), sin(uTime * 0.19 + aRand.y * 2.7));

  float g = smoothstep(d * 0.45, d * 0.45 + 0.55, uGather);
  float isOn = 1.0 - step(0.5, abs(aProj - uActive));
  float spin = uTime * (0.08 + 0.22 * aRand.z) * (1.0 + 1.8 * isOn * uFocus);
  vec3 target = aCenter + rotZ(aOffset, spin);
  vec3 q = mix(aCloud, target, g);
  q += (1.0 - g) * 0.8 * vec3(sin(uTime * 0.2 + aRand.y * 9.0), cos(uTime * 0.17 + aRand.y * 7.0), 0.0);
  float gathering = step(0.0005, uGather);
  p = mix(p, q, gathering);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = max(-mv.z, 0.001);

  float twinkle = 0.72 + 0.28 * sin(uTime * (1.3 + aRand.y * 2.2) + aRand.y * 40.0);
  float b = aRand.w;
  // hologram scan: a soft bright band sweeping up the body
  float band = 1.0 - smoothstep(0.0, 0.06, abs(fract(aHome.y * 0.085 - uTime * 0.11) - 0.5));
  b *= 1.0 + band * 0.8 * uScan * (1.0 - k) * (1.0 - gathering);

  float focus = uFocus * g * gathering;
  float dim = mix(1.0, mix(0.4, 1.55, isOn), focus);
  // tuned for the close-up figure: bigger while they travel and form the far constellation
  float boost = mix(1.0, mix(7.0, 2.6, g) * mix(1.0, 0.55, uFocus), gathering);
  float size = uSize * aRand.z * (0.65 + 0.6 * b) * boost * (1.0 + 0.55 * isOn * focus);
  float px = size * uProj / dist;
  gl_PointSize = clamp(px, 1.0, 42.0);
  float energy = min(1.0, px * px);
  float nearFade = smoothstep(0.5, 2.6, dist);
  float appear = mix(smoothstep(0.0, 0.3, uAssemble), smoothstep(0.0, 0.12, uGather), gathering);
  vAlpha = b * twinkle * energy * nearFade * dim * appear * mix(1.0, mix(1.8, 1.0, g), gathering);
  vColor = mix(vec3(0.86, 0.91, 1.0), aColor, g * gathering);
  gl_Position = projectionMatrix * mv;
}
`;

export const starFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c) * 4.0;
  if (r2 > 1.0) discard;
  float a = (exp(-r2 * 9.0) + exp(-r2 * 2.6) * 0.32) * vAlpha;
  gl_FragColor = vec4(vColor, a);
}
`;

/** Generic stars: sky, galaxies, asteroid belt and the dust that wraps around the camera. */
export const starVertex = /* glsl */ `
uniform float uTime;
uniform float uProj;
uniform float uOpacity;
uniform float uSizeMul;
#ifdef WRAP
uniform vec3 uCam;
uniform float uBox;
#endif
attribute vec3 aColor;
attribute float aSize;
attribute float aPhase;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec3 p = position;
#ifdef WRAP
  vec3 rel = mod(position - uCam + uBox * 0.5, uBox) - uBox * 0.5;
  p = uCam + rel;
  vec4 mv = viewMatrix * vec4(p, 1.0);
#else
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
#endif
  float dist = max(-mv.z, 0.001);
  float px = aSize * uSizeMul * uProj / dist;
  gl_PointSize = clamp(px, 1.0, 26.0);
  float twinkle = 0.68 + 0.32 * sin(uTime * (0.6 + aPhase * 1.9) + aPhase * 50.0);
  vAlpha = uOpacity * twinkle * min(1.0, px * px);
#ifdef WRAP
  float l = length(rel);
  vAlpha *= (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, l)) * smoothstep(0.6, 3.0, l);
#endif
  vColor = aColor;
  gl_Position = projectionMatrix * mv;
}
`;

export const sunVertex = /* glsl */ `
varying vec3 vObjN;
varying vec3 vViewN;
varying vec3 vViewPos;
void main() {
  vObjN = normal;
  vViewN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

export const sunFragment = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
varying vec3 vObjN;
varying vec3 vViewN;
varying vec3 vViewPos;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
  return s;
}
void main() {
  vec3 n = normalize(vObjN);
  float n1 = fbm(n * 3.0 + vec3(uTime * 0.05, uTime * 0.03, 0.0));
  float n2 = fbm(n * 8.0 - vec3(0.0, uTime * 0.09, uTime * 0.04));
  vec3 col = mix(vec3(1.0, 0.36, 0.04), vec3(1.0, 0.82, 0.38), n1);
  col = mix(col, vec3(1.0, 0.97, 0.82), smoothstep(0.55, 0.82, n2) * 0.65);
  float rim = pow(1.0 - max(dot(normalize(vViewN), normalize(vViewPos)), 0.0), 2.2);
  col += vec3(1.0, 0.5, 0.12) * rim * 0.9;
  gl_FragColor = vec4(col * 1.2, uOpacity);
}
`;
