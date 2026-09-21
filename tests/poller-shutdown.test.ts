import {afterEach, expect, it, vi} from 'vitest';
import {startPoller} from '../src/server/poller.ts';

vi.mock('../src/server/npm-watch.ts', () => ({runNpmWatchPoll: async () => ({queued: 0})}));
vi.mock('../src/server/web-watch.ts', () => ({runWebOriginPoll: async () => ({queued: 0})}));
vi.mock('../src/server/workspace-origin-schedule.ts', () => ({runWorkspaceOriginPoll: async () => ({queued: 0})}));
vi.mock('../src/server/map-watch.ts', () => ({runMapCustodyPoll: async () => ({queued: 0})}));
vi.mock('../src/server/prospect-feed.ts', () => ({runProspectAcquisitionPoll: async () => ({feedQueued: 0, discoveryQueued: 0})}));
vi.mock('../src/server/namespace-watch.ts', () => ({runNamespaceWatchPoll: async () => ({queued: 0})}));
vi.mock('../src/server/disclosure.ts', () => ({sweepExpiredDisclosureEvidence: async () => ({attachments: 0, notes: 0})}));

afterEach(() => vi.useRealTimers());

it('waits for an in-flight poll and prevents further ticks while shutdown drains it', async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const blocked = new Promise<void>(resolve => {release = resolve;});
  const listAllRepos = vi.fn(async () => {await blocked; return [];});
  const poller = startPoller({store: {listAllRepos}} as unknown as Parameters<typeof startPoller>[0], 100);
  await vi.advanceTimersByTimeAsync(100);
  expect(listAllRepos).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(500);
  expect(listAllRepos).toHaveBeenCalledTimes(1);
  let stopped = false;
  const completion = poller.stop().then(() => {stopped = true;});
  await vi.advanceTimersByTimeAsync(500);
  expect(stopped).toBe(false);
  expect(listAllRepos).toHaveBeenCalledTimes(1);
  release();
  await completion;
  expect(stopped).toBe(true);
  await vi.advanceTimersByTimeAsync(500);
  expect(listAllRepos).toHaveBeenCalledTimes(1);
  await poller.stop();
});
