// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {HostedReleaseEvidence} from '../src/components/watch/HostedReleaseEvidence';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const finding={rule:'MAP-001',severity:'critical',path:'app.map',title:'Exposed map',detail:'Saved source map finding'};
it('requests an exception for the selected hosted receipt, not an upload or the previous release',async()=>{
 const fetcher=vi.fn(async(url:unknown,init?:RequestInit)=>new Response(JSON.stringify(init?.method?{id:'request'}:String(url).endsWith('/exceptions')?{canRequest:true}:{available:true,workspaceId:'workspace',report:{findings:[finding],suppressed:[]}})));
 vi.stubGlobal('fetch',fetcher);render(<HostedReleaseEvidence releaseId={8} receiptId={17} search="?release=8&releaseFinding=0"/>);
 await screen.findByText('Saved source map finding');await waitFor(()=>expect(screen.getByRole('button',{name:'Request a policy exception'})).toHaveProperty('disabled',false));
 fireEvent.click(screen.getByRole('button',{name:'Request a policy exception'}));
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
