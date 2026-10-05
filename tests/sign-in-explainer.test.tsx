// @vitest-environment jsdom
import {cleanup,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {EXPLAINER_HOLD,EXPLAINER_MORPH,explainerPhase,packagePosition} from '../src/components/motion/explainer-particles';
import {SignInExplainer} from '../src/components/watch/SignInExplainer';

afterEach(cleanup);

it('walks the three steps in order, morphing only after each hold',()=>{
 const cycle=EXPLAINER_HOLD+EXPLAINER_MORPH;
 expect(explainerPhase(0)).toMatchObject({step:0,next:1,morph:0});
 expect(explainerPhase(EXPLAINER_HOLD+EXPLAINER_MORPH/2)).toMatchObject({step:0,next:1});
 expect(explainerPhase(EXPLAINER_HOLD+EXPLAINER_MORPH/2).morph).toBeCloseTo(.5);
 expect(explainerPhase(cycle+.1)).toMatchObject({step:1,next:2,morph:0});
 expect(explainerPhase(cycle*2+.1)).toMatchObject({step:2,next:0});
 expect(explainerPhase(cycle*3+.1).step).toBe(0);
});

it('draws a bounded package whose leaked file turns red and leaves once the scan reaches it',()=>{
 const seeds=Array.from({length:600},(_,i)=>({seed:(i*.618)%1,spread:((i*.37)%1),phase:i}));
 const at=(s:number)=>seeds.map((p,i)=>packagePosition(p,i,seeds.length,s));
 for(const q of at(1.2)){expect(Math.abs(q.x)).toBeLessThan(1.6);expect(Math.abs(q.y)).toBeLessThan(1);}
 const red=(s:number)=>at(s).filter(q=>q.c[0]===255&&q.c[1]===59);
 expect(red(0)).toHaveLength(0);
 const pulled=red(3.2);
 expect(pulled.length).toBeGreaterThan(20);
 expect(pulled.every(q=>q.x>.5)).toBe(true);
});

it('lists every step as text so the explainer reads without the animation',()=>{
 render(<SignInExplainer/>);
 const list=screen.getByRole('list',{name:'How NoSpoilers works'});
 expect(within(list).getAllByRole('listitem').map(item=>item.querySelector('.sign-in-explainer-title')?.textContent)).toEqual([
  'Watch every release.','See what actually ships.','Keep the receipt.',
 ]);
});
