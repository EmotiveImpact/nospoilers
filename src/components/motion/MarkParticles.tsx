import {useEffect,useRef} from 'react';
import {startMarkField,type MarkField} from './mark-particles';

const canDraw=()=>typeof window!=='undefined'&&!/jsdom/i.test(navigator.userAgent);
const prefersReduced=()=>typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A particle lighthouse that morphs through a loose swarm into the NoSpoilers mark when gathered. */
export function MarkParticles({gathered,className,limit,scale,duration,src='/assets/brand/nospoilers-mark.png'}:{gathered:boolean;className?:string;limit?:number;scale?:number;duration?:number;src?:string}){
 const canvas=useRef<HTMLCanvasElement>(null),field=useRef<MarkField|null>(null),initial=useRef(gathered);
 useEffect(()=>{
  if(!canvas.current||!canDraw())return;
  const started=startMarkField(canvas.current,{src,gathered:initial.current,reduced:prefersReduced(),limit,scale,duration});
  field.current=started;
  return()=>{started.destroy();field.current=null;};
 },[src,limit,scale,duration]);
 useEffect(()=>{field.current?.setGathered(gathered);},[gathered]);
 return <canvas ref={canvas} className={className} aria-hidden="true"/>;
}
