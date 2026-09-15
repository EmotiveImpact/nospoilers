// @vitest-environment jsdom
import {useState} from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '../src/components/motion/select';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function Example({disabled=false}:{disabled?:boolean}){const [value,setValue]=useState('7');return <Select value={value} onValueChange={setValue} disabled={disabled}><SelectTrigger aria-label="Period"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="14" disabled>Unavailable</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Quarter</SelectItem></SelectContent></Select>;}
it('supports arrow navigation, skips disabled options and restores focus after keyboard selection',async()=>{
 const user=userEvent.setup();render(<Example/>);const trigger=screen.getByRole('combobox',{name:'Period'});
 trigger.focus();await user.keyboard('{ArrowDown}');
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('option',{name:'Last 7 days'})));
 expect(screen.getByRole('option',{name:'Unavailable'}).getAttribute('aria-disabled')).toBe('true');
 await user.keyboard('{ArrowDown}');
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('option',{name:'Last 30 days'})));
 await user.keyboard('{Enter}');
 await waitFor(()=>expect(trigger.getAttribute('aria-expanded')).toBe('false'));
 expect(trigger.textContent).toContain('Last 30 days');
 await waitFor(()=>expect(document.activeElement).toBe(trigger));
 expect(screen.queryByRole('listbox')).toBeNull();
});
it('Escape closes without changing the value and returns focus to the trigger',async()=>{
 const user=userEvent.setup();render(<Example/>);const trigger=screen.getByRole('combobox',{name:'Period'});
 trigger.focus();await user.keyboard('{Enter}');await screen.findByRole('listbox');await user.keyboard('{End}');
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('option',{name:'Quarter'})));
 await user.keyboard('{Escape}');
 await waitFor(()=>expect(trigger.getAttribute('aria-expanded')).toBe('false'));
 expect(trigger.textContent).toContain('Last 7 days');await waitFor(()=>expect(document.activeElement).toBe(trigger));
});
it('finds an option by typing its label and supports pointer selection',async()=>{
 const user=userEvent.setup();render(<Example/>);const trigger=screen.getByRole('combobox',{name:'Period'});
 await user.click(trigger);await screen.findByRole('listbox');await user.keyboard('q');
 const option=screen.getByRole('option',{name:'Quarter'});
 await waitFor(()=>expect(document.activeElement).toBe(option));await user.click(option);
 await waitFor(()=>expect(trigger.textContent).toContain('Quarter'));
 await waitFor(()=>expect(document.activeElement).toBe(trigger));
});
it('does not open a disabled select',async()=>{
 const user=userEvent.setup();render(<Example disabled/>);const trigger=screen.getByRole('combobox',{name:'Period'});
 expect(trigger).toHaveProperty('disabled',true);await user.click(trigger);await user.keyboard('{ArrowDown}');
 expect(screen.queryByRole('listbox')).toBeNull();expect(trigger.textContent).toContain('Last 7 days');
});
