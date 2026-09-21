// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {HostedBriefFixture} from './ui-fixtures/HostedBriefFixture';
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},'','/');});
it('keeps the recorded receipt status separate from a legal hold',()=>{
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(()=>{})));
 render(<HostedBriefFixture mode="brief-blocked"/>);
 expect(screen.getByText('Receipt status').nextElementSibling?.textContent).toBe('Scan passed');
 expect(screen.getAllByText('Legal hold').length).toBeGreaterThan(0);
});


it('does not turn a saved passing receipt into unverified identity, delivery or approval',()=>{
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(()=>{})));
 render(<HostedBriefFixture mode="brief-blocked"/>);
 const states=screen.getByRole('group',{name:'Independent evidence states'});
 for(const name of ['Artifact inspection','Source identity','Production delivery','Release approval']){
  expect(within(within(states).getByRole('group',{name,exact:true})).getByText('Unknown')).toBeTruthy();
 }
 expect(screen.getByRole('heading',{name:'Evidence is incomplete'})).toBeTruthy();
 for(const name of ['Findings','Files','History','Proof'])expect(screen.getByRole('tab',{name})).toBeTruthy();
});

it('opens receipt verification with workspace scope and clears the selected release',()=>{
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(()=>{})));
 render(<HostedBriefFixture mode="brief"/>);
 fireEvent.click(screen.getByRole('tab',{name:'Proof'}));
 fireEvent.click(screen.getByRole('button',{name:'Verify a downloaded record'}));
 expect(window.location.pathname).toBe('/watch/scan');
 const params=new URLSearchParams(window.location.search);
 expect(params.get('workspace')).toBe('fixture');expect(params.get('mode')).toBe('receipt');
 expect(params.has('releaseFinding')).toBe(false);expect(params.has('release')).toBe(false);
});


it.each([false,true])('requests explicit confirmation for a connected public page (published=%s)',published=>{
 const fetcher=vi.fn((_url:unknown,_init?:RequestInit)=>new Promise<Response>(()=>{}));vi.stubGlobal('fetch',fetcher);
 const confirm=vi.fn();
 render(<HostedBriefFixture mode="brief" canPublish published={published} onConfirm={confirm}/>);
 fireEvent.click(screen.getByRole('tab',{name:'Proof'}));
 expect(screen.getByText(/Delivery matching is on demand, not scheduled verification/)).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:published?'Unpublish verification':'Publish verification'}));
 expect(confirm).toHaveBeenCalledWith({kind:published?'release-unpublish':'release-publish',id:1,expected:'npm:@example/long-release-package-name@2.0.0'});
 expect(fetcher.mock.calls.every(([,init])=>!(init as RequestInit|undefined)?.method)).toBe(true);
});

it('hides connected publication controls without publication authority',()=>{
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(()=>{})));
 render(<HostedBriefFixture mode="brief" canPublish={false}/>);
 fireEvent.click(screen.getByRole('tab',{name:'Proof'}));
 expect(screen.queryByRole('button',{name:'Publish verification'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Unpublish verification'})).toBeNull();
});
