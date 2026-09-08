// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
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
 fireEvent.click(screen.getByRole('button',{name:'Publish this summary'}));
 expect(await screen.findByRole('link')).toHaveProperty('href',expect.stringContaining('/api/public/upload-proofs/token'));
 fireEvent.click(await screen.findByRole('button',{name:'Revoke public link'}));
 await waitFor(()=>expect(screen.queryByRole('link')).toBeNull());
 expect(fetcher).toHaveBeenCalledWith('/api/uploads/proof/sharing',expect.objectContaining({method:'POST',body:'{"confirm":true}'}));
});
it('allows a failed status read to be retried',async()=>{
 let attempts=0;vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(++attempts===1?{error:'failed'}:{active:null,canPublish:false,preview:null}),{status:attempts===1?503:200})));
 render(<ProofSharing uploadId="proof"/>);expect(await screen.findByRole('alert')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Retry sharing status'}));
 await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
 expect((screen.getByRole('button',{name:'Publish this summary'}) as HTMLButtonElement).disabled).toBe(true);
});
it('ignores old response bodies after switching release scope',async()=>{
 let resolveOld!:(value:unknown)=>void;
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.includes('/old/')?{ok:true,status:200,json:()=>new Promise(resolve=>{resolveOld=resolve;})}:new Response(JSON.stringify({active:null,canPublish:true,preview:{artifactSha256:'NEW',scannedAt:'today',status:'passed',findingCount:0,maxSeverity:null}}))));
 const view=render(<ProofSharing uploadId="old"/>);await waitFor(()=>expect(resolveOld).toBeDefined());
 view.rerender(<ProofSharing uploadId="new"/>);expect(await screen.findByText('NEW')).toBeTruthy();
 resolveOld({active:null,canPublish:true,preview:{artifactSha256:'OLD'}});
 await waitFor(()=>expect(screen.queryByText('OLD')).toBeNull());expect(screen.getByText('NEW')).toBeTruthy();
});
