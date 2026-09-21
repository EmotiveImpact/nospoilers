// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {WatchExposureChart} from '../src/components/WatchExposureChart';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('presents an operational warning as alert activity with a keyboard-accessible timeline',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-09-09T12:00:00Z'));
 render(<WatchExposureChart alerts={[{id:1,kind:'scan_latest_release',title:'No release on owner/repo',body:'No published release available.',findings:[],created_at:'2026-09-09T10:00:00Z',full_name:'owner/repo'}]}/>);
 expect(screen.getByRole('heading',{name:'Alert activity, last 7 days'})).toBeTruthy();
 expect(screen.getByText('open alerts')).toBeTruthy();
 expect(screen.queryByText(/exposure/i)).toBeNull();
 const warning=screen.getByRole('img',{name:/warning alert · scan_latest_release: No release on owner\/repo/});
 expect(warning.getAttribute('aria-label')).toContain('still open');
 expect(warning.className).toContain('bg-warn/80');
 expect(warning.className).not.toContain('bg-danger');
 expect(warning.className).toContain('text-ink');
 expect(warning.className).not.toContain('text-snow');
 const region=screen.getByRole('region',{name:'Alert activity by source and retained time'});
 await userEvent.tab();expect(document.activeElement).toBe(region);
 const instruction=document.getElementById(region.getAttribute('aria-describedby')!);
 expect(instruction?.textContent).toMatch(/scroll/i);
 await userEvent.tab();expect(document.activeElement).toBe(warning);
 expect(screen.getByRole('table',{name:'Alert activity timeline text equivalent'})).toBeTruthy();
});
it('keeps an empty activity chart from claiming release safety',()=>{
 render(<WatchExposureChart alerts={[]}/>);
 expect(screen.queryByText(/exposure/i)).toBeNull();
 expect(screen.queryByRole('region')).toBeNull();
 expect(screen.getByText(/No alert activity in this window/)).toBeTruthy();
 expect(screen.getByText('no activity')).toBeTruthy();
 expect(screen.queryByText('all alerts closed')).toBeNull();
});

it('labels long retained windows with calendar dates rather than repeating weekdays',()=>{
 const now=Date.parse('2026-09-09T12:00:00Z');vi.spyOn(Date,'now').mockReturnValue(now);
 render(<WatchExposureChart days={90} alerts={[{id:1,kind:'scan_latest_release',title:'No release',body:'',findings:[],created_at:'2026-09-09T10:00:00Z'}]}/>);
 const start=new Date(now-90*86400000).toLocaleDateString(undefined,{day:'numeric',month:'short',timeZone:'UTC'});
 expect(screen.getByText(start)).toBeTruthy();expect(screen.getByText('Today')).toBeTruthy();
});
