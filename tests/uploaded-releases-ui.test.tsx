// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
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
    expect(await screen.findByText('Unavailable')).toBeTruthy();
    expect(screen.queryByText('Point-in-time public website scan')).toBeNull();
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
    await screen.findByRole('button',{name:/old.zip/});
    expect(fetcher).toHaveBeenCalledWith('/api/uploads?installationId=7&before=cursor&status=attention&collection=attempts',expect.anything());
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
  it.each(['','&uploadView=detail'])('keeps the workspace and package mode when starting a new attempt %s',async detail=>{
    vi.stubGlobal('fetch',vi.fn(()=>json({uploads:[{...upload('first',7),report_json:{ok:false,status:'failed-policy',kind:'tgz',fileCount:1,findings:[{rule:'MAP-001',severity:'critical',path:'index.js.map',title:'Source map',detail:'Packed map'}]}}]})));
    render(<UploadedReleases installationId={7} search={`?workspace=team&install=7&upload=first${detail}`}/>);
    if(detail)fireEvent.click(await screen.findByRole('button',{name:/Source map/}));
    fireEvent.click(await screen.findByRole('button',{name:'Upload a new attempt'}));
    expect(window.location.pathname+window.location.search).toBe('/watch/scan?install=7&workspace=team&mode=package');
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
    const view=render(<UploadedReleases installationId={7} search="?install=7&upload=first"/>);
    await screen.findByRole('heading',{name:'first.zip'});
    view.rerender(<UploadedReleases installationId={8} search="?install=8"/>);
    await waitFor(()=>expect(screen.queryByRole('heading',{name:'first.zip'})).toBeNull());
    expect(screen.getByRole('status').textContent).toContain('Loading');
  });
});

it('selects a status by keyboard while preserving tenant scope and clearing the old page and finding',async()=>{
 vi.stubGlobal('fetch',vi.fn(()=>json({uploads:[upload('first',7)]})));
 render(<UploadedReleases installationId={7} search="?workspace=team&install=7&upload=first&uploadBefore=old&uploadFinding=2&uploadTab=findings" collection="uploads"/>);
 await screen.findByRole('heading',{name:'first.zip'});
 const trigger=screen.getByRole('combobox',{name:'Status'});trigger.focus();
 await userEvent.keyboard('{Enter}');await screen.findByRole('listbox');await userEvent.keyboard('{End}{Enter}');
 await waitFor(()=>expect(new URLSearchParams(window.location.search).get('uploadStatus')).toBe('passed'));
 const query=new URLSearchParams(window.location.search);
 expect(query.get('workspace')).toBe('team');expect(query.get('install')).toBe('7');
 for(const key of ['uploadBefore','upload','uploadFinding','uploadTab'])expect(query.has(key)).toBe(false);
});

it('keeps completed builds separate from unfinished attempts and filters visible names',async()=>{
 vi.stubGlobal('fetch',vi.fn(()=>json({uploads:[upload('failed',7),{...upload('complete',7),status:'done',report_json:{ok:true,status:'passed',fileCount:2,findings:[]}}]})));
 const view=render(<UploadedReleases installationId={7} search="?install=7" collection="uploads"/>);
 await screen.findByRole('button',{name:/complete.zip/});expect(screen.queryByRole('button',{name:/failed.zip/})).toBeNull();
 fireEvent.change(screen.getByRole('searchbox',{name:'Find a build'}),{target:{value:'absent'}});expect(screen.queryByRole('button',{name:/complete.zip/})).toBeNull();
 fireEvent.change(screen.getByRole('searchbox',{name:'Find a build'}),{target:{value:''}});
 view.rerender(<UploadedReleases installationId={7} search="?install=7" collection="attempts"/>);
 expect(await screen.findByRole('button',{name:/failed.zip/})).toBeTruthy();
 expect(screen.queryByRole('button',{name:/complete.zip/})).toBeNull();
});

it('selects the first visible release into the evidence pane without inventing production proof',async()=>{
 vi.stubGlobal('fetch',vi.fn(()=>json({uploads:[{...upload('complete',7),status:'done',report_json:{ok:true,status:'passed',fileCount:2,findings:[]}}]})));
 render(<UploadedReleases installationId={7} search="?install=7" collection="uploads"/>);
 expect(await screen.findByRole('heading',{name:'complete.zip'})).toBeTruthy();
 expect(screen.getByRole('table').querySelector('tr[aria-current="true"]')).toBeTruthy();
 expect(screen.getByText('Unobserved')).toBeTruthy();
 expect(screen.getByText(/Production delivery is assessed separately from artifact inspection/)).toBeTruthy();
});

it('does not claim exact source identity when a failed attempt has no recorded digest',async()=>{
 vi.stubGlobal('fetch',vi.fn(()=>json({uploads:[{...upload('unidentified',7),artifact_sha256:null}]})));
 render(<UploadedReleases installationId={7} search="?install=7" collection="attempts"/>);
 expect(await screen.findByRole('heading',{name:'unidentified.zip'})).toBeTruthy();
 expect(screen.getByText('Unrecorded')).toBeTruthy();
 expect(screen.getByText('Exact artifact identity was not recorded for this attempt.')).toBeTruthy();
});


it('opens the selected full brief through one primary action and preserves workspace scope',async()=>{
 vi.stubGlobal('fetch',vi.fn(()=>json({uploads:[upload('first',7),upload('second',7)]})));
 const view=render(<UploadedReleases installationId={7} search="?workspace=team&install=7&upload=first"/>);
 await screen.findByRole('heading',{name:'first.zip'});
 expect(screen.queryByRole('button',{name:'View evidence'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:/second.zip/}));
 view.rerender(<UploadedReleases installationId={7} search={window.location.search}/>);
 await screen.findByRole('heading',{name:'second.zip'});
 const actions=screen.getAllByRole('button',{name:'Open full release brief'});
 expect(actions).toHaveLength(1);fireEvent.click(actions[0]);
 const params=new URLSearchParams(window.location.search);
 expect(params.get('workspace')).toBe('team');expect(params.get('install')).toBe('7');
 expect(params.get('upload')).toBe('second');expect(params.get('uploadView')).toBe('detail');
});
