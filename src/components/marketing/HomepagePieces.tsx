import { useMemo, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckWheel } from '@/components/pieces/CheckWheel'
import { FileMap, FileMapClear } from '@/components/pieces/FileMap'
import { ReceiptCheck } from '@/components/pieces/ReceiptCheck'
import { ActivityFeed, AfterTheFix, SourceList, SourceNet, TrailNote } from '@/components/pieces/Trail'
import { TrailVerdict } from '@/components/pieces/TrailView'
import { trailTime } from '@/watch/release-trail'
import { ACME_NOW, acmeAreas, acmeFileMap, acmeReceipt, acmeSourcesWhenFound, acmeTrail } from './acme-sample'

const title = `${acmeTrail.release.name} ${acmeTrail.release.version}`
const caption = `CHECKED ${trailTime(acmeTrail.release.createdAt, ACME_NOW)} UTC`

/** The Watch app's own screens, drawn from the Acme example. Each fills a named slot in the preview. */
const PIECES: Record<string, () => ReactNode> = {
  filemap: () => <FileMap model={acmeFileMap} facts={[]} />,
  fileclear: () => <FileMapClear model={acmeFileMap} />,
  net: () => <div className="np"><SourceNet title={title} caption={caption} sources={acmeSourcesWhenFound} /></div>,
  hosts: () => <div className="np"><SourceList sources={acmeSourcesWhenFound} now={ACME_NOW} /></div>,
  afterfix: () => <div className="np"><AfterTheFix model={acmeTrail} now={ACME_NOW} /><TrailNote tone={acmeTrail.summary.tone}><TrailVerdict model={acmeTrail} now={ACME_NOW} /></TrailNote></div>,
  feed: () => <div className="np"><ActivityFeed events={acmeTrail.events} now={ACME_NOW} /></div>,
  wheel: () => <CheckWheel areas={acmeAreas} total={0} passed />,
  receipt: () => <ReceiptCheck fileName={acmeReceipt.fileName} state={{ status: 'passed' }} result={acmeReceipt.result} />,
}

export function HomepagePieces({ host }: { host: HTMLElement }) {
  const slots = useMemo(() => Array.from(host.querySelectorAll<HTMLElement>('[data-piece]')), [host])
  return <>{slots.map((slot, index) => {
    const piece = PIECES[slot.dataset.piece ?? '']
    return piece ? createPortal(piece(), slot, `${slot.dataset.piece}:${index}`) : null
  })}</>
}
