/**
 * Sign-in explainer: one particle field that walks through what NoSpoilers does.
 * The particles draw the lighthouse (watch every release), then a release package
 * being scanned while a leaked file is pulled out (inspect what ships), then the
 * NoSpoilers mark (keep the receipt). Each change travels through the same loose
 * swarm as the Watch opening. Decorative only: no product state is read.
 */
import { lighthousePosition, loosePosition, sampleMark, type LitPoint, type MarkPoint, type Seed } from './mark-particles';

type Rgb = readonly [number, number, number];
const SNOW: Rgb = [228, 230, 236], DIM: Rgb = [92, 99, 112], SIGNAL: Rgb = [255, 59, 48], COOL: Rgb = [150, 160, 176];

export const EXPLAINER_STEPS = 3;
/** Seconds each step holds, then seconds spent morphing into the next one. */
export const EXPLAINER_HOLD = 3.8, EXPLAINER_MORPH = 1.2;
const CYCLE = EXPLAINER_HOLD + EXPLAINER_MORPH;

/** Which step is showing at time t, how far into it, and how far through the morph out of it. */
export function explainerPhase(t: number): { step: number; next: number; local: number; morph: number } {
  const total = Math.max(0, t) % (CYCLE * EXPLAINER_STEPS);
  const step = Math.floor(total / CYCLE), local = total - step * CYCLE;
  return { step, next: (step + 1) % EXPLAINER_STEPS, local, morph: Math.max(0, (local - EXPLAINER_HOLD) / EXPLAINER_MORPH) };
}

const smooth = (k: number) => k * k * (3 - 2 * k);
const clamp = (k: number) => Math.min(1, Math.max(0, k));
const mixRgb = (a: Rgb, b: Rgb, k: number): Rgb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// The release package: a card with file rows. Row LEAK_ROW holds the file that gets pulled out.
const CARD = { left: -.5, right: .5, top: -.78, bottom: .78 };
const ROWS = 9, LEAK_ROW = 5;
const rowY = (r: number) => CARD.top + .2 + r * ((CARD.bottom - CARD.top - .34) / (ROWS - 1));
const rowLength = (r: number) => .45 + ((r * 37) % 10) / 10 * .4;

/**
 * Where particle i of n sits in the scanned package at local time s. Roughly 30%
 * draw the card outline, 48% the file rows, 8% the leaked file and 14% the scan line.
 */
export function packagePosition(p: Seed, i: number, n: number, s: number): LitPoint {
  const role = (i * .38196601125) % 1;
  const hash = Math.sin((i + 1) * 78.233) * 12345.678, u = hash - Math.floor(hash);
  const scanY = CARD.top + clamp(s / 2.6) * (CARD.bottom - CARD.top);
  const lit = (y: number) => Math.max(0, 1 - Math.abs(y - scanY) / .14);
  if (role < .3) {
    // Outline: walk the card's perimeter.
    const w = CARD.right - CARD.left, h = CARD.bottom - CARD.top, d = (i / n) * 2 * (w + h);
    const [x, y] = d < w ? [CARD.left + d, CARD.top] : d < w + h ? [CARD.right, CARD.top + d - w] : d < 2 * w + h ? [CARD.right - (d - w - h), CARD.bottom] : [CARD.left, CARD.bottom - (d - 2 * w - h)];
    return { x, y, c: SNOW, a: .5 + .4 * lit(y) };
  }
  if (role < .78) {
    let r = Math.floor(u * ROWS);
    if (r === LEAK_ROW) r = (r + 1) % ROWS;
    const y = rowY(r), x = CARD.left + .1 + p.spread * rowLength(r);
    return { x, y, c: mixRgb(DIM, SNOW, lit(y)), a: .45 + .5 * lit(y) };
  }
  if (role < .86) {
    // The leaked file: caught when the scan line reaches it, then lifted out of the package in red.
    const y0 = rowY(LEAK_ROW), x0 = CARD.left + .1 + p.spread * .5;
    const caught = scanY >= y0 - .02, k = smooth(clamp((s - 1.9) / .9));
    const c = caught ? SIGNAL : SNOW;
    return { x: x0 + k * .95, y: y0 - k * .12 + Math.sin(p.phase) * .025 * k, c, a: caught ? .95 : .6 };
  }
  // Scan line: a bright bar across the card that runs once from top to bottom.
  const done = s > 2.6;
  return { x: CARD.left + u * (CARD.right - CARD.left), y: scanY + (p.spread - .5) * .012, c: done ? DIM : SNOW, a: done ? 0 : .85 };
}

function markPosition(marks: MarkPoint[], p: Seed, i: number, t: number): LitPoint {
  if (!marks.length) { const q = loosePosition(p, t); return { x: q.x * .6, y: q.y * .6, c: COOL, a: .5 }; }
  const m = marks[i % marks.length];
  return { x: m.x, y: m.y, c: [m.r, m.g, m.b], a: .95 };
}

export type ExplainerOptions = { src: string; reduced?: boolean; limit?: number; scale?: number; onStep?: (step: number) => void };
export type Explainer = { destroy(): void };

/** Starts the explainer loop on a canvas. Pauses while the tab is hidden; draws one still frame for reduced motion. */
export function startExplainer(canvas: HTMLCanvasElement, options: ExplainerOptions): Explainer {
  const ctx = canvas.getContext('2d');
  const count = options.limit ?? 900;
  const seeds: Seed[] = Array.from({ length: count }, (_, i) => {
    const r = Math.sin((i + 1) * 12.9898) * 43758.5453;
    return { seed: (i * .61803398875) % 1, spread: r - Math.floor(r), phase: ((i * .754877666) % 1) * Math.PI * 2 };
  });
  let marks: MarkPoint[] = [], time = 0, last = 0, frame = 0, destroyed = false, shown = -1;
  const reduced = !!options.reduced;

  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    if (destroyed) return;
    const probe = document.createElement('canvas');
    probe.width = image.naturalWidth; probe.height = image.naturalHeight;
    const pctx = probe.getContext('2d');
    if (!pctx) return;
    pctx.drawImage(image, 0, 0);
    marks = sampleMark(pctx.getImageData(0, 0, probe.width, probe.height).data, probe.width, probe.height, count);
    if (reduced) draw();
  };
  image.src = options.src;

  function scene(step: number, p: Seed, i: number, t: number, local: number): LitPoint {
    if (step === 0) return lighthousePosition(p, i, count, t);
    if (step === 1) return packagePosition(p, i, count, local);
    return markPosition(marks, p, i, t);
  }

  function draw() {
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    const radius = Math.min(h * .44, w * .3) * (options.scale ?? 1), cx = w / 2, cy = h / 2;
    const size = 1.5 * dpr, halo = 5 * dpr;
    // Reduced motion holds the final step: the mark, still.
    const phase = reduced ? { step: 2, next: 2, local: EXPLAINER_HOLD, morph: 0 } : explainerPhase(time);
    if (phase.step !== shown) { shown = phase.step; options.onStep?.(phase.step); }
    for (let i = 0; i < count; i++) {
      const p = seeds[i];
      let { x, y, c, a } = scene(phase.step, p, i, reduced ? 0 : time, phase.local);
      if (phase.morph > 0) {
        // Each particle leaves on its own beat, arcs out through the swarm and lands in the next step.
        const to = scene(phase.next, p, i, time, 0), loose = loosePosition(p, time);
        const k = smooth(clamp((phase.morph - p.spread * .3) / .7)), j = 1 - k;
        x = j * j * x + 2 * j * k * loose.x * .8 + k * k * to.x;
        y = j * j * y + 2 * j * k * loose.y * .8 + k * k * to.y;
        c = [0, 1, 2].map(n => j * j * c[n] + 2 * j * k * COOL[n] + k * k * to.c[n]) as unknown as Rgb;
        a = j * a + k * to.a;
      }
      if (a <= .01) continue;
      const px = cx + x * radius, py = cy + y * radius, rgb = `${c[0] | 0},${c[1] | 0},${c[2] | 0}`;
      ctx.fillStyle = `rgba(${rgb},${a * .07})`;
      ctx.fillRect(px - halo / 2, py - halo / 2, halo, halo);
      ctx.fillStyle = `rgba(${rgb},${a})`;
      ctx.fillRect(px - size / 2, py - size / 2, size, size);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function tick(now: number) {
    frame = 0;
    if (destroyed) return;
    time += last ? Math.min((now - last) / 1000, .05) : 0;
    last = now;
    draw();
    schedule();
  }
  function schedule() {
    if (!reduced && !frame && !destroyed && !document.hidden) frame = requestAnimationFrame(tick);
  }
  const onVisibility = () => { last = 0; if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else schedule(); };
  const onResize = () => { if (reduced) draw(); };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize);
  if (reduced) draw(); else schedule();
  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      image.onload = null;
    },
  };
}
