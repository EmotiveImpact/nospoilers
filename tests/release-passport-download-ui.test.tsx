// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ReleasePassportDownload} from '../src/components/watch/ReleaseAssurancePanel';
import {buildAssuranceView} from '../src/assurance/index';
import {sample,NOW} from './assurance-fixtures';
const {download}=vi.hoisted(()=>({download:vi.fn()}));
vi.mock('../src/assurance/client',async()=>({...await vi.importActual<typeof import('../src/assurance/client')>('../src/assurance/client'),downloadPassport:download}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
function viewFor(id:string){const source=sample();source.release.id=id;return buildAssuranceView(source,null,NOW,'uploaded-scan');}
it('downloads only a freshly authorized passport bound to the selected release',async()=>{
 const view=viewFor('first');const fetcher=vi.fn(async()=>Response.json({view}));vi.stubGlobal('fetch',fetcher);
 render(<ReleasePassportDownload kind="upload" recordId="first"/>);
 expect(fetcher).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Export private passport'}));
 await waitFor(()=>expect(download).toHaveBeenCalledWith(view.passport,'first'));
 expect(fetcher).toHaveBeenCalledWith('/api/assurance/uploads/first',expect.objectContaining({credentials:'same-origin',cache:'no-store'}));
});
it.each(['foreign','denied','pending'] as const)('does not export %s evidence',async(kind)=>{
 vi.stubGlobal('fetch',vi.fn(async()=>kind==='denied'?Response.json({error:'No longer authorized.'},{status:403}):kind==='pending'?new Response(null,{status:202}):Response.json({view:viewFor('foreign')})));
 render(<ReleasePassportDownload kind="upload" recordId="first"/>);
 fireEvent.click(screen.getByRole('button',{name:'Export private passport'}));
 await screen.findByRole('alert');expect(download).not.toHaveBeenCalled();
 expect((screen.getByRole('button',{name:'Export private passport'}) as HTMLButtonElement).disabled).toBe(false);
});
it('ignores a completed old passport request after switching record identity',async()=>{
 let finish:(response:Response)=>void=()=>{throw new Error('request missing');};
 vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>String(url).endsWith('/first')?new Promise<Response>(resolve=>{finish=resolve;}):Response.json({view:viewFor('second')})));
 const result=render(<ReleasePassportDownload kind="upload" recordId="first"/>);
 fireEvent.click(screen.getByRole('button',{name:'Export private passport'}));
 result.rerender(<ReleasePassportDownload kind="upload" recordId="second"/>);
 finish(Response.json({view:viewFor('first')}));
 fireEvent.click(screen.getByRole('button',{name:'Export private passport'}));
 await waitFor(()=>expect(download).toHaveBeenCalledTimes(1));
 expect(download).toHaveBeenCalledWith(viewFor('second').passport,'second');
});
