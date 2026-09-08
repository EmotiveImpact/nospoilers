// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {UploadedReleaseBrief} from '../src/components/watch/UploadedReleaseBrief';
import type {UploadedRelease} from '../src/watch/uploaded-release';

const record:UploadedRelease={id:'scan-1',target:'release.tgz',status:'done',installation_id:null,workspace_id:'workspace-1',artifact_sha256:'abc',created_at:'2026-09-05T10:00:00Z',receipt_json:null,error:null,report_json:{target:'release.tgz',kind:'tgz',fileCount:2,ok:false,status:'failed-policy',scannedAt:'2026-09-05T10:00:00Z',findings:[{rule:'MAP-001',severity:'critical',path:'app.js.map',title:'Public source map',detail:'Original source included'},{rule:'SEC-001',severity:'warn',path:'config.json',title:'Embedded credential',detail:'Check and rotate this credential'}]}};
afterEach(()=>{cleanup();window.history.replaceState({},'','/');});
const props={onBack:vi.fn(),onNewScan:vi.fn()};
describe('uploaded readiness evidence',()=>{
  it('uses website scope and returns to the owning source controls without uploading or scanning',()=>{
    render(<UploadedReleaseBrief {...props} upload={{...record,source_origin_id:5,target:'https://example.com/'}} search="?workspace=workspace-1&install=2"/>);
    expect(screen.getByRole('heading',{name:'Review website exposure'})).toBeTruthy();
    expect(screen.getByText(/bounded website check/)).toBeTruthy();
    expect(screen.queryByRole('button',{name:/Upload a new attempt/})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Open website controls'}));
    expect(window.location.pathname+window.location.search).toBe('/watch/sources?workspace=workspace-1&configure=website');
  });
  it('explains private downloads and keeps verification inside the scoped app',()=>{
    render(<UploadedReleaseBrief {...props} upload={{...record,receipt_json:{signature:'test'}}} search="?workspace=workspace-1&install=2&upload=scan-1"/>);
    expect(screen.getByText(/downloaded JSON may contain file names/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Verify a downloaded record'}));
    expect(window.location.pathname).toBe('/watch/scan');
    const params=new URLSearchParams(window.location.search);
    expect(params.get('workspace')).toBe('workspace-1');expect(params.get('install')).toBe('2');expect(params.get('mode')).toBe('receipt');expect(params.has('upload')).toBe(false);
  });
  it('shows the recorded artifact decision without asserting unperformed checks',()=>{
    render(<UploadedReleaseBrief {...props} upload={record} search="?workspace=workspace-1&upload=scan-1&uploadView=detail"/>);
    expect(screen.getByRole('heading',{name:'Hold this artifact'})).toBeTruthy();
    expect(screen.getByText(/this upload does not establish them/)).toBeTruthy();
    expect(screen.queryByText('Personal workspace')).toBeNull();
    expect(screen.getByRole('heading',{name:'Public source map'})).toBeTruthy();
  });
  it('keeps workspace and record scope when filtering by keyboard',()=>{
    render(<UploadedReleaseBrief {...props} upload={record} search="?workspace=workspace-1&upload=scan-1&uploadView=detail&uploadFinding=1"/>);
    fireEvent.keyDown(screen.getByRole('tab',{name:/All findings/}),{key:'ArrowRight'});
    const params=new URLSearchParams(window.location.search);
    expect(params.get('workspace')).toBe('workspace-1');expect(params.get('upload')).toBe('scan-1');
    expect(params.get('uploadTab')).toBe('maps');expect(params.has('uploadFinding')).toBe(false);
  });
  it('does not substitute another finding for a stale deep link',()=>{
    render(<UploadedReleaseBrief {...props} upload={record} search="?uploadTab=maps&uploadFinding=1"/>);
    expect(screen.getByRole('heading',{name:'Finding unavailable in this view'})).toBeTruthy();
    expect(screen.queryByRole('heading',{name:'Public source map'})).toBeNull();
  });
  it('never treats unfinished evidence as a clean release',()=>{
    render(<UploadedReleaseBrief {...props} upload={{...record,status:'running',report_json:null}} search=""/>);
    expect(screen.getByRole('heading',{name:'Inspecting artifact'})).toBeTruthy();
    expect(screen.getByText(/No completed artifact evidence/)).toBeTruthy();
    expect(screen.queryByRole('button',{name:/Signed scan record/})).toBeNull();
  });
});
