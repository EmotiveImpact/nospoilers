// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {GithubRepositoryScan} from '../src/components/watch/GithubRepositoryScan';
import {navigate} from '../src/nav';
vi.mock('../src/nav',()=>({navigate:vi.fn()}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
const repos=[{id:12,full_name:'client/release'}];
it('selects a repository and queues only on explicit action, retaining honest progress',async()=>{
 const fetcher=vi.fn(async(_url:string,options?:RequestInit)=>Response.json(options?.method?{ok:true,queued:true,jobId:1}:{repos}));vi.stubGlobal('fetch',fetcher);
 render(<GithubRepositoryScan installationId="7" search="?workspace=w&install=7" disabledReason={null}/>);
 fireEvent.change(await screen.findByLabelText('Repository'),{target:{value:'12'}});
 expect(fetcher).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Scan latest release'}));
 expect(await screen.findByRole('status')).toHaveProperty('textContent',expect.stringContaining('not a completed scan'));
 expect(fetcher).toHaveBeenCalledWith('/api/repos/12/scan-latest-release',expect.objectContaining({method:'POST'}));
 expect(screen.getByRole('link',{name:'View releases and scan progress'}).getAttribute('href')).toContain('workspace=w');
});
it('tracks the returned job without claiming a completed check passed',async()=>{
 const fetcher=vi.fn(async(url:string,options?:RequestInit)=>Response.json(options?.method?{ok:true,queued:true,jobId:9}:url.startsWith('/api/jobs')?{jobs:[{id:9,installationId:7,kind:'scan_latest_release',status:'done'}]}:{repos}));vi.stubGlobal('fetch',fetcher);
 render(<GithubRepositoryScan installationId="7" search="?workspace=w" disabledReason={null}/>);
 fireEvent.change(await screen.findByLabelText('Repository'),{target:{value:'12'}});
 fireEvent.click(screen.getByRole('button',{name:'Scan latest release'}));
 await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('Completion does not mean the release passed'));
 expect(screen.getByRole('link',{name:'View this repository’s alerts'}).getAttribute('href')).toContain('source=repo-12');
});
it('does not expose destructive coverage actions and respects read-only access',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({repos})));
 render(<GithubRepositoryScan installationId="7" search="" disabledReason="Viewer access is read-only."/>);
 fireEvent.change(await screen.findByLabelText('Repository'),{target:{value:'12'}});
 expect((screen.getByRole('button',{name:'Scan latest release'}) as HTMLButtonElement).disabled).toBe(true);
 expect(screen.queryByRole('button',{name:/delete|private|disable/i})).toBeNull();
});
it('clears prior selection and progress when workspace identity changes',async()=>{
 const fetcher=vi.fn(async()=>Response.json({repos}));vi.stubGlobal('fetch',fetcher);
 const view=render(<GithubRepositoryScan installationId="7" search="?workspace=first" disabledReason={null}/>);
 fireEvent.change(await screen.findByLabelText('Repository'),{target:{value:'12'}});
 view.rerender(<GithubRepositoryScan installationId="7" search="?workspace=second" disabledReason={null}/>);
 await waitFor(()=>expect((screen.getByLabelText('Repository') as HTMLSelectElement).value).toBe(''));
});

it('uses clean scoped destinations and client navigation for ordinary recovery-link clicks',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({repos})));
 render(<GithubRepositoryScan installationId="7" search="?workspace=w&install=99&mode=receipt&upload=old&release=2&preview=3&configure=website&origin=https%3A%2F%2Fold.example&source=repo-44&sourceType=npm&tab=done" disabledReason={null}/>);
 fireEvent.change(await screen.findByLabelText('Repository'),{target:{value:'12'}});
 const destinations=[
  ['View releases and scan progress','/watch/releases',{install:'7',workspace:'w'}],
  ['View this repository’s alerts','/watch/alerts',{install:'7',workspace:'w',source:'repo-12'}],
  ['Repository setup and prerequisites','/watch/sources',{install:'7',workspace:'w',configure:'github',source:'repo-12'}],
 ] as const;
 for(const [name,path,params] of destinations){
  const link=screen.getByRole('link',{name});
  const href=link.getAttribute('href')!;const url=new URL(href,'https://example.test');
  expect(url.pathname).toBe(path);expect(Object.fromEntries(url.searchParams)).toEqual(params);
  fireEvent.click(link);expect(navigate).toHaveBeenLastCalledWith(href);
 }
 expect(navigate).toHaveBeenCalledTimes(3);
});
it.each([{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1}])('leaves browser navigation intact for modified recovery-link click %j',async options=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({repos})));
 render(<GithubRepositoryScan installationId="7" search="?workspace=w" disabledReason={null}/>);
 await screen.findByLabelText('Repository');
 const link=screen.getByRole('link',{name:'View releases and scan progress'});
 let preventedByComponent:boolean|undefined;
 const observe=(event:MouseEvent)=>{preventedByComponent=event.defaultPrevented;event.preventDefault();};
 document.addEventListener('click',observe,{once:true});
 fireEvent.click(link,options);
 expect(preventedByComponent).toBe(false);expect(navigate).not.toHaveBeenCalled();
});
