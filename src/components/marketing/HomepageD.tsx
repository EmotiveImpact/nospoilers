import { useEffect, useRef, useState } from 'react'
import { ShieldAlert, X } from 'lucide-react'
import { findingDetails } from './finding-details'
import { navigate } from '@/nav.ts'
import content from './homepage-d-content.html?raw'
const homepageMarkup = { __html: content }
import './homepage-d.css'

const examples: Record<string, string[]> = {
  Package: ['Package inspection', 'acme-cli / dist', 'Source map contains original code', 'dist/cli.js.map', 'Package contents', 'Exclude the map, then recheck →'],
  GitHub: ['GitHub release inspection', 'acme / checkout-web', 'Internal config in release asset', 'release.zip / config.json', 'Release asset', 'Update packaging, then recheck →'],
  'Production URL': ['Production website inspection', 'app.acme.example', 'Public source map is reachable', '/assets/app.js.map', 'Production web', 'Remove public map, then recheck →'],
}

/** Trusted, bundled presentation markup from the approved Homepage D design. */
export function HomepageD({ scanPath }: { scanPath: string }) {
  const root = useRef<HTMLElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState<(typeof findingDetails)[number] | null>(null)
  useEffect(() => {
    const grid = root.current?.querySelector<HTMLElement>('.finding-grid')
    if (!grid) return
    const positionLight = () => {
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('.finding-card'))
      const bounds = grid.getBoundingClientRect()
      // Every card sees the same light, just below the centre of the grid.
      const x = bounds.left + bounds.width * .5
      const y = bounds.bottom + 35
      cards.forEach(card => {
        const rect = card.getBoundingClientRect()
        card.style.setProperty('--light-x', `${x - rect.left}px`)
        card.style.setProperty('--light-y', `${y - rect.top}px`)
        card.style.setProperty('--light-width', `${Math.max(bounds.width * .8, 300)}px`)
        card.style.setProperty('--light-height', `${bounds.height * 1.1}px`)
      })
    }
    positionLight()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', positionLight)
      return () => window.removeEventListener('resize', positionLight)
    }
    const observer = new ResizeObserver(positionLight)
    observer.observe(grid)
    return () => observer.disconnect()
  })
  useEffect(() => {
    if (!selected || !dialog.current) return
    const node = dialog.current
    const previous = document.body.style.overflow
    node.showModal()
    document.body.style.overflow = 'hidden'
    return () => { node.close(); document.body.style.overflow = previous }
  }, [selected])
  useEffect(() => {
    const page = root.current!
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const later = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => { timers.delete(timer); callback() }, delay)
      timers.add(timer)
    }
    const text = (id: string, value: string) => { const node = page.querySelector(`#${id}`); if (node) node.textContent = value }
    const click = (event: MouseEvent) => {
      const button = (event.target as Element).closest('button')
      if (!button || !page.contains(button)) return
      if (button.dataset.finding) { setSelected(findingDetails.find(item => item.key === button.dataset.finding) ?? null); return }
      if (button.classList.contains('start')) { navigate(scanPath); return }
      if (button.dataset.filter) {
        page.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(item => {
          item.classList.toggle('active', item === button)
          item.setAttribute('aria-pressed', String(item === button))
        })
        page.querySelectorAll<HTMLElement>('[data-kind]').forEach(row => { row.hidden = button.dataset.filter !== 'all' && row.dataset.kind !== button.dataset.filter })
      }
      if (button.dataset.source) {
        const example = examples[button.dataset.source]
        page.querySelectorAll<HTMLButtonElement>('[data-source]').forEach(item => {
          item.classList.toggle('active', item === button)
          item.setAttribute('aria-pressed', String(item === button))
        })
        ;['source-name', 'inspect-art-label', 'inspect-finding', 'inspect-path', 'inspect-context', 'inspect-next'].forEach((id, index) => text(id, example[index]))
      }
      if (button.classList.contains('faq-trigger')) {
        const open = button.getAttribute('aria-expanded') !== 'true'
        button.setAttribute('aria-expanded', String(open))
        const panel = page.querySelector<HTMLElement>(`#${button.getAttribute('aria-controls')}`)!
        panel.classList.toggle('open', open)
        panel.inert = !open
      }
      if (button.id === 'proof-toggle' || button.id === 'custody-toggle') {
        const open = button.getAttribute('aria-expanded') !== 'true'
        button.setAttribute('aria-expanded', String(open))
        page.querySelector<HTMLElement>(button.id === 'proof-toggle' ? '#proof-scope' : '#custody-detail')!.hidden = !open
      }
      if (button.id === 'recheck') {
        button.disabled = true
        button.textContent = 'Rechecking…'
        text('demo-status', 'Check in progress…')
        later(() => { button.disabled = false; button.textContent = 'Recheck ↻'; text('demo-status', 'Recheck complete · 3 findings still need review') }, 1100)
      }
      if (button.id === 'pipeline-run') {
        button.disabled = true
        const stages = [...page.querySelectorAll<HTMLElement>('.pipe')]
        stages.forEach((stage, index) => later(() => {
          stages.forEach(item => item.classList.toggle('current', item === stage))
          text('pipeline-state', `Current stage: ${stage.querySelector('b')!.textContent}`)
        }, index * 500))
        later(() => { stages.forEach(stage => stage.classList.remove('current')); button.disabled = false; text('pipeline-state', 'Check complete · inspect the output, then keep watching') }, stages.length * 500)
      }
    }
    page.addEventListener('click', click)
    return () => { page.removeEventListener('click', click); timers.forEach(clearTimeout) }
  }, [scanPath])
  return <><main ref={root} className="homepage-d" dangerouslySetInnerHTML={homepageMarkup} />
    <dialog ref={dialog} className="v20-detail finding-dialog" aria-labelledby="finding-dialog-title" onCancel={() => setSelected(null)} onClose={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setSelected(null) } }}>
      {selected && <><div className="v20-detail-head"><span className="v20-detail-icon"><ShieldAlert /></span><div><div className="v20-eyebrow">Release exposure</div><h3 id="finding-dialog-title">{selected.title}</h3></div><button autoFocus aria-label="Close finding details" onClick={() => setSelected(null)}><X /></button></div><div className="v20-detail-body"><p>{selected.detail}</p><div className="v20-detail-grid"><div><b>How it escapes</b><p>{selected.how}</p></div><div><b>What NoSpoilers checks</b><p>{selected.checks}</p></div><div><b>What you get</b><p>{selected.result}</p></div></div><footer><span><b>Same scanner kernel.</b> Final artefact first.</span><span>Esc closes this window</span></footer></div></>}
    </dialog></>
}
