import { WatchPageHeader } from './WatchPageHeader';
import { QuietEmptyState } from './design/QuietComponents';
import { WatchSkeleton } from '@/components/WatchDataState';
import { Button } from '@/components/ui/button';
import { navigate } from '@/nav';
import { buildReleaseBriefModel } from '@/watch/release-brief';
import { useConnectedReleasePages } from './useConnectedReleasePages';
import { ListPagination } from './ListPagination';

const decisionLabels: Record<string, string> = { all: 'All connected revisions', passed: 'Recorded scan passed', attention: 'Other scan outcomes' };

export function HostedDecisionList({ search }: { search: string }) {
  const params = new URLSearchParams(search);
  return <HostedDecisionPage key={JSON.stringify([params.get('workspace'), params.get('install'), params.get('hostedDecision'), params.get('before')])} search={search} />;
}

function HostedDecisionPage({ search }: { search: string }) {
  const params = new URLSearchParams(search);
  const decision = params.get('hostedDecision') ?? 'all';
  const install = params.get('install');
  const workspace = params.get('workspace') ?? '';
  const pagination = useConnectedReleasePages({ search, hostedDecision: decision });
  function href(extra: Record<string, string>) {
    return `/watch/releases?${new URLSearchParams({ workspace, install: install ?? '', hostedDecision: decision, ...extra })}`;
  }
  return <section className="watch-release-index" aria-label="Connected release decisions">
    <WatchPageHeader kicker={pagination.context ? `${pagination.context.workspaceName} / ${pagination.context.connectionName}` : 'Connected release evidence'} title={decisionLabels[decision] ?? decisionLabels.all} lede="Scan outcomes recorded for this connection. Uploaded artifacts have their own history." action={<Button variant="outline" onClick={() => navigate(`/watch/releases?${new URLSearchParams({ workspace, install: install ?? '', releaseView: 'attempts' })}`)}>View uploaded scans</Button>} />
    <div className="flex flex-wrap gap-2 my-6" role="group" aria-label="Connected scan outcome">{['all', 'passed', 'attention'].map(value => <Button key={value} variant={decision === value ? 'default' : 'outline'} aria-pressed={decision === value} onClick={() => navigate(href({ hostedDecision: value }))}>{decisionLabels[value]}</Button>)}</div>
    {pagination.error ? <p role="alert">Release decisions could not be loaded. <Button type="button" onClick={pagination.retry}>Retry</Button></p> : pagination.busy ? <WatchSkeleton variant="list" className="mt-4" /> : pagination.rows.length ? <section className="watch-release-list"><ol>{pagination.rows.map(row => <li key={row.id}><button type="button" onClick={() => navigate(`/watch/releases?${new URLSearchParams({ workspace, install: install ?? '', release: String(row.id) })}`)}><span className="watch-release-list-copy"><strong>{row.coordinate}</strong><small>{row.channel} · {row.sourceRevision ?? row.artifactSha256?.slice(0, 12)} · {new Date(row.createdAt).toLocaleString()}</small></span><span className={`watch-release-list-status is-${buildReleaseBriefModel(row).status}`}>{buildReleaseBriefModel(row).title}</span></button></li>)}</ol></section> : <div role="status"><QuietEmptyState title="No connected revisions match this decision."><p>{decision === 'all' ? 'No connected release evidence is available in this view. Uploaded scans are recorded separately.' : 'Choose All connected revisions to see other recorded outcomes for this connection.'}</p></QuietEmptyState></div>}
    {pagination.showPagination ? <ListPagination label="Release decisions" page={pagination.page} pageSize={pagination.pageSize} onPageSizeChange={pagination.onPageSizeChange} count={pagination.rows.length} hasPrevious={pagination.hasPrevious} hasNext={pagination.hasNext} onPrevious={pagination.onPrevious} onNext={pagination.onNext} disabled={pagination.busy || pagination.error} /> : null}
    {params.has('before') ? <Button type="button" variant="outline" onClick={() => navigate(href({}))}>Newest decisions</Button> : null}
  </section>;
}
