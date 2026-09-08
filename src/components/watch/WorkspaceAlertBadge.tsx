import {useEffect,useState} from 'react';
export function WorkspaceAlertBadge({workspaceId}:{workspaceId:string}){
 return <Badge key={workspaceId} workspaceId={workspaceId}/>;
}
function Badge({workspaceId}:{workspaceId:string}){
 const [count,setCount]=useState<number|null>(null);
 useEffect(()=>{const request=new AbortController();let timer:ReturnType<typeof setTimeout>;
  async function refresh(){try{
   const response=await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/alert-counts`,{signal:request.signal});
   if(!response.ok)throw new Error('Unavailable');const body=await response.json();
   if(!Number.isInteger(body.open)||body.open<0)throw new Error('Unavailable');
   if(!request.signal.aborted)setCount(body.open);
  }catch{if(!request.signal.aborted)setCount(null);}
  finally{if(!request.signal.aborted)timer=setTimeout(()=>void refresh(),30_000);}}
  void refresh();return()=>{request.abort();clearTimeout(timer);};
 },[workspaceId]);
 return count!==null&&count>0?<span className="ml-auto font-mono text-[11px] text-[#ff8a80]">{count}</span>:null;
}
