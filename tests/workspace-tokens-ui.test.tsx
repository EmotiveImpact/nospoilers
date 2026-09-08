// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {WorkspaceTokens} from '../src/components/watch/WorkspaceTokens';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const token={id:1,name:'CI',token_prefix:'nsp_prefix',revoked_at:null,last_used_at:null};
it('requires history review after an unconfirmed creation rather than silently retrying',async()=>{
 const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{if(init?.method==='POST')throw new TypeError('Network disconnected');return new Response(JSON.stringify({tokens:[],canManage:true,nextCursor:null}));});
 vi.stubGlobal('fetch',fetcher);render(<WorkspaceTokens workspaceId="workspace"/>);
 fireEvent.change(await screen.findByLabelText('Token name'),{target:{value:'CI'}});
 fireEvent.click(screen.getByRole('button',{name:'Create token'}));
 await screen.findByText(/Creation was not confirmed/);
 expect(screen.getByRole('button',{name:'Create token'})).toHaveProperty('disabled',true);
 fireEvent.click(screen.getByRole('button',{name:'Reload credentials'}));
 await waitFor(()=>expect(fetcher.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1));
 expect(screen.queryByLabelText('New token')).toBeNull();
});
it('creates once, reveals the secret transiently and clears it on workspace change',async()=>{
 const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>new Response(JSON.stringify(init?.method==='POST'?{token:'nsp_test_secret'}:{tokens:[],nextCursor:null,canManage:true})));
 vi.stubGlobal('fetch',fetcher);
 const view=render(<WorkspaceTokens workspaceId="first"/>);
 fireEvent.change(await screen.findByLabelText('Token name'),{target:{value:'CI'}});
 fireEvent.click(screen.getByRole('button',{name:'Create token'}));
 expect(await screen.findByLabelText('New token')).toHaveProperty('value','nsp_test_secret');
 expect(fetcher.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);
 expect(screen.getByRole('button',{name:'Create token'})).toHaveProperty('disabled',true);
 view.rerender(<WorkspaceTokens workspaceId="second"/>);
 expect(screen.queryByLabelText('New token')).toBeNull();
 await screen.findByLabelText('Token name');
 expect(fetcher.mock.calls.some(([url])=>url==='/api/workspaces/second/tokens')).toBe(true);
});
it('requires exact confirmation and retains history after revocation',async()=>{
 let revoked=false;
 const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{
  if(init?.method==='DELETE'){revoked=true;return new Response('{"ok":true}');}
  return new Response(JSON.stringify({tokens:[{...token,revoked_at:revoked?'2026-09-06':null}],nextCursor:null,canManage:true}));
 });
 vi.stubGlobal('fetch',fetcher);render(<WorkspaceTokens workspaceId="workspace"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Revoke CI'}));
 expect(screen.getByRole('button',{name:'Confirm revocation'})).toHaveProperty('disabled',true);
 fireEvent.change(screen.getByLabelText('Type CI to confirm'),{target:{value:'CI'}});
 fireEvent.click(screen.getByRole('button',{name:'Confirm revocation'}));
 await screen.findByText('Token revoked. Saved scan history is unchanged.');
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Revoke CI'})).toBeNull());
 const call=fetcher.mock.calls.find(([,init])=>init?.method==='DELETE');
 expect(call?.[0]).toBe('/api/workspaces/workspace/tokens/1');expect(JSON.parse(String(call?.[1]?.body))).toEqual({confirm:'CI'});
 expect(screen.getByText('CI')).toBeTruthy();
});
it('does not offer mutations to a read-only member',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({tokens:[token],canManage:false,nextCursor:null}))));
 render(<WorkspaceTokens workspaceId="workspace"/>);
 await screen.findByText('Only administrators of an active workspace can create or revoke tokens.');
 expect(screen.queryByRole('button',{name:'Create token'})).toBeNull();expect(screen.queryByRole('button',{name:'Revoke CI'})).toBeNull();
});
