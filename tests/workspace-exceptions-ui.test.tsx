// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {act,render,screen,fireEvent,cleanup} from '@testing-library/react';
import {WorkspaceExceptions} from '../src/components/watch/WorkspaceExceptions';
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();window.history.replaceState(null,'','/');});
const entry={id:'older',rule:'MAP-001',exact_path:'app.map',reason:'An older scoped exception',expires_at:'2027-01-01',requested_by:'author',requested_login:'author',effective_status:'pending',independent_approval:false,requires_independent_approval:true,artifact_sha256:'a'.repeat(64),source_origin_id:null};
it('isolates an in-flight decision when another exception is selected',async()=>{
 window.history.replaceState(null,'','/watch/policy?exception=older');
 let finish!:(response:Response)=>void,signal:AbortSignal|undefined;
 vi.stubGlobal('fetch',vi.fn(async(url:unknown,init?:RequestInit)=>{
  if(init?.method){signal=init.signal as AbortSignal;return new Promise<Response>(resolve=>{finish=resolve;});}
  const second=String(url).endsWith('/second');
  return new Response(JSON.stringify(second||String(url).endsWith('/older')?{exception:{...entry,id:second?'second':'older',reason:second?'Second request':entry.reason},events:[],canDecide:true,currentUserId:'reviewer'}:{exceptions:[],nextCursor:null}));
 }));
 const view=render(<WorkspaceExceptions workspaceId="workspace"/>);
 fireEvent.change(await screen.findByLabelText('Decision explanation'),{target:{value:'Reviewed first request'}});
 fireEvent.click(screen.getByRole('button',{name:'Approve exception'}));
 window.history.replaceState(null,'','/watch/policy?exception=second');
 view.rerender(<WorkspaceExceptions workspaceId="workspace"/>);
 await screen.findByText('Second request');
 expect(signal?.aborted).toBe(true);
 await act(async()=>finish(new Response(JSON.stringify({status:'approved'}))));
 expect(screen.queryByText('Decision recorded. Saved scans and alert resolution are unchanged.')).toBeNull();
 expect(screen.getByLabelText('Decision explanation')).toHaveProperty('value','');
});
it('clears a recovered detail error without hiding a separate list failure',async()=>{
 window.history.replaceState(null,'','/watch/policy?exception=older');let reads=0;
 vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>{
  if(String(url).endsWith('/older'))return ++reads===1?new Response(JSON.stringify({error:'Detail failed.'}),{status:503}):new Response(JSON.stringify({exception:entry,events:[],canDecide:false,currentUserId:'viewer'}));
  return new Response(JSON.stringify({error:'History list failed.'}),{status:503});
 }));
 render(<WorkspaceExceptions workspaceId="workspace"/>);
 await screen.findByText('Detail failed.');
 fireEvent.click(screen.getByRole('button',{name:'Refresh exceptions'}));
 await screen.findByText(entry.reason);
 expect(screen.queryByText('Detail failed.')).toBeNull();
 expect(screen.getByRole('alert').textContent).toBe('History list failed.');
 expect(screen.queryByText('Loading exceptions…')).toBeNull();
});
it.each(['expired','rejected','revoked'])('retains %s exception evidence without decision actions',async status=>{
 window.history.replaceState(null,'','/watch/policy?exception=older');
 const fetcher=vi.fn(async(url:unknown)=>new Response(JSON.stringify(String(url).endsWith('/older')?{exception:{...entry,effective_status:status},events:[{id:1,action:status,actor_user_id:'reviewer',note:'Recorded lifecycle decision',created_at:'2026-09-08T12:00:00Z'}],canDecide:true,currentUserId:'reviewer'}:{exceptions:[],nextCursor:null})));
 vi.stubGlobal('fetch',fetcher);render(<WorkspaceExceptions workspaceId="workspace"/>);
 await screen.findByText(entry.reason);
 expect(screen.getByText('Recorded lifecycle decision')).toBeTruthy();
 for(const name of ['Approve exception','Reject request','Revoke exception'])expect(screen.queryByRole('button',{name})).toBeNull();
 expect(screen.queryByLabelText('Decision explanation')).toBeNull();
 expect(fetcher.mock.calls.every(call=>!(Reflect.get(call,1) as RequestInit|undefined)?.method)).toBe(true);
});
it('offers only revocation for an already approved exception',async()=>{
 window.history.replaceState(null,'','/watch/policy?exception=older');
 vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>new Response(JSON.stringify(String(url).endsWith('/older')?{exception:{...entry,effective_status:'approved'},events:[],canDecide:true,currentUserId:'reviewer'}:{exceptions:[],nextCursor:null}))));
 render(<WorkspaceExceptions workspaceId="workspace"/>);
 expect(await screen.findByRole('button',{name:'Revoke exception'})).toHaveProperty('disabled',true);
 expect(screen.queryByRole('button',{name:'Approve exception'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Reject request'})).toBeNull();
 fireEvent.change(screen.getByLabelText('Decision explanation'),{target:{value:'Revoking bounded exception'}});
 expect(screen.getByRole('button',{name:'Revoke exception'})).toHaveProperty('disabled',false);
});
it('aborts an outstanding decision when switching workspace and ignores its late completion',async()=>{
 window.history.replaceState(null,'','/watch/policy?exception=older');
 let finish!:(response:Response)=>void,signal:AbortSignal|undefined;
 vi.stubGlobal('fetch',vi.fn(async(url:unknown,init?:RequestInit)=>{
  if(init?.method){signal=init.signal as AbortSignal;return new Promise<Response>(resolve=>{finish=resolve;});}
  const other=String(url).includes('/other/');
  return new Response(JSON.stringify(String(url).endsWith('/older')?{exception:{...entry,reason:other?'Other workspace evidence':entry.reason},events:[],canDecide:!other,currentUserId:'reviewer'}:{exceptions:[],nextCursor:null}));
 }));
 const view=render(<WorkspaceExceptions workspaceId="workspace"/>);
 fireEvent.change(await screen.findByLabelText('Decision explanation'),{target:{value:'Reviewed bounded exposure'}});
 fireEvent.click(screen.getByRole('button',{name:'Approve exception'}));
 view.rerender(<WorkspaceExceptions workspaceId="other"/>);
 await screen.findByText('Other workspace evidence');
 expect(signal?.aborted).toBe(true);
 await act(async()=>finish(new Response(JSON.stringify({status:'approved'}))));
 expect(screen.queryByText('Decision recorded. Saved scans and alert resolution are unchanged.')).toBeNull();
 expect(screen.getByText('Other workspace evidence')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Approve exception'})).toBeNull();
});
it('ignores a stale background failure after a decision is rejected',async()=>{
 window.history.replaceState(null,'','/watch/policy?exception=older');
 let finish!:(response:Response)=>void,reads=0;
 vi.stubGlobal('fetch',vi.fn(async(url:unknown,init?:RequestInit)=>{
  if(init?.method)return new Response(JSON.stringify({error:'Decision access changed.'}),{status:403});
  if(String(url).endsWith('/older')){
   if(++reads>1)return new Promise<Response>(resolve=>{finish=resolve;});
   return new Response(JSON.stringify({exception:entry,events:[],canDecide:true,currentUserId:'reviewer'}));
  }
  return new Response(JSON.stringify({exceptions:[],nextCursor:null}));
 }));
 vi.useFakeTimers();
 await act(async()=>{render(<WorkspaceExceptions workspaceId="workspace"/>);});
 await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});
 fireEvent.change(screen.getByLabelText('Decision explanation'),{target:{value:'Reviewed bounded exposure'}});
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Approve exception'}));});
 expect(screen.getByRole('alert').textContent).toBe('Decision access changed.');
 await act(async()=>finish(new Response(JSON.stringify({error:'Old request failed.'}),{status:503})));
 expect(screen.getByRole('alert').textContent).toBe('Decision access changed.');
});
it('removes decision controls after a permission rejection until refreshed',async()=>{
 window.history.replaceState(null,'','/watch/policy?exception=older');
 vi.stubGlobal('fetch',vi.fn(async(url:unknown,init?:RequestInit)=>new Response(JSON.stringify(init?.method?{error:'Access changed. Refresh exceptions.'}:String(url).endsWith('/older')?{exception:entry,events:[],canDecide:true,currentUserId:'reviewer'}:{exceptions:[],nextCursor:null}),{status:init?.method?403:200})));
 render(<WorkspaceExceptions workspaceId="workspace"/>);
 fireEvent.change(await screen.findByLabelText('Decision explanation'),{target:{value:'Reviewed bounded exposure'}});
 fireEvent.click(screen.getByRole('button',{name:'Approve exception'}));
 await screen.findByRole('alert');
 expect(screen.queryByRole('button',{name:'Approve exception'})).toBeNull();
 expect(screen.queryByText('Decision recorded. Saved scans and alert resolution are unchanged.')).toBeNull();
});
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

it('hides pagination for an empty first page while retaining navigation from an older page',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({exceptions:[],nextCursor:null,canDecide:false,currentUserId:'viewer'})));
 const view=render(<WorkspaceExceptions workspaceId="workspace"/>);
 await screen.findByText('No exception requests on this page.');
 expect(screen.queryByRole('navigation',{name:'Exception history'})).toBeNull();
 window.history.replaceState(null,'','/watch/policy?workspace=workspace&exceptionBefore=older');
 view.rerender(<WorkspaceExceptions workspaceId="workspace"/>);
 expect(await screen.findByRole('button',{name:'Newest'})).toHaveProperty('disabled',false);
 expect(screen.getByRole('button',{name:'Older'})).toHaveProperty('disabled',true);
});

it('rejects an incomplete successful detail response without exposing decision controls',async()=>{
 window.history.replaceState(null,'','/watch/policy?exception=older');
 vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>Response.json(String(url).endsWith('/older')?{canDecide:true,events:[]}:{exceptions:[],nextCursor:null})));
 render(<WorkspaceExceptions workspaceId="workspace"/>);
 expect((await screen.findByRole('alert')).textContent).toBe('Exception response was incomplete. Refresh exceptions.');
 expect(screen.queryByRole('button',{name:'Approve exception'})).toBeNull();
});

it('rejects an incomplete successful list response while preserving valid selected evidence',async()=>{
 window.history.replaceState(null,'','/watch/policy?exception=older');
 vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>Response.json(String(url).endsWith('/older')?{exception:entry,events:[],canDecide:false,currentUserId:'viewer'}:{})));
 render(<WorkspaceExceptions workspaceId="workspace"/>);
 expect((await screen.findByRole('alert')).textContent).toBe('Exception list response was incomplete. Refresh exceptions.');
 expect(await screen.findByText(entry.reason)).toBeTruthy();
 expect(screen.queryByRole('navigation',{name:'Exception history'})).toBeNull();
});

it('renders BIGSERIAL event identifiers returned as decimal strings without losing precision',async()=>{
 window.history.replaceState(null,'','/watch/policy?exception=older');
 vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>Response.json(String(url).endsWith('/older')?{exception:entry,events:[{id:'9223372036854775807',action:'requested',actor_user_id:'author',note:'Database event retained without numeric conversion',created_at:'2026-09-15T10:00:00Z'}],canDecide:false,currentUserId:'viewer'}:{exceptions:[],nextCursor:null})));
 render(<WorkspaceExceptions workspaceId="workspace"/>);
 expect(await screen.findByText('Database event retained without numeric conversion')).toBeTruthy();
 expect(screen.queryByRole('alert')).toBeNull();
});
