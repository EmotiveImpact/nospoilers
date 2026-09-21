// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import userEvent from '@testing-library/user-event';
import {UploadedReleaseBrief} from '../src/components/watch/UploadedReleaseBrief';
import type {UploadedRelease} from '../src/watch/uploaded-release';
import {sample,NOW} from './assurance-fixtures';
import {buildAssuranceView} from '../src/assurance/index';

const record:UploadedRelease={id:'scan-1',target:'release.tgz',status:'done',installation_id:null,workspace_id:'workspace-1',artifact_sha256:'abc',created_at:'2026-09-05T10:00:00Z',receipt_json:null,error:null,report_json:{target:'release.tgz',kind:'tgz',fileCount:2,ok:false,status:'failed-policy',scannedAt:'2026-09-05T10:00:00Z',findings:[{rule:'MAP-001',severity:'critical',path:'app.js.map',title:'Public source map',detail:'Original source included'},{rule:'SEC-001',severity:'warn',path:'config.json',title:'Embedded credential',detail:'Check and rotate this credential'}]}};
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},'','/');});
const props={onBack:vi.fn(),onNewScan:vi.fn()};
describe('uploaded readiness evidence',()=>{
  it('shows one canonical decision and clears it when refreshed evidence is unavailable',async()=>{
    const snapshot=sample();snapshot.release.id=record.id;
    const view=buildAssuranceView(snapshot,null,NOW,'uploaded-scan');
    let unavailable=false;
    vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
      if(String(input).startsWith('/api/assurance/'))return new Response(JSON.stringify(unavailable?{error:'Access no longer available.'}:{view}),{status:unavailable?403:200});
      return new Response(JSON.stringify({streams:[]}));
    }));
    render(<UploadedReleaseBrief {...props} upload={{...record,readiness:view.assessment}} search=""/>);
    fireEvent.click(screen.getByRole('tab',{name:'History'}));
    const inspect=await screen.findByRole('button',{name:'Inspect review'});
    expect(screen.getAllByRole('heading',{name:'Passes recorded checks'})).toHaveLength(1);
    fireEvent.click(inspect);
    await screen.findByRole('button',{name:'Refresh saved snapshot'});
    unavailable=true;fireEvent.click(screen.getByRole('button',{name:'Refresh saved snapshot'}));
    await waitFor(()=>expect(screen.getByRole('heading',{name:'Evidence is incomplete'})).toBeTruthy());
    expect(screen.queryByRole('heading',{name:'Passes recorded checks'})).toBeNull();
  });
  it('uses website scope and returns to the owning source controls without uploading or scanning',()=>{
    render(<UploadedReleaseBrief {...props} upload={{...record,source_origin_id:5,target:'https://example.com/'}} search="?workspace=workspace-1&install=2"/>);
    expect(screen.getByRole('heading',{name:'Evidence is incomplete'})).toBeTruthy();
    expect(screen.getByText(/bounded website check/)).toBeTruthy();
    expect(screen.queryByRole('button',{name:/Upload a new attempt/})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Open website controls'}));
    expect(window.location.pathname+window.location.search).toBe('/watch/sources?workspace=workspace-1&configure=website');
  });
  it('explains private downloads and keeps verification inside the scoped app',()=>{
    render(<UploadedReleaseBrief {...props} upload={{...record,receipt_json:{signature:'test'}}} search="?workspace=workspace-1&install=2&upload=scan-1"/>);
    expect(screen.getByText(/downloaded JSON may contain file names/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab',{name:'Proof'}));
    fireEvent.click(screen.getByRole('button',{name:'Verify a downloaded record'}));
    expect(window.location.pathname).toBe('/watch/scan');
    const params=new URLSearchParams(window.location.search);
    expect(params.get('workspace')).toBe('workspace-1');expect(params.get('install')).toBe('2');expect(params.get('mode')).toBe('receipt');expect(params.has('upload')).toBe(false);
  });
  it('shows the recorded artifact decision without asserting unperformed checks',()=>{
    render(<UploadedReleaseBrief {...props} upload={record} search="?workspace=workspace-1&upload=scan-1&uploadView=detail"/>);
    expect(screen.getByRole('heading',{name:'Evidence is incomplete'})).toBeTruthy();
    expect(screen.getByText(/Source identity, production delivery and release approval are separate checks/)).toBeTruthy();
    expect(screen.queryByText('Personal workspace')).toBeNull();
    expect(screen.getByRole('heading',{name:'Public source map'})).toBeTruthy();
  });
  it('keeps workspace and record scope when filtering by keyboard',()=>{
    const view=render(<UploadedReleaseBrief {...props} upload={record} search="?workspace=workspace-1&upload=scan-1&uploadView=detail&uploadFinding=1"/>);
    fireEvent.keyDown(screen.getByRole('tab',{name:/All findings/}),{key:'ArrowRight'});
    const params=new URLSearchParams(window.location.search);
    expect(params.get('workspace')).toBe('workspace-1');expect(params.get('upload')).toBe('scan-1');
    expect(params.get('uploadTab')).toBe('maps');expect(params.has('uploadFinding')).toBe(false);
    view.rerender(<UploadedReleaseBrief {...props} upload={record} search={window.location.search}/>);
    const maps=screen.getByRole('tab',{name:/Maps/});
    expect(maps.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel',{name:/Maps/}).id).toBe(maps.getAttribute('aria-controls'));
    expect(screen.getByRole('tabpanel',{name:/Maps/}).getAttribute('aria-labelledby')).toBe(maps.id);
  });
  it('does not substitute another finding for a stale deep link',()=>{
    render(<UploadedReleaseBrief {...props} upload={record} search="?uploadTab=maps&uploadFinding=1"/>);
    expect(screen.getByRole('heading',{name:'Finding unavailable in this view'})).toBeTruthy();
    expect(screen.queryByRole('heading',{name:'Public source map'})).toBeNull();
  });
  it('never treats unfinished evidence as a clean release',()=>{
    render(<UploadedReleaseBrief {...props} upload={{...record,status:'running',report_json:null}} search=""/>);
    expect(screen.getByRole('heading',{name:'Inspecting artifact'})).toBeTruthy();
    expect(screen.getByText('Inspection not completed')).toBeTruthy();
    expect(screen.queryByRole('button',{name:/Signed scan record/})).toBeNull();
  });
});

it('switches release content with keyboard without changing record scope',async()=>{
  vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(()=>{})));
  const search='?workspace=workspace-1&upload=scan-1&uploadView=detail';
  window.history.replaceState({},'', '/watch/releases'+search);
  render(<UploadedReleaseBrief {...props} upload={{...record,receipt_json:{signature:'test'}}} search={search}/>);
  const findings=screen.getByRole('tab',{name:'Findings 2'});findings.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab',{name:'Files'}).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByRole('region',{name:'Artifact record'})).toBeTruthy();
  expect(screen.queryByRole('heading',{name:'Public source map'})).toBeNull();
  await userEvent.keyboard('{End}');
  expect(screen.getByRole('region',{name:'Release proof'})).toBeTruthy();
  expect(window.location.search).toBe(search);
});
it('does not present zero recorded findings as a passing decision',()=>{
  vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(()=>{})));
  render(<UploadedReleaseBrief {...props} upload={{...record,report_json:{...record.report_json!,findings:[],ok:false,status:'inconclusive'}}} search=""/>);
  expect(screen.getByRole('heading',{name:'No findings to review'})).toBeTruthy();
  expect(screen.getByText(/This does not establish a passing decision; review/)).toBeTruthy();
  expect(screen.queryByRole('heading',{name:'Select a finding'})).toBeNull();
  expect(screen.queryByRole('heading',{name:'Passes recorded checks'})).toBeNull();
});

it('opens visible findings before focusing a review action from History',async()=>{
 const snapshot=sample();snapshot.release.id=record.id;
 const view=buildAssuranceView(snapshot,null,NOW,'uploaded-scan');view.assessment.nextAction='review-findings';
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>Response.json(String(input).startsWith('/api/assurance/')?{view}:{streams:[]})));
 Element.prototype.scrollIntoView=vi.fn();
 render(<UploadedReleaseBrief {...props} upload={record} search="?upload=scan-1&uploadView=detail"/>);
 fireEvent.click(screen.getByRole('tab',{name:'History'}));
 fireEvent.click(await screen.findByRole('button',{name:'Inspect review'}));
 fireEvent.click(await screen.findByRole('button',{name:'Review recorded findings'}));
 expect(screen.getByRole('tab',{name:'Findings 2'}).getAttribute('aria-selected')).toBe('true');
 expect(screen.getByRole('heading',{name:'Findings 2'})).toBe(document.activeElement);
 expect(screen.getByRole('heading',{name:'Public source map'})).toBeTruthy();
});

it('keeps all recorded findings without a redundant category row for a maps-only artifact',()=>{
  const map=record.report_json!.findings[0];
  render(<UploadedReleaseBrief {...props} upload={{...record,report_json:{...record.report_json!,findings:[map,{...map,path:'vendor.js.map',title:'Vendor source map'}]}}} search="?workspace=workspace-1&upload=scan-1"/>);
  expect(screen.queryByRole('tablist',{name:'Finding category'})).toBeNull();
  expect(screen.getByRole('button',{name:/Vendor source map/})).toBeTruthy();
  expect(screen.getByRole('heading',{name:'Public source map'})).toBeTruthy();
});

it('keeps the four release sections available even when no signed receipt or history is recorded',()=>{
  vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(()=>{})));
  render(<UploadedReleaseBrief {...props} upload={record} search="?workspace=workspace-1&upload=scan-1"/>);
  for(const name of ['Findings 2','Files','History','Proof'])expect(screen.getByRole('tab',{name})).toBeTruthy();
  fireEvent.click(screen.getByRole('tab',{name:'Files'}));
  expect(screen.getByText('No manifest is available for this result.')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab',{name:'Proof'}));
  expect(screen.getByRole('region',{name:'Release proof'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Signed scan record'})).toBeNull();
  expect(screen.queryByRole('button',{name:/Publish/})).toBeNull();
});


it('keeps unverified identity, production and approval unknown even when a saved job finished',()=>{
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(()=>{})));
 render(<UploadedReleaseBrief {...props} upload={record} search="?workspace=workspace-1&upload=scan-1"/>);
 const states=screen.getByRole('group',{name:'Independent evidence states'});
 for(const name of ['Artifact inspection','Source identity','Production delivery','Release approval']){
  const status=within(states).getByRole('group',{name,exact:true});
  expect(within(status).getByText('Unknown')).toBeTruthy();
 }
 expect(screen.getByRole('heading',{name:'Evidence is incomplete'})).toBeTruthy();
 expect(within(states).queryByRole('button')).toBeNull();
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(within(states).getAllByText(/verified assessment is not available/)).toHaveLength(4);
});


it.each([
 ['passed','Recorded pass'],['failed','Needs action'],['review','Review evidence'],
 ['stale','Stale observation'],['unknown','Unknown'],['not-configured','Not observed'],
] as const)('renders the production evidence state %s independently of the artifact result',(state,label)=>{
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(()=>{})));
 const snapshot=sample();snapshot.release.id=record.id;
 const assessment=buildAssuranceView(snapshot,null,NOW,'uploaded-scan').assessment;
 assessment.checks=assessment.checks.map(check=>check.id==='delivery'?{...check,state}:check);
 render(<UploadedReleaseBrief {...props} upload={{...record,readiness:assessment}} search=""/>);
 const tile=screen.getByRole('group',{name:'Production delivery',exact:true});
 expect(within(tile).getByText(label)).toBeTruthy();
 expect(within(tile).queryByRole('button')).toBeNull();
 expect(screen.getByRole('heading',{name:'Passes recorded checks'})).toBeTruthy();
});
