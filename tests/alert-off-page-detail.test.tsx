// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,it,expect} from 'vitest';
import {WatchAlertsWorkspace} from '../src/components/WatchAlertsWorkspace';
afterEach(cleanup);
it('renders a selected off-page alert without adding it to the current queue',()=>{
 const noop=()=>{};
 render(<WatchAlertsWorkspace alerts={[]} rows={[]} sourceCount={1}
  selected={{id:8,kind:'release_scan',title:'Older exposure',body:'Retained evidence',findings:[],created_at:'2026-09-01T00:00:00Z'}}
  selectedViewModel={{id:8,title:'Older exposure',coordinate:'org/repo',rule:'SOURCE',severity:'critical',status:'open',exposure:'2h'}}
  events={[]} previewing={false} ended={false} busy={false} note="" assignee="" error={null} exportError={null}
  state={{status:'ready'}} activityState={{status:'ready'}} detailOpen tab="open" teamOnly={false}
  onSelect={noop} onBack={noop} onRetry={noop} onRetryActivity={noop} onTab={noop} onNote={noop} onAssignee={noop} onAction={noop} onExport={noop}/>);
 expect(screen.getByRole('heading',{name:'Older exposure'})).toBeTruthy();
 expect(screen.getByText('Retained evidence')).toBeTruthy();
 expect(screen.queryByRole('button',{name:/Older exposure/})).toBeNull();
});
