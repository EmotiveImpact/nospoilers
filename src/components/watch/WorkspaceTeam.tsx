import {WatchPageHeader} from "./WatchPageHeader";
import './design/team-page.css';
import './design/journey-access.css';
import {SettingsTabs} from './design/SettingsTabs';
import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/motion/select';
import {navigate} from '@/nav';

type Role='owner'|'admin'|'member'|'viewer';
type Team={role:Role;archived:boolean;members:{user_id:string;login:string;role:Role;access_source:string}[];invites:{id:string;login:string;role:Role;expires_at:string}[];events:{id:string;action:string;actor:string|null;subject:string|null;created_at:string}[]};
export function WorkspaceTeam({workspaceId}:{workspaceId:string}){
  return <TeamScope key={workspaceId} workspaceId={workspaceId}/>;
}
function TeamScope({workspaceId}:{workspaceId:string}){
  const [tab,setTab]=useState('members');
  const inviteInput=useRef<HTMLInputElement>(null);
  const active=useRef(true),submitting=useRef(false),loadEpoch=useRef(0);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  const [team,setTeam]=useState<Team|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false);
  const [login,setLogin]=useState(''),[role,setRole]=useState<Role>('viewer'),[notice,setNotice]=useState('');
  useEffect(()=>{const controller=new AbortController();const epoch=loadEpoch.current;void fetch(`/api/workspaces/${workspaceId}/team`,{signal:controller.signal}).then(async response=>{
    const result=await response.json();if(controller.signal.aborted||epoch!==loadEpoch.current)return;if(!response.ok||!Array.isArray(result.members)||!Array.isArray(result.invites)||!Array.isArray(result.events))throw new Error(result.error??'Could not load workspace members.');setTeam(result);
  }).catch(err=>{if(!controller.signal.aborted&&epoch===loadEpoch.current){setTeam(null);setError(err.message);}});return()=>controller.abort();},[workspaceId,revision]);
  async function mutate(path:string,method:string,body?:unknown){
    if(submitting.current)return;submitting.current=true;setBusy(true);setError('');setNotice('');
    try{const response=await fetch(path,{method,headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const result=await response.json();if(!active.current)return;if(!response.ok){if([401,403,404].includes(response.status)){loadEpoch.current++;setTeam(null);}throw new Error(result.error??'Could not save access changes.');}loadEpoch.current++;setNotice('Access changes saved. Existing release evidence is unchanged.');setLogin('');setRevision(v=>v+1);window.dispatchEvent(new Event('nospoilers:workspaces-changed'));}
    catch(err){if(active.current)setError(err instanceof Error?err.message:'Could not save access changes.');}finally{submitting.current=false;if(active.current)setBusy(false);}
  }
  const canManage=team&&!team.archived&&['owner','admin'].includes(team.role);
  const members=team?<div className="journey-access-table"><table aria-label="Workspace members"><thead><tr><th>Person</th><th>Role</th><th>Access</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{team.members.map(member=><MemberRow key={`${member.user_id}:${member.role}`} member={member} owner={team.role==='owner'} canManage={!!canManage} busy={busy} save={next=>mutate(`/api/workspaces/${workspaceId}/members/${encodeURIComponent(member.user_id)}`,next===null?'DELETE':'PATCH',next===null?undefined:{role:next})}/>)}</tbody></table>{!team.members.length?<p className="journey-access-empty">No members recorded.</p>:null}</div>:null;
  const invitations=team?<><div className="journey-access-table"><table aria-label="Pending invitations"><thead><tr><th>Person</th><th>Role</th><th>Expires</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{team.invites.map(invite=><tr key={invite.id}><td><strong>{invite.login}</strong><small>Invitation pending</small></td><td>{invite.role}</td><td>{new Date(invite.expires_at).toLocaleDateString()}</td><td>{canManage?<Button variant="ghost" disabled={busy} onClick={()=>void mutate(`/api/workspaces/${workspaceId}/invitations/${invite.id}/revoke`,'POST')}>Revoke invitation for {invite.login}</Button>:null}</td></tr>)}</tbody></table>{!team.invites.length?<div className="journey-access-empty"><h2>No pending invitations</h2><p>An invitation stays pending until the named person accepts.</p></div>:null}</div>{canManage?<form className="journey-access-compose" onSubmit={event=>{event.preventDefault();void mutate(`/api/workspaces/${workspaceId}/invitations`,'POST',{login,role});}}><h2>Invite a person</h2><p>Use their existing NoSpoilers account name.</p><div className="journey-access-fields"><label>Account name<input ref={inviteInput} required maxLength={100} value={login} onChange={event=>setLogin(event.target.value)} autoComplete="off"/></label><RolePicker label="Workspace role" value={role} onChange={setRole} owner={team.role==='owner'} invitation disabled={busy}/><Button type="submit" disabled={busy||!login.trim()}>Send invitation</Button></div><p className="journey-access-note">Appears in their Workspaces inbox and expires in 7 days. Invitations apply only to this workspace; they do not connect GitHub or send email.</p></form>:null}</>:null;
  const activity=team?<div className="journey-access-table"><table aria-label="Access activity"><thead><tr><th>Time</th><th>Person</th><th>Change</th></tr></thead><tbody>{team.events.map(event=><tr key={event.id}><td>{new Date(event.created_at).toLocaleString()}</td><td>{event.actor??'Former member'}{event.subject?` → ${event.subject}`:''}</td><td>{event.action.replaceAll('_',' ')}</td></tr>)}</tbody></table>{!team.events.length?<p className="journey-access-empty">No access changes recorded yet.</p>:null}<p className="journey-access-note">Latest 100 access events. Removing access preserves historical attribution.</p></div>:null;
  return <section className="workspace-management team-page journey-access min-w-0 [overflow-wrap:anywhere]"><WatchPageHeader kicker="Workspace settings" title="The right access for each person." lede="Invite named people to this workspace with an explicit role." action={canManage?<Button onClick={()=>{setTab('invitations');requestAnimationFrame(()=>inviteInput.current?.focus());}}>Invite person</Button>:undefined}/>
    {error?<div role="alert" className="watch-empty"><p>{error}</p><Button variant="outline" onClick={()=>{setError('');setRevision(v=>v+1);}}>Retry</Button></div>:null}
    {notice?<p role="status" className="watch-empty">{notice}</p>:null}
    {!team&&!error?<WatchSkeleton variant="list" className="mt-4" />:null}
    {team?.archived?<p className="watch-empty">Archived workspaces are read-only. Restore this workspace before changing access.</p>:null}
    {team?<SettingsTabs label="Team sections" value={tab} onValueChange={setTab} tabs={[{id:'members',label:`Members ${team.members.length}`,content:members},{id:'invitations',label:'Invitations',content:invitations},{id:'activity',label:'Access activity',content:activity}]}/>:null}
    <p className="journey-access-note">Membership is workspace-specific. There is no automatic email-domain or agency-wide access.</p>
  </section>;
}
function MemberRow({member,owner,canManage,busy,save}:{member:Team['members'][number];owner:boolean;canManage:boolean;busy:boolean;save:(role:Role|null)=>Promise<void>}){
  const [role,setRole]=useState<Role>(member.role),[removing,setRemoving]=useState(false),[editing,setEditing]=useState(false);
  const editable=canManage&&(owner||!['owner','admin'].includes(member.role));
  return <><tr><td><div className="journey-access-person"><span className="team-avatar" aria-hidden="true">{member.login.slice(0,2).toUpperCase()}</span><strong>{member.login}</strong></div></td><td>{member.role}</td><td><span className="journey-access-status">Active</span>{member.access_source==='legacy'?<small>Connection member</small>:null}</td><td>{editable?<Button variant="ghost" aria-expanded={editing} onClick={()=>setEditing(value=>!value)}>Edit role for {member.login}</Button>:null}</td></tr>{editable&&editing?<tr><td colSpan={4}><div className="journey-access-fields"><RolePicker label={`Role for ${member.login}`} value={role} onChange={setRole} owner={owner} disabled={busy}/><Button aria-label={`Save role for ${member.login}`} disabled={busy||role===member.role} onClick={()=>void save(role)}>Save role</Button><Button variant="ghost" aria-label={`Remove ${member.login}`} disabled={busy} onClick={()=>setRemoving(true)}>Remove</Button></div>{removing?<div className="watch-empty"><p>Remove {member.login} from this workspace? Their saved evidence remains; a new invitation is required to restore access.</p><Button disabled={busy} onClick={()=>void save(null)}>Confirm removal</Button><Button variant="ghost" onClick={()=>setRemoving(false)}>Cancel</Button></div>:null}</td></tr>:null}</>;
}

type Invitation={id:string;workspace_name:string;invited_by:string;role:Role;expires_at:string};
export function WorkspaceInvitationInbox(){
  const active=useRef(true),submitting=useRef(false);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  const [invites,setInvites]=useState<Invitation[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState<string|null>(null),[revision,setRevision]=useState(0);
  useEffect(()=>{const controller=new AbortController();void fetch('/api/workspace-invitations',{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error('Could not load workspace invitations.');const result=await response.json();if(!Array.isArray(result.invites))throw new Error('Could not load workspace invitations.');if(!controller.signal.aborted)setInvites(result.invites);}).catch(err=>{if(!controller.signal.aborted)setError(err.message);});return()=>controller.abort();},[revision]);
  async function accept(id:string){
    if(submitting.current)return;submitting.current=true;setBusy(id);setError('');
    try{
      const response=await fetch(`/api/workspace-invitations/${encodeURIComponent(id)}/accept`,{method:'POST'});
      const result=await response.json();if(!active.current)return;
      if(!response.ok){
        if([401,403].includes(response.status))setInvites([]);
        else if([404,409,410].includes(response.status))setInvites(items=>(items??[]).filter(item=>item.id!==id));
        throw new Error(result.error??'Could not accept invitation.');
      }
      if(typeof result.workspaceId!=='string'||!result.workspaceId.trim())throw new Error('The server did not confirm a workspace. Refresh invitations before trying again.');
      window.dispatchEvent(new Event('nospoilers:workspaces-changed'));navigate(`/watch?workspace=${encodeURIComponent(result.workspaceId)}`);
    }catch(err){if(active.current)setError(err instanceof Error?err.message:'Could not accept invitation.');}
    finally{submitting.current=false;if(active.current)setBusy(null);}
  }
  return <section className="min-w-0 [overflow-wrap:anywhere]" aria-label="Workspace invitations">
    {!error&&invites===null?<WatchSkeleton variant="list" className="mt-4" label="Loading workspace invitations…" />:null}
    {!error&&invites?.length===0?<p className="watch-empty">No pending workspace invitations.</p>:null}
    {error?<div className="watch-empty" role="alert">{error}<Button variant="outline" disabled={!!busy} onClick={()=>{setError('');setInvites(null);setRevision(v=>v+1);}}>Retry invitations</Button></div>:null}
    {invites?.map(invite=><article key={invite.id} className="watch-empty"><h2>Invitation to {invite.workspace_name}</h2><p>{invite.invited_by} invited you as {invite.role}. Expires {new Date(invite.expires_at).toLocaleDateString()}. Accepting does not connect your GitHub account or start a new trial.</p><Button className="h-auto min-h-11 max-w-full whitespace-normal text-left [overflow-wrap:anywhere]" disabled={!!busy} onClick={()=>void accept(invite.id)}>Accept invitation to {invite.workspace_name}</Button></article>)}
  </section>;
}

function RolePicker({label,value,onChange,owner,invitation=false,disabled}:{label:string;value:Role;onChange:(role:Role)=>void;owner:boolean;invitation?:boolean;disabled:boolean}){
 const roles:Role[]=owner?(invitation?['viewer','member','admin']:['viewer','member','admin','owner']):['viewer','member'];
 const names:Record<Role,string>={viewer:'Viewer',member:'Member',admin:'Admin',owner:'Owner'};
 return <div className="team-role-picker min-w-0 w-full sm:w-auto sm:flex-1"><span>{label}</span><Select value={value} onValueChange={next=>onChange(next as Role)} disabled={disabled}><SelectTrigger aria-label={label}><SelectValue placeholder={names[value]}/></SelectTrigger><SelectContent>{roles.map(role=><SelectItem key={role} value={role}>{names[role]}</SelectItem>)}</SelectContent></Select>{invitation?<p className="team-role-description">{value==='viewer'?'Read workspace evidence.':value==='member'?'Run scans and respond to findings.':'Manage workspace access and settings.'}</p>:null}</div>;
}
