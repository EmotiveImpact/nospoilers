import './design/release-check.css';
import {RefreshCw} from 'lucide-react';
import type {ReactNode} from 'react';
import {Button} from '@/components/ui/button';
import {WatchSkeleton} from '@/components/WatchDataState';
import {TrailView} from '@/components/pieces/TrailView';
import {scheduleLine,trailTime} from '@/watch/release-trail';
import {useReleaseTrail} from './useReleaseTrail';

export function ReleaseTrail({releaseId,active,sourcesFoot,actions}:{releaseId:number;active:boolean;sourcesFoot?:ReactNode;actions?:ReactNode}){
  const {load,reload}=useReleaseTrail(releaseId,active);
  if(!active)return null;
  if(load.status==='loading')return <WatchSkeleton variant="list" className="mt-4"/>;
  if(load.status==='error')return <div className="np release-trail-error"><p role="alert">{load.message}</p><Button variant="outline" size="sm" onClick={reload}>Retry</Button></div>;
  const {model}=load;
  return <section className="np release-trail" aria-labelledby={`release-trail-${releaseId}`}>
    <header className="release-trail-head">
      <div>
        <h2 id={`release-trail-${releaseId}`}>Where it went</h2>
        <p><i className={`np-dot is-${model.summary.tone}`} aria-hidden/>{model.summary.copies?scheduleLine(model.schedule):'Not tracked yet'} · {model.summary.headline.charAt(0).toLowerCase()}{model.summary.headline.slice(1)}{model.summary.lastCheckedAt?` · last read ${trailTime(model.summary.lastCheckedAt)} UTC`:''}</p>
      </div>
      <div className="release-trail-actions">{actions}<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="size-3.5" aria-hidden/>Refresh</Button></div>
    </header>
    <TrailView model={model} sourcesFoot={sourcesFoot}/>
  </section>;
}
