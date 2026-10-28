/**
 * Logical world: the Codex backgrounds are 1920x1080 with the ground band starting
 * at y=900. The camera always shows the ground at the bottom; wide screens crop sky,
 * narrow/portrait screens get a narrower slice and extra sky above y=0.
 */
export const WORLD_W = 1920;
export const WORLD_H = 1080;
export const GROUND_TOP = 900;

export interface Layout {
  cssW: number;
  cssH: number;
  dpr: number;
  zoomCss: number; // CSS px per world unit
  zoom: number; // canvas px per world unit
  scrollX: number;
  scrollY: number;
  viewW: number;
  viewH: number;
  left: number;
  right: number;
  top: number;
  portrait: boolean;
  compact: boolean; // phones: fewer penguins and particles
  laneMin: number;
  laneMax: number;
}

export function computeLayout(cssW: number, cssH: number, dpr: number): Layout {
  const portrait = cssH > cssW * 1.05;
  const minVisible = portrait ? 900 : 1180;
  let zoomCss = cssH / WORLD_H;
  if (cssW / zoomCss > WORLD_W) zoomCss = cssW / WORLD_W;
  if (cssW / zoomCss < minVisible) zoomCss = cssW / minVisible;
  const viewW = cssW / zoomCss;
  const viewH = cssH / zoomCss;
  const scrollX = WORLD_W / 2 - viewW / 2;
  const scrollY = WORLD_H - viewH;
  const compact = Math.min(cssW, cssH) < 620;
  return {
    cssW,
    cssH,
    dpr,
    zoomCss,
    zoom: zoomCss * dpr,
    scrollX,
    scrollY,
    viewW,
    viewH,
    left: scrollX,
    right: scrollX + viewW,
    top: scrollY,
    portrait,
    compact,
    laneMin: GROUND_TOP + 34,
    laneMax: GROUND_TOP + (portrait ? 128 : 112),
  };
}

export function worldToCss(l: Layout, x: number, y: number) {
  return { x: (x - l.scrollX) * l.zoomCss, y: (y - l.scrollY) * l.zoomCss };
}

export function cssToWorld(l: Layout, x: number, y: number) {
  return { x: l.scrollX + x / l.zoomCss, y: l.scrollY + y / l.zoomCss };
}
