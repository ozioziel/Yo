import { useEffect, useRef } from 'react';
import { drawFrost } from '../game/frost';

interface Props {
  active: boolean;
  /** Text outline width in em (the hOme title has a 0.09em stroke). */
  strokeEm?: number;
  thickness?: number;
  icicles?: boolean;
}

const PAD_EM = 0.22; // room above the letters for the snow

/**
 * Winter frost that sits on every letter of its parent element. It re-renders the
 * parent's characters in a hidden canvas with the same font and position, reads their
 * top contour and draws the snow caps exactly there.
 */
export default function Frost({ active, strokeEm = 0, thickness = 0.085, icicles = true }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    let frame = 0;
    const draw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => paint(canvas, host, { strokeEm, thickness, icicles }));
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(host);
    void document.fonts?.ready.then(draw);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [strokeEm, thickness, icicles]);

  return <canvas ref={ref} className={`frost${active ? ' is-on' : ''}`} aria-hidden="true" />;
}

function paint(canvas: HTMLCanvasElement, host: HTMLElement, opts: { strokeEm: number; thickness: number; icicles: boolean }) {
  const box = host.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const cs = getComputedStyle(host);
  const fontSize = parseFloat(cs.fontSize);
  const pad = fontSize * PAD_EM;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.ceil(box.width + fontSize * 0.2);
  const h = Math.ceil(box.height + pad);
  canvas.width = Math.ceil(w * dpr);
  canvas.height = Math.ceil(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.style.left = `${-fontSize * 0.1}px`;
  canvas.style.top = `${-pad}px`;

  // the letters as the browser laid them out, rendered into a mask
  const mask = document.createElement('canvas');
  mask.width = canvas.width;
  mask.height = canvas.height;
  const m = mask.getContext('2d', { willReadFrequently: true })!;
  m.scale(dpr, dpr);
  m.translate(fontSize * 0.1, pad);
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? '';
    const parent = node.parentElement!;
    const pcs = getComputedStyle(parent);
    m.font = `${pcs.fontStyle} ${pcs.fontWeight} ${pcs.fontSize} ${pcs.fontFamily}`;
    m.textBaseline = 'alphabetic';
    const ascent = m.measureText('Hg').fontBoundingBoxAscent;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (!ch.trim()) continue;
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const r = range.getBoundingClientRect();
      const x = r.left - box.left;
      const y = r.top - box.top + ascent;
      if (opts.strokeEm > 0) {
        m.lineWidth = opts.strokeEm * parseFloat(pcs.fontSize);
        m.lineJoin = 'round';
        m.strokeText(ch, x, y);
      }
      m.fillText(ch, x, y);
    }
  }
  const data = m.getImageData(0, 0, mask.width, mask.height);
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawFrost(ctx, data, 0, { em: fontSize * dpr, thickness: opts.thickness, icicles: opts.icicles });
}
