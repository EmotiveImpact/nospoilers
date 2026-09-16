// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {FirstProofOrUploads} from '../src/components/watch/FirstProofOrUploads';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('first proof evidence transition',()=>{
  it('finds workspace website evidence even when a GitHub installation is selected',async()=>{
    const fetch=vi.fn(async(url:string)=>new Response(JSON.stringify({uploads:url.includes('installationId')?[]:[{id:'web',target:'https://example.com/',source_origin_id:1,workspace_id:'workspace',status:'failed',installation_id:null,created_at:'2026-09-05',artifact_sha256:'',report_json:null,receipt_json:null,error:null}]})));vi.stubGlobal('fetch',fetch);
    render(<FirstProofOrUploads search="?workspace=workspace&install=7" nowLabel="Today"/>);
    expect(await screen.findByRole('heading',{name:'Release evidence.'})).toBeTruthy();
    expect(await screen.findByRole('button',{name:/https:\/\/example.com\//})).toBeTruthy();
    expect(screen.getByRole('tab',{name:'Attempts'}).getAttribute('aria-selected')).toBe('true');
    expect(fetch.mock.calls.every(([url])=>!url.includes('installationId'))).toBe(true);
  });
  it('shows first proof only after confirming there are no uploads',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({uploads:[]}))));
    render(<FirstProofOrUploads search="" nowLabel="Today"/>);
    expect(await screen.findByRole('heading',{name:'Prove your first release is clean.'})).toBeTruthy();
  });
  it('uses saved package evidence without requiring a connected repository',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({uploads:[{id:'a',target:'a.zip',status:'queued',installation_id:null,created_at:'2026-09-05',artifact_sha256:'abc',report_json:null,receipt_json:null,error:null}]}))));
    render(<FirstProofOrUploads search="" nowLabel="Today"/>);
    expect(await screen.findByRole('heading',{name:'Release evidence.'})).toBeTruthy();
    expect(screen.queryByRole('heading',{name:'Prove your first release is clean.'})).toBeNull();
  });
  it('does not call an unavailable API an empty workspace',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:503})));
    render(<FirstProofOrUploads search="?install=7" nowLabel="Today"/>);
    expect(await screen.findByRole('heading',{name:'Release history unavailable'})).toBeTruthy();
  });
});
