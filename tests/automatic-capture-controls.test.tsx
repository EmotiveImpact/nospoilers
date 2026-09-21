// @vitest-environment jsdom
import {cleanup,fireEvent,render,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {AutomaticCaptureControls} from '../src/components/watch/AutomaticCaptureControls';

afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const record={kind:'release' as const,id:'1'};
const state={config:null,candidate:{selector:'github:acme/app#app.tgz',channel:'stable',format:'scan:tgz'},canManage:true,canDisable:true,notice:'Only this exact selection.',attempts:[]};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

it('requires explicit confirmation and a reason, then submits the exact record and revision',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(json(state)).mockResolvedValueOnce(json({enabled:true,revision:1})).mockResolvedValueOnce(json({...state,config:{enabled:true,revision:1,selector:state.candidate.selector}}));
  vi.stubGlobal('fetch',fetch);
  const view=render(<AutomaticCaptureControls streamId="stream" record={record}/>);
  fireEvent.click(view.getByText('Automatic history capture · Checking'));
  const button=await view.findByRole('button',{name:'Enable automatic capture'});
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(view.getByLabelText('Reason for capture change'),{target:{value:'Capture our approved artifact history.'}});
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(view.getByRole('checkbox'));
  fireEvent.click(button);
  await view.findByRole('button',{name:'Disable automatic capture'});
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({enabled:true,expectedRevision:0,record,confirm:true,reason:'Capture our approved artifact history.'});
  expect(view.container.querySelector('details')?.open).toBe(true);
});

it('shows a recoverable error without pretending the request is still loading',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(json({error:'Access changed.'},403)).mockResolvedValueOnce(json(state));
  vi.stubGlobal('fetch',fetch);
  const view=render(<AutomaticCaptureControls streamId="stream" record={record}/>);
  fireEvent.click(view.getByText('Automatic history capture · Checking'));
  await view.findByRole('alert');
  expect(view.queryByText('Reading capture settings…')).toBeNull();
  fireEvent.click(view.getByRole('button',{name:'Reload capture settings'}));
  await view.findByRole('button',{name:'Enable automatic capture'});
  expect(view.queryByRole('alert')).toBeNull();
});

it('allows an administrator to disable an existing rule without active enable permission or a candidate',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(json({...state,config:{enabled:true,revision:4,selector:'github:acme/app#app.tgz'},candidate:null,canManage:false})).mockResolvedValueOnce(json({enabled:false,revision:5})).mockResolvedValueOnce(json({...state,canManage:false,candidate:null,config:{enabled:false,revision:5,selector:'github:acme/app#app.tgz'}}));
  vi.stubGlobal('fetch',fetch);
  const view=render(<AutomaticCaptureControls streamId="stream" record={record}/>);
  fireEvent.click(view.getByText('Automatic history capture · Checking'));
  const button=await view.findByRole('button',{name:'Disable automatic capture'});
  expect(view.queryByRole('checkbox')).toBeNull();
  fireEvent.change(view.getByLabelText('Reason for capture change'),{target:{value:'Stop capturing future history.'}});
  fireEvent.click(button);
  await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(3));
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({enabled:false,expectedRevision:4});
});
