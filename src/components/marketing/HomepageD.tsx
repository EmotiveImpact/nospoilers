import { useEffect, useRef, useState } from 'react'
import { navigate } from '@/nav.ts'
import { mountHomepage } from './homepage-d-interactions'
import { HomepagePieces } from './HomepagePieces'
import content from './homepage-d-content.html?raw'
import './homepage-d.css'

const homepageMarkup = { __html: content }

/**
 * Trusted, bundled presentation markup from the approved homepage design. All examples are canned data.
 * The preview at the top is drawn by the Watch app's own components, mounted into slots in that markup.
 */
export function HomepageD({ scanPath }: { scanPath: string }) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  // The scan destination changes once the session loads; the page itself is wired up only once.
  const destination = useRef(scanPath)
  useEffect(() => { destination.current = scanPath }, [scanPath])
  useEffect(() => host ? mountHomepage(host, () => navigate(destination.current)) : undefined, [host])
  return <>
    <main ref={setHost} className="homepage-d" dangerouslySetInnerHTML={homepageMarkup} />
    {host ? <HomepagePieces host={host} /> : null}
  </>
}
