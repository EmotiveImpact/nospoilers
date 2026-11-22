import './pieces.css';
import type {CheckArea} from '@/watch/release-pieces';

const COLOUR={clear:'#4cc38a',critical:'#ff2d47',warn:'#f2a33a',unchecked:'#81858e'} as const;

/** The areas a release check covers, coloured by what was recorded in each. */
export function CheckWheel({areas,total,passed}:{areas:CheckArea[];total:number;passed:boolean}){
  const W=520,H=330,cx=260,cy=165,R=112;
  const step=360/Math.max(1,areas.length);
  const summary=areas.map(area=>`${area.label}: ${area.detail}`).join('; ');
  return <div className="np"><div className="np-wheelbox">
    <svg className="np-wheel" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${areas.length} areas checked. ${summary}`}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,.08)"/>
      <circle cx={cx} cy={cy} r={R/2} fill="none" stroke="rgba(255,255,255,.05)"/>
      {areas.map((area,index)=>{const a=(-90+index*step)*Math.PI/180;return <line key={area.id} x1={cx} y1={cy} x2={cx+Math.cos(a)*R} y2={cy+Math.sin(a)*R} stroke="rgba(255,255,255,.07)"/>;})}
      {total>0
        ?<><circle cx={cx} cy={cy} r={25} fill="#1a0a0d" stroke="rgba(255,45,71,.5)"/><text x={cx} y={cy+5} textAnchor="middle" className="np-wc">{total}</text></>
        :passed
          ?<><circle cx={cx} cy={cy} r={25} fill="#f4f5f6"/><path d={`M${cx-8} ${cy+1} l5 5 l11 -12`} fill="none" stroke="#070708" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"/></>
          :<><circle cx={cx} cy={cy} r={25} fill="#111113" stroke="rgba(255,255,255,.14)"/><text x={cx} y={cy+5} textAnchor="middle" className="np-wc is-quiet">?</text></>}
      {areas.map((area,index)=>{
        const a=(-90+index*step)*Math.PI/180,x=cx+Math.cos(a)*R,y=cy+Math.sin(a)*R,colour=COLOUR[area.tone];
        const right=Math.cos(a)>0.3,left=Math.cos(a)<-0.3,anchor=right?'start':left?'end':'middle',dx=right?13:left?-13:0,dy=Math.sin(a)<-0.6?-12:Math.sin(a)>0.6?20:4;
        const loud=area.tone==='critical'||area.tone==='warn';
        return <g key={area.id}>
          {area.tone==='unchecked'?<circle cx={x} cy={y} r={4} fill="#0c0c0d" stroke={colour} strokeWidth={1.4}/>:<circle cx={x} cy={y} r={loud?9:4} fill={loud?`${colour}26`:colour}/>}
          {loud?<circle cx={x} cy={y} r={4.5} fill={colour}/>:null}
          <text x={x+dx} y={y+dy-(Math.sin(a)<-0.6?13:0)} textAnchor={anchor} className="np-nn">{area.label}</text>
          <text x={x+dx} y={y+dy+(Math.sin(a)<-0.6?0:13)} textAnchor={anchor} className={`np-ns is-${area.tone}`}>{area.detail}</text>
        </g>;
      })}
    </svg>
    <ul className="np-areas">{areas.map(area=><li key={area.id}><i className={`is-${area.tone}`} aria-hidden/><b>{area.label}</b><span className={`is-${area.tone}`}>{area.detail}</span></li>)}</ul>
  </div></div>;
}
