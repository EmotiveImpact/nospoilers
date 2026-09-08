// @vitest-environment jsdom
import {render,screen,cleanup} from '@testing-library/react';
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
