import {useEffect,useState,type RefObject} from 'react';
import {Button} from '@/components/ui/button';
export const CLEAR_ALERT_ASSIGNMENT='__clear_assignment__';
type Props={alertId:number;workspaceId?:string;value:string;onChange:(id:string)=>void;inputRef:RefObject<HTMLSelectElement|null>};
export function AlertMemberSelect(props:Props){return <MemberOptions key={`${props.workspaceId??'legacy'}:${props.alertId}`} {...props}/>;}
function MemberOptions({alertId,workspaceId,value,onChange,inputRef}:Props){
 const [members,setMembers]=useState<{id:string;login:string}[]|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();
  void fetch(workspaceId?`/api/workspaces/${encodeURIComponent(workspaceId)}/alerts/${alertId}/assignees`:`/api/alerts/${alertId}/assignees`,{signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error('Unavailable');const body=await response.json() as {members:{id:string;login:string}[]};
   if(!controller.signal.aborted)setMembers(body.members);
  }).catch(()=>{if(!controller.signal.aborted)setError(true);});
  return()=>controller.abort();
 },[alertId,workspaceId,retry]);
 return <div className="mt-5"><label className="block"><span className="text-xs text-mute">Workspace member</span><select ref={inputRef} required value={value===CLEAR_ALERT_ASSIGNMENT||members?.some(member=>member.id===value)?value:''} disabled={!members||error} onChange={event=>onChange(event.target.value)} className="mt-2 h-12 w-full rounded-md border border-white/15 bg-panel px-3 text-sm text-snow"><option value="">{members?'Choose a teammate':'Loading members…'}</option><option value={CLEAR_ALERT_ASSIGNMENT}>Unassigned — clear ownership</option>{members?.map(member=><option key={member.id} value={member.id}>{member.login}</option>)}</select></label>{error?<div><p role="alert">Workspace members could not be loaded.</p><Button type="button" variant="outline" onClick={()=>{setError(false);setRetry(value=>value+1);}}>Retry members</Button></div>:null}</div>;
}
