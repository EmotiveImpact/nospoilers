// @vitest-environment jsdom
import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,it,expect,vi} from 'vitest';
import {OrganizationAccess} from '../src/components/watch/OrganizationAccess';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const organization={id:'org',name:'Account',role:'owner',workspace_limit:2,billing_available:false};
const access={organization,members:[{user_id:'member',login:'Reader',role:null}],events:[]};
it('keeps an organisation role draft while reviewing activity and hides stale controls after revoked access',async()=>{
 const changed=vi.fn();
 const fetcher=vi.fn(async(_url:string,init?:RequestInit)=>Response.json(init?.method?{error:'Access changed. Reload before saving.'}:access,{status:init?.method?403:200}));
 vi.stubGlobal('fetch',fetcher);render(<OrganizationAccess organization={organization} onChanged={changed}/>);
 await userEvent.click(await screen.findByRole('combobox',{name:'Organisation role for Reader'}));
 await userEvent.click(screen.getByRole('option',{name:'Administrator',exact:true}));
 await userEvent.click(screen.getByRole('button',{name:'Activity',exact:true}));
 expect(screen.queryByRole('button',{name:'Save organisation role for Reader'})).toBeNull();
 await userEvent.click(screen.getByRole('button',{name:'Close organisation panel'}));
 expect(screen.getByRole('combobox',{name:'Organisation role for Reader'}).textContent).toContain('Administrator');
 await userEvent.click(screen.getByRole('button',{name:'Save organisation role for Reader'}));
 await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/api/organizations/org/access/member',expect.objectContaining({method:'PATCH',body:JSON.stringify({role:'admin'})})));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('Access changed.'));
 expect(screen.queryByRole('combobox',{name:'Organisation role for Reader'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Deletion review'})).toBeNull();
 expect(changed).not.toHaveBeenCalled();
});
it('does not expose role editing or deletion review to an organisation administrator',async()=>{
 const admin={...organization,role:'admin'};
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...access,organization:admin})));
 render(<OrganizationAccess organization={admin} onChanged={()=>{}}/>);
 await screen.findByText('Reader');
 expect(screen.queryByRole('combobox',{name:'Organisation role for Reader'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Save organisation role for Reader'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Deletion review'})).toBeNull();
});

it('drops stale owner controls immediately when the organisation role changes',async()=>{
 let resolveAccess!:(value:Response)=>void;
 let revoked=false;
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
  if(url.endsWith('/access'))return revoked?new Promise<Response>(resolve=>{resolveAccess=resolve;}):Response.json(access);
  return Response.json({requests:[]});
 }));
 const view=render(<OrganizationAccess organization={organization} onChanged={()=>{}}/>);
 await screen.findByRole('combobox',{name:'Organisation role for Reader'});
 expect(screen.getByRole('button',{name:'Deletion review'})).toBeTruthy();
 revoked=true;
 view.rerender(<OrganizationAccess organization={{...organization,role:'admin'}} onChanged={()=>{}}/>);
 expect(screen.queryByRole('combobox',{name:'Organisation role for Reader'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Deletion review'})).toBeNull();
 await act(async()=>resolveAccess(Response.json({...access,organization:{...organization,role:'admin'}})));
 await screen.findByText('Reader');
 expect(screen.queryByRole('combobox',{name:'Organisation role for Reader'})).toBeNull();
});

it('uses current access authority for deletion even when the outer organisation list is stale',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...access,organization:{...organization,role:'admin'}})));
 render(<OrganizationAccess organization={organization} onChanged={()=>{}}/>);
 await screen.findByText('Reader');
 expect(screen.queryByRole('button',{name:'Deletion review'})).toBeNull();
 expect(screen.queryByRole('combobox',{name:'Organisation role for Reader'})).toBeNull();
});

it('does not describe unavailable administration activity as an empty history',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'Access unavailable'},{status:403})));
 render(<OrganizationAccess organization={organization} onChanged={()=>{}}/>);
 await screen.findByRole('alert');
 await userEvent.click(screen.getByRole('button',{name:'Activity',exact:true}));
 expect(screen.queryByText('No administration changes yet')).toBeNull();
 expect(screen.getByRole('alert').textContent).toContain('Access unavailable');
});

it('rejects access data for another organisation instead of showing its members',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...access,organization:{...organization,id:'other'}})));
 render(<OrganizationAccess organization={organization} onChanged={()=>{}}/>);
 expect((await screen.findByRole('alert')).textContent).toContain('Could not load organisation access.');
 expect(screen.queryByText('Reader')).toBeNull();
 expect(screen.queryByRole('button',{name:'Deletion review'})).toBeNull();
});

it('ignores a pending role save after organisation identity changes',async()=>{
 const changed=vi.fn();
 let resolveSave!:(value:Response)=>void;
 let signal:AbortSignal|undefined;
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  if(init?.method){signal=init.signal as AbortSignal;return new Promise<Response>(resolve=>{resolveSave=resolve;});}
  if(url.endsWith('/access'))return Response.json({...access,organization:{...organization,id:url.includes('/other/')?'other':'org'}});
  return Response.json({requests:[]});
 }));
 const view=render(<OrganizationAccess organization={organization} onChanged={changed}/>);
 await userEvent.click(await screen.findByRole('combobox',{name:'Organisation role for Reader'}));
 await userEvent.click(screen.getByRole('option',{name:'Administrator',exact:true}));
 await userEvent.click(screen.getByRole('button',{name:'Save organisation role for Reader'}));
 expect(signal?.aborted).toBe(false);
 view.rerender(<OrganizationAccess organization={{...organization,id:'other'}} onChanged={changed}/>);
 expect(signal?.aborted).toBe(true);
 await act(async()=>resolveSave(Response.json({})));
 expect(changed).not.toHaveBeenCalled();
});


it('shows organisation roles directly without nested tabs or an outer disclosure',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json(access)));
 const {container}=render(<OrganizationAccess organization={organization} onChanged={()=>{}}/>);
 await screen.findByRole('combobox',{name:'Organisation role for Reader'});
 expect(screen.queryByRole('tablist')).toBeNull();
 expect(container.querySelector('details')).toBeNull();
 expect(screen.getByRole('region',{name:'Account organisation administration'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Save organisation role for Reader'}).textContent).toBe('Save');
 expect(screen.getByRole('button',{name:'Deletion review'})).toBeTruthy();
});

it('routes Billing to the parent when a navigation handler is provided',async()=>{
 const navigate=vi.fn(),fetcher=vi.fn(async()=>Response.json(access));vi.stubGlobal('fetch',fetcher);
 render(<OrganizationAccess organization={{...organization,billing_available:true}} onChanged={()=>{}} onOpenBilling={navigate}/>);
 await screen.findByText('Reader');
 await userEvent.click(screen.getByRole('button',{name:'Billing',exact:true}));
 expect(navigate).toHaveBeenCalledOnce();
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(fetcher).toHaveBeenCalledTimes(1);
});

it('opens recorded activity in a focused dialog without changing organisation access',async()=>{
 const fetcher=vi.fn(async()=>Response.json({...access,events:[{id:'event',action:'admin_added',actor:'Owner',subject:'Reader',created_at:'2026-09-19T19:00:00Z'}]}));vi.stubGlobal('fetch',fetcher);
 render(<OrganizationAccess organization={organization} onChanged={()=>{}}/>);
 await screen.findByText('Reader');
 await userEvent.click(screen.getByRole('button',{name:'Activity',exact:true}));
 expect(await screen.findByRole('dialog',{name:'Administration activity'})).toBeTruthy();
 expect(screen.getByText('admin added')).toBeTruthy();
 expect(screen.getByText('Owner → Reader')).toBeTruthy();
 expect(fetcher).toHaveBeenCalledTimes(1);
 await userEvent.keyboard('{Escape}');
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(screen.getByRole('combobox',{name:'Organisation role for Reader'})).toBeTruthy();
});
