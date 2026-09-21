// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {ReleaseOutcomeControls} from '../src/components/watch/ReleaseOutcomeControls';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
const month=new Date().toISOString().slice(0,7);
const summary={type:'nospoilers-private-outcomes',signed:false,scope:{workspaceId:'workspace',streamId:'stream'},window:{month,start:`${month}-01`,through:'now'},generatedAt:'now',records:{retainedInMonth:0,verified:0,distinctArtifacts:0,repeatChecks:0,passed:0,failedPolicy:0,inconclusive:0,unavailable:0,withSuppression:0,held:0,excluded:0},latest:null,reference:{state:'not_adopted',revision:0,adoptedInMonth:0,revokedInMonth:0},remediation:{verifiedAbsent:0,stillObserved:0,unknown:0,awaitingRebuild:0,inspected:0,retainedCases:0},events:[],eventsPartial:false};
it('requires opt-in and offers one-step opt-out without changing original evidence',async()=>{
  let enabled=false,revision=0;const fetch=vi.fn(async(_url:unknown,init?:RequestInit)=>{if(init?.method==='POST'){enabled=JSON.parse(String(init.body)).enabled;revision++;return Response.json({enabled,revision});}return Response.json({enabled,revision,canConfigure:true,notice:'Private only.',summary:enabled?summary:null});});vi.stubGlobal('fetch',fetch);
  render(<ReleaseOutcomeControls streamId="stream" workspaceId="workspace"/>);
  await screen.findByText('Private only.');
  const enable=screen.getByRole('button',{name:'Enable private outcomes',hidden:true}) as HTMLButtonElement;expect(enable.disabled).toBe(true);
  fireEvent.click(screen.getByLabelText(/Enable private summaries/));fireEvent.click(enable);
  await screen.findByText('No retained recorded scans in this month. This does not mean no releases happened, or that everything was covered.');
  fireEvent.click(screen.getByRole('button',{name:'Turn off outcome summaries',hidden:true}));
  await waitFor(()=>expect(fetch.mock.calls.filter(([,i])=>i?.method==='POST')).toHaveLength(2));
  expect(JSON.parse(String(fetch.mock.calls.filter(([,i])=>i?.method==='POST')[1][1]!.body))).toMatchObject({enabled:false,confirm:true,expectedRevision:1});
});
it('refetches before export and refuses a revoked or unavailable summary',async()=>{
  let reads=0;const fetch=vi.fn(async()=>Response.json(++reads===1?{enabled:true,revision:1,canConfigure:false,notice:'Private only.',summary}:{enabled:false,revision:2,canConfigure:false,summary:null}));vi.stubGlobal('fetch',fetch);
  const create=vi.fn();vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:create,revokeObjectURL:vi.fn()}));
  render(<ReleaseOutcomeControls streamId="stream" workspaceId="workspace"/>);await screen.findByText('Private only.');
  fireEvent.click(screen.getByRole('button',{name:'Export private outcome summary',hidden:true}));
  await screen.findByText('A current authorized outcome summary is unavailable. Refresh before exporting.');expect(create).not.toHaveBeenCalled();expect(fetch).toHaveBeenCalledTimes(2);
});
it('rejects a response belonging to another workspace',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({enabled:true,revision:1,summary:{...summary,scope:{workspaceId:'foreign',streamId:'stream'}}})));
  render(<ReleaseOutcomeControls streamId="stream" workspaceId="workspace"/>);await screen.findByText('Outcome summary scope was not confirmed.');expect(screen.queryByText(/recorded release outcomes/)).toBeNull();
});
it('keeps the selected month fixed until its export finishes',async()=>{
  let finishExport!:(response:Response)=>void;
  const body={enabled:true,revision:1,canConfigure:false,notice:'Private only.',summary};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json(body)).mockImplementationOnce(()=>new Promise<Response>(resolve=>{finishExport=resolve;})));
  const create=vi.fn(()=> 'blob:private-outcomes');
  vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:create,revokeObjectURL:vi.fn()}));
  vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>undefined);
  render(<ReleaseOutcomeControls streamId="stream" workspaceId="workspace"/>);
  await screen.findByText('Private only.');
  fireEvent.click(screen.getByRole('button',{name:'Export private outcome summary',hidden:true}));
  const picker=screen.getByLabelText('Summary month (UTC)') as HTMLInputElement;
  expect(picker.disabled).toBe(true);
  expect(picker.value).toBe(month);
  finishExport(Response.json(body));
  await screen.findByText('Private unsigned summary downloaded. Nothing was published or sent.');
  expect(picker.disabled).toBe(false);
  expect(create).toHaveBeenCalledTimes(1);
});
it.each([false,true])('recovers a removed outcome action without stealing outside focus=%s',async outside=>{
 let finish!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn((_url:unknown,init?:RequestInit)=>init?.method==='POST'?new Promise<Response>(resolve=>{finish=resolve;}):Promise.resolve(Response.json({enabled:false,revision:0,canConfigure:true,notice:'Private only.',summary:null}))));
 render(<><button>Outside</button><ReleaseOutcomeControls streamId="stream" workspaceId="workspace"/></>);
 fireEvent.click(screen.getByText('Monthly outcomes · private'));
 await waitFor(()=>expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes('?month='))).toBe(true));
 await screen.findByLabelText(/Enable private summaries/);
 fireEvent.click(screen.getByLabelText(/Enable private summaries/));const trigger=screen.getByRole('button',{name:'Enable private outcomes'});trigger.focus();await userEvent.keyboard('{Enter}');
 if(outside)screen.getByRole('button',{name:'Outside'}).focus();finish(Response.json({error:'Rejected'},{status:403}));
 const error=await screen.findByRole('alert');await waitFor(()=>expect(document.activeElement).toBe(outside?screen.getByRole('button',{name:'Outside'}):error));
 expect(screen.queryByRole('button',{name:'Enable private outcomes'})).toBeNull();
});
it('focuses successful opt-in status when its invoking form is replaced',async()=>{
 vi.stubGlobal('fetch',vi.fn((_url:unknown,init?:RequestInit)=>init?.method==='POST'?Promise.resolve(Response.json({enabled:true,revision:1})):Promise.resolve(Response.json({enabled:false,revision:0,canConfigure:true,notice:'Private only.',summary:null}))));
 render(<ReleaseOutcomeControls streamId="stream" workspaceId="workspace"/>);fireEvent.click(screen.getByText('Monthly outcomes · private'));
 await waitFor(()=>expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes('?month='))).toBe(true));
 await screen.findByLabelText(/Enable private summaries/);
 fireEvent.click(screen.getByLabelText(/Enable private summaries/));screen.getByRole('button',{name:'Enable private outcomes'}).focus();await userEvent.keyboard('{Enter}');
 const status=await screen.findByText(/Private outcome summaries enabled/);await waitFor(()=>expect(document.activeElement).toBe(status));
});
it('does not autofocus an initial outcomes read failure',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'Unavailable'},{status:503})));
 render(<><button>Outside</button><ReleaseOutcomeControls streamId="stream" workspaceId="workspace"/></>);fireEvent.click(screen.getByText('Monthly outcomes · private'));
 const outside=screen.getByRole('button',{name:'Outside'});outside.focus();await screen.findByRole('alert');expect(document.activeElement).toBe(outside);
});
