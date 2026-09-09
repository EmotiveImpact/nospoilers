// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {AgentAccessControls} from '../src/components/watch/AgentAccessControls';

afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
const view={canCreate:true,notice:'Private agent access.',grants:[{id:'grant',name:'Review agent',proposals:true,expires_at:'2030-01-01T00:00:00Z',expired:false,revoked_at:null,calls:0}],proposals:[{id:'draft',name:'Review agent',note:'Check the original signed evidence.',state:'pending',finding:'MAP-001',reviewed_note:null,reviewer:null}],calls:[]};
const secret=`nsa_${'a'.repeat(8)}-${'b'.repeat(4)}-${'c'.repeat(4)}-${'d'.repeat(4)}-${'e'.repeat(12)}.${'f'.repeat(64)}`;

it('removes stale privileged controls after agent access is denied during a mutation',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>init?.method==='POST'?Response.json({error:'Workspace access revoked.'},{status:403}):Response.json(view)));
  render(<AgentAccessControls streamId="stream" snapshotId="snapshot"/>);
  await screen.findByText('Private agent access.');
  fireEvent.click(screen.getByRole('button',{name:'Revoke Review agent',hidden:true}));
  await screen.findByText('Workspace access revoked.');
  expect(screen.queryByRole('button',{name:'Create short-lived agent access',hidden:true})).toBeNull();
  expect(screen.queryByRole('button',{name:'Accept reviewed note',hidden:true})).toBeNull();
  expect(screen.queryByRole('button',{name:'Revoke Review agent',hidden:true})).toBeNull();
});

it('discards the one-time credential after a later denied mutation and refresh',async()=>{
  let posts=0;
  vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>{
    if(init?.method==='POST')return ++posts===1?Response.json({token:secret}):Response.json({error:'Workspace access revoked.'},{status:403});
    return Response.json(view);
  }));
  render(<AgentAccessControls streamId="stream" snapshotId="snapshot"/>);
  await screen.findByText('Private agent access.');
  fireEvent.change(screen.getByLabelText('Agent name'),{target:{value:'Review agent'}});
  fireEvent.click(screen.getByLabelText(/I authorize my chosen agent/));
  fireEvent.click(screen.getByRole('button',{name:'Create short-lived agent access',hidden:true}));
  await screen.findByLabelText('New agent credential');
  fireEvent.click(screen.getByRole('button',{name:'Revoke Review agent',hidden:true}));
  await screen.findByText('Workspace access revoked.');
  expect(screen.queryByLabelText('New agent credential')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Refresh agent activity',hidden:true}));
  await waitFor(()=>expect(screen.queryByText('Workspace access revoked.')).toBeNull());
  expect(screen.queryByLabelText('New agent credential')).toBeNull();
});
