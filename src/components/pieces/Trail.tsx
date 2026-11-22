import './pieces.css';
import {ShieldCheck,TriangleAlert} from 'lucide-react';
import type {ReactNode} from 'react';
import {trailTime,type ReleaseTrailModel,type TrailEvent,type TrailSource,type TrailState,type TrailTone,type TrailVersion} from '@/watch/release-trail';

const COLOUR:Record<TrailState,string>={exposed:'#ff2d47',clear:'#4cc38a',changed:'#f2a33a',unknown:'#5a5e66'};
const LINE:Record<TrailState,string>={exposed:'rgba(255,45,71,.55)',clear:'rgba(76,195,138,.4)',changed:'rgba(242,163,58,.45)',unknown:'rgba(255,255,255,.12)'};

/** A separately watched source in a word. Its full reading stays on hover and in the source map. */
const watchedLabel=(source:TrailSource)=>source.state==='clear'?(source.kind==='maps'?'Private':'Clean')
  :source.state==='changed'?'Findings'
  :source.state==='exposed'?(source.kind==='maps'?'Check failed':'Public map')
  :source.label;

const shortLabel=(source:TrailSource,now?:Date)=>source.state==='exposed'&&source.scope==='release'?(source.label.startsWith('Still')?'Still serving':'Serving')
  :source.state==='clear'&&source.since?`Clear · ${trailTime(source.since,now)}`
  :source.scope==='workspace'?watchedLabel(source)
  :source.label;

const fitEnd=(text:string,max:number)=>text.length>max?`${text.slice(0,Math.max(1,max-1))}…`:text;
const fitMiddle=(text:string,max:number)=>{
  if(text.length<=max)return text;
  const keep=Math.max(2,max-1),head=Math.ceil(keep*0.55);
  return `${text.slice(0,head)}…${text.slice(text.length-(keep-head))}`;
};

/** One release linked to every place it is served. Sources watched separately are drawn dashed. */
export function SourceNet({title,caption,sources}:{title:string;caption:string;sources:TrailSource[]}){
  const W=720,H=362,cx=360,cy=182,R=128;
  const shown=sources.slice(0,8);
  const step=360/Math.max(1,shown.length);
  const summary=shown.map(source=>`${source.name}: ${source.label}`).join('; ');
  return <svg className="np-net" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} linked to each place it is served. ${summary}`}>
    <circle cx={cx} cy={cy} r={92} fill="none" stroke="rgba(255,255,255,.04)"/>
    <circle cx={cx} cy={cy} r={150} fill="none" stroke="rgba(255,255,255,.03)"/>
    {shown.map((source,index)=>{
      const a=(-90+index*step)*Math.PI/180,x=cx+Math.cos(a)*R*1.55,y=cy+Math.sin(a)*R;
      return <line key={source.key} x1={cx} y1={cy} x2={x} y2={y} stroke={LINE[source.state]} strokeWidth={1.2} strokeDasharray={source.scope==='workspace'||source.state==='unknown'?'3 4':undefined}/>;
    })}
    <rect x={cx-76} y={cy-21} width={152} height={42} rx={9} fill="#111113" stroke="rgba(255,255,255,.08)"/>
    <text x={cx} y={cy-2} textAnchor="middle" className="np-cn">{title.length>22?`${title.slice(0,21)}…`:title}</text>
    <text x={cx} y={cy+12} textAnchor="middle" className="np-cs">{caption}</text>
    {shown.map((source,index)=>{
      const a=(-90+index*step)*Math.PI/180,x=cx+Math.cos(a)*R*1.55,y=cy+Math.sin(a)*R,colour=COLOUR[source.state];
      const right=Math.cos(a)>0.2,left=Math.cos(a)<-0.2,anchor=right?'start':left?'end':'middle',dx=right?14:left?-14:0,dy=Math.sin(a)<-0.5?-32:Math.sin(a)>0.5?24:4;
      const hollow=source.state==='unknown';
      const room=right?W-(x+dx):left?x+dx:Math.min(x,W-x)*2;
      const name=fitMiddle(source.name,Math.floor(room/7.2)),label=fitEnd(source.label,Math.floor(room/6.2));
      return <g key={source.key}>
        {source.state==='exposed'?<circle cx={x} cy={y} r={11} fill="rgba(255,45,71,.16)"/>:null}
        <circle cx={x} cy={y} r={hollow?4:5} fill={hollow?'#0c0c0d':colour} stroke={colour} strokeWidth={1.4}/>
        <text x={x+dx} y={y+dy} textAnchor={anchor} className="np-nn">{name}</text>
        <text x={x+dx} y={y+dy+14} textAnchor={anchor} className={`np-ns is-${source.state}`}>{label}</text>
      </g>;
    })}
  </svg>;
}

/** The same sources as a list, with what each returned. */
export function SourceList({sources,foot,now}:{sources:TrailSource[];foot?:ReactNode;now?:Date}){
  return <div className="np-hosts">
    <ul>{sources.map(source=><li key={source.key} className="np-host">
      <i className={`np-dot is-${source.state}`} aria-hidden/>
      <b>{source.name}</b>
      <em className={`is-${source.state}`} title={source.label}>{shortLabel(source,now)}</em>
      <small>{source.scope==='workspace'?`${source.detail} · watched separately`:source.detail}</small>
    </li>)}</ul>
    {foot?<p className="np-scope">{foot}</p>:null}
  </div>;
}

const versionPosition=(index:number,count:number)=>count<=1?30:12+index*(64/(count-1));

/** The version line from the blocked release to the one that passed. */
export function VersionLine({versions,now}:{versions:TrailVersion[];now?:Date}){
  if(!versions.length)return null;
  const tag=(version:TrailVersion)=>version.role==='this'
    ?(version.status==='failed'?`Blocked · ${trailTime(version.createdAt,now)}`:version.status==='passed'?`Passed · ${trailTime(version.createdAt,now)}`:`Checked · ${trailTime(version.createdAt,now)}`)
    :version.role==='fix'?`Fix passed · ${trailTime(version.createdAt,now)}`:null;
  const spoken=versions.map(version=>`${version.version} ${version.role==='fix'?'passed and fixed it':version.status==='failed'?'was blocked':version.status==='passed'?'passed':'was not completed'}`).join(', ');
  return <div className="np-vtl" role="img" aria-label={`Versions: ${spoken}`}>
    <span className="np-vtl-axis"/>
    {versions.map((version,index)=>{
      const left=versionPosition(index,versions.length);
      const text=tag(version);
      const tone=version.role==='fix'?' is-fix':version.status==='failed'?' is-failed':version.role==='this'?' is-this':'';
      return <span key={version.id}>
        <span className={`np-vtl-v${tone}`} style={{left:`${left}%`}}><i/><span>{version.version}</span></span>
        {text?<span className={`np-vtl-tag${version.role==='fix'||version.status!=='failed'?' is-quiet':''}${left<22?' is-start':''}`} style={{left:`${left}%`}}>{text}</span>:null}
      </span>;
    })}
    <span className="np-vtl-now" style={{left:'93%'}}><b>NOW</b></span>
  </div>;
}

const clearSince=(time:string)=>time.length<=5?`Clear since ${time}`:`Clear · ${time}`;
const gridStatus=(source:TrailSource,now?:Date)=>source.state==='exposed'?(source.label.startsWith('Still')||source.since?'Still exposed':'Exposed')
  :source.state==='clear'?(source.since?clearSince(trailTime(source.since,now)):'Clear')
  :source.state==='changed'?'Changed':source.checkedAt?'Not read':'Not checked yet';

/** Every tracked copy, hour by hour. An empty cell is an hour with no recorded check. */
export function HourGrid({sources,hours,now}:{sources:TrailSource[];hours:string[];now?:Date}){
  const rows=sources.filter(source=>source.scope==='release');
  if(!rows.length||!hours.length)return null;
  const hour=(iso:string)=>`${new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'UTC'})}`;
  return <div className="np-hgrid" style={{'--np-hours':hours.length} as React.CSSProperties}>
    <div className="np-hhead"><span/><div><span>{hour(hours[0])}</span><span>{hour(hours[Math.floor(hours.length/2)])}</span><span>Now</span></div><span/></div>
    {rows.map(source=>{
      const counts=source.cells.reduce<Record<string,number>>((all,cell)=>({...all,[cell]:(all[cell]??0)+1}),{});
      const spoken=(['exposed','changed','clear','unknown'] as const).filter(state=>counts[state]).map(state=>`${counts[state]} ${state}`).join(', ')||'no checks recorded';
      return <div className="np-hline" key={source.key}>
        <span className="np-hname">{source.name}<small>{source.detail}</small></span>
        <span className="np-hcells" role="img" aria-label={`${source.name}, last ${hours.length} hours: ${spoken}`}>
          {source.cells.map((cell,index)=><i key={hours[index]} className={`is-${cell}${cell==='exposed'&&index===source.cells.length-1?' is-now':''}`} title={`${hour(hours[index])} UTC · ${cell==='none'?'no check recorded':cell}`}/>)}
        </span>
        <span className={`np-hstat is-${source.state}`} title={source.label}>{gridStatus(source,now)}</span>
      </div>;
    })}
  </div>;
}

/** What was recorded, in order. */
export function ActivityFeed({events,now}:{events:TrailEvent[];now?:Date}){
  if(!events.length)return <p className="np-scope">Nothing has been recorded for this release yet.</p>;
  return <ul className="np-feed">{events.map((event,index)=><li key={`${event.at}:${index}`}>
    <i className={`np-dot is-${event.tone}`} aria-hidden/><span>{event.text}</span><time dateTime={event.at}>{trailTime(event.at,now)}</time>
  </li>)}</ul>;
}

/** The one-line verdict under the grid. */
export function TrailNote({tone,children}:{tone:TrailTone;children:ReactNode}){
  return <div className={`np-note is-${tone}`}>{tone==='good'?<ShieldCheck aria-hidden/>:<TriangleAlert aria-hidden/>}<span>{children}</span></div>;
}

/** After the fix: the version line and every tracked copy, hour by hour. */
export function AfterTheFix({model,now}:{model:ReleaseTrailModel;now?:Date}){
  return <div className="np-afterfix">
    <VersionLine versions={model.versions} now={now}/>
    <HourGrid sources={model.sources} hours={model.hours} now={now}/>
  </div>;
}
