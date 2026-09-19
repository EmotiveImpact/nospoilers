// @vitest-environment jsdom
import {cleanup,render,screen,waitFor,fireEvent} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {WatchMonolithShell} from '../src/components/WatchMonolithShell';
import {parseWatchRoute} from '../src/watch/routes';
vi.mock('../src/components/watch/WorkspaceSwitcher',()=>({WorkspaceSwitcher:()=>null}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('keeps real artifact settings reachable during first proof without inert connection settings',()=>{
 render(<WatchMonolithShell route={parseWatchRoute('/watch','?workspace=example')} search="?workspace=example" ended={false} role="viewer" teamOnly={false} adminOnly={false} login="viewer" sourceCount={0} openAlertCount={0} waitingCount={0} mineCount={0} resolvedCount={0} setupDone={0} setupTotal={0} firstRun artifactOnly installations={[]} activeInstallId={null} onInstall={()=>{}} onOpenPalette={()=>{}}><p>First proof content</p></WatchMonolithShell>);
 expect(screen.getByRole('link',{name:'Settings'})).toHaveProperty('href',expect.stringContaining('/watch/workspaces?workspace=example'));
 expect(screen.getByRole('link',{name:'Plan & billing'})).toHaveProperty('href',expect.stringContaining('workspaceTab=billing'));
 for(const name of ['Team & roles','Scan API tokens','Notifications','Install health'])expect(screen.queryByRole('link',{name})).toBeNull();
 expect(screen.getByRole('link',{name:'Coverage'})).toHaveProperty('href',expect.stringContaining('/watch/sources?workspace=example'));
 expect(screen.getByRole('link',{name:'New scan'})).toHaveProperty('href',expect.stringContaining('/watch/scan?workspace=example'));
 expect(screen.getByText('First proof content')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Guide'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Sign out'})).toBeNull();
 expect(screen.getByRole('button',{name:'Account menu for viewer'}).closest('header')).toBeNull();
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

it('keeps artifact settings reachable in local navigation without connection-only settings',()=>{
 render(<Route path="/watch/workspaces"/>);
 for(const name of ['Team & roles','Retention','Audit log','Scan API tokens','Notifications','Scan policy'])expect(screen.getByRole('link',{name})).toBeTruthy();
 expect(screen.queryByRole('link',{name:'Install health'})).toBeNull();
 expect(screen.queryByRole('link',{name:'Private registries'})).toBeNull();
});

it('exposes sign out inside the account menu without signing out on open',async()=>{
 render(<Route path="/watch"/>);
 fireEvent.click(screen.getByRole('button',{name:'Account menu for viewer'}));
 expect(await screen.findByRole('menuitem',{name:'Sign out'})).toBeTruthy();
 expect(screen.getByRole('menuitem',{name:'Workspace settings'})).toBeTruthy();
});
