// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import {WorkspaceScanPolicy} from '../src/components/watch/WorkspaceScanPolicy';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const policy={strict:false,revision:0,canEdit:true,supported:true,events:[]};
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
