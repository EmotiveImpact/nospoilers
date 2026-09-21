// @vitest-environment jsdom
import {cleanup,render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState,type ComponentProps} from 'react';
import {afterEach,expect,it} from 'vitest';
import {WatchAlertsWorkspace} from '../src/components/WatchAlertsWorkspace';
afterEach(cleanup);
function Filters(){
 const [tab,setTab]=useState<ComponentProps<typeof WatchAlertsWorkspace>['tab']>('open');
 const [mine,setMine]=useState(false);
 const noop=()=>{};
 return <WatchAlertsWorkspace alerts={[]} rows={[]} selected={null} events={[]} sourceCount={1}
  previewing={false} ended={false} busy={false} note="" assignee="" error={null} exportError={null}
  state={{status:'ready'}} activityState={{status:'ready'}} detailOpen={false} tab={tab} teamOnly
  assignedToMe={mine} onAssignedToMe={()=>setMine(value=>!value)} onTab={setTab}
  onSelect={noop} onBack={noop} onRetry={noop} onRetryActivity={noop} onNote={noop}
  onAssignee={noop} onAction={noop} onExport={noop}/>;
}
it('moves focus and selection through lifecycle tabs while keeping ownership independent',async()=>{
 const user=userEvent.setup();render(<Filters/>);
 const tabs=within(screen.getByRole('tablist',{name:'Alert queues'})).getAllByRole('tab');
 const ownership=screen.getByRole('button',{name:'Assigned to me'});
 expect(tabs).toHaveLength(3);
 expect(screen.queryByText('Status',{exact:true})).toBeNull();
 expect(ownership.closest('[role="tablist"]')).toBeNull();
 const selected=(index:number)=>tabs.forEach((tab,i)=>{
  expect(tab.getAttribute('aria-selected')).toBe(String(i===index));
  expect(tab.tabIndex).toBe(i===index?0:-1);
 });
 selected(0);tabs[0].focus();
 for(const [key,index] of [['{ArrowRight}',1],['{End}',2],['{ArrowRight}',0],['{ArrowLeft}',2],['{Home}',0]] as const){
  await user.keyboard(key);selected(index);expect(document.activeElement).toBe(tabs[index]);
 }
 await user.click(ownership);selected(0);expect(ownership.getAttribute('aria-pressed')).toBe('true');
 tabs[0].focus();await user.keyboard('{ArrowRight}');selected(1);
 expect(ownership.getAttribute('aria-pressed')).toBe('true');
 await user.click(ownership);selected(1);expect(ownership.getAttribute('aria-pressed')).toBe('false');
});
