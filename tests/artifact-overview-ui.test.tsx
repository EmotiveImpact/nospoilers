// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import {ArtifactOverview} from '../src/components/watch/ArtifactOverview';
import {navigate} from '../src/nav';
vi.mock('../src/nav',()=>({navigate:vi.fn()}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
const data={workspace:{name:'Product',archived:false},counts:{total:60,active:0,attention:2,passed:58},recent:[{id:'scan',target:'package.tgz',status:'done',created_at:'2026-09-05T12:00:00Z',verdict:'Policy passed'}]};
it.each([{total:2,paused:1,unavailable:0},{total:2,paused:0,unavailable:1},{total:3,paused:1,unavailable:1}])('keeps first-check guidance when another source remains available: %j',async coverage=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({...data,counts:{total:0,active:0,attention:0,passed:0},recent:[],connectedCoverage:{...coverage,unknown:1,delayed:0,recent:0}}))));
 render(<ArtifactOverview workspaceId="workspace" search="?workspace=workspace" nowLabel="Today"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Choose a connected source to check'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/sources?workspace=workspace');
});
it('first-proof package action replaces a remembered GitHub mode while retaining workspace scope',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({...data,counts:{total:0,active:0,attention:0,passed:0},recent:[]}))));
 render(<ArtifactOverview workspaceId="workspace" search="?workspace=workspace&mode=github" nowLabel="Today"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Scan a package instead'}));
 expect(screen.getByText('Completed checks preserve their outcome')).toBeTruthy();
 expect(screen.getByText(/A signature does not mean the release passed/)).toBeTruthy();
 const destination=new URL(String(vi.mocked(navigate).mock.calls.at(-1)?.[0]),'http://localhost');
 expect(destination.pathname).toBe('/watch/scan');
 expect(destination.searchParams.get('workspace')).toBe('workspace');
 expect(destination.searchParams.get('mode')).toBe('package');
});
it.each([true,false])('shows suspended connection warning with first-proof=%s',async(firstProof)=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({...data,...(firstProof?{counts:{total:0,active:0,attention:0,passed:0},recent:[]}:{}),connectedCoverage:{total:1,paused:0,unknown:0,delayed:0,recent:0,unavailable:1}}))));
 render(<ArtifactOverview workspaceId="workspace" search="?workspace=workspace" nowLabel="Today"/>);
 expect(await screen.findByText(/1 sources unavailable because their connection is suspended/)).toBeTruthy();
 if(firstProof)expect(screen.getByRole('heading',{name:'Prove your first release is clean.'})).toBeTruthy();
 else expect(screen.getByRole('button',{name:/^Policy passed\s*58$/})).toBeTruthy();
});
it('shows connected monitoring separately from passing release totals',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({...data,connectedCoverage:{total:4,paused:1,unknown:1,delayed:1,recent:1,connections:[{installationId:9,name:'Second org'}]}}))));
 render(<ArtifactOverview workspaceId="workspace" search="?workspace=workspace" nowLabel="Today"/>);
 expect(await screen.findByRole('button',{name:'4 sources'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'1 delayed'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/sources?workspace=workspace&coverageHealth=delayed');
 fireEvent.click(screen.getByRole('button',{name:'Review connected coverage'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/sources?workspace=workspace&coverageHealth=all');
 fireEvent.click(screen.getByText('Individual connections'));
 fireEvent.click(screen.getByRole('button',{name:'Review Second org coverage'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/sources?workspace=workspace&install=9');
 expect(screen.getByRole('button',{name:/^Policy passed\s*58$/})).toBeTruthy();
});
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
 expect(await screen.findByText(/Restore the workspace before starting another scan\./)).toBeTruthy();
 expect(screen.queryByRole('button',{name:'New scan'})).toBeNull();
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

it('puts next action and recent evidence before secondary monitoring without repeating the scan action',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...data,connectedCoverage:{total:1,recent:1,paused:0,unknown:0,delayed:0,unavailable:0}})));
 render(<ArtifactOverview workspaceId="workspace" search="?workspace=workspace" nowLabel="Today"/>);
 const next=await screen.findByRole('heading',{name:'Next action'});
 const recent=screen.getByRole('heading',{name:'Recent attempts'});
 const monitoring=screen.getByRole('heading',{name:'Connected monitoring'});
 expect(next.compareDocumentPosition(recent)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(recent.compareDocumentPosition(monitoring)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(screen.queryByRole('button',{name:'New scan'})).toBeNull();
});
