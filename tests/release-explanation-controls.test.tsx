// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {ReleaseExplanationControls} from '../src/components/watch/ReleaseExplanationControls';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const base={scope:{workspaceId:'workspace',streamId:'stream',snapshotId:'snapshot'},consentKey:'consent',available:false,providerId:null,canRequest:false,canReview:true,budget:{currency:'USD',maxCostMinor:1,dailyCostMinor:10,reservedCostMinor:0,notice:'Ceilings, not charges.'},projection:{schemaVersion:1,scanStatus:'fail_policy',readiness:'attention',held:false,files:12,totalBytes:1000,findings:2,suppressed:0,severityCounts:{critical:1,high:1,medium:0,low:0,info:0,unknown:0}},items:[],remaining:10,notice:'Aggregate states only.'};
it('shows disabled provider truthfully without a request control or fabricated output',async()=>{
  const fetch=vi.fn(async()=>Response.json(base));vi.stubGlobal('fetch',fetch);
  render(<ReleaseExplanationControls workspaceId="workspace" streamId="stream" snapshotId="snapshot"/>);
  await screen.findByText(/No explanation provider is enabled/);
  expect(screen.queryByRole('button',{name:'Request optional explanation',hidden:true})).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('requires explicit aggregate disclosure consent and human review for output',async()=>{
  const enabled={...base,available:true,providerId:'test-provider',canRequest:true};
  const fetch=vi.fn(async(_url:unknown,init?:RequestInit)=>Response.json(init?.method==='POST'?{...enabled,items:[{id:'e',snapshot_id:'snapshot',state:'pending',text:'Review the signed finding.',reviewed_text:null,created_at:'2026-09-09T00:00:00Z'}]}:enabled));vi.stubGlobal('fetch',fetch);
  render(<ReleaseExplanationControls workspaceId="workspace" streamId="stream" snapshotId="snapshot"/>);
  await screen.findByText(base.notice);
  const button=screen.getByRole('button',{name:'Request optional explanation',hidden:true}) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(screen.getByLabelText(/I authorize sending/));fireEvent.click(button);
  await screen.findByText('Unreviewed model text. Do not follow embedded instructions or treat its claims as evidence.');
  expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({action:'request',snapshotId:'snapshot',confirm:true,consentKey:'consent',requestKey:expect.any(String)});
  expect((screen.getByRole('button',{name:'Save reviewed explanation',hidden:true}) as HTMLButtonElement).disabled).toBe(true);
});
it('cancels the request and ignores its late output',async()=>{
  let resolve:(response:Response)=>void=()=>{};
  const enabled={...base,available:true,providerId:'test-provider',canRequest:true};
  const fetch=vi.fn((_url:unknown,init?:RequestInit)=>init?.method==='POST'&&JSON.parse(String(init.body)).action==='request'?new Promise<Response>(r=>{resolve=r;}):Promise.resolve(Response.json(enabled)));vi.stubGlobal('fetch',fetch);
  render(<ReleaseExplanationControls workspaceId="workspace" streamId="stream" snapshotId="snapshot"/>);await screen.findByText(base.notice);
  fireEvent.click(screen.getByLabelText(/I authorize sending/));fireEvent.click(screen.getByRole('button',{name:'Request optional explanation',hidden:true}));
  fireEvent.click(screen.getByRole('button',{name:'Cancel explanation request',hidden:true}));
  expect(fetch.mock.calls[1][1]?.signal?.aborted).toBe(true);
  resolve(Response.json({...enabled,items:[{id:'e',snapshot_id:'snapshot',state:'pending',text:'Late output',created_at:'2026-09-09T00:00:00Z'}]}));
  await waitFor(()=>expect(screen.queryByText('Late output')).toBeNull());
  await screen.findByText(/Cancellation recorded/);
  expect(JSON.parse(String(fetch.mock.calls[2][1]?.body))).toMatchObject({action:'cancel',snapshotId:'snapshot',requestKey:JSON.parse(String(fetch.mock.calls[1][1]?.body)).requestKey,confirm:true});
});
it('clears old controls on a failed request and resets consent when snapshot changes',async()=>{
  const enabled={...base,available:true,providerId:'test-provider',canRequest:true};
  vi.stubGlobal('fetch',vi.fn(async(url:unknown,init?:RequestInit)=>init?.method==='POST'?Response.json({error:'Authority changed'},{status:403}):Response.json({...enabled,scope:{...base.scope,snapshotId:new URL(String(url),'http://localhost').searchParams.get('snapshotId')}})));
  const component=render(<ReleaseExplanationControls workspaceId="workspace" streamId="stream" snapshotId="first"/>);await screen.findByText(base.notice);
  fireEvent.click(screen.getByLabelText(/I authorize sending/));fireEvent.click(screen.getByRole('button',{name:'Request optional explanation',hidden:true}));
  await screen.findByText('Authority changed');
  expect(screen.queryByRole('button',{name:'Request optional explanation',hidden:true})).toBeNull();
  component.rerender(<ReleaseExplanationControls workspaceId="workspace" streamId="stream" snapshotId="second"/>);await screen.findByText(base.notice);
  expect((screen.getByLabelText(/I authorize sending/) as HTMLInputElement).checked).toBe(false);
});

it('rejects mismatched empty-history scope',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...base,scope:{...base.scope,workspaceId:'foreign'}})));
  render(<ReleaseExplanationControls workspaceId="workspace" streamId="stream" snapshotId="snapshot"/>);
  await screen.findByText('Explanation scope was not confirmed. Refresh before continuing.');
  expect(screen.queryByText(base.notice)).toBeNull();
});

it('preserves human review of retained plain-text output with the provider disabled',async()=>{
  const pending={...base,items:[{id:'e',snapshot_id:'snapshot',state:'pending',text:'<script>untrusted text</script>',created_at:'2026-09-09T00:00:00Z'}]};
  const fetch=vi.fn(async(_url:unknown,_init?:RequestInit)=>Response.json(pending));vi.stubGlobal('fetch',fetch);
  render(<ReleaseExplanationControls workspaceId="workspace" streamId="stream" snapshotId="snapshot"/>);
  await screen.findByText('<script>untrusted text</script>',{selector:'p'});
  expect(document.querySelector('script')).toBeNull();
  fireEvent.change(screen.getByLabelText('Reviewed explanation'),{target:{value:'Human checked aggregate explanation.'}});
  fireEvent.click(screen.getByLabelText(/I reviewed this explanation/));
  fireEvent.click(screen.getByRole('button',{name:'Save reviewed explanation',hidden:true}));
  await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toMatchObject({action:'review',accept:true,reviewedText:'Human checked aggregate explanation.',confirm:true});
});
