// @vitest-environment jsdom
import {render,screen,cleanup,within,fireEvent} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {WatchSourcesSummary} from '../src/components/WatchSourcesSummary';
import {buildSourceViewModels} from '../src/watch/view-models';
import {navigate} from '../src/nav';
vi.mock('../src/nav',()=>({navigate:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('clears repository configuration and selection when switching source tabs',()=>{
 render(<WatchSourcesSummary mode="sources" filter="website" search="?workspace=w1&install=7&configure=github&source=repo-9&sourceType=website" sources={[]} setup={{done:0,total:5,steps:[],next:null}} state={{status:'ready'}} onRetry={()=>undefined}/>);
 fireEvent.click(screen.getByRole('tab',{name:'GitHub 0'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/sources?workspace=w1&install=7&sourceType=github');
 fireEvent.keyDown(screen.getByRole('tab',{name:'Websites 0'}),{key:'Home'});
 expect(navigate).toHaveBeenLastCalledWith('/watch/sources?workspace=w1&install=7&sourceType=all');
});
it('shows metadata and scan timestamps separately without inventing a missing scan',async()=>{
 const sources=buildSourceViewModels({repos:[],origins:[],maps:[],packages:[{id:1,package_name:'app',last_version:'1',last_sha256:null,last_checked_at:'2026-09-06T12:00:00Z',last_scanned_at:null,last_scan_status:null}]});
 render(<WatchSourcesSummary mode="sources" search="?workspace=workspace-a" sources={sources} setup={{done:0,total:5,steps:[],next:null}} selectedSourceKey="npm-1" state={{status:'ready'}}/>);
 expect(within(await screen.findByRole('dialog')).getByText('Metadata checked')).toBeTruthy();
 expect(screen.getByText('No scan time recorded')).toBeTruthy();
 expect(screen.getByRole('link',{name:'Manage workspace connections'}).getAttribute('href')).toContain('/watch/workspaces?workspace=workspace-a');
 expect(screen.getByText(/This timestamp alone does not establish a successful scan/)).toBeTruthy();
 expect(screen.getByText('Published package bytes and watched registry metadata; not the repository or deployed website.')).toBeTruthy();
});

it('keeps coverage totals scoped to the inventory rather than a filtered list',()=>{
 const sources=buildSourceViewModels({repos:[],origins:[],maps:[],packages:[{id:1,package_name:'checked-app',last_version:'1',last_sha256:null,last_checked_at:'2026-09-06T12:00:00Z',last_scanned_at:null,last_scan_status:null},{id:2,package_name:'unchecked-app',last_version:'1',last_sha256:null,last_checked_at:null,last_scanned_at:null,last_scan_status:null}]});
 render(<WatchSourcesSummary mode="sources" filter="github" sources={sources} setup={{done:0,total:5,steps:[],next:null}} state={{status:'ready'}} onRetry={()=>undefined}/>);
 const summary=screen.getByRole('tablist',{name:'Source types'});
 expect(within(summary).getByRole('tab',{name:'All sources 2'})).toBeTruthy();
 expect(within(summary).getByRole('tab',{name:'Packages 2'})).toBeTruthy();
 expect(screen.getByText('No coverage matches these filters.')).toBeTruthy();
 expect(screen.queryByText('checked-app')).toBeNull();
});

it('separates configured connections from actual checks and keeps selection scoped',()=>{
 const sources=buildSourceViewModels({repos:[{id:7,full_name:'org/app',private:true,last_checked_at:'2026-09-06T12:00:00Z'}],origins:[],maps:[],packages:[]});
 render(<WatchSourcesSummary mode="sources" admin search="?workspace=workspace-a&install=9" sources={sources} setup={{done:0,total:5,steps:[],next:null}} state={{status:'ready'}} onRetry={()=>undefined}/>);
 expect(screen.getByRole('columnheader',{name:'Connection'})).toBeTruthy();
 expect(screen.getByRole('columnheader',{name:'Latest check'})).toBeTruthy();
 expect(screen.getByText('Configured')).toBeTruthy();
 expect(screen.getByText('Private repository')).toBeTruthy();
 expect(screen.queryByText('Policy passed')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'View details'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/sources?workspace=workspace-a&install=9&source=repo-7');
 fireEvent.keyDown(screen.getByRole('tab',{name:'All sources 1'}),{key:'ArrowRight'});
 expect(navigate).toHaveBeenLastCalledWith('/watch/sources?workspace=workspace-a&install=9&sourceType=github');
});
it.each(['2026-09-06T12:00:00Z',null])('opens the selected GitHub repository separately from its check settings (last check: %s)',lastCheckedAt=>{
 const sources=buildSourceViewModels({repos:[{id:7,full_name:'org/app',private:true,last_checked_at:lastCheckedAt},{id:8,full_name:'org/another-app',private:false,last_checked_at:null}],origins:[],maps:[],packages:[]});
 const props={mode:'sources' as const,admin:true,search:'?workspace=workspace-a&install=9&source=repo-7',sources,setup:{done:0,total:5,steps:[],next:null},state:{status:'ready' as const},onRetry:()=>undefined};
 const view=render(<WatchSourcesSummary {...props} selectedSourceKey="repo-7"/>);
 const detail=within(screen.getByRole('dialog'));
 const link=detail.getByRole('link',{name:'Open repository'});
 expect(link.getAttribute('href')).toBe('https://github.com/org/app');
 expect(link.getAttribute('target')).toBeNull();
 expect(link.getAttribute('rel')).toContain('noopener');
 fireEvent.click(detail.getByRole('button',{name:'Manage checks'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/sources?workspace=workspace-a&install=9&source=repo-7&sourceType=github&configure=github');
 view.rerender(<WatchSourcesSummary {...props} selectedSourceKey="repo-8"/>);
 expect(within(screen.getByRole('dialog')).getByRole('link',{name:'Open repository'}).getAttribute('href')).toBe('https://github.com/org/another-app');
});
it('shows verification required as connection preparation, not a passing scan',()=>{
 const sources=buildSourceViewModels({repos:[],origins:[{id:8,origin_url:'https://example.com',host:'example.com',last_sha256:null,last_checked_at:null,last_scan_status:null,verification:{verifiedAt:null}}],maps:[],packages:[]});
 render(<WatchSourcesSummary mode="sources" sources={sources} setup={{done:0,total:5,steps:[],next:null}} state={{status:'ready'}} onRetry={()=>undefined}/>);
 expect(screen.getByText('Verify ownership')).toBeTruthy();
 expect(screen.getByText('Not scanned')).toBeTruthy();
 expect(screen.getByText('1 website needs verification')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Connect source'})).toBeNull();
});
