import userEvent from '@testing-library/user-event';
import {screen} from '@testing-library/react';

/** Exercise the same disclosure, trigger and portaled option as a person. */
export async function selectOption(trigger:HTMLElement,name:string|RegExp){
 const disclosures:HTMLDetailsElement[]=[];
 for(let parent=trigger.parentElement;parent;parent=parent.parentElement){
  if(parent instanceof HTMLDetailsElement&&!parent.open)disclosures.unshift(parent);
 }
 for(const disclosure of disclosures){
  const summary=disclosure.querySelector('summary');
  if(summary)await userEvent.click(summary);
 }
 await userEvent.click(trigger);
 await userEvent.click(await screen.findByRole('option',{name,exact:typeof name==='string'}));
}
