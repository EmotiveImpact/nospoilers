// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {ReleaseAssurancePanel} from '../src/components/watch/ReleaseAssurancePanel';

const {readView,renderView}=vi.hoisted(()=>({readView:vi.fn(),renderView:vi.fn()}));
vi.mock('../src/assurance/client',()=>({readAssuranceView:readView,downloadPassport:vi.fn()}));
vi.mock('../src/assurance/render',()=>({renderAssurancePanel:renderView}));
// Mount contract only: real history authorization is verified separately by its API tests.
vi.mock('../src/components/watch/ReleaseIntelligencePanel',()=>({ReleaseIntelligenceFromRecord:({record}:{record:{kind:string;id:string}})=><section aria-label="Independent history">{record.kind}:{record.id}</section>}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
const props={kind:'upload' as const,recordId:'record-one',evidenceId:'evidence'};

it.each([500,403,404])('keeps independent history discovery mounted after assurance HTTP %s without asserting a passing assessment',async status=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'Assurance unavailable.'},{status})));
  const assessment=vi.fn();render(<ReleaseAssurancePanel {...props} onAssessment={assessment}/>);
  await screen.findByRole('alert');
  expect(screen.getByRole('region',{name:'Independent history'}).textContent).toBe('upload:record-one');
  expect(assessment).toHaveBeenLastCalledWith(null);expect(renderView).not.toHaveBeenCalled();
});
it('offers independent history when the assurance payload cannot be validated',async()=>{
  readView.mockReturnValue(null);vi.stubGlobal('fetch',vi.fn(async()=>Response.json({view:{}})));
  render(<ReleaseAssurancePanel {...props}/>);
  await screen.findByText('The assurance response was incomplete or belonged to another release.');
  expect(screen.getByRole('region',{name:'Independent history'})).toBeTruthy();
  expect(renderView).not.toHaveBeenCalled();
});
it('does not offer history setup while loading or explicitly pending, and mounts after a successful retry',async()=>{
  const view={assessment:{readiness:'blocked'}};readView.mockReturnValue(view);
  const fetch=vi.fn().mockResolvedValueOnce(Response.json({},{status:202})).mockResolvedValueOnce(Response.json({view}));vi.stubGlobal('fetch',fetch);
  const assessment=vi.fn();render(<ReleaseAssurancePanel {...props} onAssessment={assessment}/>);
  expect(screen.queryByRole('region',{name:'Independent history'})).toBeNull();
  await screen.findByText('The scan is still running. No completed review is available.');
  expect(screen.queryByRole('region',{name:'Independent history'})).toBeNull();expect(assessment).toHaveBeenLastCalledWith(null);
  fireEvent.click(screen.getByRole('button',{name:'Retry saved evidence'}));
  await screen.findByRole('region',{name:'Independent history'});
  await waitFor(()=>expect(renderView).toHaveBeenCalled());expect(assessment).toHaveBeenLastCalledWith(view.assessment);
});
it('removes the previous record history immediately when the selected record changes',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(url:unknown)=>String(url).endsWith('record-two')?new Promise<Response>(()=>{}):Response.json({error:'Assurance unavailable.'},{status:500})));
  const result=render(<ReleaseAssurancePanel {...props}/>);await screen.findByRole('region',{name:'Independent history'});
  result.rerender(<ReleaseAssurancePanel {...props} recordId="record-two"/>);
  expect(screen.queryByRole('region',{name:'Independent history'})).toBeNull();
  await waitFor(()=>expect(screen.getByText('Reading this release’s saved evidence…').className).toBe('sr-only'));
  expect(screen.queryByRole('region',{name:'Release assurance companion'})).toBeNull();
});
it('treats an empty HTTP 202 response as pending rather than a parse error that reveals setup',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(null,{status:202})));
  render(<ReleaseAssurancePanel {...props}/>);
  await screen.findByText('The scan is still running. No completed review is available.');
  expect(screen.queryByRole('region',{name:'Independent history'})).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
});
