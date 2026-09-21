// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import {ProofSharing} from '../src/components/watch/ProofSharing';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('previews redacted fields before explicit publish and exposes revocation',async()=>{
 let active=false;
 const fetcher=vi.fn(async(_url:string,options?:RequestInit)=>{
  if(options?.method==='POST'){active=true;return new Response(JSON.stringify({token:'token'}));}
  if(options?.method==='DELETE'){active=false;return new Response(JSON.stringify({ok:true}));}
  return new Response(JSON.stringify({active:active?{id:'share'}:null,canPublish:true,preview:{artifactSha256:'abc123',scannedAt:'2026-09-05',status:'failed-policy',findingCount:1,maxSeverity:'critical'}}));
 });vi.stubGlobal('fetch',fetcher);render(<ProofSharing uploadId="proof"/>);
 expect(await screen.findByText('abc123')).toBeTruthy();expect(fetcher).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Review & publish'}));
 const review=screen.getByRole('dialog',{name:'Review public summary'});
 expect(fetcher.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(0);
 fireEvent.click(within(review).getByRole('button',{name:'Publish summary'}));
 expect(await screen.findByRole('link')).toHaveProperty('href',expect.stringContaining('/api/public/upload-proofs/token'));
 fireEvent.click(await screen.findByRole('button',{name:'Revoke public link'}));
 const revoke=screen.getByRole('dialog',{name:'Revoke public link'});
 expect(fetcher.mock.calls.filter(([,init])=>init?.method==='DELETE')).toHaveLength(0);
 fireEvent.click(within(revoke).getByRole('button',{name:'Revoke link'}));
 await waitFor(()=>expect(screen.queryByRole('link')).toBeNull());
 expect(fetcher).toHaveBeenCalledWith('/api/uploads/proof/sharing',expect.objectContaining({method:'POST',body:'{"confirm":true}'}));
});
it('allows a failed status read to be retried',async()=>{
 let attempts=0;vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(++attempts===1?{error:'failed'}:{active:null,canPublish:false,preview:null}),{status:attempts===1?503:200})));
 render(<ProofSharing uploadId="proof"/>);expect(await screen.findByRole('alert')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Retry sharing status'}));
 await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
 expect((screen.getByRole('button',{name:'Review & publish'}) as HTMLButtonElement).disabled).toBe(true);
});
it('ignores old response bodies after switching release scope',async()=>{
 let resolveOld!:(value:unknown)=>void;
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.includes('/old/')?{ok:true,status:200,json:()=>new Promise(resolve=>{resolveOld=resolve;})}:new Response(JSON.stringify({active:null,canPublish:true,preview:{artifactSha256:'NEW',scannedAt:'today',status:'passed',findingCount:0,maxSeverity:null}}))));
 const view=render(<ProofSharing uploadId="old"/>);await waitFor(()=>expect(resolveOld).toBeDefined());
 view.rerender(<ProofSharing uploadId="new"/>);expect(await screen.findByText('NEW')).toBeTruthy();
 resolveOld({active:null,canPublish:true,preview:{artifactSha256:'OLD'}});
 await waitFor(()=>expect(screen.queryByText('OLD')).toBeNull());expect(screen.getByText('NEW')).toBeTruthy();
});


it('lets people cancel publication without changing the private record',async()=>{
 const fetcher=vi.fn(async(_url:unknown,_init?:RequestInit)=>Response.json({active:null,canPublish:true,preview:{artifactSha256:'private-digest',scannedAt:'2026-09-05',status:'failed-policy',findingCount:1,maxSeverity:'critical'}}));vi.stubGlobal('fetch',fetcher);
 render(<ProofSharing uploadId="proof"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Review & publish'}));
 const dialog=screen.getByRole('dialog',{name:'Review public summary'});
 expect(within(dialog).getByText('failed-policy')).toBeTruthy();
 fireEvent.click(within(dialog).getByRole('button',{name:'Cancel'}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(fetcher.mock.calls.every(([,init])=>!init?.method)).toBe(true);
 expect(screen.queryByRole('link')).toBeNull();
});

it('closes a pending publication preview when a different release is selected',async()=>{
 const fetcher=vi.fn(async(url:unknown,_init?:RequestInit)=>Response.json({active:null,canPublish:true,preview:{artifactSha256:String(url).includes('/first/')?'first-digest':'second-digest',scannedAt:'2026-09-05',status:'failed-policy',findingCount:1,maxSeverity:'critical'}}));vi.stubGlobal('fetch',fetcher);
 const result=render(<ProofSharing uploadId="first"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Review & publish'}));
 expect(screen.getByRole('dialog')).toBeTruthy();
 result.rerender(<ProofSharing uploadId="second"/>);
 await screen.findByText('second-digest');
 expect(screen.queryByRole('dialog')).toBeNull();expect(screen.queryByText('first-digest')).toBeNull();
 expect(fetcher.mock.calls.every(([,init])=>!init?.method)).toBe(true);
});

it('removes stale sharing authority after a rejected publication and requires a fresh status read',async()=>{
 let reads=0;
 const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{
  if(init?.method==='POST')return Response.json({error:'Publishing authority changed.'},{status:403});
  reads++;return Response.json({active:null,canPublish:reads===1,preview:{artifactSha256:'digest',scannedAt:'2026-09-05',status:'failed-policy',findingCount:1,maxSeverity:'critical'}});
 });vi.stubGlobal('fetch',fetcher);
 render(<ProofSharing uploadId="proof"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Review & publish'}));
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Publish summary'}));
 await screen.findByRole('alert');
 expect(screen.queryByRole('dialog')).toBeNull();expect(screen.queryByRole('button',{name:'Review & publish'})).toBeNull();expect(screen.queryByRole('link')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Retry sharing status'}));
 const publish=await screen.findByRole('button',{name:'Review & publish'});
 expect((publish as HTMLButtonElement).disabled).toBe(true);
 expect(fetcher.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);
});

it('allows an existing public link to be revoked when publication is no longer available',async()=>{
 let active=true;
 const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>{
  if(init?.method==='DELETE'){active=false;return Response.json({ok:true});}
  return Response.json({active:active?{id:'existing-share'}:null,canPublish:false,preview:null});
 });vi.stubGlobal('fetch',fetcher);
 render(<ProofSharing uploadId="archived-proof"/>);
 const revoke=await screen.findByRole('button',{name:'Revoke public link'});
 expect((revoke as HTMLButtonElement).disabled).toBe(false);
 expect((screen.getByRole('button',{name:'Replace public link'}) as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(revoke);
 fireEvent.click(within(screen.getByRole('dialog',{name:'Revoke public link'})).getByRole('button',{name:'Revoke link'}));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Revoke public link'})).toBeNull());
 expect(fetcher).toHaveBeenCalledWith('/api/uploads/archived-proof/sharing',expect.objectContaining({method:'DELETE'}));
 expect(fetcher.mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
});
