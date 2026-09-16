import {useId} from 'react';
import {Plus} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {navigate} from '@/nav';
import {watchHref,watchPath} from '@/watch/routes';
import {WatchPageHeader} from './WatchPageHeader';
import {UploadedReleases} from './UploadedReleases';
import './design/release-journey.css';

/** Independent workspaces expose only the release collections they actually own. */
export function WorkspaceReleaseCollection({search,installationId,defaultCollection='uploads',canScan=true}:{search:string;installationId?:number|null;defaultCollection?:'uploads'|'attempts';canScan?:boolean}){
 const id=useId();
 const params=new URLSearchParams(search);
 const collection=params.get('releaseView')==='attempts'||params.get('uploadStatus')==='active'?'attempts':params.get('releaseView')==='uploads'?'uploads':defaultCollection;
 if(params.get('uploadView')==='detail')return <UploadedReleases search={search} installationId={installationId}/>;
 function choose(value:'uploads'|'attempts'){
  const next=new URLSearchParams(search);next.set('releaseView',value);
  for(const key of ['upload','uploadView','uploadBefore','uploadFinding','uploadTab','uploadStatus','release','preview'])next.delete(key);
  navigate(`/watch/releases?${next}`);
 }
 return <section className="watch-release-index" aria-label="Releases"><WatchPageHeader title="Release evidence." lede="Find a build, understand its result, or return to an unfinished attempt." action={canScan?<Button onClick={()=>navigate(watchHref(watchPath('scan'),search))}>New scan<Plus className="size-4" aria-hidden/></Button>:undefined}/>
  <div className="mt-5 flex flex-wrap gap-1 border-b border-white/10" role="tablist" aria-label="Release history type" onKeyDown={event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   const tabs=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));const index=tabs.indexOf(event.target as HTMLButtonElement);if(index<0)return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].focus();tabs[next].click();
  }}>{(['uploads','attempts'] as const).map(value=><button key={value} type="button" role="tab" id={`${id}-${value}`} aria-controls={`${id}-panel`} aria-selected={collection===value} tabIndex={collection===value?0:-1} className="min-h-11 border-b-2 border-transparent px-3 text-sm text-mute aria-selected:border-white/60 aria-selected:text-snow" onClick={()=>choose(value)}>{value==='uploads'?'Uploaded builds':'Attempts'}</button>)}</div>
  <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${collection}`}><UploadedReleases search={search} installationId={installationId} collection={collection}/></div>
 </section>;
}
