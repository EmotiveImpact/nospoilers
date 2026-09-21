// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
import {it,expect,vi,afterEach} from 'vitest';
import {act,render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {WorkspaceNotifications} from '../src/components/watch/WorkspaceNotifications';
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
const page={destinations:[{id:1,kind:'email',host:'example.com',independent:true,last_delivery_status:null,test_status:null}],deliveries:[],nextCursor:null,canManage:true,providers:{email:true,slack:true}};
it('locks destination editing during a save and restores it after a service failure',async()=>{
 let finish!:(response:Response)=>void;
 vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>init?.method?new Promise<Response>(resolve=>{finish=resolve;}):new Response(JSON.stringify(page))));
 render(<WorkspaceNotifications workspaceId="one"/>);
 await userEvent.click(await screen.findByRole('button',{name:'Add destination'}));
 fireEvent.change(await screen.findByLabelText('Email address'),{target:{value:'person@example.com'}});
 fireEvent.click(screen.getByRole('button',{name:'Save destination'}));
 expect(screen.getByLabelText('Email address')).toHaveProperty('disabled',true);
 expect(screen.getByLabelText('Destination type')).toHaveProperty('disabled',true);
 await act(async()=>finish(new Response(JSON.stringify({error:'Service unavailable.'}),{status:503})));
 expect(screen.getByLabelText('Email address')).toHaveProperty('disabled',false);
 expect(screen.getByLabelText('Email address')).toHaveProperty('value','person@example.com');
 expect(screen.getByRole('alert').textContent).toBe('Service unavailable.');
});
it('refreshes authority and clears sensitive form input after a forbidden save',async()=>{
 let rejected=false;
 vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>{
  if(init?.method){rejected=true;return new Response(JSON.stringify({error:'Workspace access changed.'}),{status:403});}
  return new Response(JSON.stringify({...page,canManage:!rejected}));
 }));
 render(<WorkspaceNotifications workspaceId="one"/>);
 await userEvent.click(await screen.findByRole('button',{name:'Add destination'}));
 fireEvent.change(await screen.findByLabelText('Email address'),{target:{value:'private@example.com'}});
 fireEvent.click(screen.getByRole('button',{name:'Save destination'}));
 await screen.findByText('Only administrators of an active workspace can change destinations.');
 expect(screen.queryByRole('button',{name:'Save destination'})).toBeNull();
 expect(screen.queryByDisplayValue('private@example.com')).toBeNull();
 expect(screen.getByRole('alert').textContent).toBe('Workspace access changed.');
 expect(screen.queryByText('Destination saved. Delivery has not been tested.')).toBeNull();
});
it('saves without claiming delivery and requires exact confirmation to disconnect',async()=>{
 const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>new Response(JSON.stringify(init?.method?{destination:{id:1}}:page)));
 vi.stubGlobal('fetch',fetcher);render(<WorkspaceNotifications workspaceId="one"/>);
 await userEvent.click(await screen.findByRole('button',{name:'Add destination'}));
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
 await userEvent.click(await screen.findByRole('button',{name:'Add destination'}));
 fireEvent.change(await screen.findByLabelText('Email address'),{target:{value:'private@example.com'}});
 view.rerender(<WorkspaceNotifications workspaceId="two"/>);
 await screen.findByText('Only administrators of an active workspace can change destinations.');
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Save destination'})).toBeNull());
 expect(screen.queryByDisplayValue('private@example.com')).toBeNull();
});

it('changing destination type clears private input without submitting',async()=>{
 const fetcher=vi.fn(async()=>new Response(JSON.stringify(page)));
 vi.stubGlobal('fetch',fetcher);render(<WorkspaceNotifications workspaceId="one"/>);
 await userEvent.click(await screen.findByRole('button',{name:'Add destination'}));
 fireEvent.change(await screen.findByLabelText('Email address'),{target:{value:'private@example.com'}});
 await userEvent.click(screen.getByRole('combobox',{name:'Destination type'}));
 await userEvent.click(screen.getByRole('option',{name:'Slack'}));
 expect(screen.queryByDisplayValue('private@example.com')).toBeNull();
 expect(screen.getByRole('combobox',{name:'Destination type'}).textContent).toContain('Slack');
 expect(document.activeElement).toBe(screen.getByRole('combobox',{name:'Destination type'}));
 expect(fetcher).toHaveBeenCalledTimes(1);
});

it('keeps an unsaved destination draft when visiting delivery history without submitting it',async()=>{
 const fetcher=vi.fn(async()=>Response.json(page));vi.stubGlobal('fetch',fetcher);
 render(<WorkspaceNotifications workspaceId="one"/>);
 await userEvent.click(await screen.findByRole('button',{name:'Add destination'}));
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'draft@example.com'}});
 await userEvent.click(screen.getByRole('tab',{name:'Delivery history'}));
 expect(screen.queryByRole('button',{name:'Save destination'})).toBeNull();
 await userEvent.click(screen.getByRole('tab',{name:'Destinations',exact:true}));
 expect(screen.getByLabelText('Email address')).toHaveProperty('value','draft@example.com');
 expect(fetcher.mock.calls.every(call=>!Reflect.get(call,1)?.method)).toBe(true);
});

it('keeps delivery pagination inside the selected workspace and visible history tab',async()=>{
 const fetcher=vi.fn(async(url:string)=>Response.json({...page,nextCursor:url.includes('before=')?null:'older'}));vi.stubGlobal('fetch',fetcher);
 render(<WorkspaceNotifications workspaceId="one"/>);
 await screen.findByRole('button',{name:'Add destination'});
 expect(screen.queryByRole('button',{name:'Older'})).toBeNull();
 await userEvent.click(screen.getByRole('tab',{name:'Delivery history'}));
 await userEvent.click(screen.getByRole('button',{name:'Older'}));
 await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/api/workspaces/one/notifications?before=older',expect.anything()));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Newest'})).toHaveProperty('disabled',false));
 expect(screen.getByRole('tab',{name:'Delivery history'}).getAttribute('aria-selected')).toBe('true');
 await userEvent.click(screen.getByRole('button',{name:'Newest'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Newest'})).toHaveProperty('disabled',true));
});

it('closes the destination editor on Cancel and returns focus without submitting',async()=>{
 const fetcher=vi.fn(async()=>Response.json(page));vi.stubGlobal('fetch',fetcher);
 render(<WorkspaceNotifications workspaceId="one"/>);
 const compose=await screen.findByRole('button',{name:'Add destination'});
 await userEvent.click(compose);
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'unsent@example.com'}});
 await userEvent.click(screen.getByRole('button',{name:'Cancel',exact:true}));
 expect(screen.queryByRole('button',{name:'Save destination'})).toBeNull();
 expect(screen.getByRole('button',{name:'Add destination'})).toBe(compose);
 expect(compose.getAttribute('aria-expanded')).toBe('false');
 expect(document.activeElement).toBe(compose);
 expect(fetcher.mock.calls.every(call=>!Reflect.get(call,1)?.method)).toBe(true);
});

it('invalidates a disconnect confirmation when the destination disappears on refresh',async()=>{
 vi.useFakeTimers();let current=page;
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json(current)));
 render(<WorkspaceNotifications workspaceId="one"/>);
 await act(async()=>{});
 fireEvent.click(screen.getByRole('button',{name:'Disconnect example.com'}));
 fireEvent.change(screen.getByLabelText('Type example.com to disconnect'),{target:{value:'example.com'}});
 current={...page,destinations:[]};
 await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});
 expect(screen.queryByRole('button',{name:'Confirm disconnect'})).toBeNull();
});

it('clears private drafts when polling discovers revoked management authority',async()=>{
 vi.useFakeTimers();let allowed=true;
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...page,canManage:allowed})));
 render(<WorkspaceNotifications workspaceId="one"/>);await act(async()=>{});
 fireEvent.click(screen.getByRole('button',{name:'Add destination'}));
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'private@example.com'}});
 allowed=false;await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});
 allowed=true;await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});
 expect(screen.queryByDisplayValue('private@example.com')).toBeNull();
});

it('does not let an older poll resurrect controls after a forbidden mutation',async()=>{
 vi.useFakeTimers();let reads=0;let oldPoll!:(response:Response)=>void;
 vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>{
  if(init?.method)return Response.json({error:'Access changed'},{status:403});
  reads++;if(reads===2)return new Promise<Response>(resolve=>{oldPoll=resolve;});
  return Response.json({...page,canManage:reads===1});
 }));
 render(<WorkspaceNotifications workspaceId="one"/>);await act(async()=>{});
 fireEvent.click(screen.getByRole('button',{name:'Add destination'}));
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'private@example.com'}});
 await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Save destination'}));});
 await act(async()=>{oldPoll(Response.json(page));});
 expect(screen.queryByRole('button',{name:'Add destination'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Save destination'})).toBeNull();
});

it('focuses disconnect confirmation and returns focus on cancellation without a request',async()=>{
 const fetcher=vi.fn(async()=>Response.json(page));vi.stubGlobal('fetch',fetcher);
 render(<WorkspaceNotifications workspaceId="one"/>);
 const trigger=await screen.findByRole('button',{name:'Disconnect example.com'});
 await userEvent.click(trigger);
 expect(document.activeElement).toBe(screen.getByLabelText('Type example.com to disconnect'));
 await userEvent.click(screen.getByRole('button',{name:'Cancel',exact:true}));
 expect(document.activeElement).toBe(trigger);
 expect(fetcher.mock.calls.every(call=>!Reflect.get(call,1)?.method)).toBe(true);
});
