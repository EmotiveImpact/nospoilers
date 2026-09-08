// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {WorkspaceExceptionRequest} from '../src/components/watch/WorkspaceExceptionRequest';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('submits a scoped request and does not describe it as approved',async()=>{
 const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>new Response(JSON.stringify(init?.method?{id:'request-id'}:{canRequest:true})));
 vi.stubGlobal('fetch',fetcher);render(<WorkspaceExceptionRequest workspaceId="workspace" attemptId="attempt" findingIndex={2} website={false}/>);
 await screen.findByRole('button',{name:'Request a policy exception'});
 await screen.findByText('Request a policy exception');
 // Permission response is asynchronous; wait for the enabled action.
 const {waitFor}=await import('@testing-library/react');await waitFor(()=>expect(screen.getByRole('button',{name:'Request a policy exception'})).toHaveProperty('disabled',false));
 fireEvent.click(screen.getByRole('button',{name:'Request a policy exception'}));
 expect(screen.getByText('Expires at 23:59:59 UTC on the selected date. Your local calendar date may differ.').id).toBe(screen.getByLabelText('Exception expiry').getAttribute('aria-describedby'));
 fireEvent.change(screen.getByLabelText('Exception justification'),{target:{value:'Risk reviewed for this artifact'}});
 fireEvent.change(screen.getByLabelText('Exception expiry'),{target:{value:'2026-12-01'}});
 fireEvent.click(screen.getByRole('button',{name:'Submit exception request'}));
 await screen.findByText(/Exception requested, not approved/);
 const submitted=JSON.parse(String(fetcher.mock.calls.find(([,init])=>init?.method==='POST')?.[1]?.body));
 expect(submitted).toMatchObject({attemptId:'attempt',findingIndex:2,reason:'Risk reviewed for this artifact'});
 expect(screen.getByRole('link',{name:'Review exception'})).toHaveProperty('href',expect.stringContaining('workspace=workspace&exception=request-id'));
});
