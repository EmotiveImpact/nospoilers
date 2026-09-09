// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {ReleaseGateControls} from '../src/components/watch/ReleaseGateControls';
import {ReleaseRemediationControls} from '../src/components/watch/ReleaseRemediationControls';
import {AgentAccessControls} from '../src/components/watch/AgentAccessControls';

afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
const record={kind:'upload' as const,id:'upload'};
function responses(view:unknown){vi.stubGlobal('fetch',vi.fn(async(_url:unknown,init?:RequestInit)=>init?.method==='POST'?Response.json({error:'Permission changed. Refresh before continuing.'},{status:403}):Response.json(view)));}
async function checkFocus(button:HTMLElement){
  const panel=button.closest('details')!;panel.open=true;button.focus();expect(document.activeElement).toBe(button);
  fireEvent.click(button);
  await screen.findByText('Permission changed. Refresh before continuing.');
  await waitFor(()=>{
    expect(document.activeElement).not.toBe(document.body);
    expect(panel.contains(document.activeElement)).toBe(true);
  });
  expect(screen.getByRole('alert').textContent).toContain('Permission changed.');
}
it('keeps keyboard recovery within Release Gate after a denied evaluation',async()=>{
  responses({policy:{mode:'advisory',revision:0,maxAgeHours:24},policies:[],decisions:[],canManage:false,canWrite:true,binding:{record,digest:'digest'},notice:'Gate loaded.'});
  render(<ReleaseGateControls streamId="stream" record={record} refreshVersion={0}/>);
  await screen.findByText('Gate loaded.');
  fireEvent.change(screen.getByLabelText('Deployment attempt ID'),{target:{value:'deploy-1'}});
  await checkFocus(screen.getByRole('button',{name:'Evaluate this recorded build',hidden:true}));
});
it('keeps keyboard recovery within remediation after a denied investigation',async()=>{
  responses({cases:[],selected:null,current:{snapshotId:'snapshot',findings:['MAP-001']},canWrite:true,notice:'Remediation loaded.'});
  render(<ReleaseRemediationControls streamId="stream" workspaceId="workspace" record={record} snapshots={[]}/>);
  await screen.findByText('Remediation loaded.');
  fireEvent.change(screen.getByLabelText('Remediation note (no secrets)'),{target:{value:'Investigate signed finding.'}});
  fireEvent.change(screen.getByLabelText('Original signed finding'),{target:{value:'MAP-001'}});
  await checkFocus(screen.getByRole('button',{name:'Start investigation',hidden:true}));
});
it('keeps keyboard recovery within agent access and announces a denied revocation',async()=>{
  responses({canCreate:false,grants:[{id:'grant',name:'Test agent',proposals:false,expires_at:'2030-01-01T00:00:00Z',expired:false,revoked_at:null,calls:0}],proposals:[],calls:[],notice:'Agent loaded.'});
  render(<AgentAccessControls streamId="stream" snapshotId="snapshot"/>);
  await screen.findByText('Agent loaded.');
  await checkFocus(screen.getByRole('button',{name:'Revoke Test agent',hidden:true}));
});

it.each(['gate','remediation','agent'] as const)('does not steal focus after an initial %s read failure',async(kind)=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'Initial access unavailable.'},{status:500})));
  render(<><button type="button">Other page action</button>{kind==='gate'?<ReleaseGateControls streamId="stream" record={record} refreshVersion={0}/>:kind==='remediation'?<ReleaseRemediationControls streamId="stream" workspaceId="workspace" record={record} snapshots={[]}/>:<AgentAccessControls streamId="stream" snapshotId="snapshot"/>}</>);
  const pending=screen.getByLabelText(kind==='gate'?'Reading gate policy':kind==='remediation'?'Reading remediation evidence':'Reading agent access');
  expect(pending.getAttribute('role')).toBe('status');
  const outside=screen.getByRole('button',{name:'Other page action'});outside.focus();
  await screen.findByText('Initial access unavailable.');
  expect(document.activeElement).toBe(outside);
});

it('does not reclaim focus when a person leaves agent access before a mutation fails',async()=>{
  let finish:(response:Response)=>void=()=>{throw new Error('Mutation has not started.');};
  const fetch=vi.fn(async(_url:unknown,init?:RequestInit)=>{
    if(init?.method==='POST')return new Promise<Response>(resolve=>{finish=resolve;});
    return Response.json({canCreate:false,grants:[{id:'grant',name:'Test agent',proposals:false,expires_at:'2030-01-01T00:00:00Z',expired:false,revoked_at:null,calls:0}],proposals:[],calls:[],notice:'Agent loaded.'});
  });
  vi.stubGlobal('fetch',fetch);
  render(<><button type="button">Other page action</button><AgentAccessControls streamId="stream" snapshotId="snapshot"/></>);
  await screen.findByText('Agent loaded.');
  const revoke=screen.getByRole('button',{name:'Revoke Test agent',hidden:true});revoke.closest('details')!.open=true;revoke.focus();fireEvent.click(revoke);
  const outside=screen.getByRole('button',{name:'Other page action'});outside.focus();
  finish(Response.json({error:'Permission changed while pending.'},{status:403}));
  await screen.findByText('Permission changed while pending.');
  expect(document.activeElement).toBe(outside);
});
