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
