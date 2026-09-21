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
  expect(screen.queryByRole('heading',{name:'Remediation case · map'})).toBeNull();
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
  expect(screen.getByRole('heading',{name:'Original finding'})).toBeTruthy();
});
const otherCase={id:'second-case',finding:'secret',revision:1,original_snapshot:'second-original'};
const multipleCases={...view,cases:[...view.cases,otherCase]};
function selectOtherCase(){
 const selector=screen.getByLabelText('Remediation case');selector.focus();
 fireEvent.change(selector,{target:{value:otherCase.id}});
}
it('continues keyboard focus at the requested case after its selector is replaced',async()=>{
 let finish!:(response:Response)=>void;
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json(multipleCases)).mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve;}));vi.stubGlobal('fetch',fetcher);
 render(<ReleaseRemediationControls streamId="stream" workspaceId="workspace" record={{kind:'upload',id:'upload'}} snapshots={[]}/>);
 await screen.findByText(view.notice);selectOtherCase();
 expect(screen.queryByLabelText('Remediation case')).toBeNull();
 expect(screen.getByRole('status',{name:'Reading remediation evidence'})).toBeTruthy();
 expect(String(fetcher.mock.calls[1][0])).toContain('caseId=second-case');
 expect(String(fetcher.mock.calls[1][0])).toContain('recordId=upload');
 finish(Response.json({...multipleCases,selected:{...view.selected,...otherCase}}));
 const heading=await screen.findByRole('heading',{name:'Remediation case · secret'});
 await waitFor(()=>expect(document.activeElement).toBe(heading));
 expect((screen.getByLabelText('Remediation case') as HTMLSelectElement).value).toBe(otherCase.id);
});
it('continues keyboard focus at the error when loading the selected case fails',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json(multipleCases)).mockResolvedValueOnce(Response.json({error:'Case access was removed.'},{status:403})));
 render(<ReleaseRemediationControls streamId="stream" workspaceId="workspace" record={{kind:'upload',id:'upload'}} snapshots={[]}/>);
 await screen.findByText(view.notice);selectOtherCase();
 const error=await screen.findByRole('alert');await waitFor(()=>expect(document.activeElement).toBe(error));
 expect(screen.queryByLabelText('Remediation case')).toBeNull();
});
it('keeps deliberate outside focus when the selected case finishes loading',async()=>{
 let finish!:(response:Response)=>void;
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json(multipleCases)).mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve;})));
 render(<><button>Elsewhere</button><ReleaseRemediationControls streamId="stream" workspaceId="workspace" record={{kind:'upload',id:'upload'}} snapshots={[]}/></>);
 await screen.findByText(view.notice);selectOtherCase();const outside=screen.getByRole('button',{name:'Elsewhere'});outside.focus();
 finish(Response.json({...multipleCases,selected:{...view.selected,...otherCase}}));
 await screen.findByRole('heading',{name:'Remediation case · secret'});expect(document.activeElement).toBe(outside);
});
it('abandons pending case focus and data when the record scope changes',async()=>{
 let finish!:(response:Response)=>void;let signal:AbortSignal|undefined;
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json(multipleCases)).mockImplementationOnce((_url:unknown,init:RequestInit)=>{signal=init.signal as AbortSignal;return new Promise<Response>(resolve=>{finish=resolve;});}).mockResolvedValueOnce(Response.json({...view,notice:'New record context.'})));
 const component=render(<><button>Elsewhere</button><ReleaseRemediationControls streamId="stream" workspaceId="workspace" record={{kind:'upload',id:'upload'}} snapshots={[]}/></>);
 await screen.findByText(view.notice);selectOtherCase();const outside=screen.getByRole('button',{name:'Elsewhere'});outside.focus();
 component.rerender(<><button>Elsewhere</button><ReleaseRemediationControls streamId="stream" workspaceId="workspace" record={{kind:'upload',id:'new-upload'}} snapshots={[]}/></>);
 await screen.findByText('New record context.');expect(signal?.aborted).toBe(true);
 finish(Response.json({...multipleCases,selected:{...view.selected,...otherCase}}));
 await waitFor(()=>expect(screen.queryByText('Remediation case · secret')).toBeNull());
 expect(document.activeElement).toBe(outside);
});

it('takes review and rebuild users directly to their required note without saving',async()=>{
 const fetcher=vi.fn(async()=>Response.json(view));vi.stubGlobal('fetch',fetcher);
 render(<ReleaseRemediationControls streamId="stream" workspaceId="workspace" record={{kind:'upload',id:'upload'}} snapshots={[]}/>);
 await screen.findByText('Scoped remediation only.');
 expect(screen.getByRole('heading',{name:'Record a human-reviewed change'}).closest('details')).toBeNull();
 expect(screen.getByRole('heading',{name:'Check a rebuilt artifact'}).closest('details')).toBeNull();
 const note=screen.getByLabelText('Remediation note (no secrets)');
 for(const button of screen.getAllByRole('button',{name:'Add required note'})){
  button.focus();fireEvent.click(button);expect(document.activeElement).toBe(note);
 }
 expect(document.getElementById(note.getAttribute('aria-describedby')!)).toHaveProperty('textContent',expect.stringContaining('at least 8 characters'));
 expect(fetcher).toHaveBeenCalledTimes(1);
 fireEvent.change(note,{target:{value:'Reviewed the original signed finding.'}});
 expect(screen.queryByRole('button',{name:'Add required note'})).toBeNull();
});

it('shows finding, reviewed change and rebuilt evidence as one visible three-step workflow',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json(view)));
 render(<ReleaseRemediationControls streamId="stream" workspaceId="workspace" record={{kind:'upload',id:'upload'}} snapshots={[]}/>);
 await screen.findByText('Scoped remediation only.');
 const progress=screen.getByRole('list',{name:'Remediation progress'});
 expect(progress.textContent).toContain('Original finding');
 expect(progress.textContent).toContain('Reviewed change');
 expect(progress.textContent).toContain('Rebuilt evidence');
 expect(screen.getByRole('heading',{name:'Original finding'})).toBeTruthy();
 expect(screen.getByRole('heading',{name:'Record a human-reviewed change'})).toBeTruthy();
 expect(screen.getByRole('heading',{name:'Check a rebuilt artifact'})).toBeTruthy();
 expect(screen.getByText('Linked evidence and technical activity').closest('details')).toBeTruthy();
});
