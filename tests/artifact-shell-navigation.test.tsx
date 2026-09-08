// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {WatchMonolithShell} from '../src/components/WatchMonolithShell';
import {parseWatchRoute} from '../src/watch/routes';
vi.mock('../src/components/watch/WorkspaceSwitcher',()=>({WorkspaceSwitcher:()=>null}));
afterEach(cleanup);
it('keeps real artifact settings reachable during first proof without inert connection settings',()=>{
 render(<WatchMonolithShell route={parseWatchRoute('/watch','?workspace=example')} search="?workspace=example" ended={false} role="viewer" teamOnly={false} adminOnly={false} login="viewer" sourceCount={0} openAlertCount={0} waitingCount={0} mineCount={0} resolvedCount={0} setupDone={0} setupTotal={0} firstRun artifactOnly installations={[]} activeInstallId={null} onInstall={()=>{}} onOpenPalette={()=>{}}><p>First proof content</p></WatchMonolithShell>);
 for(const [name,path] of [['Team & roles','team'],['Retention','retention'],['Audit log','audit']] as const)expect(screen.getByRole('link',{name})).toHaveProperty('href',expect.stringContaining(`/watch/${path}?workspace=example`));
 expect(screen.getByRole('link',{name:/Manage workspace connections/})).toHaveProperty('href',expect.stringContaining('/watch/workspaces?workspace=example'));
 expect(screen.getByRole('link',{name:'Coverage'})).toHaveProperty('href',expect.stringContaining('/watch/sources?workspace=example'));
 expect(screen.getByRole('link',{name:'Alerts'})).toHaveProperty('href',expect.stringContaining('/watch/alerts?workspace=example'));
 expect(screen.getByRole('link',{name:'Scan API tokens'})).toHaveProperty('href',expect.stringContaining('/watch/tokens?workspace=example'));
 expect(screen.getByRole('link',{name:'Notifications'})).toHaveProperty('href',expect.stringContaining('/watch/notifications?workspace=example'));
 for(const name of ['Policy & allowlist','Connection diagnostics','Install health'])expect(screen.queryByRole('link',{name})).toBeNull();
 expect(screen.getByText('First proof content')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Guide'})).toBeNull();
 expect(screen.getByRole('button',{name:'New scan'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'New scan'}).className).not.toContain('hidden');
 expect(screen.getByRole('button',{name:'Search or run a command'}).getAttribute('aria-label')).toBe('Search or run a command');
});
