// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { AppSelect } from '../src/components/ui/app-select';
import { radixUiTestSupport } from './helpers/radix-ui';
radixUiTestSupport();
afterEach(cleanup);
it('uses a labelled custom menu and preserves numeric IDs and optional empty choices', async () => {
 const change = vi.fn();
 function Demo() { const [value,setValue]=useState('');return <AppSelect label="Save this release in" value={value} onValueChange={next=>{setValue(next);change(next);}}><option value="">Personal workspace</option><option value={42}>Studio</option></AppSelect>; }
 render(<Demo/>);
 const trigger=screen.getByRole('combobox',{name:'Save this release in'});
 await userEvent.click(trigger);await userEvent.click(await screen.findByRole('option',{name:'Studio'}));
 expect(change).toHaveBeenLastCalledWith('42');expect(trigger.textContent).toContain('Studio');
 await userEvent.click(trigger);await userEvent.click(await screen.findByRole('option',{name:'Personal workspace'}));
 expect(change).toHaveBeenLastCalledWith('');
});
it('filters long lists without selecting, supports keyboard choice and restores focus', async () => {
 const change=vi.fn();render(<AppSelect label="Repository" value="0" onValueChange={change}>{Array.from({length:10},(_,i)=><option key={i} value={i}>Team/repo-{i}</option>)}</AppSelect>);
 const trigger=screen.getByRole('combobox',{name:'Repository'});await userEvent.click(trigger);
 const search=await screen.findByRole('textbox',{name:'Search repository'});
 await userEvent.type(search,'repo-7');
 fireEvent.focus(screen.getByRole('dialog',{name:'Repository options'}));expect(document.activeElement).toBe(search);expect(screen.queryByRole('option',{name:'Team/repo-0'})).toBeNull();expect(change).not.toHaveBeenCalled();
 await userEvent.keyboard('{ArrowDown}{Enter}');expect(change).toHaveBeenCalledWith('7',trigger);
 await waitFor(()=>expect(document.activeElement).toBe(trigger));
});
it('preserves required validation, disabled choices and disabled controls',async()=>{
 function Demo(){const [value,setValue]=useState('');return <form aria-label="Setup"><AppSelect label="Token" required value={value} onValueChange={setValue}><option value="">Choose a token</option><option value="expired" disabled>Expired</option><option value="active">Active</option></AppSelect><button type="submit">Save</button></form>;}
 render(<Demo/>);const form=screen.getByRole('form',{name:'Setup'}) as HTMLFormElement;
 expect(form.checkValidity()).toBe(false);
 await userEvent.click(screen.getByRole('combobox',{name:'Token'}));expect((await screen.findByRole('option',{name:'Expired'})).getAttribute('aria-disabled')).toBe('true');
 await userEvent.click(screen.getByRole('option',{name:'Active'}));expect(form.checkValidity()).toBe(true);
});
it('cancels an empty search without changing the selected value',async()=>{
 const change=vi.fn();render(<AppSelect label="Source" value="2" onValueChange={change}>{Array.from({length:9},(_,i)=><option key={i} value={i}>Source {i}</option>)}</AppSelect>);
 const trigger=screen.getByRole('combobox',{name:'Source'});await userEvent.click(trigger);
 fireEvent.change(await screen.findByRole('textbox',{name:'Search source'}),{target:{value:'unmatched'}});
 expect(await screen.findByRole('status')).toHaveProperty('textContent','No matching options.');
 await userEvent.keyboard('{Escape}');expect(change).not.toHaveBeenCalled();expect(trigger.textContent).toContain('Source 2');
});

it('does not open or change a disabled picker',async()=>{
 const change=vi.fn();render(<AppSelect label="Locked setting" value="active" disabled onValueChange={change}><option value="active">Active</option></AppSelect>);
 const trigger=screen.getByRole('combobox',{name:'Locked setting'});await userEvent.click(trigger);
 expect(screen.queryByRole('listbox')).toBeNull();expect(change).not.toHaveBeenCalled();expect(trigger).toHaveProperty('disabled',true);
});
it('does not submit a surrounding form when Enter is pressed in search',async()=>{
 const submit=vi.fn(event=>event.preventDefault());render(<form data-dropdown-boundary onSubmit={submit}><AppSelect label="Destination" value="0" onValueChange={()=>{}}>{Array.from({length:9},(_,i)=><option key={i} value={i}>Destination {i}</option>)}</AppSelect><button type="submit">Save</button></form>);
 await userEvent.click(screen.getByRole('combobox',{name:'Destination'}));
 const search=await screen.findByRole('textbox',{name:'Search destination'});await userEvent.type(search,'Destination 7{Enter}');
 expect(submit).not.toHaveBeenCalled();expect(screen.getByRole('dialog',{name:'Destination options'})).toBeTruthy();
});
