import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WatchSkeleton } from '@/components/WatchDataState';
import { navigate } from '@/nav';
import { buildReleaseBriefModel } from '@/watch/release-brief';
import { watchHref, watchPath } from '@/watch/routes';
import type { ReleaseRevision } from '@/watch/types';
import { ListPagination } from './ListPagination';
import { useConnectedReleasePages } from './useConnectedReleasePages';

function releaseDisplayName(coordinate: string) {
  const upload = /^upload:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}#(.+)$/i.exec(coordinate);
  return upload?.[1].split(/[\\/]/).filter(Boolean).at(-1) ?? coordinate;
}

export function ConnectedReleaseTable({ releases, search }: { releases: ReleaseRevision[]; search: string }) {
  const scope = new URLSearchParams(search);
  return <ConnectedReleasePage key={JSON.stringify([scope.get('workspace'), scope.get('install'), scope.get('before')])} releases={releases} search={search} />;
}

function ConnectedReleasePage({ releases, search }: { releases: ReleaseRevision[]; search: string }) {
  const pagination = useConnectedReleasePages({ search, initialRows: releases });
  return <div className="min-w-0">
    {pagination.error ? <p role="alert" className="watch-release-error">Connected releases could not be loaded. <Button type="button" variant="outline" onClick={pagination.retry}>Retry</Button></p> : pagination.busy ? <WatchSkeleton variant="list" className="mt-4" /> : pagination.rows.length ? <div className="journey-release-table-wrap"><table className="journey-release-table"><thead><tr><th>Release</th><th>Source</th><th>Result</th><th>Scanned</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{pagination.rows.map(release => {
      const model = buildReleaseBriefModel(release);
      const label = model.blocked ? 'Blocked' : model.ready ? 'Passes recorded checks' : model.status === 'review' ? 'Review' : 'Unknown';
      return <tr key={release.id}><td><strong className="text-snow font-medium">{releaseDisplayName(release.coordinate)}</strong><small className="block mt-1">{release.sourceRevision ?? release.artifactSha256.slice(0, 12)}</small></td><td>{release.channel}</td><td><span className={`journey-result-status is-${model.status}`}>{label}</span></td><td>{new Date(release.createdAt).toLocaleDateString()}</td><td><Button type="button" variant="ghost" onClick={() => navigate(watchHref(watchPath('releases'), search, { release: release.id, previewRelease: null }))}>View evidence <ArrowRight className="size-4" aria-hidden /></Button></td></tr>;
    })}</tbody></table></div> : <p className="watch-empty">No connected releases on this page.</p>}
    {pagination.showPagination ? <ListPagination label="Connected releases" page={pagination.page} pageSize={pagination.pageSize} onPageSizeChange={pagination.onPageSizeChange} count={pagination.rows.length} hasPrevious={pagination.hasPrevious} hasNext={pagination.hasNext} onPrevious={pagination.onPrevious} onNext={pagination.onNext} disabled={pagination.busy || pagination.error} /> : null}
  </div>;
}
