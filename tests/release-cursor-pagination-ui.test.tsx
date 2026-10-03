// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ConnectedReleaseTable } from '../src/components/watch/ConnectedReleaseTable';
import { HostedDecisionList } from '../src/components/watch/HostedDecisionList';
import { navigate } from '../src/nav';
import type { ReleaseRevision } from '../src/watch/types';
import { radixUiTestSupport } from './helpers/radix-ui';
import { selectOption } from './helpers/select-option';

vi.mock('../src/nav', () => ({ navigate: vi.fn() }));
radixUiTestSupport();
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

function release(id: number, coordinate = `org/app-${id}`): ReleaseRevision {
  return { id, receiptId: id * 2, coordinate, channel: 'stable', artifactSha256: 'a'.repeat(64), artifactBytes: 2048, mediaType: null, sourceRevision: null, ciRunUrl: null, mismatch: false, receiptStatus: 'passed', createdAt: '2026-10-03T12:00:00Z' };
}
const revisions = Array.from({ length: 65 }, (_, index) => release(65 - index));
const response = (rows: ReleaseRevision[], nextCursor: string | null = null) => ({ ok: true, json: async () => ({ releases: rows, nextCursor, context: { workspaceName: 'Studio', connectionName: 'Org' } }) });
const tableRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

function pagedRequest(input: unknown) {
  const params = new URL(String(input), 'https://nospoilers.dev').searchParams;
  const size = Number(params.get('pageSize'));
  const before = params.get('before');
  const matching = revisions.filter(row => !before || row.id < Number(before));
  const rows = matching.slice(0, size);
  return Promise.resolve(response(rows, matching.length > size ? String(rows.at(-1)!.id) : null));
}

it('renders the first ten loaded connected revisions without a bootstrap fetch and keeps exact filename/evidence navigation', () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const loaded = [...revisions];
  loaded[0] = release(65, 'upload:12345678-1234-1234-1234-123456789012#dist/app.tgz');
  loaded[1] = { ...loaded[1], receiptStatus: 'failed-policy' };
  render(<ConnectedReleaseTable releases={loaded.slice(0, 50)} search="?workspace=w&install=7&releaseView=connected&preview=65" />);
  expect(fetch).not.toHaveBeenCalled();
  expect(tableRows()).toHaveLength(10);
  expect(screen.getByText('app.tgz')).toBeTruthy();
  expect(screen.getByText('org/app-64')).toBeTruthy();
  expect(screen.queryByText('org/app-55')).toBeNull();
  fireEvent.click(screen.getAllByRole('button', { name: 'View evidence' })[0]);
  const destination = new URL(vi.mocked(navigate).mock.calls.at(-1)![0], 'https://nospoilers.dev');
  expect(destination.searchParams.get('workspace')).toBe('w');
  expect(destination.searchParams.get('install')).toBe('7');
  expect(destination.searchParams.get('release')).toBe('65');
  expect(destination.searchParams.has('preview')).toBe(false);
});

it('fetches real 10, 30 and 60 connected pages, using server cursors and a Previous stack', async () => {
  const fetch = vi.fn(pagedRequest);
  vi.stubGlobal('fetch', fetch);
  render(<ConnectedReleaseTable releases={revisions.slice(0, 50)} search="?workspace=w&install=7" />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('org/app-55');
  expect(fetch.mock.calls[0][0]).toBe('/api/releases?installationId=7&workspace=w&pageSize=10&before=56');
  expect(tableRows()).toHaveLength(10);
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  await screen.findByText('org/app-65');
  expect(fetch.mock.calls[1][0]).toBe('/api/releases?installationId=7&workspace=w&pageSize=10');
  await selectOption(screen.getByRole('combobox', { name: 'Connected releases per page' }), '30');
  await waitFor(() => expect(tableRows()).toHaveLength(30));
  expect(fetch.mock.calls[2][0]).toBe('/api/releases?installationId=7&workspace=w&pageSize=30');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('org/app-35');
  expect(fetch.mock.calls[3][0]).toContain('pageSize=30&before=36');
  await selectOption(screen.getByRole('combobox', { name: 'Connected releases per page' }), '60');
  await waitFor(() => expect(tableRows()).toHaveLength(60));
  expect(screen.getByText('org/app-6')).toBeTruthy();
  expect(fetch.mock.calls[4][0]).toBe('/api/releases?installationId=7&workspace=w&pageSize=60');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('org/app-5');
  expect(tableRows()).toHaveLength(5);
  expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
});

it('hides connected rows and disables pagination on error, then retries the same scoped cursor', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Denied' }) }).mockResolvedValueOnce(response(revisions.slice(10, 20), '46'));
  vi.stubGlobal('fetch', fetch);
  render(<ConnectedReleaseTable releases={revisions.slice(0, 50)} search="?workspace=w&install=7" />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.queryByRole('button', { name: 'View evidence' })).toBeNull();
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Connected releases could not be loaded. Retry');
  expect(screen.getByRole('button', { name: 'Previous' })).toHaveProperty('disabled', true);
  expect(screen.getByRole('combobox', { name: 'Connected releases per page' })).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('org/app-55');
  expect(fetch.mock.calls[0][0]).toBe(fetch.mock.calls[1][0]);
});

it('aborts a pending connected page and resets to the new workspace without accepting its stale response', async () => {
  let resolve!: (value: ReturnType<typeof response>) => void;
  const fetch = vi.fn((_input: unknown, _init: RequestInit) => new Promise<ReturnType<typeof response>>(done => { resolve = done; }));
  vi.stubGlobal('fetch', fetch);
  const view = render(<ConnectedReleaseTable releases={revisions.slice(0, 50)} search="?workspace=w&install=7" />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  const signal = fetch.mock.calls[0][1].signal;
  view.rerender(<ConnectedReleaseTable releases={[release(999, 'other/workspace')]} search="?workspace=other&install=8" />);
  expect(signal?.aborted).toBe(true);
  expect(screen.getByText('other/workspace')).toBeTruthy();
  await act(async () => resolve(response(revisions.slice(10, 20), '46')));
  expect(screen.queryByText('org/app-55')).toBeNull();
  expect(screen.queryByRole('combobox')).toBeNull();
});

it('pages hosted decisions using explicit server nextCursor, preserving the decision filter and workspace', async () => {
  const fetch = vi.fn(pagedRequest);
  vi.stubGlobal('fetch', fetch);
  render(<HostedDecisionList search="?workspace=w&install=7&hostedDecision=passed" />);
  await screen.findByRole('button', { name: /org\/app-65/ });
  expect(fetch.mock.calls[0][0]).toBe('/api/releases?installationId=7&hostedDecision=passed&workspace=w&pageSize=10');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('button', { name: /org\/app-55/ });
  expect(fetch.mock.calls[1][0]).toContain('hostedDecision=passed&workspace=w&pageSize=10&before=56');
  await selectOption(screen.getByRole('combobox', { name: 'Release decisions per page' }), '60');
  await screen.findByText('org/app-6');
  expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(60);
  expect(fetch.mock.calls[2][0]).toBe('/api/releases?installationId=7&hostedDecision=passed&workspace=w&pageSize=60');
  fireEvent.click(screen.getByRole('button', { name: /org\/app-65/ }));
  expect(navigate).toHaveBeenLastCalledWith('/watch/releases?workspace=w&install=7&release=65');
});

it('does not invent another hosted page for exactly ten rows and retains direct-cursor recovery navigation', async () => {
  const fetch = vi.fn().mockResolvedValue(response(revisions.slice(10, 20), null));
  vi.stubGlobal('fetch', fetch);
  render(<HostedDecisionList search="?workspace=w&install=7&hostedDecision=attention&before=56" />);
  await screen.findByRole('button', { name: /org\/app-55/ });
  expect(fetch.mock.calls[0][0]).toBe('/api/releases?installationId=7&hostedDecision=attention&workspace=w&pageSize=10&before=56');
  expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Newest decisions' }));
  expect(navigate).toHaveBeenLastCalledWith('/watch/releases?workspace=w&install=7&hostedDecision=attention');
});

it('resets hosted decision scope and ignores an aborted response from the previous filter', async () => {
  let resolve!: (value: ReturnType<typeof response>) => void;
  const fetch = vi.fn((input: unknown, _init: RequestInit) => String(input).includes('hostedDecision=passed')
    ? new Promise<ReturnType<typeof response>>(done => { resolve = done; })
    : Promise.resolve(response([release(999, 'attention/record')], null)));
  vi.stubGlobal('fetch', fetch);
  const view = render(<HostedDecisionList search="?workspace=w&install=7&hostedDecision=passed" />);
  const previousSignal = fetch.mock.calls[0][1].signal;
  view.rerender(<HostedDecisionList search="?workspace=w&install=7&hostedDecision=attention" />);
  expect(previousSignal?.aborted).toBe(true);
  await screen.findByText('attention/record');
  await act(async () => resolve(response(revisions.slice(0, 10), '56')));
  expect(screen.queryByText('org/app-65')).toBeNull();
  expect(screen.getByText('attention/record')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'All connected revisions' }));
  expect(navigate).toHaveBeenLastCalledWith('/watch/releases?workspace=w&install=7&hostedDecision=all');
});
