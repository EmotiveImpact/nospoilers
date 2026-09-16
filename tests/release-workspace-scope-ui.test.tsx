// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {parseWatchRoute,watchHref,watchPath} from '../src/watch/routes';
import {Button} from '../src/components/ui/button';
import {ReleasesScreen} from '../src/components/watch/screens/ReleasesScreen';
const state=vi.hoisted(()=>({search:'',activeInstallId:7,route:{view:'releases'},releases:[]} as Record<string,any>));
vi.mock('../src/components/watch/useWatchScreenContext',()=>({useWatchScreenContext:()=>state}));
vi.mock('../src/components/watch/UploadedReleases',()=>({UploadedReleases:({installationId}:{installationId:number|null})=><p>Saved scope: {installationId??'workspace'}</p>}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('does not hide an independent website attempt behind the selected GitHub ledger',()=>{
 state.search='?workspace=workspace-one&install=7&upload=website-attempt&uploadView=detail';
 render(<ReleasesScreen/>);
 expect(screen.getByText('Saved scope: workspace')).toBeTruthy();
});
it('retains installation isolation for legacy URLs without workspace scope',()=>{
 state.search='?install=7&upload=ci-attempt&uploadView=detail';
 render(<ReleasesScreen/>);
 expect(screen.getByText('Saved scope: 7')).toBeTruthy();
});

function listContext(search:string){
 Object.assign(state,{search,route:parseWatchRoute('/watch/releases',search),activeInstallId:7,releases:[],selectedRelease:null,Button,canExportReleases:true,datasetState:{releases:{status:'ready'}},ledgerExportError:null,receiptError:null,watchHref,watchPath,navigate:vi.fn(),setLedgerExportError:vi.fn(),loadJson:vi.fn().mockResolvedValue({exportedAt:'2026-09-09T00:00:00Z'}),scopedApi:(path:string,id:number)=>`${path}?installationId=${id}`});
}
it.each([['?workspace=w&install=7','Uploaded builds'],['?workspace=w&install=7&releaseView=connected','Connected releases'],['?workspace=w&install=7&preview=7','Connected releases'],['?workspace=w&install=7&releaseView=connected&upload=attempt','Uploaded builds']])('restores the history surface from %s', (search,name)=>{
 listContext(search);render(<ReleasesScreen/>);
 expect(screen.getByRole('tab',{name}).getAttribute('aria-selected')).toBe('true');
 expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(screen.getByRole('tab',{name}).id);
});
it('switches history with keyboard while clearing only conflicting selection context',()=>{
 listContext('?workspace=w&install=7&upload=attempt&uploadTab=maps&uploadFinding=1');
 const view=render(<ReleasesScreen/>);const attempts=screen.getByRole('tab',{name:'Uploaded builds'});
 attempts.focus();fireEvent.keyDown(attempts,{key:'ArrowRight'});
 expect(document.activeElement).toBe(screen.getByRole('tab',{name:'Connected releases'}));
 const destination=state.navigate.mock.lastCall[0];const query=new URL(destination,'http://localhost').searchParams;
 expect(query.get('workspace')).toBe('w');expect(query.get('install')).toBe('7');expect(query.get('releaseView')).toBe('connected');
 for(const key of ['upload','uploadTab','uploadFinding'])expect(query.has(key)).toBe(false);
 state.search=new URL(destination,'http://localhost').search;state.route=parseWatchRoute('/watch/releases',state.search);view.rerender(<ReleasesScreen/>);
 expect(screen.getByText('No repository-linked revisions yet')).toBeTruthy();
 fireEvent.keyDown(screen.getByRole('tab',{name:'Connected releases'}),{key:'Home'});
 state.search=new URL(state.navigate.mock.lastCall[0],'http://localhost').search;state.route=parseWatchRoute('/watch/releases',state.search);view.rerender(<ReleasesScreen/>);
 expect(screen.getByText('Saved scope: workspace')).toBeTruthy();
});
it('keeps connected export and shows an uploaded filename while linking the exact revision',async()=>{
 listContext('?workspace=w&install=7&releaseView=connected');
 const coordinate='upload:12345678-1234-1234-1234-123456789012#dist/app.tgz';
 state.releases=[{id:7,receiptId:14,channel:'stable',coordinate,artifactSha256:'a'.repeat(64),artifactBytes:2048,mediaType:'application/gzip',sourceRevision:null,ciRunUrl:null,mismatch:false,receiptStatus:'passed',createdAt:'2026-09-04T14:42:00Z',locations:[],approval:null,legalHold:null,publicPage:null,attestations:[]}];
 const create=vi.fn(()=> 'blob:test');Object.defineProperty(URL,'createObjectURL',{configurable:true,value:create});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:vi.fn()});vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 render(<ReleasesScreen/>);expect(screen.getByText('app.tgz')).toBeTruthy();expect(screen.queryByText(coordinate)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'View evidence'}));expect(new URL(state.navigate.mock.lastCall[0],'http://localhost').searchParams.get('release')).toBe('7');
 fireEvent.click(screen.getByRole('button',{name:'Export ledger'}));
 await waitFor(()=>expect(create).toHaveBeenCalled());expect(state.loadJson).toHaveBeenCalledWith('/api/releases/export?installationId=7');
});
