/**
 * Behaviour for the homepage. Every example on the page is canned presentation data:
 * nothing in this file uploads, scans or calls an API.
 *
 * Only the hero moves by itself. Everything below it waits for a click.
 */
type Cleanup = () => void
type NetState = 'x' | 'ok' | 'n' // x = still serving, ok = cleared, n = never carried it
type NetNode = readonly [name: string, detail: string, state: NetState]
type NetOptions = { compact: boolean; still?: boolean; title: string; sub: string; subCompact?: string; nodes: readonly NetNode[] }
type Finding = { sev: string; c: '' | 'h' | 'v'; file: string; what: string; size: string; ev: string; exp: string; next: string }
type Source = { name: string; fix: string; rest: string; f: Finding[] }

const TICK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3.5 8.4 2.8 2.8 6.2-6.6"/></svg>'
const OK_CIRCLE = '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="none" stroke="#4cc38a" stroke-width="1.5"/><path d="M4.6 7.2 6.3 8.9 9.5 5.4" fill="none" stroke="#4cc38a" stroke-width="1.5" stroke-linecap="round"/></svg>'

/** The connected sources of the example release, as the hero's Trace step shows them. */
const SOURCES_BEFORE_FIX: readonly NetNode[] = [
  ['npm registry', 'registry.npmjs.org · 200', 'x'],
  ['cdn.acme.example', 'Serving the map · 200', 'x'],
  ['app.acme.example', 'Clean', 'n'],
  ['docs.acme.example', 'Clean', 'n'],
  ['Sentry upload', 'Private, as intended', 'n'],
  ['GitHub release', 'Map in the release asset', 'x'],
]

const MAP: Finding = {
  sev: 'Critical', c: '', file: 'dist/cli.js.map', what: 'Embedded original source', size: '412 KB',
  ev: '{ "version": 3,\n  "sources": ["../src/cli.ts", "../src/auth/token.ts"],\n  <mark>"sourcesContent": ["import { signToken } from \'./auth/token\'</mark>\n  <mark>const ISSUER = \'acme-internal\'…</mark>',
  exp: '14 original files, including the auth module', next: 'Leave *.map out of the published files, then recheck.',
}
const ENV: Finding = {
  sev: 'High', c: 'h', file: 'config/.env', what: 'Environment file with two keys', size: '1 KB',
  ev: 'STRIPE_SECRET_KEY=<mark>sk_live_••••••••••••3fQ2</mark>\nSENTRY_DSN=<mark>https://••••@o44.ingest.sentry.io/12</mark>',
  exp: '2 working credentials', next: 'Rotate both keys, then keep config/ out of the package.',
}
const PROMPT: Finding = {
  sev: 'Review', c: 'v', file: 'prompts/system.txt', what: 'Possible private AI context', size: '6 KB',
  ev: 'You are Acme\'s internal support agent.\n<mark>Never reveal the refund override code</mark>…',
  exp: '1 system prompt with internal rules', next: 'Remove it, or record a reviewed exception.',
}
const INSPECT_SOURCES: readonly Source[] = [
  { name: 'acme-cli v2.4.1', fix: 'acme-cli v2.4.2', rest: '1,280 files', f: [MAP, ENV, PROMPT] },
  { name: 'acme-cli v2.4.1 on GitHub', fix: 'acme-cli v2.4.2 on GitHub', rest: '2,038 files',
    f: [{ ...MAP, file: 'linux-x64/dist/cli.js.map', what: 'Embedded original source, in 3 archives' }, { ...ENV, file: 'linux-x64/config/.env' }] },
  { name: 'app.acme.example', fix: 'app.acme.example', rest: '63 assets',
    f: [{ sev: 'Critical', c: '', file: '/assets/app.4f2a.js.map', what: 'Source map served in production', size: '1.1 MB',
      ev: 'GET /assets/app.4f2a.js.map  <mark>200 OK</mark>\n<mark>"sources": ["webpack://app/src/billing/charge.ts", …]</mark>',
      exp: '212 original files, readable by any visitor', next: 'Stop serving .map files, or upload them privately to your error tracker.' }] },
]

const BOUNDARY_STEPS = [
  'Commit a3f9e1 passes repository checks. Nothing sensitive is in Git.',
  'CI builds v2.4.1. The bundler writes dist/cli.js.map next to cli.js.',
  'The tarball is published with the map inside. Git scanners never see this file. NoSpoilers flags it here.',
  'npm and the GitHub release now offer the same tarball to everyone.',
  'Production serves the same bundle, and its map, from cdn.acme.example.',
  'Anyone who installs or visits can now read your original source. Coverage keeps watching every step after the boundary.',
]

const VERIFY_COMMAND = 'nospoilers verify acme-cli-2.4.2.tgz --receipt receipt.json'
const VERIFY_OUTPUT = [
  '<span class="p">Receipt passed  sha256 a91f…d82c</span>',
  '<span class="p">  3214502 bytes  npm:acme-cli@2.4.2</span>',
  '<span class="ok">Artifact SHA-256 matches a passing receipt.</span>',
]

/** A release at the centre with every connected source around it. */
function drawNet(svg: SVGElement, reduce: boolean, o: NetOptions) {
  const c = o.compact, W = c ? 360 : 720, H = c ? 400 : 440, cx = W / 2, cy = c ? 200 : 216, rx = c ? 128 : 215, ry = 150, n = o.nodes.length
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  let s = `<ellipse cx="${cx}" cy="${cy}" rx="${rx * .58}" ry="${ry * .58}" fill="none" stroke="rgba(255,255,255,.045)"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="rgba(255,255,255,.03)"/>`
  const points = o.nodes.map((node, i) => {
    const a = (-90 + i * 360 / n) * Math.PI / 180
    return { node, cs: Math.cos(a), sn: Math.sin(a), x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }
  })
  points.forEach((p, i) => {
    const state = p.node[2]
    s += `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="${state === 'x' ? 'rgba(255,45,71,.45)' : state === 'ok' ? 'rgba(76,195,138,.26)' : '#26282c'}" stroke-width="1.1"${state === 'n' ? ' stroke-dasharray="3 4"' : ''}/>`
    if (state === 'x' && !reduce && !o.still) s += `<circle r="2.2" fill="#ff8a99"><animateMotion dur="2.6s" begin="${i * .45}s" repeatCount="indefinite" path="M${cx} ${cy} L${p.x.toFixed(1)} ${p.y.toFixed(1)}"/></circle>`
  })
  points.forEach(p => {
    const state = p.node[2], x = p.x.toFixed(1), y = p.y.toFixed(1)
    s += state === 'x' ? `<circle cx="${x}" cy="${y}" r="11" fill="rgba(255,45,71,.16)"/><circle cx="${x}" cy="${y}" r="4.5" fill="#ff2d47"/>`
      : state === 'ok' ? `<circle cx="${x}" cy="${y}" r="9" fill="rgba(76,195,138,.13)"/><circle cx="${x}" cy="${y}" r="3.8" fill="#4cc38a"/>`
        : `<circle cx="${x}" cy="${y}" r="4" fill="#0b0c0d" stroke="#4a4d54"/>`
    const nameColour = state === 'x' ? '#f7f8f8' : state === 'ok' ? '#d0d3d8' : '#8a8f98'
    const subColour = state === 'x' ? '#ff8a99' : state === 'ok' ? '#4cc38a' : '#62666d'
    if (c) {
      const ly = p.y + (p.sn < -.2 ? -15 : 23)
      s += `<text x="${x}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="11.5" fill="${nameColour}" font-weight="500">${p.node[0]}</text>`
      return
    }
    const anchor = p.cs > .35 ? 'start' : p.cs < -.35 ? 'end' : 'middle'
    const lx = p.x + (anchor === 'start' ? 15 : anchor === 'end' ? -15 : 0)
    const ly = anchor === 'middle' ? (p.sn < 0 ? p.y - 29 : p.y + 25) : p.y - 2
    s += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" font-size="13" fill="${nameColour}" font-weight="500">${p.node[0]}</text><text x="${lx.toFixed(1)}" y="${(ly + 16).toFixed(1)}" text-anchor="${anchor}" font-size="11.5" fill="${subColour}">${p.node[1]}</text>`
  })
  const sub = c && o.subCompact ? o.subCompact : o.sub
  const boxWidth = Math.max(c ? 132 : 150, sub.length * 6.4 + 26)
  s += `<rect x="${cx - boxWidth / 2}" y="${cy - 27}" width="${boxWidth}" height="54" rx="12" fill="#131416" stroke="rgba(255,255,255,.14)"/><text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="13.5" fill="#f7f8f8" font-weight="500">${o.title}</text>`
  s += `<text x="${cx}" y="${cy + 15}" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#7d828a" letter-spacing=".06em">${sub}</text>`
  svg.innerHTML = s
}

/** Every check area around the release, complete. */
function drawWheel(svg: SVGElement, compact: boolean) {
  const W = compact ? 360 : 640, H = 400, cx = W / 2, cy = compact ? 192 : 198, R = compact ? 96 : 128
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  const labels = compact
    ? ['Contents', 'Source maps', 'Secrets', 'Env files', 'Live sites', 'AI context', 'Private files', 'Inventory']
    : ['Package contents', 'Source maps', 'Secrets', 'Environment files', 'Live sites', 'AI context', 'Private files', 'Inventory']
  const id = `hd-arc-${svg.id}`
  let o = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="rgba(255,255,255,.1)"/><circle cx="${cx}" cy="${cy}" r="${R * .55}" fill="none" stroke="rgba(255,255,255,.05)"/>`
  o += `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".55"/></linearGradient></defs>`
  const a0 = -Math.PI / 2, a1 = -Math.PI / 2 + 1.1
  o += `<g class="arc" style="transform-origin:${cx}px ${cy}px"><path d="M${(cx + R * Math.cos(a0)).toFixed(1)} ${(cy + R * Math.sin(a0)).toFixed(1)} A${R} ${R} 0 0 1 ${(cx + R * Math.cos(a1)).toFixed(1)} ${(cy + R * Math.sin(a1)).toFixed(1)}" fill="none" stroke="url(#${id})" stroke-width="1.6"/></g>`
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a), x = cx + R * c, y = cy + R * s
    o += `<line x1="${(cx + 38 * c).toFixed(1)}" y1="${(cy + 38 * s).toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.07)"/>`
    o += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#0b0c0d" stroke="#3e4147"/>`
    o += `<g class="d" style="--d:${(.15 + i * .09).toFixed(2)}s"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="rgba(76,195,138,.14)"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.8" fill="#4cc38a"/></g>`
    const anchor = c > .3 ? 'start' : c < -.3 ? 'end' : 'middle', lx = x + (c > .3 ? 14 : c < -.3 ? -14 : 0), ly = y + (s < -.6 ? -14 : s > .6 ? 22 : 4.5)
    o += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" font-size="12.5" fill="#9a9ea6">${labels[i]}</text>`
  }
  o += `<circle cx="${cx}" cy="${cy}" r="25" fill="#131416" stroke="rgba(255,255,255,.14)"/>`
  o += `<g class="tick"><circle cx="${cx}" cy="${cy}" r="25" fill="#f7f8f8"/><path d="M${cx - 9} ${cy + 1}l6 6 12-13" fill="none" stroke="#08090a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>`
  svg.innerHTML = o
}

/** Hourly coverage for the last 24 hours. fix = exposed for two checks then cleared, live = still exposed, none = never. */
function drawMatrix(el: HTMLElement, rows: readonly (readonly [string, 'fix' | 'live' | 'none'])[]) {
  el.innerHTML = rows.map(([name, state]) => {
    let h = `<span class="nm">${name}</span><div class="dots">`
    for (let i = 0; i < 24; i++) {
      let k = 'c'
      if (state !== 'none' && (i === 21 || i === 22)) k = 'x'
      else if (i === 23 && state === 'fix') k = 'ok'
      else if (i === 23 && state === 'live') k = 'x now'
      h += `<i class="${k}"></i>`
    }
    return `${h}</div>`
  }).join('')
}

/** Scrolling file contents with the hits picked out. Seeded, so every visit shows the same lines. */
function fillStream(el: HTMLElement, lines: number, width: number) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let seed = 7
  const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
  const junk = (n: number) => { let t = ''; for (let i = 0; i < n; i++) t += chars[Math.floor(random() * chars.length)]; return t }
  const hits = ['<b>sourceMappingURL</b>', '<u>dist/cli.js</u>', '<b>sk_live_51Hx</b>', '<u>config</u>', '<b>.env</b>', '<b>system_prompt</b>', '<u>webpack://</u>', '<b>AKIA4QX7</b>']
  const out: string[] = []
  for (let l = 0; l < lines; l++) out.push(junk(3 + Math.floor(random() * width)) + hits[l % 8] + junk(10) + (l % 3 === 0 ? `<u>${junk(4)}</u>` : '') + junk(26))
  el.innerHTML = out.concat(out).join('<br>')
}

function start(page: HTMLElement, startScan: () => void): Cleanup {
  const abort = new AbortController()
  const { signal } = abort
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const frames = new Set<number>()
  const observers: IntersectionObserver[] = []
  let disposed = false

  const later = (fn: () => void, ms: number) => {
    const timer = setTimeout(() => { timers.delete(timer); if (!disposed) fn() }, ms)
    timers.add(timer)
    return timer
  }
  const cancel = (timer: ReturnType<typeof setTimeout> | null) => { if (timer !== null) { clearTimeout(timer); timers.delete(timer) } }
  const canAnimate = typeof requestAnimationFrame === 'function'
  const frame = (fn: (now: number) => void) => {
    const id = requestAnimationFrame(now => { frames.delete(id); if (!disposed) fn(now) })
    frames.add(id)
  }
  const media = (query: string) => typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  const reduce = media('(prefers-reduced-motion: reduce)')
  const narrow = media('(max-width:720px)')
  const canObserve = typeof IntersectionObserver !== 'undefined'
  const $ = <T extends Element = HTMLElement>(selector: string) => page.querySelector<T>(selector)!
  const $$ = <T extends Element = HTMLElement>(selector: string) => Array.from(page.querySelectorAll<T>(selector))
  const pressed = (buttons: Element[], active: Element) => buttons.forEach(b => b.setAttribute('aria-pressed', b === active ? 'true' : 'false'))

  /** Runs step(p) from 0 to 1 over ms and returns a function that stops it. */
  const tween = (ms: number, step: (p: number) => void, done?: () => void): Cleanup => {
    if (reduce || ms <= 0 || !canAnimate) { step(1); done?.(); return () => {} }
    let began: number | null = null, stopped = false
    const run = (now: number) => {
      if (stopped) return
      began ??= now
      const p = Math.min(1, (now - began) / ms)
      step(p)
      if (p < 1) frame(run); else done?.()
    }
    frame(run)
    return () => { stopped = true }
  }

  // Sections ease in as they are scrolled to. Without an observer they simply show.
  page.classList.add('hd-js')
  const reveals = $$('.rv')
  if (canObserve) {
    const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('in'); reveal.unobserve(entry.target) }
    }), { rootMargin: '0px 0px -6% 0px' })
    reveals.forEach(el => reveal.observe(el))
    observers.push(reveal)
    later(() => reveals.forEach(el => el.classList.add('in')), 2500)
  } else reveals.forEach(el => el.classList.add('in'))

  page.addEventListener('click', event => {
    if ((event.target as Element).closest('button.start')) startScan()
  }, { signal })

  // ---- hero: one release moves through four steps ----
  const stage = $('#stage')
  const fit = () => {
    const width = stage.clientWidth
    if (width > 720) stage.style.setProperty('--k', Math.min(1, (width * .94) / 1250).toFixed(3))
    else stage.style.removeProperty('--k')
  }
  fit()
  window.addEventListener('resize', fit, { signal })
  later(() => stage.classList.add('in'), 80)

  const stepsEl = $('#steps'), steps = $$('.step'), layers = $$('.app .lv'), navs = $$('.side .nv[data-n]')
  const cols = narrow ? 22 : 38, rows = narrow ? 6 : 7
  const hot: readonly (readonly [number, number, string])[] = narrow ? [[5, 1, 'x'], [12, 4, 'a'], [18, 2, 'v']] : [[8, 1, 'x'], [21, 4, 'a'], [30, 2, 'v']]
  const tilesEl = $('#htiles'), sweep = $('#hsweep')
  tilesEl.style.setProperty('--cols', String(cols))
  tilesEl.innerHTML = ''
  const tiles: { el: HTMLElement; col: number; hit: string | null }[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const el = document.createElement('i')
    tilesEl.appendChild(el)
    tiles.push({ el, col: c, hit: null })
  }
  hot.forEach(([c, r, kind]) => { tiles[r * cols + c].hit = kind })
  const keys = $$('#hkey span'), keyNote = $('#hkey em'), found = $$('.app .hf'), chip = $('#hchip'), spinner = $('#hspin')
  let lastScan = -1
  const scan = (p: number) => {
    if (p === lastScan) return
    lastScan = p
    const reached = p * cols
    tiles.forEach(t => { const cl = t.col < reached ? (t.hit ?? 'r') : ''; if (t.el.className !== cl) t.el.className = cl })
    sweep.style.left = `calc(14px + ${p} * (100% - 28px))`
    sweep.style.opacity = p <= 0 || p >= 1 ? '0' : '1'
    hot.forEach(([c], i) => { const on = c < reached; keys[i].classList.toggle('on', on); found[i].classList.toggle('on', on) })
    keyNote.classList.toggle('on', p >= 1)
    found[3].classList.toggle('on', p >= 1)
    spinner.classList.toggle('ok', p >= 1)
    chip.textContent = p >= 1 ? '3 findings · 1,283 files' : `Reading ${Math.round(p * 1283).toLocaleString('en-GB')} of 1,283 files`
  }
  fillStream($('#hstream'), 14, 6)
  drawNet($<SVGElement>('#hnet'), reduce, { compact: narrow, title: 'acme-cli v2.4.1', sub: 'PUBLISHED 08:00 UTC', subCompact: 'PUBLISHED 08:00', nodes: SOURCES_BEFORE_FIX })
  drawWheel($<SVGElement>('#hwheel'), narrow)
  drawMatrix($('#hmx'), [['npm registry', 'fix'], ['GitHub release', 'fix'], ['cdn.acme.example', 'live'], ['app.acme.example', 'none'], ['docs.acme.example', 'none']])

  const STEP_MS = 7000
  let current = -1, elapsed = 0
  const go = (n: number) => {
    current = n
    elapsed = 0
    steps.forEach((step, i) => {
      step.classList.toggle('on', i === n)
      step.setAttribute('aria-selected', i === n ? 'true' : 'false')
      const bar = step.querySelector<HTMLElement>('u')
      if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '' } // restart the progress line
    })
    layers.forEach(layer => { layer.classList.toggle('on', Number(layer.dataset.s) === n); layer.classList.remove('lit') })
    navs.forEach(nav => nav.classList.toggle('on', (nav.dataset.n ?? '').split(' ').includes(String(n))))
    lastScan = -1
    scan(n === 0 && !reduce && canAnimate ? 0 : 1)
    if (n === 3) later(() => layers.forEach(layer => { if (Number(layer.dataset.s) === 3 && current === 3) layer.classList.add('lit') }), reduce ? 0 : 250)
  }
  steps.forEach((step, i) => step.addEventListener('click', () => go(i), { signal }))
  go(0)
  if (reduce || !canAnimate) stepsEl.classList.add('still')
  else {
    stepsEl.classList.remove('still')
    let held = false, visible = true, last = performance.now()
    const hold = () => stepsEl.classList.toggle('hold', held || !visible)
    stepsEl.addEventListener('pointerenter', () => { held = true; hold() }, { signal })
    stepsEl.addEventListener('pointerleave', () => { held = false; hold() }, { signal })
    if (canObserve) {
      const watchStage = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; hold() })
      watchStage.observe(stage)
      observers.push(watchStage)
    }
    const tick = (now: number) => {
      const delta = Math.min(100, now - last)
      last = now
      if (visible && !held) {
        elapsed += delta
        if (current === 0) scan(Math.min(1, Math.max(0, (elapsed - 400) / 3600)))
        if (elapsed > STEP_MS) go((current + 1) % 4)
      }
      frame(tick)
    }
    frame(tick)
  }

  // ---- release boundary: the finished picture is on the page, the button replays it ----
  const stages = $$('.bst'), boundaryState = $('#bndstate'), boundaryRun = $<HTMLButtonElement>('#bndrun')
  const gitLane = $('.bnd-lanes .git i'), releaseLane = $('.bnd-lanes .ns i')
  let boundaryTimer: ReturnType<typeof setTimeout> | null = null
  const setBoundary = (n: number, moving: boolean) => {
    stages.forEach((el, i) => { el.classList.toggle('hit', i <= n); el.classList.toggle('cur', moving && i === n) })
    gitLane.style.setProperty('--f', String(Math.max(0, Math.min(n + 1, 2)) / 2))
    releaseLane.style.setProperty('--f', String(Math.max(0, n - 1) / 4))
    if (n >= 0) boundaryState.innerHTML = `<b>${n + 1} / 6</b>${BOUNDARY_STEPS[n]}`
  }
  const playBoundary = () => {
    cancel(boundaryTimer)
    if (reduce) { setBoundary(5, false); return }
    setBoundary(-1, false)
    boundaryRun.disabled = true
    let n = 0
    const step = () => {
      setBoundary(n, true)
      if (n < 5) { n++; boundaryTimer = later(step, 1250) }
      else boundaryTimer = later(() => { setBoundary(5, false); boundaryRun.disabled = false; boundaryRun.innerHTML = 'Replay <span class="ar">↻</span>' }, 1400)
    }
    step()
  }
  boundaryRun.disabled = false
  boundaryRun.addEventListener('click', playBoundary, { signal })
  setBoundary(5, false)

  // ---- pricing: monthly or yearly ----
  const billing = $$<HTMLButtonElement>('.bill button')
  billing.forEach(button => button.addEventListener('click', () => {
    pressed(billing, button)
    const period = button.dataset.b === 'y' ? 'y' : 'm'
    $$('.pr [data-m]').forEach(el => { el.textContent = el.dataset[period] ?? '' })
  }, { signal }))

  // ---- inspect: pick what to check, open a finding, then recheck ----
  const reveal = [.25, .55, .85]
  const list = $('#flist'), evidence = $('#fev'), status = $('#cst'), recheck = $<HTMLButtonElement>('#rcb'), tabs = $$<HTMLButtonElement>('#con .srct button')
  let source = 0, cleared = false, stopInspect: Cleanup | null = null
  const say = (text: string) => { status.textContent = `Example · ${text}` }
  const count = (s: Source) => `${s.f.length} ${s.f.length === 1 ? 'finding' : 'findings'}`
  const show = (i: number) => {
    const finding = INSPECT_SOURCES[source].f[i]
    $$('#flist .frow[data-i]').forEach(row => row.setAttribute('aria-pressed', Number(row.dataset.i) === i ? 'true' : 'false'))
    evidence.className = 'fev'
    void evidence.offsetWidth
    evidence.className = 'fev swap'
    evidence.innerHTML = `<div class="fev-h"><span class="sev ${finding.c}">${finding.sev}</span><b>${finding.file}</b><span class="sz">${finding.size}</span></div><pre>${finding.ev}</pre><dl><dt>Exposes</dt><dd>${finding.exp}</dd><dt>Next step</dt><dd>${finding.next}</dd></dl>`
  }
  const load = (i: number, animate: boolean) => {
    source = i
    cleared = false
    const s = INSPECT_SOURCES[i]
    stopInspect?.()
    recheck.disabled = false
    recheck.innerHTML = 'Recheck after the fix <span class="ar">↻</span>'
    list.innerHTML = s.f.map((f, k) => `<button class="frow wait" type="button" aria-pressed="false" data-i="${k}"><span class="sev ${f.c}">${f.sev}</span><span><b>${f.file}</b><small>${f.what}</small></span><span class="sz">${f.size}</span></button>`).join('')
      + `<div class="frow ok wait">${OK_CIRCLE}<span>Checked, nothing found · ${s.rest}</span></div>`
    show(0)
    const rowsNow = $$('#flist .frow')
    say(`Reading ${s.name}…`)
    stopInspect = tween(animate ? 900 : 0,
      p => s.f.forEach((_, k) => { if (reveal[k] < p) rowsNow[k].classList.remove('wait') }),
      () => { rowsNow.forEach(row => row.classList.remove('wait')); say(`${s.name} · ${count(s)}`) })
  }
  list.addEventListener('click', event => {
    const row = (event.target as Element).closest<HTMLElement>('.frow[data-i]')
    if (row && !cleared) show(Number(row.dataset.i))
  }, { signal })
  tabs.forEach(tab => tab.addEventListener('click', () => { pressed(tabs, tab); load(Number(tab.dataset.i), true) }, { signal }))
  recheck.addEventListener('click', () => {
    const s = INSPECT_SOURCES[source]
    if (cleared) { load(source, true); return }
    stopInspect?.()
    recheck.disabled = true
    say(`Reading ${s.fix}…`)
    const findings = $$('#flist .frow[data-i]')
    $$('#flist .frow').forEach(row => row.classList.remove('wait'))
    stopInspect = tween(1100,
      p => s.f.forEach((_, k) => {
        const row = findings[k]
        if (reveal[k] < p && !row.classList.contains('gone')) {
          row.classList.add('gone')
          row.querySelector('.sev')!.textContent = 'Cleared'
          row.setAttribute('aria-pressed', 'false')
        }
      }),
      () => {
        cleared = true
        recheck.disabled = false
        recheck.textContent = 'Reset example'
        say(`${s.fix} · 0 findings · proof ready`)
        evidence.className = 'fev clear swap'
        evidence.innerHTML = `<span class="ok">${TICK}</span><h4>No findings in completed checks</h4><p>${s.fix} no longer carries any of them. The result is saved as a release proof with its scope.</p><a href="#prove">See the proof <span class="ar">→</span></a>`
      })
  }, { signal })
  pressed(tabs, tabs[0])
  load(0, false)

  // ---- watch: one connected source still serves the map; recheck it ----
  const net = $<SVGElement>('#wnet'), graph = $('#trg'), graphChip = $('#trchip'), alert = $('#wal'), alertText = $('#walt')
  const nextRow = $('#wnext'), clearedRow = $('#wok'), recheckSource = $<HTMLButtonElement>('#wre'), checked = $('#wst')
  const openAlert = '<b>cdn.acme.example still serves</b> <code>dist/cli.js.map</code>'
  let purged = false, watchTimer: ReturnType<typeof setTimeout> | null = null
  const drawWatch = () => {
    const cdn: NetNode = purged ? ['cdn.acme.example', 'Purged · 404', 'ok'] : ['cdn.acme.example', 'Still serving · 200', 'x']
    drawNet(net, reduce, { still: true, compact: narrow, title: 'acme-cli v2.4.1', sub: 'FIXED BY v2.4.2 AT 10:00 UTC', subCompact: 'FIXED AT 10:00',
      nodes: [['npm registry', 'Clean since 10:00', 'ok'], cdn, ['app.acme.example', 'Clean', 'n'], ['docs.acme.example', 'Clean', 'n'], ['Sentry upload', 'Private, as intended', 'n'], ['GitHub release', 'Clean since 10:00', 'ok']] })
    graph.classList.toggle('calm', purged)
    graphChip.classList.toggle('g', purged)
    graphChip.lastElementChild!.textContent = purged ? '6 of 6 clear' : '1 of 6 still serving'
    alert.classList.toggle('g', purged)
    alertText.innerHTML = purged ? '<b>All six connected sources are clear.</b> The alert is resolved.' : openAlert
    nextRow.classList.toggle('wait', purged)
    clearedRow.classList.toggle('wait', !purged)
    checked.textContent = purged ? 'Checked just now' : 'Last checked 2 minutes ago'
    recheckSource.disabled = false
    recheckSource.innerHTML = purged ? 'Reset example' : 'Recheck the CDN <span class="ar">↻</span>'
  }
  drawWatch()
  recheckSource.addEventListener('click', () => {
    cancel(watchTimer)
    if (purged) { purged = false; drawWatch(); return }
    recheckSource.disabled = true
    checked.textContent = 'Checking cdn.acme.example…'
    watchTimer = later(() => { purged = true; drawWatch() }, reduce ? 0 : 1200)
  }, { signal })

  // ---- prove: the verified receipt is on the page; Run verify types it again ----
  const terminal = $('#pterm'), runVerify = $<HTMLButtonElement>('#pvb')
  const prompt = '<span class="p">$</span> '
  let verifyTimer: ReturnType<typeof setTimeout> | null = null
  const finishVerify = () => {
    terminal.innerHTML = `${prompt}<span class="cm">${VERIFY_COMMAND}</span>\n${VERIFY_OUTPUT.join('\n')}\n${prompt}<span class="cur"></span>`
    runVerify.disabled = false
  }
  runVerify.addEventListener('click', () => {
    cancel(verifyTimer)
    if (reduce) { finishVerify(); return }
    runVerify.disabled = true
    let typed = 0
    const type = () => {
      terminal.innerHTML = `${prompt}<span class="cm">${VERIFY_COMMAND.slice(0, typed)}</span><span class="cur"></span>`
      if (typed < VERIFY_COMMAND.length) { typed++; verifyTimer = later(type, 22); return }
      let shown = 0
      const line = () => {
        verifyTimer = later(() => {
          shown++
          if (shown === VERIFY_OUTPUT.length) { finishVerify(); return }
          terminal.innerHTML = `${prompt}<span class="cm">${VERIFY_COMMAND}</span>\n${VERIFY_OUTPUT.slice(0, shown).join('\n')}`
          line()
        }, shown === VERIFY_OUTPUT.length - 1 ? 650 : 360)
      }
      line()
    }
    type()
  }, { signal })
  finishVerify()

  return () => {
    disposed = true
    abort.abort()
    timers.forEach(clearTimeout)
    if (typeof cancelAnimationFrame === 'function') frames.forEach(id => cancelAnimationFrame(id))
    observers.forEach(observer => observer.disconnect())
    stopInspect?.()
  }
}

/**
 * Wires up the homepage markup and returns a function that undoes it.
 * The hero's phone layout draws smaller pictures, so crossing that width starts the page again.
 */
export function mountHomepage(page: HTMLElement, startScan: () => void): Cleanup {
  let stop = start(page, startScan)
  const phone = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width:720px)') : null
  const restart = () => { stop(); stop = start(page, startScan) }
  phone?.addEventListener?.('change', restart)
  return () => { phone?.removeEventListener?.('change', restart); stop() }
}
