// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
const dropdownCss=readFileSync('src/components/motion/dropdown.css','utf8');
import userEvent from '@testing-library/user-event';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {useState} from 'react';
import {WatchCommandPalette} from '../src/components/WatchCommandPalette';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '../src/components/motion/select';
vi.mock('motion/react',async importOriginal=>({...await importOriginal<typeof import('motion/react')>(),useReducedMotion:()=>true}));
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
it('disables dropdown CSS motion under reduced-motion preference and retains keyboard behavior',async()=>{
 expect(dropdownCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.ns-dropdown-surface\[data-state\][\s\S]*animation:\s*none;[\s\S]*transition:\s*none;/);
 render(<Picker/>);const trigger=screen.getByRole('combobox',{name:'Destination'});
 trigger.focus();await userEvent.keyboard('{ArrowDown}');await screen.findByRole('listbox');await userEvent.keyboard('{End}');
 const option=screen.getByRole('option',{name:'Slack'});
 await waitFor(()=>expect(document.activeElement).toBe(option));await userEvent.click(option);
 expect(trigger.textContent).toContain('Slack');await waitFor(()=>expect(document.activeElement).toBe(trigger));
 expect(trigger.getAttribute('aria-expanded')).toBe('false');
});
