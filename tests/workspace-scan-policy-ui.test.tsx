// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import {WorkspaceScanPolicy} from '../src/components/watch/WorkspaceScanPolicy';
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},'','/');});
const policy={strict:false,revision:0,canEdit:true,supported:true,events:[]};
it.each([200,403])('requires reload after an incomplete or forbidden save (%s)',async status=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>new Response(JSON.stringify(url.endsWith('/exceptions')?{exceptions:[],nextCursor:null}:options?.method?{error:'Access changed.'}:{policy}),{status:options?.method?status:200})));
 render(<WorkspaceScanPolicy workspaceId="workspace"/>);
 fireEvent.click(await screen.findByRole('checkbox',{name:/Strict policy/}));
 fireEvent.click(screen.getByRole('button',{name:'Save policy'}));
 await screen.findByRole('alert');
 expect(screen.queryByText('Policy saved for subsequent scan starts.')).toBeNull();
 if(status===403)expect(screen.queryByRole('button',{name:'Save policy'})).toBeNull();
 else expect(screen.getByRole('button',{name:'Save policy'})).toHaveProperty('disabled',true);
 expect(screen.getByRole('button',{name:'Reload policy'})).toBeTruthy();
});
it('saves strict policy with its revision and shows server confirmation',async()=>{
 const fetcher=vi.fn(async(_url:string,options?:RequestInit)=>new Response(JSON.stringify(_url.endsWith('/exceptions')?{exceptions:[],canDecide:true,nextCursor:null}:{policy:options?.method?{...policy,strict:true,revision:1}:policy})));vi.stubGlobal('fetch',fetcher);
 render(<WorkspaceScanPolicy workspaceId="workspace"/>);fireEvent.click(await screen.findByRole('checkbox',{name:/Strict policy/}));fireEvent.click(screen.getByRole('button',{name:'Save policy'}));
 expect(await screen.findByText('Policy saved for subsequent scan starts.')).toBeTruthy();
 expect(fetcher).toHaveBeenCalledWith('/api/workspaces/workspace/scan-policy',expect.objectContaining({method:'PUT',body:'{"strict":true,"expectedRevision":0,"requireExceptionApproval":false}'}));
});
it('requires reload after a conflicting change and keeps viewers read-only',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(_url:string,options?:RequestInit)=>new Response(JSON.stringify(_url.endsWith('/exceptions')?{exceptions:[],canDecide:true,nextCursor:null}:options?.method?{error:'This policy changed. Reload it before saving.'}:{policy}),{status:options?.method?409:200})));
 const view=render(<WorkspaceScanPolicy workspaceId="workspace"/>);fireEvent.click(await screen.findByRole('checkbox',{name:/Strict policy/}));fireEvent.click(screen.getByRole('button',{name:'Save policy'}));
 expect(await screen.findByRole('alert')).toBeTruthy();expect((screen.getByRole('button',{name:'Save policy'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Reload policy'}));await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url.endsWith('/exceptions')?{exceptions:[],canDecide:false,nextCursor:null}:{policy:{...policy,canEdit:false}}))));view.rerender(<WorkspaceScanPolicy workspaceId="viewer-workspace"/>);
 expect((await screen.findByRole('checkbox',{name:/Strict policy/}) as HTMLInputElement).disabled).toBe(true);
});

it('preserves unsaved rules through keyboard tab navigation without saving',async()=>{
 const fetcher=vi.fn(async(url:string)=>Response.json(url.endsWith('/exceptions')?{exceptions:[],nextCursor:null,canDecide:false}:{policy}));vi.stubGlobal('fetch',fetcher);
 render(<WorkspaceScanPolicy workspaceId="workspace"/>);
 fireEvent.click(await screen.findByRole('checkbox',{name:/Strict policy/}));
 const rules=screen.getByRole('tab',{name:'Scan rules'});rules.focus();
 await userEvent.keyboard('{ArrowRight}{Enter}');
 await waitFor(()=>expect(screen.getByRole('tab',{name:'Exceptions'}).getAttribute('aria-selected')).toBe('true'));
 expect(screen.queryByRole('button',{name:'Save policy'})).toBeNull();
 await userEvent.keyboard('{ArrowLeft}{Enter}');
 await waitFor(()=>expect(rules.getAttribute('aria-selected')).toBe('true'));
 expect(screen.getByRole('checkbox',{name:/Strict policy/})).toHaveProperty('checked',true);
 expect(fetcher.mock.calls.every(call=>!Reflect.get(call,1)?.method)).toBe(true);
});

it('opens exception deep links initially and when navigation changes after returning to rules',async()=>{
 const entry={id:'older',rule:'MAP-001',exact_path:'app.map',reason:'Review this bounded exception',expires_at:'2027-01-01',effective_status:'pending',artifact_sha256:'a'.repeat(64)};
 window.history.replaceState({},'','/watch/policy?workspace=workspace&exception=older');
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>Response.json(url.endsWith('/exceptions/older')?{exception:entry,events:[],canDecide:false}:url.includes('/exceptions')?{exceptions:[],nextCursor:null}:{policy})));
 const view=render(<WorkspaceScanPolicy workspaceId="workspace"/>);
 await waitFor(()=>expect(screen.getByRole('tab',{name:'Exceptions'}).getAttribute('aria-selected')).toBe('true'));
 expect(await screen.findByText('Review this bounded exception')).toBeTruthy();
 await userEvent.click(screen.getByRole('tab',{name:'Scan rules'}));
 window.history.replaceState({},'','/watch/policy?workspace=workspace&exceptionBefore=older-page');
 view.rerender(<WorkspaceScanPolicy workspaceId="workspace"/>);
 await waitFor(()=>expect(screen.getByRole('tab',{name:'Exceptions'}).getAttribute('aria-selected')).toBe('true'));
});
