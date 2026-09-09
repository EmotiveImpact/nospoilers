// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {GithubRepositoryScan} from '../src/components/watch/GithubRepositoryScan';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
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
