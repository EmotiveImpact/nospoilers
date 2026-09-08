// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadedReleases } from '../src/components/watch/UploadedReleases';

const upload=(id:string,installation_id:number)=>({id,installation_id,target:`${id}.zip`,status:'failed',artifact_sha256:'abc',created_at:'2026-09-05T10:00:00Z',report_json:null,receipt_json:null,error:'Scan failed'});
const json=(body:unknown)=>Promise.resolve(new Response(JSON.stringify(body)));
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},'','/');});

describe('uploaded release workspace flow',()=>{
  it('changes the decision preview with selection and restores it from the URL',async()=>{
    vi.stubGlobal('fetch',vi.fn(()=>json({uploads:[upload('first',7),upload('second',7)]})));
    const view=render(<UploadedReleases installationId={7} search="?workspace=team&install=7&upload=first"/>);
    await screen.findByRole('heading',{name:'first.zip'});
    fireEvent.click(screen.getByRole('button',{name:/second.zip/}));
    expect(new URLSearchParams(window.location.search).get('upload')).toBe('second');
    expect(new URLSearchParams(window.location.search).get('workspace')).toBe('team');
    view.rerender(<UploadedReleases installationId={7} search={window.location.search}/>);
    await screen.findByRole('heading',{name:'second.zip'});
    expect(screen.queryByRole('heading',{name:'first.zip'})).toBeNull();
    view.rerender(<UploadedReleases installationId={7} search="?workspace=team&install=7&upload=first"/>);
    await screen.findByRole('heading',{name:'first.zip'});
    expect(screen.queryByRole('heading',{name:'second.zip'})).toBeNull();
  });
  it('ignores an older list response after the selected release changes',async()=>{
    let finish!:(response:Response)=>void;
    const oldResponse=new Promise<Response>(resolve=>{finish=resolve;});
    vi.stubGlobal('fetch',vi.fn().mockReturnValueOnce(oldResponse).mockImplementation(()=>json({uploads:[upload('second',7)]})));
    const view=render(<UploadedReleases installationId={7} search="?install=7&upload=first"/>);
    view.rerender(<UploadedReleases installationId={7} search="?install=7&upload=second"/>);
    await screen.findByRole('heading',{name:'second.zip'});
    await act(async()=>finish(new Response(JSON.stringify({uploads:[upload('first',7)]}))));
    expect(screen.getByRole('heading',{name:'second.zip'})).toBeTruthy();
    expect(screen.queryByRole('heading',{name:'first.zip'})).toBeNull();
  });
  it('explains a linked attempt outside the active status filter',async()=>{
    vi.stubGlobal('fetch',vi.fn((url:string)=>url.startsWith('/api/uploads/')?json({upload:upload('failed',7)}):json({uploads:[]})));
    render(<UploadedReleases installationId={7} search="?install=7&upload=failed&uploadStatus=passed"/>);
    expect(await screen.findByRole('heading',{name:'failed.zip'})).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('outside the selected status filter');
    expect(screen.getByText('No results match this status. Change the filter to see other releases.')).toBeTruthy();
  });
  it('routes website retry to coverage instead of asking for an artifact upload',async()=>{
    vi.stubGlobal('fetch',vi.fn(()=>json({uploads:[{...upload('website',7),workspace_id:'team',source_origin_id:4,target:'https://example.com/'}]})));
    render(<UploadedReleases installationId={7} search="?workspace=team&install=7&upload=website"/>);
    fireEvent.click(await screen.findByRole('button',{name:'Open website controls'}));
    expect(window.location.pathname+window.location.search).toBe('/watch/sources?workspace=team&configure=website');
    expect(screen.queryByRole('button',{name:'Upload a new attempt'})).toBeNull();
  });
  it('does not mistake an empty status filter for an empty customer workspace',async()=>{
    vi.stubGlobal('fetch',vi.fn(()=>json({uploads:[],nextCursor:null})));
    render(<UploadedReleases installationId={7} search="?install=7&uploadStatus=passed"/>);
    expect(await screen.findByText('No releases match this filter or page. Choose another status or return to the newest releases.')).toBeTruthy();
    expect(screen.queryByText(/create your first release/)).toBeNull();
  });
  it('navigates older history with a scoped URL and clears the previous selection',async()=>{
    vi.stubGlobal('fetch',vi.fn(()=>json({uploads:[upload('first',7)],nextCursor:'cursor'})));
    render(<UploadedReleases installationId={7} search="?workspace=team&install=7&upload=first"/>);
    fireEvent.click(await screen.findByRole('button',{name:'Older releases'}));
    const query=new URLSearchParams(window.location.search);
    expect(query.get('workspace')).toBe('team');expect(query.get('install')).toBe('7');expect(query.get('uploadBefore')).toBe('cursor');expect(query.has('upload')).toBe(false);
  });
  it('requests server-side filters and restores an older page from its URL',async()=>{
    const fetcher=vi.fn(()=>json({uploads:[upload('old',7)],nextCursor:null}));vi.stubGlobal('fetch',fetcher);
    render(<UploadedReleases installationId={7} search="?install=7&uploadBefore=cursor&uploadStatus=attention"/>);
    await screen.findByRole('heading',{name:'old.zip'});
    expect(fetcher).toHaveBeenCalledWith('/api/uploads?installationId=7&before=cursor&status=attention',expect.anything());
    fireEvent.click(screen.getByRole('button',{name:'Newest releases'}));expect(new URLSearchParams(window.location.search).has('uploadBefore')).toBe(false);
  });
  it('distinguishes an unavailable deep link from a first-time empty workspace',async()=>{
    vi.stubGlobal('fetch',vi.fn((url:string)=>url.startsWith('/api/uploads/')?Promise.resolve(new Response('{}',{status:404})):json({uploads:[]})));
    render(<UploadedReleases installationId={7} search="?install=7&upload=missing"/>);
    expect(await screen.findByText('This upload is unavailable in the current workspace. Select another release.')).toBeTruthy();
    expect(screen.queryByText(/create your first release/)).toBeNull();
  });
  it('treats a detail service failure as retryable, not a missing release',async()=>{
    vi.stubGlobal('fetch',vi.fn((url:string)=>url.startsWith('/api/uploads/')?Promise.resolve(new Response('{}',{status:503})):json({uploads:[]})));
    render(<UploadedReleases installationId={7} search="?install=7&upload=missing"/>);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button',{name:'Try again'})).toBeTruthy();
  });
  it('keeps the workspace when starting a new attempt',async()=>{
    vi.stubGlobal('fetch',vi.fn(()=>json({uploads:[upload('first',7)]})));
    render(<UploadedReleases installationId={7} search="?install=7&upload=first"/>);
    fireEvent.click(await screen.findByRole('button',{name:'Upload a new attempt'}));
    expect(window.location.pathname+window.location.search).toBe('/watch/scan?install=7');
  });
  it('does not insert another workspace result into the selected workspace',async()=>{
    vi.stubGlobal('fetch',vi.fn((url:string)=>url.startsWith('/api/uploads/')?json({upload:upload('other',8)}):json({uploads:[upload('first',7)]})));
    render(<UploadedReleases installationId={7} search="?install=7&upload=other"/>);
    expect(await screen.findByText('This upload is unavailable in the current workspace. Select another release.')).toBeTruthy();
    expect(screen.queryByText('other.zip')).toBeNull();
  });
  it('clears previous workspace evidence while the next workspace loads',async()=>{
    const fetcher=vi.fn((url:string)=>url.includes('installationId=7')?json({uploads:[upload('first',7)]}):new Promise<Response>(()=>{}));
    vi.stubGlobal('fetch',fetcher);
    const view=render(<UploadedReleases installationId={7} search="?install=7"/>);
    await screen.findByRole('heading',{name:'first.zip'});
    view.rerender(<UploadedReleases installationId={8} search="?install=8"/>);
    await waitFor(()=>expect(screen.queryByRole('heading',{name:'first.zip'})).toBeNull());
    expect(screen.getByRole('status').textContent).toContain('Loading');
  });
});
