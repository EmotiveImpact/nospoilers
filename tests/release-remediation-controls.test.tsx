// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {ReleaseRemediationControls} from '../src/components/watch/ReleaseRemediationControls';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const view={cases:[{id:'case',finding:'map',revision:2,original_snapshot:'original'}],selected:{id:'case',finding:'map',revision:2,original_snapshot:'original',history:[{id:'review',action:'review',actor_login:'reviewer',created_at:new Date().toISOString(),detail:{commit:'a'.repeat(40),reason:'Reviewed change'}}],observation:null,unavailable:false},current:{snapshotId:'original',findings:['map']},canWrite:true,notice:'Scoped remediation only.'};
it('keeps reviewed-change and rebuilt-artifact confirmations separate',async()=>{
  const fetch=vi.fn(async(_url:unknown,init?:RequestInit)=>Response.json(init?.method==='POST'?{caseId:'case',revision:3}:view));vi.stubGlobal('fetch',fetch);
  render(<ReleaseRemediationControls streamId="stream" workspaceId="workspace" record={{kind:'upload',id:'upload'}} snapshots={[{id:'rebuilt',scanned_at:new Date().toISOString(),digest:'b'.repeat(64),record_kind:'upload',record_id:'rebuilt'} as never]}/>);
  await screen.findByText('Scoped remediation only.');
  fireEvent.change(screen.getByLabelText('Remediation note (no secrets)'),{target:{value:'Verify the rebuilt artifact after review.'}});
  fireEvent.change(screen.getByLabelText('Rebuilt artifact'),{target:{value:'rebuilt'}});
  fireEvent.click(screen.getByLabelText(/I reviewed this change/));
  const verify=screen.getByRole('button',{name:'Verify selected rebuild',hidden:true});expect((verify as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText(/I confirm this rebuilt artifact/));fireEvent.click(verify);
  await waitFor(()=>expect(fetch.mock.calls.some(([,init])=>init?.method==='POST')).toBe(true));
  expect(JSON.parse(String(fetch.mock.calls.find(([,init])=>init?.method==='POST')![1]!.body))).toMatchObject({action:'verify',confirm:true,candidateSnapshot:'rebuilt',expectedRevision:2});
});
it('shows unavailable evidence without a resolved claim or write controls',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...view,canWrite:false,selected:{...view.selected,unavailable:true}})));
  render(<ReleaseRemediationControls streamId="stream" workspaceId="workspace" record={{kind:'upload',id:'upload'}} snapshots={[]}/>);
  await screen.findByText('Linked evidence is unavailable; no current resolution is inferred.');
  expect(screen.queryByRole('button',{name:'Verify selected rebuild',hidden:true})).toBeNull();
});

it('hides stale remediation actions and evidence after a rejected mutation',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>init?.method==='POST'?Response.json({error:'Access revoked'},{status:403}):Response.json(view)));
  render(<ReleaseRemediationControls streamId="stream" workspaceId="workspace" record={{kind:'upload',id:'upload'}} snapshots={[]}/>);
  await screen.findByText(view.notice);
  fireEvent.change(screen.getByLabelText('Remediation note (no secrets)'),{target:{value:'Investigate this recorded finding.'}});
  fireEvent.click(screen.getByRole('button',{name:'Add investigation note',hidden:true}));
  await screen.findByText('Access revoked');
  expect(screen.queryByRole('button',{name:'Add investigation note',hidden:true})).toBeNull();
  expect(screen.queryByText('Original finding')).toBeNull();
});

it('resets private drafts and consent when the record changes',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(view)));
  const component=render(<ReleaseRemediationControls streamId="stream" workspaceId="workspace" record={{kind:'upload',id:'first'}} snapshots={[]}/>);
  await screen.findByText(view.notice);
  fireEvent.change(screen.getByLabelText('Remediation note (no secrets)'),{target:{value:'Private first record note.'}});
  fireEvent.click(screen.getByLabelText(/I reviewed this change/));
  component.rerender(<ReleaseRemediationControls streamId="stream" workspaceId="workspace" record={{kind:'upload',id:'second'}} snapshots={[]}/>);
  await screen.findByText(view.notice);
  expect((screen.getByLabelText('Remediation note (no secrets)') as HTMLTextAreaElement).value).toBe('');
  expect((screen.getByLabelText(/I reviewed this change/) as HTMLInputElement).checked).toBe(false);
});

it('explains why the selected release has no new investigation action',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...view,current:null})));
  render(<ReleaseRemediationControls streamId="stream" workspaceId="workspace" record={{kind:'upload',id:'upload'}} snapshots={[]}/>);
  await screen.findByText(/Record this release in the selected stream/);
  expect(screen.queryByRole('button',{name:'Start investigation',hidden:true})).toBeNull();
  expect(screen.getByText('Original finding')).toBeTruthy();
});
