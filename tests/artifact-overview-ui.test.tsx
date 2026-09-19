// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,act} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import {ArtifactOverview} from '../src/components/watch/ArtifactOverview';
import {navigate} from '../src/nav';
vi.mock('../src/nav',()=>({navigate:vi.fn()}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
const data={workspace:{name:'Product',archived:false},counts:{total:60,active:0,attention:2,passed:58},recent:[{id:'scan',target:'package.tgz',source_kind:'artifact',status:'done',created_at:'2026-09-05T12:00:00Z',verdict:'Policy passed'}]};
function load(extra:Record<string,unknown>={}){vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...data,...extra})));render(<ArtifactOverview workspaceId="workspace" search="?workspace=workspace&install=7" nowLabel="Today"/>);}
it('matches the approved composition without old panels, release-mode tabs or an evidence drawer',async()=>{
 load({connectedCoverage:{total:4,paused:1,unknown:1,delayed:1,recent:1},alertCounts:{open:3,waiting:2,done:4,mine:1}});
 await screen.findByRole('heading',{name:'Your latest release evidence is ready.'});
 expect(screen.getByRole('columnheader',{name:'Build'})).toBeTruthy();
 expect(screen.getByRole('columnheader',{name:'Files'})).toBeTruthy();
 const recent=screen.getByRole('heading',{name:'Recent release scans'});
 const activity=screen.getByRole('heading',{name:'Source activity'});
 expect(recent.compareDocumentPosition(activity)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(screen.queryByRole('heading',{name:'Connected monitoring'})).toBeNull();
 expect(screen.queryByRole('region',{name:'Alert activity'})).toBeNull();
 expect(screen.queryByRole('region',{name:'Alert response'})).toBeNull();
 expect(screen.queryByText('Uploaded scans')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'View evidence for package.tgz'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/releases?workspace=workspace&install=7&upload=scan&uploadView=detail');
 expect(screen.queryByRole('dialog')).toBeNull();
});
it('opens the latest evidence directly and keeps workspace and installation scope',async()=>{
 load();fireEvent.click(await screen.findByRole('button',{name:'Review evidence'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/releases?workspace=workspace&install=7&upload=scan&uploadView=detail');
 fireEvent.click(screen.getByRole('button',{name:'Failed attempts needing review 2'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/releases?workspace=workspace&install=7&releaseView=attempts&uploadStatus=attention');
 fireEvent.click(screen.getByRole('button',{name:'All releases'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/releases?workspace=workspace&install=7');
});
it('places a repository exposure ahead of a passing upload and routes to the exact alert',async()=>{
 load({alertCounts:{open:1,waiting:0,done:0,mine:0},priorityAlert:{id:77,title:'Public repository detected',body:'Repository visibility changed.',kind:'repo_publicized',findings:[],created_at:'2026-09-05T13:00:00Z',acknowledged_at:null,resolved_at:null,status:'open'}});
 expect(await screen.findByRole('heading',{name:'One release alert needs your response.'})).toBeTruthy();
 expect(screen.getAllByText('Repository exposure').length).toBeGreaterThan(0);
 expect(screen.getByRole('heading',{name:'Public repository detected'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Review alert'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/alerts?workspace=workspace&install=7&alert=77&tab=open');
});
it('uses recorded severity from every finding in the priority alert',async()=>{
 load({priorityAlert:{id:78,title:'Critical archive evidence',body:'Critical evidence recorded.',kind:'release_scan',findings:[{rule:'DOC-001',path:'notes.md',severity:'warn'},{rule:'LNK-001',path:'unsafe-link',severity:'critical'}],created_at:'2026-09-05T13:00:00Z',acknowledged_at:null,resolved_at:null,status:'open'}});
 expect(await screen.findByText('Critical finding')).toBeTruthy();
 expect(screen.getByRole('heading',{name:'Critical archive evidence'})).toBeTruthy();
});
it('does not claim unavailable file counts or production verification',async()=>{
 load();await screen.findByRole('table');
 expect(screen.getByLabelText('File count not available in this summary').textContent).toBe('—');
 expect(screen.getByText('Production evidence remains a separate lane')).toBeTruthy();
 expect(screen.queryByText('Production not checked')).toBeNull();
});
it('prioritises a returned release that needs review over a newer passing record',async()=>{
 load({recent:[data.recent[0],{...data.recent[0],id:'review',target:'needs-review.tgz',created_at:'2026-09-04T12:00:00Z',verdict:'Review findings'}]});
 expect(await screen.findByRole('heading',{name:'One release needs review.'})).toBeTruthy();
 expect(screen.getByRole('heading',{name:/Release artifact.*needs-review\.tgz/})).toBeTruthy();
 expect(screen.getByRole('region',{name:'Release work'})).toBeTruthy();
 expect(screen.getByRole('complementary',{name:'Coverage status'})).toBeTruthy();
});
it('uses only actual completed returned records for daily activity',async()=>{
 const now=new Date().toISOString();
 load({recent:[{...data.recent[0],created_at:now},{...data.recent[0],id:'queued',status:'queued',created_at:now},{...data.recent[0],id:'future',created_at:'2099-01-01T00:00:00Z'}]});
 await screen.findByRole('table');
 expect(screen.getByLabelText(new RegExp('Uploaded builds, .*: 1 returned checks'))).toBeTruthy();
 expect(screen.queryByLabelText(new RegExp('Uploaded builds, .*: 2 returned checks'))).toBeNull();
 expect(screen.getByText(/Activity uses the latest five returned scans/)).toBeTruthy();
});
it.each([{total:2,paused:1,unavailable:0},{total:2,paused:0,unavailable:1},{total:3,paused:1,unavailable:1}])('preserves connected-source first-check guidance: %j',async coverage=>{
 load({counts:{total:0,active:0,attention:0,passed:0},recent:[],connectedCoverage:{...coverage,unknown:1,delayed:0,recent:0}});
 fireEvent.click(await screen.findByRole('button',{name:'Choose a connected source to check'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/sources?workspace=workspace&install=7');
});
it('starts a first package scan in the correct mode',async()=>{
 load({counts:{total:0,active:0,attention:0,passed:0},recent:[]});
 fireEvent.click(await screen.findByRole('button',{name:'Run your first scan'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/scan?workspace=workspace&install=7&mode=package');
});
it.each([{unverified:1,unchecked:0,action:'Verify website ownership'},{unverified:0,unchecked:1,action:'Run your first website check'}])('preserves website preparation guidance: $action',async state=>{
 load({counts:{total:0,active:0,attention:0,passed:0},recent:[],websiteCoverage:{total:1,attention:1,delayed:0,...state}});
 fireEvent.click(await screen.findByRole('button',{name:state.action}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/sources?workspace=workspace&install=7');
});
it('keeps suspended connections explicit without presenting a monitoring dashboard',async()=>{
 load({connectedCoverage:{total:1,paused:0,unknown:0,delayed:0,recent:0,unavailable:1}});
 expect(await screen.findByText(/1 sources unavailable because their connection is suspended/)).toBeTruthy();
 expect(screen.queryByRole('heading',{name:'Connected monitoring'})).toBeNull();
});
it('routes connected-only release evidence to its actual installation',async()=>{
 load({counts:{total:0,active:0,attention:0,passed:0},recent:[],hostedSources:[{installationId:9,name:'Second org',total:2,passed:1,attention:1}]});
 fireEvent.click(await screen.findByRole('button',{name:'View Second org releases'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/releases?workspace=workspace&install=9&releaseView=connected');
 expect(screen.queryByRole('heading',{name:'Your first release starts here.'})).toBeNull();
});
it('shows connected processing as the next action before any saved result',async()=>{
 load({counts:{total:0,active:0,attention:0,passed:0},recent:[],connectedActivity:[{installationId:9,name:'Second org',queued:2,running:1}]});
 fireEvent.click(await screen.findByRole('button',{name:'View coverage'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/sources?workspace=workspace');
 expect(screen.queryByRole('heading',{name:'Your first release starts here.'})).toBeNull();
});
it('does not allow an archived workspace to start a scan',async()=>{
 load({workspace:{...data.workspace,archived:true}});
 expect(await screen.findByText(/Restore the workspace before starting another scan\./)).toBeTruthy();
 expect(screen.queryByRole('button',{name:'New scan'})).toBeNull();
});
it('labels website evidence correctly',async()=>{
 load({recent:[{...data.recent[0],target:'https://example.com/',source_kind:'website'}]});
 expect(await screen.findByRole('heading',{name:/^Website check/})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'View evidence for https://example.com/'}));
 expect(navigate).toHaveBeenLastCalledWith('/watch/releases?workspace=workspace&install=7&upload=scan&uploadView=detail');
});
it('waits silently for evidence instead of flashing empty onboarding',async()=>{
 let finish!:(response:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;})));
 render(<ArtifactOverview workspaceId="workspace" search="?workspace=workspace" nowLabel="Today"/>);
 expect(screen.getByRole('region',{name:'Workspace overview'}).getAttribute('aria-busy')).toBe('true');
 expect(screen.queryByRole('heading')).toBeNull();
 expect(screen.getByRole('status').className).toBe('sr-only');
 await act(async()=>finish(Response.json({...data,counts:{total:0,active:0,attention:0,passed:0},recent:[]})));
 expect(await screen.findByRole('heading',{name:'Your first release starts here.'})).toBeTruthy();
});
it.each([403,503])('recovers from HTTP%s without displaying unavailable evidence as empty',async status=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({error:'Unavailable'},{status})).mockResolvedValueOnce(Response.json(data));vi.stubGlobal('fetch',fetcher);
 render(<ArtifactOverview workspaceId="workspace" search="?workspace=workspace" nowLabel="Today"/>);
 await screen.findByRole('alert');expect(screen.queryByRole('heading',{name:'Your first release starts here.'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Choose a workspace'}));expect(navigate).toHaveBeenLastCalledWith('/watch/workspaces');
 fireEvent.click(screen.getByRole('button',{name:'Retry'}));await screen.findByText(/Product · Your releases/);
 expect(screen.queryByRole('alert')).toBeNull();expect(fetcher).toHaveBeenCalledTimes(2);
});
it('clears old workspace evidence and ignores a late response',async()=>{
 let finish!:(response:Response)=>void;
 vi.stubGlobal('fetch',vi.fn((url:string)=>url.includes('/old/')?new Promise<Response>(resolve=>{finish=resolve;}):Promise.resolve(Response.json({...data,workspace:{name:'Current workspace',archived:false}}))));
 const view=render(<ArtifactOverview workspaceId="old" search="?workspace=old" nowLabel="Today"/>);
 view.rerender(<ArtifactOverview workspaceId="new" search="?workspace=new" nowLabel="Today"/>);
 await screen.findByText(/Current workspace · Your releases/);
 await act(async()=>finish(Response.json(data)));
 expect(screen.queryByText(/Product · Your releases/)).toBeNull();
});
