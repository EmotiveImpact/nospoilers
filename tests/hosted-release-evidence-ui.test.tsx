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
