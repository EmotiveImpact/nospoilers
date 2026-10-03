// @vitest-environment jsdom
import {useEffect,useState} from 'react';
import {act,cleanup,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {UploadedReleases} from '../src/components/watch/UploadedReleases';
import {radixUiTestSupport} from './helpers/radix-ui';

radixUiTestSupport();
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},'','/');});
const upload=(index:number)=>({id:`upload-${index}`,installation_id:7,workspace_id:'team',target:index===64?'distant build.zip':`build-${index}.zip`,status:'done',artifact_sha256:'abc',created_at:'2026-10-03T10:00:00Z',report_json:{ok:true,status:'passed',kind:'zip',fileCount:2,findings:[]},receipt_json:null,error:null});
const rows=Array.from({length:65},(_,index)=>upload(index));

function Fixture(){
 const [search,setSearch]=useState(window.location.search);
 useEffect(()=>{const update=()=>setSearch(window.location.search);window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update);},[]);
 return <UploadedReleases installationId={7} search={search} collection="uploads"/>;
}
function listFetcher(url:string){
 const p=new URL(url,'https://example.test').searchParams;
 const matching=rows.filter(row=>row.target.includes(p.get('q')??''));
 const before=p.get('before'),start=before?matching.findIndex(row=>row.id===before)+1:0,size=Number(p.get('pageSize'));
 const result=matching.slice(start,start+size);
 return Promise.resolve(Response.json({uploads:result,nextCursor:start+size<matching.length?result.at(-1)!.id:null}));
}
function open(search='?workspace=team&install=7&releaseView=uploads'){
 window.history.replaceState({},'','/watch/releases'+search);
 return render(<Fixture/>);
}
const countRows=()=>within(screen.getByRole('table')).getAllByRole('row').length-1;
async function size(value:30|60){
 await userEvent.click(screen.getByRole('combobox',{name:'Builds per page'}));
 await userEvent.click(screen.getByRole('option',{name:String(value),exact:true}));
}

it('requests ten by default and walks back one visited page while preserving tenant and collection',async()=>{
 const fetcher=vi.fn(listFetcher);vi.stubGlobal('fetch',fetcher);open();
 await screen.findByRole('heading',{name:'build-0.zip'});
 expect(countRows()).toBe(10);
 expect(screen.getByRole('navigation').textContent).toContain('Page 1 · 10 builds');
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));
 await screen.findByRole('heading',{name:'build-10.zip'});
 expect(screen.getByRole('navigation').textContent).toContain('Page 2 · 10 builds');
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));
 await screen.findByRole('heading',{name:'build-20.zip'});
 await userEvent.click(screen.getByRole('button',{name:'Previous',exact:true}));
 await screen.findByRole('heading',{name:'build-10.zip'});
 const p=new URLSearchParams(window.location.search);
 expect(p.get('workspace')).toBe('team');expect(p.get('install')).toBe('7');expect(p.get('releaseView')).toBe('uploads');
 expect(p.get('uploadBefore')).toBe('upload-9');
 expect(JSON.parse(p.get('uploadTrail')!)).toEqual([null,'upload-9']);
 expect(fetcher.mock.calls.every(([url])=>new URL(url,'https://example.test').searchParams.get('pageSize')==='10')).toBe(true);
});

it('changes to thirty and sixty actual server rows, returning to the first page',async()=>{
 vi.stubGlobal('fetch',vi.fn(listFetcher));open();await screen.findByRole('heading',{name:'build-0.zip'});
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));await screen.findByRole('heading',{name:'build-10.zip'});
 await size(30);await screen.findByRole('heading',{name:'build-0.zip'});
 expect(countRows()).toBe(30);expect(new URLSearchParams(window.location.search).has('uploadBefore')).toBe(false);
 expect(new URLSearchParams(window.location.search).has('uploadTrail')).toBe(false);
 await size(60);await waitFor(()=>expect(countRows()).toBe(60));
 expect(new URLSearchParams(window.location.search).get('uploadPageSize')).toBe('60');
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));await screen.findByRole('heading',{name:'build-60.zip'});
 expect(countRows()).toBe(5);expect(screen.getByRole('button',{name:'Next',exact:true})).toHaveProperty('disabled',true);
});

it('searches beyond the loaded page and keeps typing focus, spaces and route scope',async()=>{
 const fetcher=vi.fn(listFetcher);vi.stubGlobal('fetch',fetcher);open();await screen.findByRole('heading',{name:'build-0.zip'});
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));await screen.findByRole('heading',{name:'build-10.zip'});
 const input=screen.getByRole('searchbox',{name:'Find a build'});
 await userEvent.type(input,'  distant ');
 await screen.findByRole('heading',{name:'distant build.zip'});
 expect(document.activeElement).toBe(input);expect(input).toHaveProperty('value','  distant ');
 const p=new URLSearchParams(window.location.search);
 expect(p.get('uploadQuery')).toBe('  distant ');expect(p.get('workspace')).toBe('team');expect(p.get('install')).toBe('7');
 expect(p.has('uploadBefore')).toBe(false);expect(p.has('uploadTrail')).toBe(false);
 expect(new URL(fetcher.mock.calls.at(-1)![0],'https://example.test').searchParams.get('q')).toBe('distant');
 expect(countRows()).toBe(1);
});

it('preserves an off-page selected record without inserting it into the ten-row page',async()=>{
 vi.stubGlobal('fetch',vi.fn((url:string)=>url.startsWith('/api/uploads?')?listFetcher(url):Promise.resolve(Response.json(url==='/api/uploads/linked'?{upload:{...upload(64),id:'linked'}}:{}))));
 open('?workspace=team&install=7&releaseView=uploads&upload=linked');
 await screen.findByRole('heading',{name:'distant build.zip'});
 expect(countRows()).toBe(10);
 expect(within(screen.getByRole('table')).queryByText('distant build.zip')).toBeNull();
 expect(screen.getByRole('navigation').textContent).toContain('Page 1 · 10 builds');
 expect(screen.getByRole('status').textContent).toContain('outside the selected status filter or history page');
 await userEvent.click(screen.getByRole('button',{name:'Open full release brief'}));
 expect(new URLSearchParams(window.location.search).get('upload')).toBe('linked');
 expect(new URLSearchParams(window.location.search).get('uploadView')).toBe('detail');
});

it('hides old page evidence and controls while the next page loads, and ignores late aborted responses',async()=>{
 let finish!:(response:Response)=>void;let signal:AbortSignal|null=null;
 const pending=new Promise<Response>(resolve=>{finish=resolve;});
 vi.stubGlobal('fetch',vi.fn((url:string,options?:RequestInit)=>{
  const before=new URL(url,'https://example.test').searchParams.get('before');
  if(before==='upload-9'){signal=options?.signal as AbortSignal;return pending;}
  return listFetcher(url);
 }));
 open();await screen.findByRole('heading',{name:'build-0.zip'});
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));
 expect(screen.queryByRole('heading',{name:'build-0.zip'})).toBeNull();expect(screen.queryByRole('navigation')).toBeNull();
 const input=screen.getByRole('searchbox',{name:'Find a build'});await userEvent.type(input,'distant');
 await screen.findByRole('heading',{name:'distant build.zip'});
 expect(signal?.aborted).toBe(true);
 await act(async()=>{finish(Response.json({uploads:rows.slice(10,20),nextCursor:'upload-19'}));await pending;});
 expect(screen.getByRole('heading',{name:'distant build.zip'})).toBeTruthy();
 expect(screen.queryByRole('heading',{name:'build-10.zip'})).toBeNull();
});

it('restores page size and search from the URL and safely falls back from a malformed trail',async()=>{
 const fetcher=vi.fn(listFetcher);vi.stubGlobal('fetch',fetcher);
 open('?workspace=team&install=7&releaseView=uploads&uploadBefore=upload-29&uploadPageSize=30&uploadQuery=build&uploadTrail=malformed');
 await screen.findByRole('heading',{name:'build-30.zip'});
 expect(countRows()).toBe(30);expect(screen.getByRole('searchbox')).toHaveProperty('value','build');
 await userEvent.click(screen.getByRole('button',{name:'Previous',exact:true}));await screen.findByRole('heading',{name:'build-0.zip'});
 expect(new URLSearchParams(window.location.search).get('uploadPageSize')).toBe('30');
 expect(new URLSearchParams(window.location.search).get('uploadQuery')).toBe('build');
});
