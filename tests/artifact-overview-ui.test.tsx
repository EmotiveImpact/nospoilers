// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import {ArtifactOverview} from '../src/components/watch/ArtifactOverview';
import {navigate} from '../src/nav';
vi.mock('../src/nav',()=>({navigate:vi.fn()}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
const data={workspace:{name:'Product',archived:false},counts:{total:60,active:0,attention:2,passed:58},recent:[{id:'scan',target:'package.tgz',status:'done',created_at:'2026-09-05T12:00:00Z',verdict:'Policy passed'}]};
it.each([{unverified:1,unchecked:0,title:'Your website is added. Verify ownership next.',action:'Verify website ownership'},{unverified:0,unchecked:1,title:'Ownership verified. Run your first check.',action:'Run your first website check'}])('reflects website preparation before the first result: $action',async state=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({...data,counts:{total:0,active:0,attention:0,passed:0},recent:[],websiteCoverage:{total:1,attention:1,delayed:0,...state}}))));
 render(<ArtifactOverview workspaceId="workspace" search="?workspace=workspace" nowLabel="Today"/>);
 expect(await screen.findByRole('heading',{name:state.title})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:state.action}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/sources?workspace=workspace');
 expect(screen.queryByText('Connect the release you actually ship.')).toBeNull();
});
it('shows connected checks before the first saved result without restarting onboarding',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({...data,counts:{total:0,active:0,attention:0,passed:0},recent:[],connectedActivity:[{installationId:9,name:'Second org',queued:2,running:1}]}))));
 render(<ArtifactOverview workspaceId="workspace" search="?workspace=workspace" nowLabel="Today"/>);
 expect(await screen.findByRole('region',{name:'Connected scan activity'})).toHaveProperty('textContent',expect.stringContaining('2 queued · 1 running'));
 expect(screen.queryByRole('heading',{name:'Prove your first release is clean.'})).toBeNull();
 expect(screen.queryByText('No scan evidence has been recorded in this workspace.')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'View coverage'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/sources?workspace=workspace');
});
it('routes connected evidence to its own installation instead of the selected one',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({...data,counts:{total:0,active:0,attention:0,passed:0},recent:[],hostedSources:[{installationId:9,name:'Second org',total:2,passed:1,attention:1}]}))));
 render(<ArtifactOverview workspaceId="workspace" search="?workspace=workspace&install=7" nowLabel="Today"/>);
 fireEvent.click(await screen.findByRole('button',{name:'View Second org releases'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/releases?workspace=workspace&install=9');
 expect(screen.queryByRole('heading',{name:'Prove your first release is clean.'})).toBeNull();
});
it('shows the daily workspace rather than first proof when alerts exist without uploads',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({...data,counts:{total:0,active:0,attention:0,passed:0},recent:[],alertCounts:{open:1,waiting:0,done:0,mine:0}}))));
 render(<ArtifactOverview workspaceId="workspace" search="?workspace=workspace" nowLabel="Today"/>);
 expect(await screen.findByRole('heading',{name:'Product'})).toBeTruthy();
 expect(screen.queryByRole('heading',{name:'Prove your first release is clean.'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Open: 1'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/alerts?workspace=workspace&tab=open');
});
it('opens exact response queues without treating resolved alerts as passing scans',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({...data,alertCounts:{open:3,waiting:2,done:4,mine:1}}))));
 render(<ArtifactOverview workspaceId="workspace" search="?workspace=workspace" nowLabel="Today"/>);
 fireEvent.click(await screen.findByRole('button',{name:'In progress: 2'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/alerts?workspace=workspace&tab=waiting');
 fireEvent.click(screen.getByRole('button',{name:'Assigned to me: 1'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/alerts?workspace=workspace&tab=mine');
 expect(screen.getByRole('button',{name:/^Policy passed\s*58$/}).textContent).toContain('58');
});
it('links totals to scoped release filters and recent attempts to their brief',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify(data))));
 render(<ArtifactOverview workspaceId="workspace" search="?workspace=workspace" nowLabel="Today"/>);
 fireEvent.click(await screen.findByRole('button',{name:/Need review/}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/releases?workspace=workspace&uploadStatus=attention');
 fireEvent.click(screen.getByRole('button',{name:/package.tgz/}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/releases?workspace=workspace&upload=scan&uploadView=detail');
 expect(screen.getByText(/Older failed attempts remain/)).toBeTruthy();
});
it('does not allow an archived workspace to start a scan',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({...data,workspace:{...data.workspace,archived:true}}))));
 render(<ArtifactOverview workspaceId="workspace" search="?workspace=workspace" nowLabel="Today"/>);
 expect(await screen.findByRole('button',{name:'New scan'})).toHaveProperty('disabled',true);
});
it('opens delayed website coverage without mixing it with scan findings',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({...data,websiteCoverage:{total:3,attention:2,delayed:1}}))));
 render(<ArtifactOverview workspaceId="workspace" search="?workspace=workspace" nowLabel="Today"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Monitoring delayed: 1'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/sources?workspace=workspace&websiteHealth=delayed');
 expect(screen.getByRole('button',{name:/Need review/}).textContent).toContain('2');
});
it('identifies website evidence without labelling it an artifact scan',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({...data,recent:[{...data.recent[0],target:'https://example.com/',source_kind:'website'}]}))));
 render(<ArtifactOverview workspaceId="workspace" search="?workspace=workspace" nowLabel="Today"/>);
 expect(await screen.findByText(/Website check ·/)).toBeTruthy();
 expect(screen.queryByText(/Saved artifact evidence/)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:/https:\/\/example.com/}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/releases?workspace=workspace&upload=scan&uploadView=detail');
});
