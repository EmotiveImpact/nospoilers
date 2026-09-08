import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {navigate} from '@/nav';

type Role='owner'|'admin'|'member'|'viewer';
type Team={role:Role;archived:boolean;members:{user_id:string;login:string;role:Role;access_source:string}[];invites:{id:string;login:string;role:Role;expires_at:string}[];events:{id:string;action:string;actor:string|null;subject:string|null;created_at:string}[]};
export function WorkspaceTeam({workspaceId}:{workspaceId:string}){
  return <TeamScope key={workspaceId} workspaceId={workspaceId}/>;
}
function TeamScope({workspaceId}:{workspaceId:string}){
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
  return <section className="workspace-management"><header className="watch-release-heading"><div><span className="watch-kicker">Workspace settings</span><h1>Team & access</h1><p>Access to this workspace—not a GitHub login or permission to every workspace in the organisation.</p></div></header>
    {error?<div role="alert" className="watch-empty"><p>{error}</p><Button variant="outline" onClick={()=>{setError('');setRevision(v=>v+1);}}>Retry</Button></div>:null}
    {notice?<p role="status" className="watch-empty">{notice}</p>:null}
    {!team&&!error?<p role="status">Loading workspace access…</p>:null}
    {team?.archived?<p className="watch-empty">Archived workspaces are read-only. Restore this workspace before changing access.</p>:null}
    {canManage?<form className="workspace-create" onSubmit={event=>{event.preventDefault();void mutate(`/api/workspaces/${workspaceId}/invitations`,'POST',{login,role});}}><h2>Invite a teammate</h2><p>Enter their existing NoSpoilers account name. The invitation appears in their Workspaces inbox and expires after seven days. Email delivery and additional sign-in providers are not enabled yet.</p><label>Account name<input required maxLength={100} value={login} onChange={event=>setLogin(event.target.value)} autoComplete="off"/></label><label>Workspace role<select value={role} onChange={event=>setRole(event.target.value as Role)}><option value="viewer">Viewer · read evidence</option><option value="member">Member · scan and respond</option>{team.role==='owner'?<option value="admin">Admin · manage workspace access</option>:null}</select></label><Button type="submit" disabled={busy||!login.trim()}>Send invitation</Button></form>:null}
    {team?<><div className="workspace-cards" aria-label="Workspace members">{team.members.map(member=><MemberRow key={`${member.user_id}:${member.role}`} member={member} owner={team.role==='owner'} canManage={!!canManage} busy={busy} save={next=>mutate(`/api/workspaces/${workspaceId}/members/${encodeURIComponent(member.user_id)}`,next===null?'DELETE':'PATCH',next===null?undefined:{role:next})}/>)}</div>
      <section className="mt-8"><h2>Pending invitations</h2>{team.invites.length?team.invites.map(invite=><article className="watch-empty" key={invite.id}><p>{invite.login} · {invite.role} · expires {new Date(invite.expires_at).toLocaleDateString()}</p>{canManage?<Button variant="outline" disabled={busy} onClick={()=>void mutate(`/api/workspaces/${workspaceId}/invitations/${invite.id}/revoke`,'POST')}>Revoke invitation for {invite.login}</Button>:null}</article>):<p className="watch-empty">No pending invitations.</p>}</section>
      <section className="mt-8"><h2>Access activity</h2><p className="text-sm text-mute">Latest 100 invitation and membership events. Full workspace activity is in Audit log. Removing access does not erase historical attribution.</p>{team.events.length===0?<p className="watch-empty">No access changes recorded yet.</p>:null}{team.events.map(event=><p className="watch-empty" key={event.id}>{event.action.replaceAll('_',' ')} · {event.actor??'Former member'}{event.subject?` → ${event.subject}`:''} · {new Date(event.created_at).toLocaleString()}</p>)}</section></>:null}
  </section>;
}
function MemberRow({member,owner,canManage,busy,save}:{member:Team['members'][number];owner:boolean;canManage:boolean;busy:boolean;save:(role:Role|null)=>Promise<void>}){
  const [role,setRole]=useState<Role>(member.role),[removing,setRemoving]=useState(false);
  const editable=canManage&&(owner||!['owner','admin'].includes(member.role));
  return <article><h2>{member.login}</h2><p>{member.role}{member.access_source==='legacy'?' · migrated connection membership':''}</p>{editable?<><div className="flex flex-wrap items-end gap-3"><label>Role for {member.login}<select value={role} onChange={event=>setRole(event.target.value as Role)}><option value="viewer">Viewer</option><option value="member">Member</option>{owner?<><option value="admin">Admin</option><option value="owner">Owner</option></>:null}</select></label><Button disabled={busy||role===member.role} onClick={()=>void save(role)}>Save role for {member.login}</Button><Button variant="ghost" disabled={busy} onClick={()=>setRemoving(true)}>Remove {member.login}</Button></div>{removing?<div className="watch-empty"><p>Remove {member.login} from this workspace? Their saved evidence remains; a new invitation is required to restore access.</p><Button disabled={busy} onClick={()=>void save(null)}>Confirm removal</Button><Button variant="ghost" onClick={()=>setRemoving(false)}>Cancel</Button></div>:null}</>:null}</article>;
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
  return <section aria-label="Workspace invitations">
    {!error&&invites===null?<p className="watch-empty" role="status">Loading workspace invitations…</p>:null}
    {!error&&invites?.length===0?<p className="watch-empty">No pending workspace invitations.</p>:null}
    {error?<div className="watch-empty" role="alert">{error}<Button variant="outline" disabled={!!busy} onClick={()=>{setError('');setInvites(null);setRevision(v=>v+1);}}>Retry invitations</Button></div>:null}
    {invites?.map(invite=><article key={invite.id} className="watch-empty"><h2>Invitation to {invite.workspace_name}</h2><p>{invite.invited_by} invited you as {invite.role}. Expires {new Date(invite.expires_at).toLocaleDateString()}. Accepting does not connect your GitHub account or start a new trial.</p><Button disabled={!!busy} onClick={()=>void accept(invite.id)}>Accept invitation to {invite.workspace_name}</Button></article>)}
  </section>;
}
