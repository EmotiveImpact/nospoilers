// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {WatchMonolithShell} from '../src/components/WatchMonolithShell';
import {parseWatchRoute} from '../src/watch/routes';
vi.mock('../src/components/watch/WorkspaceSwitcher',()=>({WorkspaceSwitcher:()=>null}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},'','/');});
function SettingsPage({path='/watch/workspaces',search='?workspace=w2&install=7',ended=false}:{path?:string;search?:string;ended?:boolean}){
 return <WatchMonolithShell route={parseWatchRoute(path,search)} search={search} ended={ended} role="admin" teamOnly adminOnly login="owner" sourceCount={2} openAlertCount={0} waitingCount={0} mineCount={0} resolvedCount={0} setupDone={2} setupTotal={2} firstRun={false} installations={[{id:7,account_login:'Studio'}]} activeInstallId={7} onInstall={()=>{}} onOpenPalette={()=>{}}><h1>Current settings content</h1><button>Page action</button></WatchMonolithShell>;
}
it('keeps settings navigation scoped while discarding a previous release finding',()=>{
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(()=>{})));
 const search='?workspace=w2&install=7&release=65&releaseFinding=8&upload=old&uploadView=detail&workspaceTab=organisation';
 window.history.replaceState({},'','/watch/workspaces'+search);
 render(<SettingsPage search={search}/>);
 const nav=screen.getByRole('navigation',{name:'Settings sections'});
 const policy=within(nav).getByRole('link',{name:'Policy & allowlist'});
 const params=new URL(policy.getAttribute('href')!,location.origin).searchParams;
 expect(params.get('workspace')).toBe('w2');expect(params.get('install')).toBe('7');
 for(const key of ['release','releaseFinding','upload','uploadView','workspaceTab'])expect(params.has(key)).toBe(false);
 fireEvent.click(policy);
 expect(location.pathname).toBe('/watch/policy');
 expect(location.search).toBe('?workspace=w2&install=7');
});
it('identifies one current settings destination while keeping page content independent of navigation',()=>{
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(()=>{})));
 render(<SettingsPage path="/watch/notifications"/>);
 const nav=screen.getByRole('navigation',{name:'Settings sections'});
 const current=within(nav).getAllByRole('link').filter(link=>link.getAttribute('aria-current')==='page');
 expect(current).toHaveLength(1);expect(current[0].textContent).toContain('Notifications');
 expect(nav.contains(screen.getByRole('heading',{name:'Current settings content'}))).toBe(false);
 expect(screen.getByRole('button',{name:'Page action'})).toBeTruthy();
});


it('takes ended coverage directly to the current workspace billing controls',()=>{
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(()=>{})));
 const search='?workspace=w2&install=7&release=65&releaseFinding=8';
 window.history.replaceState({},'','/watch/releases'+search);
 render(<SettingsPage path="/watch/releases" search={search} ended/>);
 fireEvent.click(screen.getByRole('button',{name:'See plans'}));
 expect(location.pathname).toBe('/watch/workspaces');
 expect(Object.fromEntries(new URLSearchParams(location.search))).toEqual({workspace:'w2',install:'7',workspaceTab:'billing'});
 expect(screen.queryByRole('dialog')).toBeNull();
});
