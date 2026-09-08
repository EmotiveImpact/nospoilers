// @vitest-environment jsdom
import {render,screen,cleanup,fireEvent,waitFor,act} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {WorkspaceWebsites} from '../src/components/watch/WorkspaceWebsites';
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
it('does not restore stale inventory when an older poll finishes after denied mutation',async()=>{
 vi.useFakeTimers();let reads=0;let finish!:(value:Response)=>void;
 const oldPoll=new Promise<Response>(resolve=>{finish=resolve;});
 const inventory={origins:[{id:1,host:'example.com',origin_url:'https://example.com/',verified_at:'2026-09-05'}]};
 vi.stubGlobal('fetch',vi.fn((_url,options)=>{
  if(options?.method==='POST')return Promise.resolve(Response.json({error:'Access revoked.'},{status:403}));
  reads++;
  return reads===1?Promise.resolve(Response.json(inventory)):reads===2?oldPoll:Promise.resolve(Response.json({error:'Access revoked.'},{status:403}));
 }));
 await act(async()=>{render(<WorkspaceWebsites workspaceId="workspace"/>);});
 await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});
 expect(reads).toBe(2);
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Scan website'}));});
 await act(async()=>{finish(Response.json(inventory));await oldPoll;});
 expect(screen.queryByRole('button',{name:'Scan website'})).toBeNull();
 expect(screen.queryByRole('heading',{name:'example.com'})).toBeNull();
 expect(screen.getByRole('alert').textContent).toContain('Access revoked.');
});
it('removes cached source controls immediately when a mutation denies access',async()=>{
 let denied=false;
 vi.stubGlobal('fetch',vi.fn(async(_url,options)=>{
  if(options?.method==='POST'){denied=true;return Response.json({error:'Access revoked.'},{status:403});}
  if(denied)return Response.json({error:'Refresh unavailable.'},{status:503});
  return Response.json({origins:[{id:1,host:'example.com',origin_url:'https://example.com/',verified_at:'2026-09-05'}]});
 }));
 render(<WorkspaceWebsites workspaceId="workspace"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Scan website'}));
 await screen.findByText('Access revoked.');
 expect(screen.queryByRole('button',{name:'Scan website'})).toBeNull();
 expect(screen.queryByRole('heading',{name:'example.com'})).toBeNull();
});
it('shows the exact configured target and does not imply whole-domain coverage',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({origins:[{id:1,host:'example.com',origin_url:'https://example.com/app/',verified_at:'2026-09-05',last_checked_at:null,schedule_hours:0}]}))));
 render(<WorkspaceWebsites workspaceId="workspace"/>);
 expect(await screen.findByText('https://example.com/app/')).toBeTruthy();
 expect(screen.getByText(/not every page or service on this domain/)).toBeTruthy();
 expect(screen.getByText('Ownership verified · no completed check')).toBeTruthy();
});
it('filters delayed monitoring without including manual-only source history',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({origins:[{id:1,host:'late.example.com',verified_at:'2026-09-05',last_checked_at:'2026-09-05',schedule_hours:6,next_check_at:'2020-01-01'},{id:2,host:'manual.example.com',verified_at:'2026-09-05',last_checked_at:'2026-09-05',schedule_hours:0}]}))));
 render(<WorkspaceWebsites workspaceId="workspace" healthFilter="delayed"/>);
 expect(await screen.findByRole('heading',{name:'late.example.com'})).toBeTruthy();
 expect(screen.queryByRole('heading',{name:'manual.example.com'})).toBeNull();
 expect(screen.getByRole('button',{name:'Show all websites'})).toBeTruthy();
});
it('refreshes source status and removes cached details when access is revoked',async()=>{
 vi.useFakeTimers();let revoked=false;
 const fetch=vi.fn(async()=>revoked?new Response(JSON.stringify({error:'Access removed'}),{status:403}):new Response(JSON.stringify({origins:[{id:1,host:'example.com',verified_at:'2026-09-05',last_checked_at:'2026-09-05',schedule_hours:6,next_check_at:'2020-01-01',latest_attempt_status:'done'}]})));vi.stubGlobal('fetch',fetch);
 await act(async()=>{render(<WorkspaceWebsites workspaceId="workspace"/>);});
 expect(screen.getByText('Monitoring delayed · check needs attention')).toBeTruthy();
 revoked=true;await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});
 expect(screen.queryByText('example.com')).toBeNull();expect(screen.getByRole('alert').textContent).toContain('Access removed');
 expect(fetch.mock.calls).toHaveLength(2);
});
it('saves an explicit schedule without enabling it on mount',async()=>{
 const fetch=vi.fn(async(_url,options)=>new Response(JSON.stringify(options?.method==='POST'?{ok:true}:{origins:[{id:1,host:'example.com',origin_url:'https://example.com/',verified_at:'2026-09-05',schedule_hours:0}]})));vi.stubGlobal('fetch',fetch);
 render(<WorkspaceWebsites workspaceId="workspace"/>);
 const select=await screen.findByRole('combobox',{name:'Check schedule for example.com'});
 expect(fetch.mock.calls.every(([,options])=>!options?.method)).toBe(true);
 fireEvent.change(select,{target:{value:'24'}});fireEvent.click(screen.getByRole('button',{name:'Save schedule'}));
 await waitFor(()=>expect(fetch).toHaveBeenCalledWith('/api/workspaces/workspace/origins/1/schedule',expect.objectContaining({method:'POST',body:'{"hours":24}'})));
});
it('shows the ownership challenge and only checks it after an explicit action',async()=>{
 const fetch=vi.fn().mockImplementation(async(_url,options)=>new Response(JSON.stringify(options?.method==='POST'?{method:'dns'}:{origins:[{id:1,host:'example.com',verification_token:'challenge',verified_at:null,disconnected_at:null,latest_attempt_id:null}]})));vi.stubGlobal('fetch',fetch);
 render(<WorkspaceWebsites workspaceId="workspace"/>);
 expect(await screen.findByText('nospoilers-verification=challenge')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Scan website'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Verify DNS'}));
 await waitFor(()=>expect(fetch).toHaveBeenCalledWith('/api/workspaces/workspace/origins/1/verify',expect.objectContaining({method:'POST',body:'{"method":"dns"}'})));
});
it('requires the exact URL before disconnecting and shows paused state separately from findings',async()=>{
 const fetch=vi.fn().mockImplementation(async(_url,options)=>new Response(JSON.stringify(options?.method==='POST'?{ok:true}:{origins:[{id:1,host:'example.com',origin_url:'https://example.com/',verified_at:'2026-09-05',paused_at:'2026-09-05',disconnected_at:null,latest_attempt_id:null,activity:[{action:'paused',actor:'owner',created_at:'2026-09-05'}]}]})));vi.stubGlobal('fetch',fetch);
 render(<WorkspaceWebsites workspaceId="workspace"/>);
 expect(await screen.findByText('Paused · scans stopped')).toBeTruthy();expect(screen.queryByRole('button',{name:'Scan website'})).toBeNull();
 expect(screen.getByRole('button',{name:'Resume website'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Disconnect website'}));
 expect(screen.getByRole('button',{name:'Confirm disconnect'}).hasAttribute('disabled')).toBe(true);
 fireEvent.change(screen.getByLabelText(/Type https/),{target:{value:'https://example.com/'}});
 fireEvent.click(screen.getByRole('button',{name:'Confirm disconnect'}));
 await waitFor(()=>expect(fetch).toHaveBeenCalledWith('/api/workspaces/workspace/origins/1/lifecycle',expect.objectContaining({method:'POST',body:'{"action":"disconnect","confirmation":"https://example.com/"}'})));
});
