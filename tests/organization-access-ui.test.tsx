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
it('keeps an organisation role draft across tabs and hides stale controls after revoked access',async()=>{
 const changed=vi.fn();
 const fetcher=vi.fn(async(_url:string,init?:RequestInit)=>Response.json(init?.method?{error:'Access changed. Reload before saving.'}:access,{status:init?.method?403:200}));
 vi.stubGlobal('fetch',fetcher);render(<OrganizationAccess organization={organization} onChanged={changed}/>);
 await userEvent.click(screen.getByText('Account · organisation administration'));
 await userEvent.click(await screen.findByRole('combobox',{name:'Organisation role for Reader'}));
 await userEvent.click(screen.getByRole('option',{name:'Administrator',exact:true}));
 await userEvent.click(screen.getByRole('tab',{name:'Activity',exact:true}));
 expect(screen.queryByRole('button',{name:'Save organisation role for Reader'})).toBeNull();
 await userEvent.click(screen.getByRole('tab',{name:'Access',exact:true}));
 expect(screen.getByRole('combobox',{name:'Organisation role for Reader'}).textContent).toContain('Administrator');
 await userEvent.click(screen.getByRole('button',{name:'Save organisation role for Reader'}));
 await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/api/organizations/org/access/member',expect.objectContaining({method:'PATCH',body:JSON.stringify({role:'admin'})})));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('Access changed.'));
 expect(screen.queryByRole('combobox',{name:'Organisation role for Reader'})).toBeNull();
 expect(screen.queryByRole('tab',{name:'Deletion review'})).toBeNull();
 expect(changed).not.toHaveBeenCalled();
});
it('does not expose role editing or deletion review to an organisation administrator',async()=>{
 const admin={...organization,role:'admin'};
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...access,organization:admin})));
 render(<OrganizationAccess organization={admin} onChanged={()=>{}}/>);
 await userEvent.click(screen.getByText('Account · organisation administration'));
 await screen.findByText('Reader');
 expect(screen.queryByRole('combobox',{name:'Organisation role for Reader'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Save organisation role for Reader'})).toBeNull();
 expect(screen.queryByRole('tab',{name:'Deletion review'})).toBeNull();
});

it('drops stale owner controls immediately when the organisation role changes',async()=>{
 let resolveAccess!:(value:Response)=>void;
 let revoked=false;
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
  if(url.endsWith('/access'))return revoked?new Promise<Response>(resolve=>{resolveAccess=resolve;}):Response.json(access);
  return Response.json({requests:[]});
 }));
 const view=render(<OrganizationAccess organization={organization} onChanged={()=>{}}/>);
 await userEvent.click(screen.getByText('Account · organisation administration'));
 await screen.findByRole('combobox',{name:'Organisation role for Reader'});
 expect(screen.getByRole('tab',{name:'Deletion review'})).toBeTruthy();
 revoked=true;
 view.rerender(<OrganizationAccess organization={{...organization,role:'admin'}} onChanged={()=>{}}/>);
 expect(screen.queryByRole('combobox',{name:'Organisation role for Reader'})).toBeNull();
 expect(screen.queryByRole('tab',{name:'Deletion review'})).toBeNull();
 await act(async()=>resolveAccess(Response.json({...access,organization:{...organization,role:'admin'}})));
 await screen.findByText('Reader');
 expect(screen.queryByRole('combobox',{name:'Organisation role for Reader'})).toBeNull();
});

it('uses current access authority for deletion even when the outer organisation list is stale',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...access,organization:{...organization,role:'admin'}})));
 render(<OrganizationAccess organization={organization} onChanged={()=>{}}/>);
 await userEvent.click(screen.getByText('Account · organisation administration'));
 await screen.findByText('Reader');
 expect(screen.queryByRole('tab',{name:'Deletion review'})).toBeNull();
 expect(screen.queryByRole('combobox',{name:'Organisation role for Reader'})).toBeNull();
});

it('does not describe unavailable administration activity as an empty history',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'Access unavailable'},{status:403})));
 render(<OrganizationAccess organization={organization} onChanged={()=>{}}/>);
 await userEvent.click(screen.getByText('Account · organisation administration'));
 await screen.findByRole('alert');
 await userEvent.click(screen.getByRole('tab',{name:'Activity',exact:true}));
 expect(screen.queryByText('No administration changes recorded.')).toBeNull();
 expect(screen.getByRole('alert').textContent).toContain('Access unavailable');
});

it('rejects access data for another organisation instead of showing its members',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...access,organization:{...organization,id:'other'}})));
 render(<OrganizationAccess organization={organization} onChanged={()=>{}}/>);
 await userEvent.click(screen.getByText('Account · organisation administration'));
 expect((await screen.findByRole('alert')).textContent).toContain('Could not load organisation access.');
 expect(screen.queryByText('Reader')).toBeNull();
 expect(screen.queryByRole('tab',{name:'Deletion review'})).toBeNull();
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
 await userEvent.click(screen.getByText('Account · organisation administration'));
 await userEvent.click(await screen.findByRole('combobox',{name:'Organisation role for Reader'}));
 await userEvent.click(screen.getByRole('option',{name:'Administrator',exact:true}));
 await userEvent.click(screen.getByRole('button',{name:'Save organisation role for Reader'}));
 expect(signal?.aborted).toBe(false);
 view.rerender(<OrganizationAccess organization={{...organization,id:'other'}} onChanged={changed}/>);
 expect(signal?.aborted).toBe(true);
 await act(async()=>resolveSave(Response.json({})));
 expect(changed).not.toHaveBeenCalled();
});
