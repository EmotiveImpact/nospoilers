import { useEffect, useRef } from 'react'
import { navigate } from '@/nav.ts'
import { mountHomepage } from './homepage-d-interactions'
import content from './homepage-d-content.html?raw'
import './homepage-d.css'

const homepageMarkup = { __html: content }

/** Trusted, bundled presentation markup from the approved homepage design. All examples are canned data. */
export function HomepageD({ scanPath }: { scanPath: string }) {
  const root = useRef<HTMLElement>(null)
  // The scan destination changes once the session loads; the page itself is wired up only once.
  const destination = useRef(scanPath)
  useEffect(() => { destination.current = scanPath }, [scanPath])
  useEffect(() => mountHomepage(root.current!, () => navigate(destination.current)), [])
  return <main ref={root} className="homepage-d" dangerouslySetInnerHTML={homepageMarkup} />
}
