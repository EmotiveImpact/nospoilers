// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {WebsiteAlertRecheck} from '../src/components/watch/WebsiteAlertRecheck';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('only queues on demand and reuses the request identity after an uncertain failure',async()=>{
 const fetch=vi.fn().mockRejectedValueOnce(new Error('Connection interrupted')).mockImplementationOnce(async(_url,init)=>new Response(JSON.stringify({id:JSON.parse(init.body).attemptId}),{status:202}));vi.stubGlobal('fetch',fetch);
 render(<WebsiteAlertRecheck workspaceId="workspace" sourceId={7} canRespond/>);
 expect(fetch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Recheck website'}));await screen.findByRole('alert');
 fireEvent.click(screen.getByRole('button',{name:'Recheck website'}));await screen.findByRole('link',{name:'View the new check'});
 expect(fetch.mock.calls[0][0]).toBe('/api/workspaces/workspace/origins/7/check');
 expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
 expect((screen.getByRole('button',{name:'Recheck website'}) as HTMLButtonElement).disabled).toBe(true);
});
