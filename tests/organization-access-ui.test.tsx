// @vitest-environment jsdom
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,it,expect,vi} from 'vitest';
import {OrganizationAccess} from '../src/components/watch/OrganizationAccess';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const organization={id:'org',name:'Account',role:'owner',workspace_limit:2,billing_available:false};
const access={organization,members:[{user_id:'member',login:'Reader',role:null}],events:[]};
it('keeps an organisation role draft across tabs and preserves a rejected save',async()=>{
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
