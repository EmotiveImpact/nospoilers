import {useEffect,useState} from 'react';
import type {ProductWorkspace} from '@/watch/workspace-types';

export type WorkspaceChoice=ProductWorkspace&{avatar_url?:string|null};
export function useWorkspaceChoices(identity=''){
 const [result,setResult]=useState({identity,workspaces:[] as WorkspaceChoice[],error:false,loaded:false});
 const [revision,setRevision]=useState(0);
 const refresh=()=>setRevision(value=>value+1);
 useEffect(()=>{
  const changed=()=>setRevision(value=>value+1);
  window.addEventListener('nospoilers:workspaces-changed',changed);
  return()=>window.removeEventListener('nospoilers:workspaces-changed',changed);
 },[]);
 useEffect(()=>{
  const controller=new AbortController();
  void fetch('/api/workspaces',{signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error('Unavailable');
   const body=await response.json() as {workspaces:WorkspaceChoice[]};
   if(!Array.isArray(body.workspaces))throw new Error('Unavailable');
   if(!controller.signal.aborted)setResult({identity,workspaces:body.workspaces,error:false,loaded:true});
  }).catch(()=>{if(!controller.signal.aborted)setResult({identity,workspaces:[],error:true,loaded:false});});
  return()=>controller.abort();
 },[identity,revision]);
 return {...(result.identity===identity?result:{workspaces:[],error:false,loaded:false}),refresh};
}
export type WorkspaceChoices=ReturnType<typeof useWorkspaceChoices>;
