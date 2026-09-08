import {it,expect,vi} from 'vitest';
import type {Store} from '../src/server/store.ts';
import {alertRecheckTarget} from '../src/server/alert-recheck.ts';
it('only resolves a matching persisted release-scan repository',async()=>{
  const store={getAlertForUser:vi.fn().mockResolvedValue({repo_id:4,installation_id:9,kind:'release_scan'}),getRepo:vi.fn().mockResolvedValue({id:4,installation_id:9})} as unknown as Store;
  expect((await alertRecheckTarget(store,'user',1))?.endpoint).toBe('/api/repos/4/scan-latest-release');
  vi.mocked(store.getRepo).mockResolvedValue({id:4,installation_id:10} as never);
  expect((await alertRecheckTarget(store,'user',1))?.endpoint).toBeNull();
  vi.mocked(store.getAlertForUser).mockResolvedValue({repo_id:4,installation_id:9,kind:'repo_publicized'} as never);
  expect((await alertRecheckTarget(store,'user',1))?.endpoint).toBeNull();
  vi.mocked(store.getAlertForUser).mockResolvedValue(null);
  expect(await alertRecheckTarget(store,'stranger',1)).toBeNull();
});
