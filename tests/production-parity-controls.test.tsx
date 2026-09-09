// @vitest-environment jsdom
import {cleanup,fireEvent,render,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ProductionParityControls} from '../src/components/watch/ProductionParityControls';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const response=(body:unknown)=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
const base={canManage:true,canCancel:true,baselineRevision:2,manifest:[{path:'dist/app.js',size:20}],origins:[{id:12,origin_url:'https://owned.example/'}],runs:[],notice:'Uses the existing scan allowance.'};

it('requires an adopted reference before presenting the request form',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({...base,baselineRevision:null,manifest:[]})));
  const view=render(<ProductionParityControls streamId="stream" refreshVersion={0}/>);
  fireEvent.click(view.getByText('Approved build → production'));
  await view.findByText(/Adopt an eligible signed release/);
  expect(view.queryByRole('button',{name:'Observe production'})).toBeNull();
});

it('sends explicit reference, deployment and file mapping only after confirmation',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(response(base)).mockResolvedValueOnce(response({id:'run',status:'queued'})).mockResolvedValueOnce(response(base));
  vi.stubGlobal('fetch',fetch);
  const view=render(<ProductionParityControls streamId="stream" refreshVersion={0}/>);
  fireEvent.click(view.getByText('Approved build → production'));
  await view.findByRole('button',{name:'Add file mapping'});
  fireEvent.change(view.getByLabelText('Verified website'),{target:{value:'12'}});
  fireEvent.change(view.getByLabelText('Declared deployment ID'),{target:{value:'deploy-42'}});
  fireEvent.change(view.getByLabelText('Declared deployment time (your local time)'),{target:{value:'2026-09-09T01:00'}});
  fireEvent.click(view.getByRole('button',{name:'Add file mapping'}));
  fireEvent.change(view.getByLabelText('Approved file'),{target:{value:'dist/app.js'}});
  fireEvent.change(view.getByLabelText('Exact public path'),{target:{value:'/assets/app.js'}});
  const submit=view.getByRole('button',{name:'Observe production'}) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);fireEvent.click(view.getByRole('checkbox'));expect(submit.disabled).toBe(false);
  fireEvent.click(submit);
  await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(3));
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({expectedBaselineRevision:2,originId:12,deploymentId:'deploy-42',confirm:true,mappings:[{path:'dist/app.js',servedPath:'/assets/app.js',representation:'identity'}]});
});

it('labels prior results historical when authority changes and preserves the recorded mismatch',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({...base,canManage:false,runs:[{id:'r',status:'completed',deployment_id:'deploy',reason:null,authorityCurrent:false,result:{observedAt:'2026-01-01T00:00:00Z',scope:'Bounded observation only.',unmappedManifestFiles:3,assets:[{servedPath:'/app.js',state:'mismatched',reason:'Observed bytes differ.',cache:null}]}}]})));
  const view=render(<ProductionParityControls streamId="stream" refreshVersion={0}/>);
  fireEvent.click(view.getByText('Approved build → production'));
  fireEvent.click(await view.findByText('deploy · completed'));
  expect(view.getByText(/Historical only/)).toBeTruthy();expect(view.getByText('mismatched')).toBeTruthy();expect(view.getByText('3 manifest files were not mapped.')).toBeTruthy();
});

it('explains missing website setup instead of offering an empty observation form',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({...base,origins:[]})));
  const view=render(<ProductionParityControls streamId="stream" refreshVersion={0}/>);
  await view.findByText(/Connect a production website in Coverage/);
  expect(view.queryByRole('button',{name:'Observe production',hidden:true})).toBeNull();
});

it('hides stale observation controls after failed cancellation and can refresh safely',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(response({...base,runs:[{id:'run',status:'queued',deployment_id:'old-deploy',authorityCurrent:true,result:null}]})).mockResolvedValueOnce(new Response(JSON.stringify({error:'Access revoked'}),{status:403})).mockResolvedValueOnce(response({...base,canManage:false,runs:[]}));
  vi.stubGlobal('fetch',fetch);
  const view=render(<ProductionParityControls streamId="stream" refreshVersion={0}/>);
  await view.findByText('old-deploy · queued');
  fireEvent.click(view.getByRole('button',{name:'Cancel observation',hidden:true}));
  await view.findByText('Access revoked');
  expect(view.queryByRole('button',{name:'Observe production',hidden:true})).toBeNull();
  expect(view.queryByText('old-deploy · queued')).toBeNull();
  fireEvent.click(view.getByRole('button',{name:'Refresh production observations',hidden:true}));
  await view.findByText('An administrator with active coverage can request an observation.');
});

it('does not carry deployment drafts or confirmation into another stream',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>response(base)));
  const view=render(<ProductionParityControls streamId="first" refreshVersion={0}/>);
  await view.findByText(base.notice);
  fireEvent.change(view.getByLabelText('Declared deployment ID'),{target:{value:'first-deployment'}});
  fireEvent.click(view.getByRole('checkbox',{hidden:true}));
  view.rerender(<ProductionParityControls streamId="second" refreshVersion={0}/>);
  await view.findByText(base.notice);
  expect((view.getByLabelText('Declared deployment ID') as HTMLInputElement).value).toBe('');
  expect((view.getByRole('checkbox',{hidden:true}) as HTMLInputElement).checked).toBe(false);
});
