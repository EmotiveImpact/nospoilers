import './pieces.css';
import {useState,type ReactNode} from 'react';
import {sourcesWhenFound,trailTime,type ReleaseTrailModel} from '@/watch/release-trail';
import {ActivityFeed,AfterTheFix,SourceList,SourceNet,TrailNote} from './Trail';

const plural=(count:number,one:string,many:string)=>`${count} ${count===1?one:many}`;

/** What the note under the grid says, in the release's own terms. */
export function TrailVerdict({model,now}:{model:ReleaseTrailModel;now?:Date}){
  const copies=model.sources.filter(source=>source.scope==='release');
  const serving=copies.filter(source=>source.state==='exposed');
  if(serving.length&&model.release.status==='failed'){
    const alert=[...model.alerts].reverse().find(row=>!row.resolvedAt);
    const names=serving.length===1?serving[0].name:plural(serving.length,'source','sources');
    return <><b>{names} {serving.length===1?'is':'are'} still serving</b> {model.release.version||'this build'}{model.fix?` after ${model.fix.version||'the fix'} passed`:''}.{alert?` Alert sent ${trailTime(alert.createdAt,now)} UTC.`:''}</>;
  }
  if(model.summary.tone==='good')return <><b>No copies exposed.</b> {model.release.status==='failed'?'No tracked source serves the blocked build any more.':'Every tracked source matches the build that was checked.'}</>;
  return <><b>{model.summary.headline}.</b>{model.summary.copies?'':' Attach a delivery URL to track where this release is served.'}</>;
}

/** Where it went: the map of sources, then what happened after the fix. Built from a recorded trail only. */
export function TrailView({model,now,sourcesFoot}:{model:ReleaseTrailModel;now?:Date;sourcesFoot?:ReactNode}){
  const [when,setWhen]=useState<'found'|'now'>('now');
  const copies=model.sources.filter(source=>source.scope==='release');
  const foundAt=copies.map(source=>source.first?.at).filter((value):value is string=>Boolean(value)).sort()[0]??null;
  const view=when==='found'&&foundAt?'found':'now';
  const sources=view==='found'?sourcesWhenFound(model):model.sources;
  const serving=sources.filter(source=>source.scope==='release'&&source.state==='exposed').length;
  const title=`${model.release.name}${model.release.version?` ${model.release.version}`:''}`;
  const headline=!copies.length?'No copy tracked yet'
    :serving?`${plural(serving,'source carries','sources carry')} ${model.release.status==='failed'?'this build':'a blocked build'}`
    :view==='now'?model.summary.headline:'No source carried a blocked build';
  return <div className="np np-trail">
    <div className="np-trail-top">
      <div className="np-netbox">
        <div className="np-nethead">
          {foundAt?<div className="np-seg" role="group" aria-label="When">
            <button type="button" aria-pressed={view==='found'} onClick={()=>setWhen('found')}>When found · {trailTime(foundAt,now)}</button>
            <button type="button" aria-pressed={view==='now'} onClick={()=>setWhen('now')}>Now</button>
          </div>:<span>First check pending</span>}
          <span className={serving?'is-bad':undefined}><i className={`np-dot is-${serving?'exposed':model.summary.tone==='good'||view==='found'?'clear':'unknown'}`} aria-hidden/>{headline}</span>
        </div>
        <SourceNet title={title} caption={`CHECKED ${trailTime(model.release.createdAt,now).toUpperCase()} UTC`} sources={sources}/>
      </div>
      <aside className="np-hostbox" aria-label="Connected sources">
        <h3 className="np-label">Connected sources<span>{view==='found'&&foundAt?trailTime(foundAt,now):'now'}</span></h3>
        <SourceList sources={sources} foot={sourcesFoot} now={now}/>
      </aside>
    </div>
    {copies.length?<>
      <h3 className="np-label">After the fix<span>checked every hour</span></h3>
      <AfterTheFix model={model} now={now}/>
      <ul className="np-hkey" aria-label="Key"><li><i className="is-exposed"/>Serving the blocked build</li><li><i className="is-clear"/>Clear</li><li><i className="is-changed"/>Changed</li><li><i className="is-unknown"/>Could not be read</li><li><i/>No check that hour</li></ul>
    </>:null}
    <TrailNote tone={model.summary.tone}><TrailVerdict model={model} now={now}/></TrailNote>
    <div className="np-trail-two">
      <div><h3 className="np-label">What happened</h3><ActivityFeed events={model.events} now={now}/></div>
      <div><h3 className="np-label">What this covers</h3>
        <p>Each hour, for 30 days after a release, we fetch it from where it was published and from every delivery URL attached to it, and compare the bytes with the build that was checked. Websites and private map uploads are watched separately and shown here for context.</p>
        <p>A clear cell means the blocked build was not served at that check. It cannot show whether someone downloaded it earlier.</p>
      </div>
    </div>
  </div>;
}
