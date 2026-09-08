// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {WorkspaceExceptions} from '../src/components/watch/WorkspaceExceptions';
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState(null,'','/');});
const entry={id:'older',rule:'MAP-001',exact_path:'app.map',reason:'An older scoped exception',expires_at:'2027-01-01',requested_by:'author',requested_login:'author',effective_status:'pending',independent_approval:false,requires_independent_approval:true,artifact_sha256:'a'.repeat(64),source_origin_id:null};
it('opens an off-page exception and records a decision against its stable identifier',async()=>{
 window.history.replaceState(null,'','/watch/policy?workspace=workspace&exception=older');
 const fetcher=vi.fn(async(url:unknown,init?:RequestInit)=>new Response(JSON.stringify(init?.method?{status:'approved'}:String(url).endsWith('/older')?{exception:entry,events:[],canDecide:true,currentUserId:'reviewer'}:{exceptions:[],nextCursor:null,canDecide:false,currentUserId:'reviewer'})));
 vi.stubGlobal('fetch',fetcher);render(<WorkspaceExceptions workspaceId="workspace"/>);
 await screen.findByText('An older scoped exception');
 expect(screen.getByText(/Status: pending · Expires .* UTC/)).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Decision explanation'),{target:{value:'Reviewed the bounded exposure'}});
 fireEvent.click(screen.getByRole('button',{name:'Approve exception'}));
 await screen.findByText('Decision recorded. Saved scans and alert resolution are unchanged.');
 expect(fetcher).toHaveBeenCalledWith('/api/workspaces/workspace/exceptions/older/decision',expect.objectContaining({method:'POST',body:JSON.stringify({action:'approved',note:'Reviewed the bounded exposure'})}));
});
it('uses current detail permissions and approval policy rather than stale list permissions',async()=>{
 window.history.replaceState(null,'','/watch/policy?exception=older');
 vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>new Response(JSON.stringify(String(url).endsWith('/older')?{exception:entry,events:[],canDecide:true,currentUserId:'author',independentApproverAvailable:false}:{exceptions:[],nextCursor:null,canDecide:true,currentUserId:'author'}))));
 render(<WorkspaceExceptions workspaceId="workspace"/>);
 fireEvent.change(await screen.findByLabelText('Decision explanation'),{target:{value:'My explanation is long enough'}});
 expect(screen.getByRole('button',{name:'Approve exception'})).toHaveProperty('disabled',true);
 expect(screen.getByText('A different administrator must approve your request.')).toBeTruthy();
 expect(screen.getByText(/No other eligible administrator/)).toBeTruthy();
 expect(screen.getByRole('link',{name:'team access'})).toHaveProperty('href',expect.stringContaining('/watch/team?workspace=workspace'));
});
