// @vitest-environment jsdom
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {Dialog,DialogPanel,DialogTitle} from '@headlessui/react';
import {AppSelect} from '../src/components/ui/app-select';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

function AssignmentDialog({count=2,onClose,onChange}:{count?:number;onClose:()=>void;onChange:(value:string)=>void}){
 const [open,setOpen]=useState(true),[value,setValue]=useState('0');
 return <Dialog open={open} onClose={()=>{setOpen(false);onClose();}}><DialogPanel>
  <DialogTitle>Assign this alert</DialogTitle>
  <AppSelect label="Workspace member" value={value} onValueChange={next=>{setValue(next);onChange(next);}}>
   {Array.from({length:count},(_,i)=><option key={i} value={i}>Member {i}</option>)}
  </AppSelect>
  <button>Save assignment</button>
 </DialogPanel></Dialog>;
}

it.each([2,10])('keeps the assignment dialog open while choosing among %s members',async count=>{
 const close=vi.fn(),change=vi.fn();render(<AssignmentDialog count={count} onClose={close} onChange={change}/>);
 const trigger=await screen.findByRole('combobox',{name:'Workspace member'});
 await userEvent.click(trigger);
 const panel=trigger.closest('[id^="headlessui-dialog-panel-"]')!;
 expect(panel.contains(await screen.findByRole('option',{name:'Member 1',exact:true}))).toBe(true);
 if(count>7){
  const search=await screen.findByRole('textbox',{name:'Search workspace member'});
  await userEvent.type(search,'Member 1');
  expect(document.activeElement).toBe(search);
 }
 await userEvent.click(await screen.findByRole('option',{name:'Member 1',exact:true}));
 expect(change).toHaveBeenCalledWith('1');expect(close).not.toHaveBeenCalled();
 expect(screen.getByRole('dialog',{name:'Assign this alert'})).toBeTruthy();
 expect(trigger.textContent).toContain('Member 1');
 await waitFor(()=>expect(document.activeElement).toBe(trigger));
});

it.each([2,10])('Escape closes the %s-member menu before closing the assignment dialog',async count=>{
 const close=vi.fn(),change=vi.fn();render(<AssignmentDialog count={count} onClose={close} onChange={change}/>);
 const trigger=await screen.findByRole('combobox',{name:'Workspace member'});
 await userEvent.click(trigger);
 if(count>7)await userEvent.click(await screen.findByRole('textbox',{name:'Search workspace member'}));
 await userEvent.keyboard('{Escape}');
 await waitFor(()=>expect(screen.queryByRole('option')).toBeNull());
 expect(close).not.toHaveBeenCalled();expect(change).not.toHaveBeenCalled();
 expect(screen.getByRole('dialog',{name:'Assign this alert'})).toBeTruthy();
 await waitFor(()=>expect(document.activeElement).toBe(trigger));
 await userEvent.keyboard('{Escape}');
 await waitFor(()=>expect(close).toHaveBeenCalledTimes(1));
 expect(screen.queryByRole('dialog',{name:'Assign this alert'})).toBeNull();
});
