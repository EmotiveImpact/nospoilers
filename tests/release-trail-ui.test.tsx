// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {TrailView} from '../src/components/pieces/TrailView';
import {HourGrid,VersionLine} from '../src/components/pieces/Trail';
import {ReleaseTrail} from '../src/components/watch/ReleaseTrail';
import {AlertAfterFix} from '../src/components/watch/AlertAfterFix';
import {buildReleaseTrail,trailTime,type ReleaseTrailInput} from '../src/watch/release-trail';

const BAD='a'.repeat(64),GOOD='b'.repeat(64);
const now=new Date('2026-11-05T12:20:00.000Z');
const at=(hour:number,minute=5)=>`2026-11-05T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00.000Z`;
const blocked={id:3,coordinate:'npm:acme-cli@2.4.1',status:'failed-policy',artifactSha256:BAD,createdAt:at(8,0)};
const fix={id:4,coordinate:'npm:acme-cli@2.4.2',status:'passed',artifactSha256:GOOD,createdAt:at(10,0)};
const input=(extra:Partial<ReleaseTrailInput>={}):ReleaseTrailInput=>({
  release:blocked,lineage:[blocked,fix],
  locations:[
    {id:1,url:'https://registry.npmjs.org/acme-cli/-/acme-cli-2.4.1.tgz',host:'registry.npmjs.org',canonical:true,lastStatus:'missing',lastSha256:null,lastCheckedAt:at(12)},
    {id:2,url:'https://cdn.acme.example/cli/2.4.1/cli.tgz',host:'cdn.acme.example',canonical:false,lastStatus:'matched',lastSha256:BAD,lastCheckedAt:at(12)},
  ],
  checks:[8,9,10,11,12].flatMap(hour=>[
    {locationId:1,status:hour<10?'matched':'missing',observedSha256:hour<10?BAD:null,createdAt:at(hour)},
    {locationId:2,status:'matched',observedSha256:BAD,createdAt:at(hour)},
  ]),
  websites:[{id:1,host:'app.acme.example',status:'passed',publicMap:false,checkedAt:at(11)}],
  alerts:[{id:9,title:'cdn.acme.example still serves npm:acme-cli@2.4.1 after the fix',createdAt:at(10,42),resolvedAt:null}],
  now,...extra,
});
const exposedModel=()=>buildReleaseTrail(input());
const clearModel=()=>buildReleaseTrail(input({locations:input().locations.map(location=>location.id===2?{...location,lastStatus:'missing',lastSha256:null}:location),alerts:[]}));

afterEach(()=>{cleanup();vi.unstubAllGlobals();});

describe('trail times',()=>{
  it('shows the clock time today and the day otherwise, in UTC',()=>{
    expect(trailTime(at(10,42),now)).toBe('10:42');
    expect(trailTime('2026-11-04T20:05:00.000Z',now)).toBe('4 Nov 20:05');
    expect(trailTime(null,now)).toBe('Not recorded');
  });
});

describe('Where it went',()=>{
  it('draws every source with what it returned and names the copy still serving the blocked build',()=>{
    render(<TrailView model={exposedModel()} now={now}/>);
    const net=screen.getByRole('img',{name:/acme-cli 2\.4\.1 linked to each place it is served/});
    expect(net.getAttribute('aria-label')).toContain('npm registry: No longer served');
    expect(net.getAttribute('aria-label')).toContain('cdn.acme.example: Still serving this build');
    expect(net.getAttribute('aria-label')).toContain('app.acme.example: Clean at its last check');
    const sources=screen.getByRole('complementary',{name:'Connected sources'});
    expect(within(sources).getByText('Still serving')).toBeTruthy();
    expect(within(sources).getByText('Clear · 10:05')).toBeTruthy();
    expect(within(sources).getByText('Verified website · watched separately')).toBeTruthy();
    expect(screen.getByText('1 source carries this build')).toBeTruthy();
    expect(screen.getByText('cdn.acme.example is still serving').parentElement?.textContent).toBe('cdn.acme.example is still serving 2.4.1 after 2.4.2 passed. Alert sent 10:42 UTC.');
  });

  it('switches between when it was found and now using recorded checks only',()=>{
    render(<TrailView model={exposedModel()} now={now}/>);
    fireEvent.click(screen.getByRole('button',{name:'When found · 08:05'}));
    expect(screen.getByRole('button',{name:'When found · 08:05'}).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('2 sources carry this build')).toBeTruthy();
    expect(screen.getByRole('img',{name:/linked to each place/}).getAttribute('aria-label')).toContain('npm registry: Serving this build');
    fireEvent.click(screen.getByRole('button',{name:'Now'}));
    expect(screen.getByText('1 source carries this build')).toBeTruthy();
  });

  it('says every copy is clear only when no tracked source serves the blocked build',()=>{
    render(<TrailView model={clearModel()} now={now}/>);
    expect(screen.getByText('No copies exposed.').parentElement?.textContent).toContain('No tracked source serves the blocked build any more.');
    expect(screen.queryByText(/still serving/)).toBeNull();
  });

  it('does not offer a found view or an hourly grid before anything was read',()=>{
    render(<TrailView model={buildReleaseTrail(input({locations:[],checks:[],websites:[],alerts:[]}))} now={now}/>);
    expect(screen.queryByRole('button',{name:/When found/})).toBeNull();
    expect(screen.getByText('First check pending')).toBeTruthy();
    expect(screen.queryByText('After the fix')).toBeNull();
    expect(screen.getByText(/Attach a delivery URL to track where this release is served/)).toBeTruthy();
  });
});

describe('After the fix',()=>{
  it('marks the blocked version and the fix on the version line',()=>{
    render(<VersionLine versions={exposedModel().versions} now={now}/>);
    expect(screen.getByRole('img',{name:'Versions: 2.4.1 was blocked, 2.4.2 passed and fixed it'})).toBeTruthy();
    expect(screen.getByText('Blocked · 08:00')).toBeTruthy();
    expect(screen.getByText('Fix passed · 10:00')).toBeTruthy();
  });

  it('shows each tracked copy hour by hour and leaves context sources out',()=>{
    const model=exposedModel();
    const {container}=render(<div className="np"><HourGrid sources={model.sources} hours={model.hours} now={now}/></div>);
    expect(container.querySelectorAll('.np-hline')).toHaveLength(2);
    expect(screen.getByRole('img',{name:'npm registry, last 24 hours: 2 exposed, 3 clear'})).toBeTruthy();
    expect(screen.getByRole('img',{name:'cdn.acme.example, last 24 hours: 5 exposed'})).toBeTruthy();
    expect(screen.getByText('Still exposed')).toBeTruthy();
    expect(screen.getByText('Clear since 10:05')).toBeTruthy();
    expect(container.querySelectorAll('.np-hcells i.is-none')).toHaveLength(38);
  });
});

describe('loading the trail in the app',()=>{
  it('loads the recorded trail for the release and renders it',async()=>{
    const fetchMock=vi.fn(async()=>new Response(JSON.stringify({trail:exposedModel()}),{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',fetchMock);
    render(<ReleaseTrail releaseId={3} active/>);
    expect(await screen.findByRole('heading',{name:'Where it went'})).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/releases/3/trail',expect.objectContaining({credentials:'include'}));
    expect(screen.getByText(/Checked hourly · 1 source is still serving this build/)).toBeTruthy();
  });

  it('does not fetch until the section is opened',()=>{
    const fetchMock=vi.fn();
    vi.stubGlobal('fetch',fetchMock);
    const {container}=render(<ReleaseTrail releaseId={3} active={false}/>);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.textContent).toBe('');
  });

  it('shows the failure and retries instead of presenting an empty trail',async()=>{
    const fetchMock=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({error:'Unknown release.'}),{status:404}))
      .mockResolvedValueOnce(new Response(JSON.stringify({trail:clearModel()}),{status:200}));
    vi.stubGlobal('fetch',fetchMock);
    render(<ReleaseTrail releaseId={3} active/>);
    expect((await screen.findByRole('alert')).textContent).toBe('Unknown release.');
    expect(screen.queryByRole('heading',{name:'Where it went'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Retry'}));
    await waitFor(()=>expect(screen.getByText('No copies exposed.')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('adds After the fix to an alert only when its release has tracked copies',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({trail:exposedModel()}),{status:200})));
    render(<AlertAfterFix releaseId={3} href="/watch/releases?release=3&releaseTab=where"/>);
    const block=await screen.findByRole('region',{name:'After the fix'});
    expect(within(block).getByText('Fix passed · 5 Nov 10:00')).toBeTruthy();
    expect(within(block).getByRole('link',{name:'Open Where it went'}).getAttribute('href')).toBe('/watch/releases?release=3&releaseTab=where');
    cleanup();
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({trail:buildReleaseTrail(input({locations:[],checks:[]}))}),{status:200})));
    const {container}=render(<AlertAfterFix releaseId={3} href="/x"/>);
    await waitFor(()=>expect(vi.mocked(fetch)).toHaveBeenCalled());
    await new Promise(resolve=>setTimeout(resolve,20));
    expect(container.textContent).toBe('');
  });
});
