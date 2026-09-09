// @vitest-environment jsdom
import {useState} from 'react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '../src/components/motion/select';
class TestResizeObserver { observe(){} unobserve(){} disconnect(){} }
beforeEach(()=>vi.stubGlobal('ResizeObserver',TestResizeObserver));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function Example(){const [value,setValue]=useState('7');return <Select value={value} onValueChange={setValue}><SelectTrigger aria-label="Period"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="14" disabled>Unavailable</SelectItem><SelectItem value="30">Last 30 days</SelectItem></SelectContent></Select>;}
it('supports arrow navigation, skips disabled options and restores focus after selection',async()=>{
 render(<Example/>);const trigger=screen.getByRole('combobox',{name:'Period'});
 trigger.focus();fireEvent.keyDown(trigger,{key:'ArrowDown'});
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('option',{name:'Last 7 days'})));
 fireEvent.keyDown(document.activeElement!,{key:'ArrowDown'});
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('option',{name:'Last 30 days'})));
 fireEvent.click(document.activeElement!);
 expect(trigger.textContent).toContain('Last 30 days');
 expect(trigger.getAttribute('aria-expanded')).toBe('false');
 expect(document.activeElement).toBe(trigger);
 expect(screen.queryByRole('listbox')).toBeNull();
});
it('Escape closes without changing the value and returns focus to the trigger',async()=>{
 render(<Example/>);const trigger=screen.getByRole('combobox',{name:'Period'});
 fireEvent.keyDown(trigger,{key:'End'});
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('option',{name:'Last 30 days'})));
 fireEvent.keyDown(document.activeElement!,{key:'Escape'});
 expect(trigger.getAttribute('aria-expanded')).toBe('false');
 expect(trigger.textContent).toContain('Last 7 days');expect(document.activeElement).toBe(trigger);
});
