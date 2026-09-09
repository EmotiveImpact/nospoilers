// @vitest-environment jsdom
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {WatchMonolithShell} from '../src/components/WatchMonolithShell';
import {parseWatchRoute} from '../src/watch/routes';
vi.mock('../src/components/watch/WorkspaceSwitcher',()=>({WorkspaceSwitcher:()=>null}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
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

function Route({path,search='?workspace=example'}:{path:string;search?:string}){
 return <WatchMonolithShell route={parseWatchRoute(path,search)} search={search} ended={false} role="viewer" teamOnly={false} adminOnly={false} login="viewer" sourceCount={0} openAlertCount={0} waitingCount={0} mineCount={0} resolvedCount={0} setupDone={0} setupTotal={0} firstRun artifactOnly installations={[]} activeInstallId={null} onInstall={()=>{}} onOpenPalette={()=>{}}><button>Page control</button></WatchMonolithShell>;
}
it('focuses a changed page while preserving initial and same-page query focus',async()=>{
 const scroll=vi.fn();Element.prototype.scrollTo=scroll;
 const view=render(<Route path="/watch"/>);
 const control=screen.getByRole('button',{name:'Page control'});
 expect(document.activeElement).not.toBe(screen.getByRole('region'));
 control.focus();view.rerender(<Route path="/watch" search="?workspace=other"/>);
 expect(document.activeElement).toBe(control);expect(scroll).not.toHaveBeenCalled();
 view.rerender(<Route path="/watch/scan" search="?workspace=other"/>);
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('region',{name:'New scan page'})));
 expect(scroll).toHaveBeenCalledWith({top:0,left:0,behavior:'instant'});
 control.focus();view.rerender(<Route path="/watch/scan" search="?workspace=other&mode=package"/>);
 expect(document.activeElement).toBe(control);
});
it('does not take page-change focus from an open modal',async()=>{
 Element.prototype.scrollTo=vi.fn();
 const view=render(<><div role="dialog" aria-modal="true"><button>Modal control</button></div><Route path="/watch"/></>);
 const modal=screen.getByRole('button',{name:'Modal control'});modal.focus();
 view.rerender(<><div role="dialog" aria-modal="true"><button>Modal control</button></div><Route path="/watch/scan"/></>);
 await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
 expect(document.activeElement).toBe(modal);
});

it('resets the new page before animation frames and does not reset again after focus',async()=>{
 const scroll=vi.fn();Element.prototype.scrollTo=scroll;
 const view=render(<Route path="/watch"/>);
 view.rerender(<Route path="/watch/sources"/>);
 expect(scroll).toHaveBeenCalledExactlyOnceWith({top:0,left:0,behavior:'instant'});
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('region',{name:'Coverage page'})));
 expect(scroll).toHaveBeenCalledTimes(1);
 view.rerender(<Route path="/watch/sources" search="?workspace=example&sourceType=github"/>);
 expect(scroll).toHaveBeenCalledTimes(1);
});
