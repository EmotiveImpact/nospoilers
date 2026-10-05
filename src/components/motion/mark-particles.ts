/**
 * Vanilla canvas particle field for the Watch opening. While stages load the
 * particles draw a lighthouse whose beam sweeps; when ready each particle
 * travels out through a loose swarm and settles into the NoSpoilers mark,
 * taking that raster's own colours. Decorative only: no product state is read.
 */
export type MarkPoint = { x: number; y: number; r: number; g: number; b: number; seed: number; spread: number; phase: number };
export type Seed = Pick<MarkPoint, 'seed' | 'spread' | 'phase'>;
type Rgb = readonly [number, number, number];
export type LitPoint = { x: number; y: number; c: Rgb; a: number };

function seedFor(i: number): Seed {
  const random = Math.sin((i + 1) * 12.9898) * 43758.5453;
  return { seed: (i * .61803398875) % 1, spread: random - Math.floor(random), phase: ((i * .754877666) % 1) * Math.PI * 2 };
}

/** Samples visible pixels of an RGBA raster into normalised points (height spans -1..1). */
export function sampleMark(rgba: ArrayLike<number>, width: number, height: number, limit = 900, step = 3): MarkPoint[] {
  const candidates: { x: number; y: number; r: number; g: number; b: number }[] = [];
  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
    const i = (y * width + x) * 4;
    if (rgba[i + 3] < 128) continue;
    candidates.push({ x: (x / (width - 1) - .5) * 2 * width / height, y: (y / (height - 1) - .5) * 2, r: rgba[i], g: rgba[i + 1], b: rgba[i + 2] });
  }
  const count = Math.min(limit, candidates.length);
  return Array.from({ length: count }, (_, i) => ({ ...candidates[Math.floor(i * candidates.length / count)], ...seedFor(i) }));
}

/** Loose position for a point at time t: a slow blend of cloud, ring and figure-eight. */
export function loosePosition(p: Seed, t: number): { x: number; y: number } {
  const a = p.seed * Math.PI * 2 + t * .32;
  const r = .25 + Math.sqrt(p.spread) * 1.2;
  const cloud = { x: Math.cos(a) * r * 1.5, y: Math.sin(a * 2 + p.phase * .5) * r * .8 };
  const band = 1.25 + (p.spread - .5) * .7;
  const ring = { x: Math.cos(a) * band * 1.2, y: Math.sin(a) * band * .45 + Math.sin(p.phase + t * .3) * .1 };
  const w = .6 + p.spread * .5;
  const eight = { x: Math.sin(a) * 1.6 * w, y: Math.sin(a) * Math.cos(a) * 1.05 * w };
  const shape = .5 + .5 * Math.sin(t * .14), eightMix = .24 + .2 * Math.sin(t * .1);
  const lx = cloud.x + (ring.x - cloud.x) * shape, ly = cloud.y + (ring.y - cloud.y) * shape;
  return { x: lx + (eight.x - lx) * eightMix, y: ly + (eight.y - ly) * eightMix };
}

const SNOW: Rgb = [228, 230, 236], DIM: Rgb = [120, 128, 142], SIGNAL: Rgb = [255, 59, 48], COOL: Rgb = [150, 160, 176];
const LAMP = { x: 0, y: -.47 };

// The tower as line segments in the mark's coordinate space; `red` marks the signal band.
const TOWER: { a: [number, number]; b: [number, number]; red?: boolean }[] = [
  { a: [-.27, .9], b: [-.17, -.28] }, { a: [.27, .9], b: [.17, -.28] }, { a: [-.34, .9], b: [.34, .9] },
  { a: [-.215, .38], b: [.215, .38], red: true }, { a: [-.205, .3], b: [.205, .3], red: true },
  { a: [-.24, .64], b: [.24, .64] }, { a: [-.25, -.28], b: [.25, -.28] }, { a: [-.25, -.33], b: [.25, -.33] },
  { a: [-.12, -.33], b: [-.12, -.6] }, { a: [.12, -.33], b: [.12, -.6] }, { a: [-.15, -.6], b: [.15, -.6] },
  { a: [-.15, -.6], b: [0, -.76] }, { a: [.15, -.6], b: [0, -.76] }, { a: [0, -.76], b: [0, -.84] },
];
const TOWER_LENGTH = TOWER.reduce((sum, s) => sum + Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]), 0);

function onTower(u: number, jitter: number): LitPoint {
  let d = u * TOWER_LENGTH;
  for (const s of TOWER) {
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    if (d <= len || s === TOWER[TOWER.length - 1]) {
      const k = Math.min(1, d / len);
      return { x: s.a[0] + (s.b[0] - s.a[0]) * k + jitter, y: s.a[1] + (s.b[1] - s.a[1]) * k, c: s.red ? SIGNAL : SNOW, a: .9 };
    }
    d -= len;
  }
  return { x: 0, y: 0, c: SNOW, a: .9 };
}

/**
 * Where particle i of n sits in the lighthouse at time t. Roughly 55% draw the
 * tower, 10% the lamp, 23% the rotating beam and 12% the water line.
 */
export function lighthousePosition(p: Seed, i: number, n: number, t: number): LitPoint {
  const role = (i * .38196601125) % 1, jitter = (p.spread - .5) * .012;
  // `role` tracks `seed`, so placement within a role uses an independent hash.
  const hash = Math.sin((i + 1) * 78.233) * 12345.678, u = hash - Math.floor(hash);
  if (role < .55) return onTower(i / n, jitter);
  const turn = t * 1.15, facing = Math.cos(turn);
  if (role < .65) {
    // Lamp: a small red cluster that brightens as the beam turns towards the viewer.
    const a = p.phase, r = Math.sqrt(p.spread) * .07;
    return { x: LAMP.x + Math.cos(a) * r, y: LAMP.y + Math.sin(a) * r * .9, c: SIGNAL, a: .55 + .45 * (1 - Math.abs(facing)) };
  }
  if (role < .88) {
    // Beam: a cone from the lamp whose horizontal reach shortens as it rotates through the viewer.
    const d = .1 + Math.pow(p.spread, .7) * 1.35, side = Math.sign(facing) || 1;
    const lateral = (u - .5) * 2 * (.03 + d * .2);
    const reach = Math.abs(facing);
    return { x: LAMP.x + side * d * (.15 + .85 * reach), y: LAMP.y + lateral + d * .05, c: SNOW, a: (1 - d / 1.5) * (.12 + .5 * reach) };
  }
  // Water line: a gentle swell across the base.
  const x = (u - .5) * 3;
  return { x, y: .94 + Math.sin(x * 5 + t * 1.6 + p.phase * .2) * .02 + p.spread * .03, c: DIM, a: .45 };
}

export type MarkFieldOptions = { src: string; gathered?: boolean; reduced?: boolean; limit?: number; scale?: number; duration?: number };
export type MarkField = { setGathered(value: boolean): void; destroy(): void };

const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (k: number) => k * k * (3 - 2 * k);

/** Starts a field on the canvas. Stops drawing once settled on the mark, when hidden and on destroy. */
export function startMarkField(canvas: HTMLCanvasElement, options: MarkFieldOptions): MarkField {
  const ctx = canvas.getContext('2d');
  const count = options.limit ?? 900, seeds = Array.from({ length: count }, (_, i) => seedFor(i));
  let marks: MarkPoint[] = [], target = options.gathered ? 1 : 0, progress = target, time = 0, last = 0, frame = 0, destroyed = false;
  const reduced = !!options.reduced, duration = (options.duration ?? 800) / 1000;
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    if (destroyed || !ctx) return;
    const probe = document.createElement('canvas');
    probe.width = image.naturalWidth; probe.height = image.naturalHeight;
    const pctx = probe.getContext('2d');
    if (!pctx) return;
    pctx.drawImage(image, 0, 0);
    marks = sampleMark(pctx.getImageData(0, 0, probe.width, probe.height).data, probe.width, probe.height, count);
    schedule();
  };
  image.src = options.src;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return dpr;
  }
  function draw() {
    if (!ctx) return;
    const dpr = resize();
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const radius = Math.min(height * .5, width * .32) * (options.scale ?? .82);
    const cx = width / 2, cy = height / 2, size = 1.4 * dpr;
    const morphing = marks.length > 0 && progress > 0;
    for (let i = 0; i < count; i++) {
      const p = seeds[i], from = lighthousePosition(p, i, count, reduced ? 0 : time);
      let x = from.x, y = from.y, c: Rgb = from.c, a = from.a;
      if (morphing) {
        // Each particle leaves on its own beat, arcs out through the swarm and lands on its mark pixel.
        const to = marks[i % marks.length], loose = loosePosition(p, time);
        const k = smooth(Math.min(1, Math.max(0, (progress - p.spread * .3) / .7))), j = 1 - k;
        const bx = loose.x * .72, by = loose.y * .72;
        x = j * j * from.x + 2 * j * k * bx + k * k * to.x;
        y = j * j * from.y + 2 * j * k * by + k * k * to.y;
        const end = [to.r, to.g, to.b], via = (n: number) => j * j * from.c[n] + 2 * j * k * COOL[n] + k * k * end[n];
        c = [via(0), via(1), via(2)];
        a = mix(from.a, .95, k);
      }
      ctx.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
      ctx.fillRect(cx + x * radius - size / 2, cy + y * radius - size / 2, size, size);
    }
  }
  function tick(now: number) {
    frame = 0;
    if (destroyed) return;
    const dt = last ? Math.min((now - last) / 1000, .05) : 0;
    last = now;
    if (reduced) { progress = marks.length ? target : 0; draw(); return; }
    time += dt;
    // The lighthouse waits for the mark raster; without it there is nowhere to land.
    if (marks.length) progress = target > progress ? Math.min(target, progress + dt / duration) : Math.max(target, progress - dt / duration);
    draw();
    // A settled mark holds still; the lighthouse keeps a loop alive for its beam.
    if (progress !== 1 || target !== 1 || !marks.length) schedule();
  }
  function schedule() {
    if (!frame && !destroyed && !document.hidden) frame = requestAnimationFrame(tick);
  }
  schedule();
  const onVisibility = () => { last = 0; if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else schedule(); };
  document.addEventListener('visibilitychange', onVisibility);
  return {
    setGathered(value) { target = value ? 1 : 0; last = 0; schedule(); },
    destroy() { destroyed = true; cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onVisibility); image.onload = null; },
  };
}
