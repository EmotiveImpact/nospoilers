import {expect, it, vi} from 'vitest';
import {runPollerTick} from '../src/server/poller.ts';

const calls: string[] = [];
vi.mock('../src/server/npm-watch.ts', () => ({runNpmWatchPoll: async () => {calls.push('npm'); throw new Error('npm registry unavailable');}}));
vi.mock('../src/server/namespace-watch.ts', () => ({runNamespaceWatchPoll: async () => {calls.push('namespace'); return {checked: 1, queued: 0};}}));
vi.mock('../src/server/web-watch.ts', () => ({runWebOriginPoll: async () => {calls.push('web'); return {queued: 2};}}));
vi.mock('../src/server/workspace-origin-schedule.ts', () => ({runWorkspaceOriginPoll: async () => {calls.push('workspace_web'); return {queued: 1};}}));
vi.mock('../src/server/map-watch.ts', () => ({runMapCustodyPoll: async () => {calls.push('map'); return {queued: 0};}}));
vi.mock('../src/server/prospect-feed.ts', () => ({runProspectAcquisitionPoll: async () => {calls.push('prospect'); return {feedQueued: 0, discoveryQueued: 0};}}));
vi.mock('../src/server/disclosure.ts', () => ({sweepExpiredDisclosureEvidence: async () => {calls.push('disclosure'); return {attachments: 0, notes: 0};}}));

it('keeps running later sweeps when the visibility poll and another sweep fail', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const wakeWorker = vi.fn();
    const store = {listAllRepos: async () => {throw new Error('connection terminated');}};
    const result = await runPollerTick({store, wakeWorker} as unknown as Parameters<typeof runPollerTick>[0]);
    expect(calls).toEqual(['npm', 'namespace', 'web', 'workspace_web', 'map', 'prospect', 'disclosure']);
    expect(result).toMatchObject({visibilityAlerts: 0, npmQueued: 0, webQueued: 3});
    expect(wakeWorker).toHaveBeenCalledTimes(1);
    const failed = errors.mock.calls.map(([line]) => JSON.parse(String(line)) as {event: string; sweep: string});
    expect(failed.filter(entry => entry.event === 'poller.sweep_failed').map(entry => entry.sweep)).toEqual(['visibility', 'npm']);
  } finally {
    errors.mockRestore();
  }
});
