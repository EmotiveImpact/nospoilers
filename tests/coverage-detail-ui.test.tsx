// @vitest-environment jsdom
import {render,screen,cleanup,within} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {WatchSourcesSummary} from '../src/components/WatchSourcesSummary';
import {buildSourceViewModels} from '../src/watch/view-models';
afterEach(cleanup);
it('shows metadata and scan timestamps separately without inventing a missing scan',async()=>{
 const sources=buildSourceViewModels({repos:[],origins:[],maps:[],packages:[{id:1,package_name:'app',last_version:'1',last_sha256:null,last_checked_at:'2026-09-06T12:00:00Z',last_scanned_at:null,last_scan_status:null}]});
 render(<WatchSourcesSummary mode="sources" search="?workspace=workspace-a" sources={sources} setup={{done:0,total:5,steps:[],next:null}} selectedSourceKey="npm-1" state={{status:'ready'}}/>);
 expect(await screen.findByText('Metadata checked')).toBeTruthy();
 expect(screen.getByText('No scan time recorded')).toBeTruthy();
 expect(screen.getByRole('link',{name:'Manage workspace connections'}).getAttribute('href')).toContain('/watch/workspaces?workspace=workspace-a');
 expect(screen.getByText(/This timestamp alone does not establish a successful scan/)).toBeTruthy();
 expect(screen.getByText('Published package bytes and watched registry metadata; not the repository or deployed website.')).toBeTruthy();
});

it('keeps coverage totals scoped to the inventory rather than a filtered list',()=>{
 const sources=buildSourceViewModels({repos:[],origins:[],maps:[],packages:[{id:1,package_name:'checked-app',last_version:'1',last_sha256:null,last_checked_at:'2026-09-06T12:00:00Z',last_scanned_at:null,last_scan_status:null},{id:2,package_name:'unchecked-app',last_version:'1',last_sha256:null,last_checked_at:null,last_scanned_at:null,last_scan_status:null}]});
 render(<WatchSourcesSummary mode="sources" filter="github" sources={sources} setup={{done:0,total:5,steps:[],next:null}} state={{status:'ready'}} onRetry={()=>undefined}/>);
 const summary=screen.getByLabelText('Coverage summary');
 expect(within(summary).getByText('Monitored surfaces').parentElement?.querySelector('strong')?.textContent).toBe('2');
 expect(within(summary).getByText('Checked at least once').parentElement?.querySelector('strong')?.textContent).toBe('1');
 expect(screen.getByText('No coverage matches these filters.')).toBeTruthy();
 expect(screen.queryByText('checked-app')).toBeNull();
});
