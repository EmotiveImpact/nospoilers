import '@/components/pieces/pieces.css';
import './design/release-check.css';
import {ActivityFeed,AfterTheFix,TrailNote} from '@/components/pieces/Trail';
import {TrailVerdict} from '@/components/pieces/TrailView';
import {useReleaseTrail} from './useReleaseTrail';

/** After the fix, on the alert: the linked release's version line, its copies hour by hour and what was recorded. */
export function AlertAfterFix({releaseId,href}:{releaseId:number;href:string}){
  const {load}=useReleaseTrail(releaseId,true);
  if(load.status!=='ready'||!load.model.summary.copies)return null;
  const {model}=load;
  return <section className="np alert-after-fix" aria-label="After the fix">
    <h2 className="np-label">After the fix<span>checked every hour</span></h2>
    <AfterTheFix model={model}/>
    <TrailNote tone={model.summary.tone}><TrailVerdict model={model}/></TrailNote>
    <h2 className="np-label">What happened</h2>
    <ActivityFeed events={model.events}/>
    <p className="alert-after-fix-more"><a href={href}>Open Where it went</a></p>
  </section>;
}
