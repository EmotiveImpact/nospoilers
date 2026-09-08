// @vitest-environment jsdom
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import {WorkspaceCoverageHealth} from '../src/components/watch/WorkspaceCoverageHealth';
import {WatchFirstProofOverview} from '../src/components/watch/WatchFirstProofOverview';
import {HostedDecisionList} from '../src/components/watch/HostedDecisionList';
import {WorkspaceCoverageEmpty} from '../src/components/watch/WorkspaceCoverageEmpty';
import {navigate} from '../src/nav';
vi.mock('../src/nav',()=>({navigate:vi.fn()}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
it('filters workspace-wide source health and opens the exact owning connection',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({connectedCoverage:{sources:[
  {key:'repo-1',name:'Repo',installationId:7,connectionName:'First',health:'recent'},
  {key:'npm-2',name:'Package',installationId:9,connectionName:'Second',health:'delayed'}]}}))));
 render(<WorkspaceCoverageHealth workspaceId="w" search="?coverageHealth=delayed"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Package · Second · delayed'}));
 expect(screen.queryByRole('button',{name:/Repo ·/})).toBeNull();
 expect(navigate).toHaveBeenCalledWith('/watch/sources?workspace=w&install=9&source=npm-2');
});
it('uses the inspect step for an existing connection without claiming scan evidence',()=>{
 render(<WatchFirstProofOverview search="?workspace=w" nowLabel="Today" connectedSources/>);
 expect(screen.getByText('Step 2 of 4 · inspect')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Choose a connected source to check'}));
 expect(navigate).toHaveBeenCalledWith('/watch/sources?workspace=w');
});
it('uses the hosted decision API filter and opens the exact release, not an upload filter',async()=>{
 const request=vi.fn(async(_input:unknown)=>new Response(JSON.stringify({releases:[{id:32,coordinate:'npm:example@1',receiptStatus:'passed',mismatch:false,createdAt:'2026-09-08T12:00:00Z'}]})));vi.stubGlobal('fetch',request);
 render(<HostedDecisionList search="?workspace=w&install=9&hostedDecision=passed"/>);
 fireEvent.click(await screen.findByRole('button',{name:/npm:example@1/}));
 expect(request.mock.calls[0][0]).toBe('/api/releases?installationId=9&hostedDecision=passed&workspace=w');
 expect(navigate).toHaveBeenCalledWith('/watch/releases?workspace=w&install=9&release=32');
});
it('uses a focused monitoring result screen rather than appending unrelated inventory',async()=>{
 window.history.replaceState({},'', '/watch/sources?workspace=w&coverageHealth=delayed');
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({connectedCoverage:{sources:[]}}))));
 render(<WorkspaceCoverageEmpty workspace={{id:'w',name:'QA',organization_id:'org',archived_at:null,installation_id:null,role:'owner'}}/>);
 expect(await screen.findByText('No connected sources match this monitoring state.')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Connect GitHub to this workspace'})).toBeNull();
 expect(screen.getByRole('button',{name:'Manage all coverage'})).toBeTruthy();
 window.history.replaceState({},'', '/');
});
