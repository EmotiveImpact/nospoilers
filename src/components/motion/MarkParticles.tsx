import {useEffect,useRef} from 'react';
import {startMarkField,type MarkField} from './mark-particles';

const canDraw=()=>typeof window!=='undefined'&&!/jsdom/i.test(navigator.userAgent);
const prefersReduced=()=>typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The NoSpoilers mark as a particle field: a loose swarm that gathers into the mark. */
export function MarkParticles({gathered,className,limit,scale,rate,src='/assets/brand/nospoilers-mark.png'}:{gathered:boolean;className?:string;limit?:number;scale?:number;rate?:number;src?:string}){
 const canvas=useRef<HTMLCanvasElement>(null),field=useRef<MarkField|null>(null),initial=useRef(gathered);
 useEffect(()=>{
  if(!canvas.current||!canDraw())return;
  const started=startMarkField(canvas.current,{src,gathered:initial.current,reduced:prefersReduced(),limit,scale,rate});
  field.current=started;
  return()=>{started.destroy();field.current=null;};
 },[src,limit,scale,rate]);
 useEffect(()=>{field.current?.setGathered(gathered);},[gathered]);
 return <canvas ref={canvas} className={className} aria-hidden="true"/>;
}
