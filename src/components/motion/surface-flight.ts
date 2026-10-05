/**
 * Clean, decorative surface motion in vanilla DOM and Web Animations:
 * particles arc from the control that was used to the edges of the surface it
 * opened, and the surface's corners trace in. Nothing here carries product
 * state; each effect removes its own elements when it finishes.
 */
const EASE = 'cubic-bezier(.2,.7,.2,1)';
let layer: HTMLDivElement | null = null;
let running: Animation[] = [];

function motionAllowed(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined' || document.hidden) return false;
  if (typeof Element.prototype.animate !== 'function') return false;
  return !(typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function ensureLayer(): HTMLDivElement {
  if (layer?.isConnected) return layer;
  layer = document.createElement('div');
  layer.className = 'surface-flight-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  return layer;
}

function clear() {
  running.forEach(animation => animation.cancel());
  running = [];
  layer?.replaceChildren();
}

/** Points spread evenly around a rectangle's perimeter. */
export function perimeterPoints(rect: { left: number; top: number; width: number; height: number }, count: number) {
  const perimeter = 2 * (rect.width + rect.height);
  return Array.from({ length: count }, (_, i) => {
    let d = (i + .5) / count * perimeter;
    if (d < rect.width) return { x: rect.left + d, y: rect.top };
    d -= rect.width;
    if (d < rect.height) return { x: rect.left + rect.width, y: rect.top + d };
    d -= rect.height;
    if (d < rect.width) return { x: rect.left + rect.width - d, y: rect.top + rect.height };
    d -= rect.width;
    return { x: rect.left, y: rect.top + rect.height - d };
  });
}

/** One flight at a time: rapid interaction replaces an obsolete effect. */
export function flyToSurface(from: DOMRect | null, to: DOMRect | null, count = 36) {
  if (!from || !to || to.width < 1 || !motionAllowed()) return;
  clear();
  const host = ensureLayer();
  const origin = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
  const move = (p: { x: number; y: number }) => `translate3d(${p.x}px,${p.y}px,0)`;
  perimeterPoints(to, count).forEach((end, i) => {
    const dot = document.createElement('i');
    dot.className = i % 7 === 3 ? 'surface-particle is-signal' : 'surface-particle';
    host.appendChild(dot);
    const bend = (i % 2 ? 1 : -1) * (18 + (i % 5) * 4);
    const mid = { x: (origin.x + end.x) / 2 + bend, y: (origin.y + end.y) / 2 - 22 };
    const animation = dot.animate([
      { transform: move(origin), opacity: 0 },
      { transform: move(mid), opacity: .95, offset: .45 },
      { transform: move(end), opacity: 0 },
    ], { duration: 720, delay: i * 7, easing: EASE, fill: 'both' });
    running.push(animation);
    animation.onfinish = () => { dot.remove(); running = running.filter(item => item !== animation); };
  });
}

/** Four corner ticks draw in around the element, hold briefly, then fade. */
export function traceSurface(element: HTMLElement | null) {
  if (!element || !motionAllowed()) return;
  element.querySelector(':scope > .surface-trace')?.remove();
  const trace = document.createElement('span');
  trace.className = 'surface-trace';
  trace.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 4; i++) trace.appendChild(document.createElement('i'));
  if (getComputedStyle(element).position === 'static') element.style.position = 'relative';
  element.appendChild(trace);
  Array.from(trace.children).forEach((tick, i) => {
    (tick as HTMLElement).animate([
      { transform: 'scale(0)', opacity: 1 },
      { transform: 'scale(1)', opacity: 1, offset: .35 },
      { transform: 'scale(1)', opacity: 1, offset: .7 },
      { transform: 'scale(1)', opacity: 0 },
    ], { duration: 1250, delay: 120 + i * 60, easing: EASE, fill: 'both' });
  });
  window.setTimeout(() => trace.remove(), 1700);
}
