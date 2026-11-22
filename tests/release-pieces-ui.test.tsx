// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {UploadedReleaseBrief} from '../src/components/watch/UploadedReleaseBrief';
import type {UploadedRelease} from '../src/watch/uploaded-release';

const manifest=[{path:'app.js',size:120,sha256:'a'.repeat(64)},{path:'app.js.map',size:900,sha256:'b'.repeat(64)},{path:'package.json',size:60,sha256:'c'.repeat(64)}];
const record:UploadedRelease={id:'scan-1',target:'release.tgz',status:'done',installation_id:null,workspace_id:'workspace-1',artifact_sha256:'f'.repeat(64),created_at:'2026-11-22T08:02:00Z',receipt_json:{signature:'test'},error:null,
  report_json:{target:'release.tgz',kind:'tgz',fileCount:3,artifactBytes:1080,ok:false,status:'failed-policy',scannedAt:'2026-11-22T08:02:00Z',manifest,findings:[{rule:'MAP-003',severity:'warn',path:'app.js',title:'Map reference',detail:'Points at a map'},{rule:'MAP-001',severity:'critical',path:'app.js.map',title:'Public source map',detail:'Original source included'}]}};
const props={onBack:vi.fn(),onNewScan:vi.fn()};
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},'','/');});

describe('release check pieces',()=>{
  it('maps every inspected file, opens a finding from its tile and counts the files with nothing recorded',()=>{
    render(<UploadedReleaseBrief {...props} upload={record} search="?workspace=workspace-1&upload=scan-1&uploadTab=maps"/>);
    expect(screen.getByRole('heading',{name:'Release check',level:1})).toBeTruthy();
    const map=screen.getByRole('region',{name:'File map'});
    expect(map.querySelectorAll('.np-ft')).toHaveLength(3);
    expect(within(map).getByText('Each tile is one file')).toBeTruthy();
    expect(within(map).getByText('1.1 KB')).toBeTruthy();
    fireEvent.click(within(map).getByRole('button',{name:'Open the finding in app.js.map'}));
    const next=new URLSearchParams(window.location.search);
    expect(next.get('uploadFinding')).toBe('1');
    expect(next.get('uploadTab')).toBeNull();
  });
  it('shows the clear count only for files without a recorded finding',()=>{
    render(<UploadedReleaseBrief {...props} upload={record} search=""/>);
    expect(screen.getByText('Checked, nothing found').parentElement?.textContent).toContain('1 file');
  });
  it('draws no map when the record kept no manifest',()=>{
    render(<UploadedReleaseBrief {...props} upload={{...record,report_json:{...record.report_json!,manifest:undefined}}} search=""/>);
    expect(screen.queryByRole('region',{name:'File map'})).toBeNull();
    expect(screen.queryByText('Checked, nothing found')).toBeNull();
  });
  it('lists the areas checked and reports the receipt check exactly as the server answered',async()=>{
    const fetchMock=vi.fn(async(input:string,init?:RequestInit)=>{
      if(input==='/api/receipts/verify'){
        expect(JSON.parse(String(init?.body))).toEqual({receipt:{signature:'test'},sha256:'f'.repeat(64)});
        return new Response(JSON.stringify({ok:true,status:'failed-policy'}),{status:200});
      }
      return new Response(JSON.stringify({streams:[]}));
    });
    vi.stubGlobal('fetch',fetchMock);
    render(<UploadedReleaseBrief {...props} upload={record} search=""/>);
    expect(fetchMock.mock.calls.filter(([url])=>url==='/api/receipts/verify')).toHaveLength(0);
    fireEvent.click(screen.getByRole('tab',{name:'Proof'}));
    const wheel=screen.getByRole('img',{name:/8 areas checked/});
    expect(wheel.getAttribute('aria-label')).toContain('Source maps: 2 findings');
    expect(wheel.getAttribute('aria-label')).toContain('Live sites: Not observed');
    expect(wheel.getAttribute('aria-label')).toContain('Inventory: 3 files hashed');
    await waitFor(()=>expect(screen.getByText('Receipt passed')).toBeTruthy());
    expect(screen.getByText(/2 findings · checked 22 Nov 2026, 08:02 UTC/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab',{name:/Findings/}));fireEvent.click(screen.getByRole('tab',{name:'Proof'}));
    expect(fetchMock.mock.calls.filter(([url])=>url==='/api/receipts/verify')).toHaveLength(1);
  });
  it('never prints a pass when the receipt does not verify or the check cannot run',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(input:string)=>input==='/api/receipts/verify'?new Response(JSON.stringify({ok:false,code:'artifact-mismatch',reason:'Artifact hash differs from the receipt.'}),{status:400}):new Response(JSON.stringify({streams:[]}))));
    const view=render(<UploadedReleaseBrief {...props} upload={record} search=""/>);
    fireEvent.click(screen.getByRole('tab',{name:'Proof'}));
    await waitFor(()=>expect(screen.getByText(/Receipt check failed · Artifact hash differs from the receipt\./)).toBeTruthy());
    expect(screen.queryByText('Receipt passed')).toBeNull();
    view.unmount();
    vi.stubGlobal('fetch',vi.fn(async(input:string)=>input==='/api/receipts/verify'?new Response(JSON.stringify({error:'Too many receipt checks from this address. Wait and try again.'}),{status:429}):new Response(JSON.stringify({streams:[]}))));
    render(<UploadedReleaseBrief {...props} upload={record} search=""/>);
    fireEvent.click(screen.getByRole('tab',{name:'Proof'}));
    await waitFor(()=>expect(screen.getByText(/Too many receipt checks/)).toBeTruthy());
    expect(screen.queryByText('Receipt passed')).toBeNull();
  });
});
