// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {WatchAlertsWorkspace} from '../src/components/WatchAlertsWorkspace';
import type {ComponentProps} from 'react';

const alert={id:1,kind:'exposure',title:'Recorded exposure',body:'Review the recorded artifact.',findings:null,created_at:'2026-09-05T10:00:00Z'};
function props():ComponentProps<typeof WatchAlertsWorkspace>{return {alerts:[alert],rows:[{id:1,title:alert.title,coordinate:'artifact',rule:'MAP-001',severity:'critical',status:'open',exposure:'1 hour'}],selected:alert,events:[],previewing:false,ended:false,busy:false,note:'Fixed source map',assignee:'owner',error:null,exportError:null,state:{status:'ready'},activityState:{status:'ready'},detailOpen:true,tab:'open',teamOnly:true,onSelect:vi.fn(),onBack:vi.fn(),onRetry:vi.fn(),onRetryActivity:vi.fn(),onTab:vi.fn(),onNote:vi.fn(),onAssignee:vi.fn(),onAction:vi.fn(),onExport:vi.fn()};}
afterEach(cleanup);
describe('alert response permissions',()=>{
  it('defaults unknown/viewer permissions to read-only without blocking evidence',()=>{
    const input=props();render(<WatchAlertsWorkspace {...input}/>);
    for(const name of ['Acknowledge','Resolve','Assign']){const button=screen.getByRole('button',{name});expect((button as HTMLButtonElement).disabled).toBe(true);fireEvent.click(button);}
    expect(input.onAction).not.toHaveBeenCalled();expect(screen.getByText(/Read-only access/)).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true);
  });
  it('permits actual responders to acknowledge while preserving expiry response access',()=>{
    const input=props();render(<WatchAlertsWorkspace {...input} canRespond ended/>);
    const button=screen.getByRole('button',{name:'Acknowledge'});expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);expect(input.onAction).toHaveBeenCalledWith('acknowledge');
  });
  it('keeps preview read-only even with responder permission',()=>{
    render(<WatchAlertsWorkspace {...props()} canRespond previewing/>);
    expect((screen.getByRole('button',{name:'Resolve'}) as HTMLButtonElement).disabled).toBe(true);
  });
});
