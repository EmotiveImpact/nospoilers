// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ReleaseIntelligencePanel} from '../src/components/watch/ReleaseIntelligencePanel';
vi.mock('../src/components/watch/AutomaticCaptureControls',()=>({AutomaticCaptureControls:()=> <p>Automatic capture controls</p>}));
vi.mock('../src/components/watch/ProductionParityControls',()=>({ProductionParityControls:()=> <p>Production parity controls</p>}));
vi.mock('../src/components/watch/ReleaseGateControls',()=>({ReleaseGateControls:({record}:{record:{id:string}})=><button type="button">Gate for {record.id}</button>}));
vi.mock('../src/components/watch/ReleaseRemediationControls',()=>({ReleaseRemediationControls:({record}:{record:{id:string}})=> <p>Finding reviews for {record.id}</p>}));
vi.mock('../src/components/watch/AgentAccessControls',()=>({AgentAccessControls:({snapshotId}:{snapshotId:string})=><button type="button">Grant agent for {snapshotId}</button>}));
vi.mock('../src/components/watch/ReleaseExplanationControls',()=>({ReleaseExplanationControls:()=> <p>Optional explanation controls</p>}));
vi.mock('../src/components/watch/ReleaseOutcomeControls',()=>({ReleaseOutcomeControls:()=> <p>Private monthly outcome controls</p>}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
const record={kind:'upload' as const,id:'record'};
const stream={id:'stream',workspace_id:'workspace',name:'Release product',artifact_role:'Package',channel:'stable',revision:0};
const list={streams:[stream],links:[{stream_id:'stream',snapshot_id:'snapshot'}],canManage:true,canWrite:true};
const detail={stream,snapshots:[],selected:null,nextCursor:null,canManage:true,canWrite:true,unavailable:false,baselineEligible:false,analysis:null,baselines:[],events:[],currentBaselineState:'not_adopted',notice:'Scoped history.'};
const isList=(url:unknown)=>String(url).includes('/streams?');
it.each(['Adopt selected reference','Revoke current reference','Export private history'])('recovers keyboard focus and retry after %s fails',async(name)=>{
 const snapshot={id:'snapshot',record_kind:'upload',record_id:'record',scanned_at:'2026-09-09T00:00:00Z',digest:'a'.repeat(64),metrics:{files:1},excluded:false};
 const current={...detail,selected:snapshot,snapshots:[snapshot],baselineEligible:true,baselines:[{id:'baseline',revision:1,action:'adopt',reason:'Approved reference',actor_login:'owner',created_at:'2026-09-09T00:00:00Z'}]};
 vi.stubGlobal('fetch',vi.fn(async(url:unknown,init?:RequestInit)=>String(url).endsWith('/export')||init?.method==='POST'?Response.json({error:'Authority changed.'},{status:403}):Response.json(isList(url)?list:current)));
 render(<ReleaseIntelligencePanel workspaceId="workspace" record={record}/>);
 await screen.findByText('Scoped history.');
 if(name!=='Export private history'){
  await userEvent.click(screen.getByText('Approved reference and history exclusions'));
  fireEvent.change(screen.getByLabelText('Reason for change'),{target:{value:'Review this reference change.'}});
 }
 const button=screen.getByRole('button',{name});
 await waitFor(()=>expect((button as HTMLButtonElement).disabled).toBe(false));
 button.focus();await userEvent.keyboard('{Enter}');
 const alert=await screen.findByRole('alert');await waitFor(()=>expect(document.activeElement).toBe(alert));
 expect(screen.queryByRole('button',{name})).toBeNull();
 await userEvent.tab();expect(document.activeElement).toBe(screen.getByRole('button',{name:'Retry saved history'}));
 await userEvent.keyboard('{Enter}');await screen.findByText('Scoped history.');
});
it('explains the hidden capabilities and opens setup with focus without creating data',async()=>{
  const fetch=vi.fn(async()=>Response.json({...list,streams:[],links:[]}));vi.stubGlobal('fetch',fetch);
  Element.prototype.scrollIntoView=vi.fn();
  render(<ReleaseIntelligencePanel workspaceId="workspace" record={record}/>);
  await screen.findByText('Start a history for this product');
  fireEvent.click(screen.getByRole('button',{name:'Set up release history'}));
  const name=screen.getByLabelText('Name');expect(document.activeElement).toBe(name);
  expect(screen.getByRole('form',{name:'Create a release stream'}).contains(name)).toBe(true);
  expect(screen.getByText(/These are separate opt-ins/)).toBeTruthy();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('removes old history and creation controls after a failed list refresh, then recovers',async()=>{
  let failed=false;
  vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>isList(url)?Response.json(failed?{error:'Workspace unavailable.'}:list,{status:failed?404:200}):Response.json(detail)));
  render(<ReleaseIntelligencePanel workspaceId="workspace" record={record}/>);
  await screen.findByText('Scoped history.');
  await waitFor(()=>expect((screen.getByRole('button',{name:'Refresh history'}) as HTMLButtonElement).disabled).toBe(false));
  failed=true;fireEvent.click(screen.getByRole('button',{name:'Refresh history'}));
  await screen.findByRole('alert');
  expect(screen.queryByText('Scoped history.')).toBeNull();
  expect(screen.queryByRole('button',{name:'Create stream and record release',hidden:true})).toBeNull();
  failed=false;fireEvent.click(screen.getByRole('button',{name:'Retry saved history'}));
  await screen.findByText('Scoped history.');
});
it('clears old workspace controls immediately while a new workspace request is pending',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>String(url).includes('workspaceId=next')?new Promise<Response>(()=>{}):Response.json(isList(url)?list:detail)));
  const result=render(<ReleaseIntelligencePanel workspaceId="workspace" record={record}/>);
  await screen.findByText('Scoped history.');
  result.rerender(<ReleaseIntelligencePanel workspaceId="next" record={record}/>);
  expect(screen.queryByText('Scoped history.')).toBeNull();
  expect(screen.queryByRole('button',{name:'Export private history'})).toBeNull();
});
it('rejects stream lists belonging to another workspace',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...list,streams:[{...stream,workspace_id:'foreign'}]})));
  render(<ReleaseIntelligencePanel workspaceId="workspace" record={record}/>);
  await screen.findByRole('alert');
  expect(screen.queryByRole('button',{name:'Create stream and record release',hidden:true})).toBeNull();
});
it('does not download a history export with an unconfirmed workspace',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>Response.json(String(url).endsWith('/export')?{type:'nospoilers-private-history',signed:false,scope:{workspaceId:'foreign',streamId:'stream'}}:isList(url)?list:detail)));
  const create=vi.fn();vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:create,revokeObjectURL:vi.fn()}));
  render(<ReleaseIntelligencePanel workspaceId="workspace" record={record}/>);
  await screen.findByText('Scoped history.');
  await waitFor(()=>expect((screen.getByRole('button',{name:'Export private history'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'Export private history'}));
  await screen.findByText('Export scope was not confirmed. Refresh history before exporting.');
  expect(create).not.toHaveBeenCalled();expect(screen.queryByText('Scoped history.')).toBeNull();
});
it('moves keyboard focus to the error when a failed refresh removes the focused control',async()=>{
  let failed=false;
  vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>isList(url)?Response.json(failed?{error:'Workspace unavailable.'}:list,{status:failed?404:200}):Response.json(detail)));
  render(<ReleaseIntelligencePanel workspaceId="workspace" record={record}/>);
  await screen.findByText('Scoped history.');
  const refresh=screen.getByRole('button',{name:'Refresh history'});
  await waitFor(()=>expect((refresh as HTMLButtonElement).disabled).toBe(false));
  refresh.focus();failed=true;await userEvent.keyboard('{Enter}');
  const alert=await screen.findByRole('alert');
  await waitFor(()=>expect(document.activeElement).toBe(alert));
  await userEvent.tab();expect(document.activeElement).toBe(screen.getByRole('button',{name:'Retry saved history'}));
});
it('does not steal focus after the customer has left the history panel during a failed request',async()=>{
  let fail:((response:Response)=>void)|undefined,failed=false;
  vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>isList(url)?failed?new Promise<Response>(resolve=>{fail=resolve;}):Response.json(list):Response.json(detail)));
  render(<><button>Outside history</button><ReleaseIntelligencePanel workspaceId="workspace" record={record}/></>);
  await screen.findByText('Scoped history.');
  const refresh=screen.getByRole('button',{name:'Refresh history'});
  await waitFor(()=>expect((refresh as HTMLButtonElement).disabled).toBe(false));
  refresh.focus();failed=true;fireEvent.click(refresh);
  const outside=screen.getByRole('button',{name:'Outside history'});outside.focus();
  await waitFor(()=>expect(fail).toBeTruthy());fail!(Response.json({error:'Unavailable.'},{status:404}));
  await screen.findByRole('alert');expect(document.activeElement).toBe(outside);
});
it('identifies same-digest records distinctly and announces a keyboard-selected historical record',async()=>{
  const snapshot={id:'snapshot',record_kind:'upload',record_id:'record',scanned_at:'2026-09-09T00:00:00.000Z',digest:'a'.repeat(64),metrics:{files:1},excluded:false};
  const next={...snapshot,id:'next',record_id:'another-record'};
  vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>Response.json(isList(url)?list:{...detail,canAdminister:true,snapshots:[snapshot,next],selected:String(url).includes('snapshotId=next')?next:snapshot})));
  render(<ReleaseIntelligencePanel workspaceId="workspace" record={record}/>);
  const button=await screen.findByRole('button',{name:/Inspect upload another-record/});
  await waitFor(()=>expect((button as HTMLButtonElement).disabled).toBe(false));
  button.focus();await userEvent.keyboard('{Enter}');
  await waitFor(()=>expect(button.getAttribute('aria-pressed')).toBe('true'));
  expect(screen.getByRole('status').textContent).toContain('Selected upload another-record');
  expect(screen.getByRole('status').textContent).toContain('different historical record');
  const scope=screen.getByRole('status');
  expect(scope.getAttribute('aria-atomic')).toBe('true');
  fireEvent.click(screen.getByRole('button',{name:'Release decisions'}));
  const gate=screen.getByRole('button',{name:'Gate for record'});
  expect(scope.compareDocumentPosition(gate)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Gate for another-record',hidden:true})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Access & assistance'}));
  const agent=screen.getByRole('button',{name:'Grant agent for next'});
  expect(scope.compareDocumentPosition(agent)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Gate for record'})).toBeNull();
});

it.each(['selection','refresh'] as const)('removes prior scoped child actions during pending history %s',async(action)=>{
 const first={id:'snapshot',record_kind:'upload',record_id:'record',scanned_at:'2026-09-09T00:00:00.000Z',digest:'a'.repeat(64),metrics:{files:1},excluded:false};
 const next={...first,id:'next',record_id:'next-record'};
 let pending=false,finish:((response:Response)=>void)|undefined;
 vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>{
  if(isList(url))return Response.json(list);
  if(pending)return new Promise<Response>(resolve=>{finish=resolve;});
  return Response.json({...detail,canAdminister:true,snapshots:[first,next],selected:first});
 }));
 render(<ReleaseIntelligencePanel workspaceId="workspace" record={record}/>);
 await screen.findByText('Scoped history.');
 fireEvent.click(screen.getByRole('button',{name:'Access & assistance'}));
 expect(screen.getByRole('button',{name:'Grant agent for snapshot'})).toBeTruthy();
 if(action==='selection')fireEvent.click(screen.getByRole('button',{name:'Comparison'}));
 const trigger=screen.getByRole('button',{name:action==='selection'?/Inspect upload next-record/:'Refresh history'});
 await waitFor(()=>expect((trigger as HTMLButtonElement).disabled).toBe(false));pending=true;fireEvent.click(trigger);
 await waitFor(()=>expect(finish).toBeTruthy());
 expect(screen.queryByRole('button',{name:/Grant agent for/,hidden:true})).toBeNull();
 expect(screen.getByLabelText('Refreshing release tools')).toBeTruthy();
 const selected=action==='selection'?next:first;
 finish!(Response.json({...detail,canAdminister:true,snapshots:[first,next],selected}));
 await screen.findByRole('button',{name:`Grant agent for ${selected.id}`,hidden:true});
 fireEvent.click(screen.getByRole('button',{name:'Access & assistance'}));
 expect(screen.getByRole('button',{name:`Grant agent for ${selected.id}`})).toBeTruthy();
 if(action==='selection')expect(screen.queryByRole('button',{name:'Grant agent for snapshot'})).toBeNull();
});


it('keeps all scoped release tools reachable through task navigation without mutating evidence',async()=>{
 const snapshot={id:'snapshot',record_kind:'upload',record_id:'record',scanned_at:'2026-09-09T00:00:00Z',digest:'a'.repeat(64),metrics:{files:1},excluded:false};
 const fetcher=vi.fn(async(url:unknown,_init?:RequestInit)=>Response.json(isList(url)?list:{...detail,canAdminister:true,selected:snapshot,snapshots:[snapshot]}));vi.stubGlobal('fetch',fetcher);
 render(<ReleaseIntelligencePanel workspaceId="workspace" record={record}/>);
 await screen.findByText('Scoped history.');
 const groups=[
  ['Release decisions',['Gate for record']],
  ['Finding reviews',['Finding reviews for record']],
  ['Stream settings',['Automatic capture controls','Production parity controls','Private monthly outcome controls']],
  ['Access & assistance',['Grant agent for snapshot','Optional explanation controls']],
 ] as const;
 for(const [name,contents] of groups){
  fireEvent.click(screen.getByRole('button',{name}));
  expect(screen.getByRole('button',{name}).getAttribute('aria-pressed')).toBe('true');
  for(const text of contents)expect(screen.getByText(text).closest('[hidden]')).toBeNull();
 }
 fireEvent.click(screen.getByRole('button',{name:'Comparison'}));
 expect(screen.getByRole('button',{name:/Inspect upload record/})).toBeTruthy();
 expect(fetcher.mock.calls.every(([,init])=>!(init as RequestInit|undefined)?.method)).toBe(true);
});


it('keeps independently authorized release controls reachable when stream discovery fails',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'History is unavailable.'},{status:503})));
 render(<ReleaseIntelligencePanel workspaceId="workspace" record={record} decisionControls={<button>Current release governance</button>} supportingReview={<button>Inspect independent evidence</button>}/>);
 await screen.findByRole('alert');
 expect(screen.getByRole('button',{name:'Current release governance'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Inspect independent evidence'})).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Gate for record',hidden:true})).toBeNull();
 expect(screen.queryByRole('button',{name:'Create stream and record release',hidden:true})).toBeNull();
});
