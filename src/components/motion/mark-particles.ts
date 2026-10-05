/**
 * Vanilla canvas particle field for the NoSpoilers mark. Points are sampled
 * from the supplied brand raster, keep its own colours, drift as a loose swarm
 * and gather into the exact mark. Decorative only: no product state is read.
 */
export type MarkPoint = { x: number; y: number; r: number; g: number; b: number; seed: number; spread: number; phase: number };

/** Samples visible pixels of an RGBA raster into normalised points (height spans -1..1). */
export function sampleMark(rgba: ArrayLike<number>, width: number, height: number, limit = 900, step = 3): MarkPoint[] {
  const candidates: { x: number; y: number; r: number; g: number; b: number }[] = [];
  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
    const i = (y * width + x) * 4;
    if (rgba[i + 3] < 128) continue;
    candidates.push({ x: (x / (width - 1) - .5) * 2 * width / height, y: (y / (height - 1) - .5) * 2, r: rgba[i], g: rgba[i + 1], b: rgba[i + 2] });
  }
  const count = Math.min(limit, candidates.length);
  return Array.from({ length: count }, (_, i) => {
    const c = candidates[Math.floor(i * candidates.length / count)];
    const random = Math.sin((i + 1) * 12.9898) * 43758.5453;
    return { ...c, seed: (i * .61803398875) % 1, spread: random - Math.floor(random), phase: ((i * .754877666) % 1) * Math.PI * 2 };
  });
}

/** Loose position for a point at time t: a slow blend of cloud, ring and figure-eight. */
export function loosePosition(p: MarkPoint, t: number): { x: number; y: number } {
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

export type MarkFieldOptions = { src: string; gathered?: boolean; reduced?: boolean; limit?: number; scale?: number; rate?: number };
export type MarkField = { setGathered(value: boolean): void; destroy(): void };

const COOL = [150, 160, 176];

/** Starts a field on the canvas. Stops drawing once settled, when hidden and on destroy. */
export function startMarkField(canvas: HTMLCanvasElement, options: MarkFieldOptions): MarkField {
  const ctx = canvas.getContext('2d');
  let points: MarkPoint[] = [], target = options.gathered ? 1 : 0, gather = target, time = 0, last = 0, frame = 0, destroyed = false;
  const reduced = !!options.reduced;
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    if (destroyed || !ctx) return;
    const probe = document.createElement('canvas');
    probe.width = image.naturalWidth; probe.height = image.naturalHeight;
    const pctx = probe.getContext('2d');
    if (!pctx) return;
    pctx.drawImage(image, 0, 0);
    points = sampleMark(pctx.getImageData(0, 0, probe.width, probe.height).data, probe.width, probe.height, options.limit);
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
    const cx = width / 2, cy = height / 2, size = 1.4 * dpr, spread = .72;
    const eased = gather * gather * (3 - 2 * gather);
    for (const p of points) {
      const loose = loosePosition(p, time);
      const lx = loose.x * spread, ly = loose.y * spread;
      const x = cx + (lx + (p.x - lx) * eased) * radius;
      const y = cy + (ly + (p.y - ly) * eased) * radius;
      const r = COOL[0] + (p.r - COOL[0]) * eased, g = COOL[1] + (p.g - COOL[1]) * eased, b = COOL[2] + (p.b - COOL[2]) * eased;
      ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${.55 + .4 * eased})`;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }
  }
  function tick(now: number) {
    frame = 0;
    if (destroyed) return;
    const dt = last ? Math.min((now - last) / 1000, .05) : 0;
    last = now;
    if (reduced) { gather = 1; draw(); return; }
    time += dt;
    gather += (target - gather) * (1 - Math.exp(-dt * (options.rate ?? 3.2)));
    draw();
    // A gathered mark holds still; only the swarm keeps a loop alive.
    if (Math.abs(target - gather) > .002 || target < 1) schedule(); else { gather = target; draw(); }
  }
  function schedule() {
    if (!frame && !destroyed && !document.hidden) frame = requestAnimationFrame(tick);
  }
  const onVisibility = () => { last = 0; if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else schedule(); };
  document.addEventListener('visibilitychange', onVisibility);
  return {
    setGathered(value) { target = value ? 1 : 0; last = 0; schedule(); },
    destroy() { destroyed = true; cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onVisibility); image.onload = null; },
  };
}
