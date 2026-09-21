// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {radixUiTestSupport} from './helpers/radix-ui';
import {AuditScreen} from '../src/components/watch/screens/AuditScreen';
radixUiTestSupport();
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const audit={status:'ready' as const,rows:[{id:1,at:new Date().toISOString(),actorLogin:'Admin',action:'policy_updated',summary:'Strict scan rules enabled'},{id:2,at:'2020-01-01T12:00:00Z',actorLogin:'Owner',action:'member_invited',summary:'Invited Alex'}]};
it('filters actual loaded audit events without losing their details',async()=>{
 render(<AuditScreen previewing={false} audit={audit} installationId={23}/>);
 expect(screen.getByRole('table',{name:'Administrative changes'})).toBeTruthy();
 expect(screen.getByText('Invited Alex')).toBeTruthy();
 await userEvent.click(screen.getByRole('combobox',{name:'Audit date'}));
 await userEvent.click(screen.getByRole('option',{name:'Last 7 days'}));
 expect(screen.queryByText('Invited Alex')).toBeNull();
 expect(screen.getByText('Strict scan rules enabled')).toBeTruthy();
 await userEvent.click(screen.getByRole('combobox',{name:'Audit event'}));
 await userEvent.click(screen.getByRole('option',{name:'member invited'}));
 expect(screen.getByText('No loaded events match these filters.')).toBeTruthy();
});
it('withholds event filters and export authority after a load failure',()=>{
 render(<AuditScreen previewing={false} audit={{status:'error',message:'Access changed'}} installationId={23}/>);
 expect(screen.getByRole('button',{name:'Export audit JSON'})).toHaveProperty('disabled',true);
 expect(screen.queryByRole('combobox')).toBeNull();
 expect(screen.queryByRole('table')).toBeNull();
 expect(screen.getByRole('alert').textContent).toBe('Access changed');
});

it('prevents duplicate exports and ignores a late export after installation scope changes',async()=>{
 let finish!:(value:Response)=>void;let signal:AbortSignal|undefined;
 const fetcher=vi.fn((_url:string,init?:RequestInit)=>{signal=init?.signal as AbortSignal;return new Promise<Response>(resolve=>{finish=resolve;});});
 vi.stubGlobal('fetch',fetcher);const createObjectURL=vi.fn();vi.stubGlobal('URL',Object.assign(URL,{createObjectURL}));
 const view=render(<AuditScreen previewing={false} audit={audit} installationId={23}/>);
 fireEvent.click(screen.getByRole('button',{name:'Export audit JSON'}));
 expect(screen.getByRole('button',{name:'Preparing export…'})).toHaveProperty('disabled',true);
 expect(fetcher).toHaveBeenCalledTimes(1);
 view.rerender(<AuditScreen previewing={false} audit={audit} installationId={24}/>);
 expect(signal?.aborted).toBe(true);
 await act(async()=>finish(Response.json({exportedAt:'2026-09-20T00:00:00Z'})));
 expect(createObjectURL).not.toHaveBeenCalled();
 expect(screen.queryByRole('alert')).toBeNull();
});
it('rejects malformed audit export metadata instead of downloading an unusable file',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({rows:[]})));
 render(<AuditScreen previewing={false} audit={audit} installationId={23}/>);
 await userEvent.click(screen.getByRole('button',{name:'Export audit JSON'}));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','The audit export was incomplete. Please retry.');
 expect(screen.getByRole('button',{name:'Export audit JSON'})).toHaveProperty('disabled',false);
});
