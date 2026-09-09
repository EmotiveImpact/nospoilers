// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {useState} from 'react';
import {WatchCommandPalette} from '../src/components/WatchCommandPalette';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '../src/components/motion/select';
vi.mock('motion/react',async importOriginal=>({...await importOriginal<typeof import('motion/react')>(),useReducedMotion:()=>true}));
class TestResizeObserver{observe(){} unobserve(){} disconnect(){}}
beforeEach(()=>vi.stubGlobal('ResizeObserver',TestResizeObserver));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('opens search fully visible with reduced motion and retains combobox focus',async()=>{
 render(<WatchCommandPalette open search="?workspace=one" teamOnly={false} adminOnly={false} alerts={[]} sources={[]} releases={[]} onClose={()=>{}}/>);
 const input=await screen.findByRole('combobox',{name:'Search pages and commands'});
 const panel=document.querySelector<HTMLElement>('.watch-search-panel')!;
 expect(panel.style.opacity).toBe('1');
 expect(panel.style.transform===''||panel.style.transform==='none').toBe(true);
 await waitFor(()=>expect(document.activeElement).toBe(input));
 fireEvent.keyDown(input,{key:'End'});
 expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).not.toBeNull();
});
function Picker(){const [value,setValue]=useState('email');return <Select value={value} onValueChange={setValue}><SelectTrigger aria-label="Destination"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="email">Email</SelectItem><SelectItem value="slack">Slack</SelectItem></SelectContent></Select>;}
it('keeps reduced-motion select keyboard selection and focus return functional',async()=>{
 render(<Picker/>);const trigger=screen.getByRole('combobox',{name:'Destination'});
 trigger.focus();fireEvent.keyDown(trigger,{key:'End'});
 const option=screen.getByRole('option',{name:'Slack'});
 await waitFor(()=>expect(document.activeElement).toBe(option));fireEvent.click(option);
 expect(trigger.textContent).toContain('Slack');expect(document.activeElement).toBe(trigger);
 expect(trigger.getAttribute('aria-expanded')).toBe('false');
});
