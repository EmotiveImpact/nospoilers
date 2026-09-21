// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor,within} from '@testing-library/react';
import {HostedReleaseEvidence} from '../src/components/watch/HostedReleaseEvidence';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const finding={rule:'MAP-001',severity:'critical',path:'app.map',title:'Exposed map',detail:'Saved source map finding'};
it('requests an exception for the selected hosted receipt, not an upload or the previous release',async()=>{
 const fetcher=vi.fn(async(url:unknown,init?:RequestInit)=>new Response(JSON.stringify(init?.method?{id:'request'}:String(url).endsWith('/exceptions')?{canRequest:true}:{available:true,workspaceId:'workspace',report:{findings:[finding],suppressed:[]}})));
 vi.stubGlobal('fetch',fetcher);render(<HostedReleaseEvidence releaseId={8} receiptId={17} search="?release=8&releaseFinding=0"/>);
 await screen.findByText('Saved source map finding');await waitFor(()=>expect(screen.getByRole('button',{name:'Request a policy exception'})).toHaveProperty('disabled',false));
 fireEvent.click(screen.getByRole('button',{name:'Request a policy exception'}));
 expect(screen.getByRole('button',{name:'Request a policy exception'}).getAttribute('aria-expanded')).toBe('true');
 expect(screen.getByRole('form',{name:'Request a policy exception'}).id).toBe(screen.getByRole('button',{name:'Request a policy exception'}).getAttribute('aria-controls'));
 fireEvent.change(screen.getByLabelText('Exception justification'),{target:{value:'Reviewed exact hosted artifact'}});
 fireEvent.change(screen.getByLabelText('Exception expiry'),{target:{value:'2026-12-01'}});
 fireEvent.click(screen.getByRole('button',{name:'Submit exception request'}));
 await screen.findByText(/Exception requested, not approved/);
 const body=JSON.parse(String(fetcher.mock.calls.find(([,init])=>init?.method==='POST')?.[1]?.body));
 expect(body).toMatchObject({receiptId:17,findingIndex:0});expect(body).not.toHaveProperty('attemptId');
});
it('clears old findings immediately on a different release and explicitly reports unavailable history',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>new Response(JSON.stringify(String(url).endsWith('/exceptions')?{canRequest:false}:String(url).includes('/8/')?{available:true,workspaceId:'workspace',report:{findings:[finding]}}:{available:false,reason:'Full details were not retained.'}))));
 const view=render(<HostedReleaseEvidence releaseId={8} receiptId={17} search="?release=8"/>);
 await screen.findByText('Saved source map finding');
 view.rerender(<HostedReleaseEvidence releaseId={9} receiptId={18} search="?release=9"/>);
 expect(screen.queryByText('Saved source map finding')).toBeNull();
 await screen.findByText('Full details were not retained.');expect(screen.queryByRole('button',{name:'Request a policy exception'})).toBeNull();
});
it('announces the selected connected finding while preserving URL scope and queue focus',async()=>{
 const second={...finding,rule:'SEC-001',path:'a/very/long/build/path/config.json',title:'Saved credential warning',detail:'Second saved finding details'};
 vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>Response.json(String(url).endsWith('/exceptions')?{canRequest:false}:{available:true,workspaceId:'workspace',report:{findings:[finding,second],suppressed:[]}})));
 const search='?workspace=workspace&install=7&release=8';
 window.history.replaceState({},'',`/watch/releases${search}`);
 const view=render(<HostedReleaseEvidence releaseId={8} receiptId={17} search={search}/>);
 const panel=await screen.findByRole('complementary',{name:'Selected recorded finding'});
 expect(panel.getAttribute('aria-live')).toBe('polite');
 expect(within(panel).getByText('Saved source map finding')).toBeTruthy();
 const row=screen.getByRole('button',{name:/Saved credential warning/});row.focus();fireEvent.click(row);
 expect(new URLSearchParams(window.location.search).get('workspace')).toBe('workspace');
 expect(new URLSearchParams(window.location.search).get('install')).toBe('7');
 expect(new URLSearchParams(window.location.search).get('releaseFinding')).toBe('1');
 view.rerender(<HostedReleaseEvidence releaseId={8} receiptId={17} search={window.location.search}/>);
 expect(within(panel).getByText('Second saved finding details')).toBeTruthy();
 expect(within(panel).queryByText('Saved source map finding')).toBeNull();
 expect(row.getAttribute('aria-pressed')).toBe('true');
 expect(document.activeElement).toBe(row);
});

it('shows only a genuinely retained manifest in the Files section',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({available:true,workspaceId:'workspace',report:{fileCount:1,findings:[],manifest:[{path:'dist/app.js',size:123,sha256:'abc'}]}})));
 const view=render(<HostedReleaseEvidence releaseId={8} receiptId={17} search="?release=8" activeSection="files"/>);
 expect(await screen.findByRole('cell',{name:'dist/app.js'})).toBeTruthy();
 expect(screen.getByRole('cell',{name:'123 bytes'})).toBeTruthy();
 expect(screen.queryByRole('region',{name:'Saved release findings'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Inspect dist/app.js'}));
 const file=screen.getByRole('dialog',{name:'Recorded file metadata'});
 expect(within(file).getByText('abc')).toBeTruthy();
 expect(within(file).getByText('123 bytes')).toBeTruthy();
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({available:true,workspaceId:'workspace',report:{fileCount:1,findings:[]}})));
 view.rerender(<HostedReleaseEvidence releaseId={9} receiptId={18} search="?release=9" activeSection="files"/>);
 expect(await screen.findByText(/No file manifest was retained/)).toBeTruthy();
 expect(screen.queryByRole('cell',{name:'dist/app.js'})).toBeNull();
 expect(screen.queryByRole('dialog')).toBeNull();
});

it('keeps a single-category connected release focused on its complete findings list',async()=>{
 const second={...finding,path:'vendor.map',title:'Vendor source map'};
 vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>Response.json(String(url).endsWith('/exceptions')?{canRequest:false}:{available:true,workspaceId:'workspace',report:{findings:[finding,second]}})));
 render(<HostedReleaseEvidence releaseId={8} receiptId={17} search="?release=8"/>);
 await screen.findByText('Saved source map finding');
 expect(screen.queryByRole('group',{name:'Finding category'})).toBeNull();
 expect(screen.getByRole('button',{name:/Vendor source map/})).toBeTruthy();
});

it('filters mixed connected findings without changing the receipt or workspace scope',async()=>{
 const secret={...finding,rule:'SEC-001',path:'config.json',title:'Embedded credential',detail:'Saved credential finding'};
 vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>Response.json(String(url).endsWith('/exceptions')?{canRequest:false}:{available:true,workspaceId:'workspace',report:{findings:[finding,secret]}})));
 const search='?workspace=workspace&install=7&release=8&releaseFinding=0';
 window.history.replaceState({},'',`/watch/releases${search}`);
 const view=render(<HostedReleaseEvidence releaseId={8} receiptId={17} search={search}/>);
 const categories=await screen.findByRole('group',{name:'Finding category'});
 fireEvent.click(within(categories).getByRole('button',{name:/Secrets/}));
 view.rerender(<HostedReleaseEvidence releaseId={8} receiptId={17} search={window.location.search}/>);
 expect(screen.queryByRole('button',{name:/Exposed map/})).toBeNull();
 expect(screen.getByRole('button',{name:/Embedded credential/})).toBeTruthy();
 const params=new URLSearchParams(window.location.search);
 expect(params.get('workspace')).toBe('workspace');expect(params.get('install')).toBe('7');expect(params.get('release')).toBe('8');
});
