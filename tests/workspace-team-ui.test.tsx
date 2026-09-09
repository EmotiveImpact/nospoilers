// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {WorkspaceTeam,WorkspaceInvitationInbox} from '../src/components/watch/WorkspaceTeam';
class TestResizeObserver {observe(){} unobserve(){} disconnect(){}}
beforeEach(()=>vi.stubGlobal('ResizeObserver',TestResizeObserver));
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},'','/');});
const team={role:'owner',archived:false,members:[{user_id:'owner',login:'Owner',role:'owner',access_source:'explicit'}],invites:[],events:[]};
const inbox={invites:[{id:'i1',workspace_name:'Production',invited_by:'Owner',role:'viewer',expires_at:'2026-09-10'}]};
it('distinguishes loading invitations from a confirmed empty inbox',async()=>{
 let finish!:(value:Response)=>void;const pending=new Promise<Response>(resolve=>{finish=resolve;});
 vi.stubGlobal('fetch',vi.fn(()=>pending));render(<WorkspaceInvitationInbox/>);
 expect(screen.getByRole('status').textContent).toContain('Loading workspace invitations');
 expect(screen.queryByText('No pending workspace invitations.')).toBeNull();
 await act(async()=>{finish(Response.json({invites:[]}));await pending;});
 expect(screen.getByText('No pending workspace invitations.')).toBeTruthy();
 expect(screen.queryByRole('status')).toBeNull();
});
it.each([404,409,410])('removes an unavailable invitation after response %s',async status=>{
 vi.stubGlobal('fetch',vi.fn(async(_url,options)=>options?.method?Response.json({error:'Invitation expired.'},{status}):Response.json(inbox)));
 render(<WorkspaceInvitationInbox/>);
 fireEvent.click(await screen.findByRole('button',{name:'Accept invitation to Production'}));
 await screen.findByText('Invitation expired.');
 expect(screen.queryByRole('button',{name:'Accept invitation to Production'})).toBeNull();
 expect(window.location.pathname).toBe('/');
});
it('does not navigate for an incomplete acceptance response',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(_url,options)=>Response.json(options?.method?{}:inbox)));
 render(<WorkspaceInvitationInbox/>);
 fireEvent.click(await screen.findByRole('button',{name:'Accept invitation to Production'}));
 await screen.findByText('The server did not confirm a workspace. Refresh invitations before trying again.');
 expect(window.location.pathname).toBe('/');
});
it('ignores a completed acceptance after leaving the inbox',async()=>{
 let finish!:(value:Response)=>void;const pending=new Promise<Response>(resolve=>{finish=resolve;});
 vi.stubGlobal('fetch',vi.fn((_url,options)=>options?.method?pending:Promise.resolve(Response.json(inbox))));
 const view=render(<WorkspaceInvitationInbox/>);
 fireEvent.click(await screen.findByRole('button',{name:'Accept invitation to Production'}));view.unmount();
 await act(async()=>{finish(Response.json({workspaceId:'w1'}));await pending;});
 expect(window.location.pathname).toBe('/');
});
it('removes team controls after a denied write and reloads current permissions on retry',async()=>{
 let denied=false;
 vi.stubGlobal('fetch',vi.fn(async(_url:string,options?:RequestInit)=>{
  if(options?.method){denied=true;return Response.json({error:'Access changed.'},{status:403});}
  return Response.json({...team,role:denied?'viewer':'owner'});
 }));
 render(<WorkspaceTeam workspaceId="w1"/>);
 fireEvent.change(await screen.findByLabelText('Account name'),{target:{value:'teammate'}});
 fireEvent.click(screen.getByRole('button',{name:'Send invitation'}));
 await screen.findByText('Access changed.');
 expect(screen.queryByRole('button',{name:'Send invitation'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Retry'}));
 await screen.findByRole('heading',{name:'Owner'});
 expect(screen.queryByRole('button',{name:'Send invitation'})).toBeNull();
});
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

it('limits administrator role choices and keeps role selection separate from saving',async()=>{
 const fetcher=vi.fn(async()=>Response.json({...team,role:'admin',members:[{user_id:'reader',login:'Reader',role:'viewer',access_source:'explicit'}]}));
 vi.stubGlobal('fetch',fetcher);render(<WorkspaceTeam workspaceId="w1"/>);
 fireEvent.click(await screen.findByRole('combobox',{name:'Role for Reader'}));
 expect(screen.queryByRole('option',{name:'Admin',exact:true})).toBeNull();
 expect(screen.queryByRole('option',{name:'Owner',exact:true})).toBeNull();
 fireEvent.click(screen.getByRole('option',{name:'Member',exact:true}));
 expect(screen.getByRole('button',{name:'Save role for Reader'})).toHaveProperty('disabled',false);
 expect(fetcher).toHaveBeenCalledTimes(1);
});
