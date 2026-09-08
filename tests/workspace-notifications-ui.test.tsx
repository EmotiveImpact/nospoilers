// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {WorkspaceNotifications} from '../src/components/watch/WorkspaceNotifications';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const page={destinations:[{id:1,kind:'email',host:'example.com',independent:true,last_delivery_status:null,test_status:null}],deliveries:[],nextCursor:null,canManage:true,providers:{email:true,slack:true}};
it('saves without claiming delivery and requires exact confirmation to disconnect',async()=>{
 const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>new Response(JSON.stringify(init?.method?{destination:{id:1}}:page)));
 vi.stubGlobal('fetch',fetcher);render(<WorkspaceNotifications workspaceId="one"/>);
 fireEvent.change(await screen.findByLabelText('Email address'),{target:{value:'person@example.com'}});
 fireEvent.click(screen.getByRole('button',{name:'Save destination'}));
 await screen.findByText('Destination saved. Delivery has not been tested.');
 expect(screen.getByLabelText('Email address')).toHaveProperty('value','');
 fireEvent.click(screen.getByRole('button',{name:'Disconnect example.com'}));
 expect(screen.getByRole('button',{name:'Confirm disconnect'})).toHaveProperty('disabled',true);
 fireEvent.change(screen.getByLabelText('Type example.com to disconnect'),{target:{value:'example.com'}});
 fireEvent.click(screen.getByRole('button',{name:'Confirm disconnect'}));
 await screen.findByText('Destination disconnected. Delivery history is retained.');
 expect(fetcher.mock.calls.some(([,init])=>init?.method==='DELETE'&&init.body===JSON.stringify({confirm:'example.com'}))).toBe(true);
});
it('reuses an unconfirmed test identifier and never treats queued as sent',async()=>{
 let tries=0;const keys:string[]=[];
 const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{
  if(init?.method==='POST'){keys.push(JSON.parse(String(init.body)).requestKey);if(++tries===1)throw new Error('Disconnected');return new Response(JSON.stringify({status:'queued'}));}
  return new Response(JSON.stringify(page));
 });
 vi.stubGlobal('fetch',fetcher);render(<WorkspaceNotifications workspaceId="one"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Send test to example.com'}));
 await screen.findByText(/Retry uses the same test identifier/);
 fireEvent.click(screen.getByRole('button',{name:'Send test to example.com'}));
 await screen.findByText(/Test queued/);expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);
});
it('clears workspace form state and hides mutation controls from viewers',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>new Response(JSON.stringify({...page,canManage:!String(url).includes('/two/')}))));
 const view=render(<WorkspaceNotifications workspaceId="one"/>);
 fireEvent.change(await screen.findByLabelText('Email address'),{target:{value:'private@example.com'}});
 view.rerender(<WorkspaceNotifications workspaceId="two"/>);
 await screen.findByText('Only administrators of an active workspace can change destinations.');
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Save destination'})).toBeNull());
 expect(screen.queryByDisplayValue('private@example.com')).toBeNull();
});
