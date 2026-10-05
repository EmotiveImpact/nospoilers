// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {sampleMark,loosePosition} from '../src/components/motion/mark-particles';
import {perimeterPoints} from '../src/components/motion/surface-flight';

it('samples only visible mark pixels and keeps their own colour',()=>{
 // 4x2 raster: one opaque red pixel, one opaque white pixel, the rest transparent.
 const rgba=new Uint8ClampedArray(4*2*4);
 rgba.set([255,0,0,255],0);rgba.set([255,255,255,255],(1*4+3)*4);
 const points=sampleMark(rgba,4,2,10,1);
 expect(points).toHaveLength(2);
 expect(points[0]).toMatchObject({r:255,g:0,b:0,y:-1});
 expect(points[1]).toMatchObject({r:255,g:255,b:255,y:1});
 expect(points.every(p=>p.seed>=0&&p.seed<1&&p.spread>=0&&p.spread<1)).toBe(true);
});

it('caps the sample count and keeps loose positions bounded',()=>{
 const rgba=new Uint8ClampedArray(30*30*4).fill(255);
 const points=sampleMark(rgba,30,30,50,1);
 expect(points).toHaveLength(50);
 for(const t of [0,3.7,40])for(const p of points){const q=loosePosition(p,t);expect(Math.abs(q.x)).toBeLessThan(3);expect(Math.abs(q.y)).toBeLessThan(2);}
});

it('spreads flight targets around the whole surface edge',()=>{
 const points=perimeterPoints({left:10,top:20,width:100,height:50},12);
 expect(points).toHaveLength(12);
 for(const p of points){
  const onEdge=p.y===20||p.y===70||p.x===10||p.x===110;
  expect(onEdge).toBe(true);
 }
 expect(new Set(points.map(p=>p.y===20?'top':p.x===110?'right':p.y===70?'bottom':'left')).size).toBe(4);
});
