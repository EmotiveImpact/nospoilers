// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {WorkspaceCoverageEmpty} from '../src/components/watch/WorkspaceCoverageEmpty';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('offers explicit connection without running requests on entry and distinguishes history from monitoring',()=>{
 const fetch=vi.fn().mockResolvedValue(new Response('{"origins":[]}'));vi.stubGlobal('fetch',fetch);
 render(<WorkspaceCoverageEmpty workspace={{id:'one',name:'Studio',organization_id:'org',archived_at:null,installation_id:null,role:'admin'}}/>);
 expect(screen.getByRole('heading',{name:'Coverage'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Connect GitHub to this workspace'}).hasAttribute('disabled')).toBe(false);
 expect(screen.getByText(/Uploading a package does not turn on continuous monitoring/)).toBeTruthy();
 expect(fetch.mock.calls.every(call=>call[1]?.method!=='POST')).toBe(true);
});
it('explains read-only and archived connection restrictions',()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{"origins":[]}')));
 const workspace={id:'one',name:'Studio',organization_id:'org',archived_at:null,installation_id:null,role:'viewer'};
 const {rerender}=render(<WorkspaceCoverageEmpty workspace={workspace}/>);
 expect(screen.getByRole('button',{name:'Connect GitHub to this workspace'}).hasAttribute('disabled')).toBe(true);
 expect(screen.getAllByRole('status').some(row=>row.textContent?.includes('administrator'))).toBe(true);
 rerender(<WorkspaceCoverageEmpty workspace={{...workspace,role:'owner',archived_at:'2026-09-05'}}/>);
 expect(screen.getAllByRole('status').some(row=>row.textContent?.includes('Restore'))).toBe(true);
});
