// @vitest-environment jsdom
import {cleanup,render,screen,within} from '@testing-library/react';
import {it,expect,afterEach} from 'vitest';
import {AlertProgress} from '../src/components/WatchAlertsWorkspace';
afterEach(cleanup);
it('marks acknowledgement as the current step on an open alert',()=>{
 render(<AlertProgress alert={{created_at:'2026-11-05T10:42:00Z',acknowledged_at:null,resolved_at:null}}/>);
 const steps=within(screen.getByRole('list',{name:'Response progress'})).getAllByRole('listitem');
 expect(steps.map(step=>step.querySelector('strong')?.textContent)).toEqual(['Opened','Acknowledged','Resolved']);
 expect(steps[1].getAttribute('aria-current')).toBe('step');
 expect(steps[2].textContent).toContain('Not yet');
});
it('shows who acknowledged and resolved a finished alert, with no current step',()=>{
 render(<AlertProgress alert={{created_at:'2026-11-05T10:42:00Z',acknowledged_at:'2026-11-05T10:50:00Z',acknowledged_by_login:'edem',resolved_at:'2026-11-05T12:00:00Z',resolved_by_login:'edem'}}/>);
 const steps=within(screen.getByRole('list',{name:'Response progress'})).getAllByRole('listitem');
 expect(steps.every(step=>step.className==='is-done')).toBe(true);
 expect(steps.some(step=>step.getAttribute('aria-current'))).toBe(false);
 expect(steps[2].textContent).toContain('edem');
});
