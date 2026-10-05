// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {sampleMark,loosePosition,lighthousePosition} from '../src/components/motion/mark-particles';

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

it('draws a bounded lighthouse with a red lamp and signal band',()=>{
 const points=sampleMark(new Uint8ClampedArray(30*30*4).fill(255),30,30,400,1);
 const lit=points.map((p,i)=>lighthousePosition(p,i,points.length,2.5));
 for(const q of lit){expect(Math.abs(q.x)).toBeLessThan(1.6);expect(Math.abs(q.y)).toBeLessThan(1.05);expect(q.a).toBeGreaterThanOrEqual(0);}
 const red=lit.filter(q=>q.c[0]===255&&q.c[1]===59);
 expect(red.length).toBeGreaterThan(20);
 expect(red.some(q=>q.y<-.3)).toBe(true);
 expect(red.some(q=>q.y>.25)).toBe(true);
});
