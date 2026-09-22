// @vitest-environment jsdom
import {selectOption} from './helpers/select-option';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import {WorkspaceDeletionRequest} from '../src/components/watch/WorkspaceDeletionRequest';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const preview={scope:'workspace_history',workspaceId:'workspace',organizationId:'org',generatedAt:'2026-09-05T12:00:00Z',executionAvailable:false,holdsChecked:false,counts:{workspaces:1,savedUploadRecords:2,activeUploads:0,sourceConnections:0,sourceReleaseRecords:0,activeJobs:0,publicLinks:0}};
it('requires typing and acknowledgement and truthfully shows a pending request',async()=>{
 const fetcher=vi.fn(async(url:string,input?:RequestInit)=>new Response(JSON.stringify(url.includes('deletion-impact')?preview:input?.method?{id:'request',status:'pending_review'}:{requests:[]})));vi.stubGlobal('fetch',fetcher);
 render(<WorkspaceDeletionRequest organizationId="org" workspaceId="workspace" workspaceName="Production"/>);
 const button=screen.getByRole('button',{name:'Request deletion review'});
 expect((button as HTMLButtonElement).disabled).toBe(true);
 fireEvent.change(screen.getByLabelText('Deletion confirmation'),{target:{value:'DELETE HISTORY workspace'}});
 expect((button as HTMLButtonElement).disabled).toBe(true);
 await screen.findByText('Saved upload records');fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(button);
 expect(await screen.findByRole('status')).toHaveProperty('textContent',expect.stringContaining('Your history and account remain unchanged'));
 expect(fetcher).toHaveBeenCalledWith('/api/organizations/org/deletion-requests',expect.objectContaining({method:'POST',body:JSON.stringify({scope:'workspace_history',workspaceId:'workspace',confirmation:'DELETE HISTORY workspace',acknowledgeHistory:true})}));
});
it('does not accept consent when the impact inventory is unavailable',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url.includes('deletion-impact')?{error:'Inventory unavailable'}:{requests:[]}),{status:url.includes('deletion-impact')?503:200})));
 render(<WorkspaceDeletionRequest organizationId="org" workspaceId="workspace"/>);
 expect(await screen.findByText('Inventory unavailable')).toBeTruthy();
 expect(screen.getByRole('checkbox')).toHaveProperty('disabled',true);
 expect(screen.getByRole('button',{name:'Request deletion review'})).toHaveProperty('disabled',true);
});
it('resets authorisation when scope or organisation changes',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({requests:[]}))));
 render(<WorkspaceDeletionRequest organizationId="org" workspaceId="workspace"/>);
 fireEvent.change(screen.getByLabelText('Deletion confirmation'),{target:{value:'DELETE HISTORY workspace'}});fireEvent.click(screen.getByRole('checkbox'));
 await selectOption(screen.getByLabelText('Request scope'),'Close this organisation and delete its history');
 expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
 expect((screen.getByLabelText('Deletion confirmation') as HTMLInputElement).value).toBe('');
 expect(screen.getByText('CLOSE AND DELETE org')).toBeTruthy();
});
it('loads persisted requests and permits withdrawal without claiming deletion',async()=>{
 let withdrawn=false;
 const fetcher=vi.fn(async(_url:string,input?:RequestInit)=>{if(input?.method){withdrawn=true;return new Response(JSON.stringify({id:'saved',status:'withdrawn'}));}return new Response(JSON.stringify({requests:[{id:'saved',scope:'organization_closure',workspace_id:null,status:withdrawn?'withdrawn':'pending_review'}]}));});vi.stubGlobal('fetch',fetcher);
 render(<WorkspaceDeletionRequest organizationId="org"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Withdraw request'}));
 expect(await screen.findByText(/Withdrawn — nothing deleted/)).toBeTruthy();
 expect(fetcher).toHaveBeenCalledWith('/api/organizations/org/deletion-requests/saved/withdraw',{method:'POST'});
});
it('keeps long deletion scope and confirmation accessible in the responsive form',async()=>{
 const workspace='workspace-'+ 'long-id-'.repeat(25);
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url.includes('deletion-impact')?{...preview,workspaceId:workspace}:{requests:[]}))));
 render(<WorkspaceDeletionRequest organizationId="org" workspaceId={workspace} workspaceName={'Long workspace '.repeat(15)}/>);
 await screen.findByText(/Counted/);
 expect(screen.getByRole('region',{name:'Data deletion'}).className).not.toContain('watch-empty');
 expect(screen.getByLabelText('Request scope').className).toContain('w-full');
 const confirmation=screen.getByLabelText('Deletion confirmation');
 expect(confirmation.className).toContain('w-full');
 expect(screen.getByText(`DELETE HISTORY ${workspace}`)).toBeTruthy();
 expect((screen.getByRole('button',{name:'Request deletion review'}) as HTMLButtonElement).disabled).toBe(true);
});
