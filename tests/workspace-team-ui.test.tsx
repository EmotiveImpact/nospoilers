// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {WorkspaceTeam,WorkspaceInvitationInbox} from '../src/components/watch/WorkspaceTeam';
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},'','/');});
const team={role:'owner',archived:false,members:[{user_id:'owner',login:'Owner',role:'owner',access_source:'explicit'}],invites:[],events:[]};
it('submits an explicit viewer invitation through the visible form',async()=>{
  const fetcher=vi.fn(async(_url:string,options?:RequestInit)=>new Response(JSON.stringify(options?.method?{}:team)));
  vi.stubGlobal('fetch',fetcher);render(<WorkspaceTeam workspaceId="w1"/>);
  fireEvent.change(await screen.findByLabelText('Account name'),{target:{value:'teammate'}});
  fireEvent.click(screen.getByRole('button',{name:'Send invitation'}));
  await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/api/workspaces/w1/invitations',expect.objectContaining({method:'POST',body:JSON.stringify({login:'teammate',role:'viewer'})})));
});
it('does not offer invitations or role writes to a viewer',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({...team,role:'viewer'}))));
  render(<WorkspaceTeam workspaceId="w1"/>);await screen.findByRole('heading',{name:'Owner'});
  expect(screen.queryByRole('button',{name:'Send invitation'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Remove Owner'})).toBeNull();
});
it('handles malformed invitation responses without crashing the workspace screen',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}')));
  render(<WorkspaceInvitationInbox/>);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Retry invitations'})).toBeTruthy();
});
it('requires an explicit acceptance action and navigates only after the API succeeds',async()=>{
  const fetcher=vi.fn(async(_url:string,options?:RequestInit)=>new Response(JSON.stringify(options?.method?{workspaceId:'w1'}:{invites:[{id:'i1',workspace_name:'Production',invited_by:'Owner',role:'viewer',expires_at:'2026-09-10'}]})));
  vi.stubGlobal('fetch',fetcher);render(<WorkspaceInvitationInbox/>);
  const accept=await screen.findByRole('button',{name:'Accept invitation to Production'});
  expect(fetcher.mock.calls.some(([,options])=>options?.method==='POST')).toBe(false);
  fireEvent.click(accept);
  await waitFor(()=>expect(window.location.pathname+window.location.search).toBe('/watch?workspace=w1'));
});
