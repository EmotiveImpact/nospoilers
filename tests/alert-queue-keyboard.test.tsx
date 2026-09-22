// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import type {ComponentProps} from 'react';
import {WatchAlertsWorkspace} from '../src/components/WatchAlertsWorkspace';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function props():ComponentProps<typeof WatchAlertsWorkspace>{
 const alerts=[1,2].map(id=>({id,kind:'scan_latest_release',title:`Missing release ${id}`,body:'No release.',findings:[],created_at:'2026-09-05T10:00:00Z'}));
 return {alerts,rows:alerts.map(a=>({id:a.id,title:a.title,coordinate:`repo${a.id}`,rule:a.kind,severity:'warning',status:'open',exposure:'1h'})),selected:alerts[0],events:[],previewing:false,ended:false,busy:false,note:'',assignee:'',error:'',exportError:'',state:{status:'ready'},activityState:{status:'ready'},detailOpen:false,tab:'open',teamOnly:true,canRespond:true,onSelect:vi.fn(),onBack:vi.fn(),onRetry:vi.fn(),onRetryActivity:vi.fn(),onTab:vi.fn(),onNote:vi.fn(),onAssignee:vi.fn(),onAction:vi.fn(),onExport:vi.fn()};
}
it('moves desktop queue focus with arrows and J without changing response state',()=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true})));Element.prototype.scrollIntoView=vi.fn();
 const p=props();render(<WatchAlertsWorkspace {...p}/>);
 const first=screen.getByRole('button',{name:/Missing release 1/}),second=screen.getByRole('button',{name:/Missing release 2/});
 first.focus();fireEvent.keyDown(first,{key:'ArrowDown'});expect(p.onSelect).toHaveBeenCalledWith(2);expect(document.activeElement).toBe(second);
 fireEvent.keyDown(first,{key:'j'});expect(p.onSelect).toHaveBeenCalledTimes(2);expect(p.onAction).not.toHaveBeenCalled();
 expect(screen.getByRole('status').textContent).toContain('Selected alert: Missing release 1');
});
it('leaves outside, form, modal and modified shortcuts alone',()=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true})));Element.prototype.scrollIntoView=vi.fn();
 const p=props();render(<><button>Outside</button><WatchAlertsWorkspace {...p}/></>);
 const row=screen.getByRole('button',{name:/Missing release 1/});
 for(const modifier of [{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true}])fireEvent.keyDown(row,{key:'j',...modifier});
 fireEvent.keyDown(screen.getByRole('button',{name:'Outside'}),{key:'j'});
 fireEvent.keyDown(screen.getByRole('textbox'),{key:'j'});
 fireEvent.keyDown(screen.getByRole('button',{name:'Acknowledge'}),{key:'ArrowDown'});
 const editable=document.createElement('div');editable.setAttribute('contenteditable','true');row.parentElement!.append(editable);fireEvent.keyDown(editable,{key:'j'});
 const modal=document.createElement('div');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');document.body.append(modal);fireEvent.keyDown(row,{key:'j'});modal.remove();
 expect(p.onSelect).not.toHaveBeenCalled();expect(p.onAction).not.toHaveBeenCalled();
});

it('labels an actionable incomplete check without exposing internal job labels',()=>{
 const p=props();
 p.alerts=[{...p.alerts[0],title:'Latest release check could not finish',body:'GitHub returned an incomplete asset response.'}];
 p.rows=[{...p.rows[0],title:'Latest release check could not finish',coordinate:'Acme/web',rule:'scan_latest_release',operational:true,queueKind:'incomplete-check',exposure:'Saved check'}];
 p.selected=p.alerts[0];
 render(<WatchAlertsWorkspace {...p}/>);
 const row=screen.getByRole('button',{name:'Acme/web. Latest release check could not finish'});
 expect(row.textContent).not.toContain('scan_latest_release');
 expect(row.textContent).not.toContain('Saved check');
 expect(screen.getByText(/opened this from a latest release check/)).toBeTruthy();
 expect(screen.getByRole('heading',{name:'Latest release check could not finish'})).toBeTruthy();
});

it('groups mixed alerts and navigates in displayed order without changing evidence',()=>{
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true})));Element.prototype.scrollIntoView=vi.fn();
 const p=props();
 p.rows=[
 {...p.rows[0],coordinate:'Acme/web',title:'Latest check failed',operational:true,queueKind:'incomplete-check'},
 {...p.rows[1],coordinate:'Acme/api',title:'Sensitive path in Acme/api',queueKind:'finding'},
 ];
 p.selected=p.alerts[1];
 render(<WatchAlertsWorkspace {...p}/>);
 const rows=Array.from(document.querySelectorAll<HTMLButtonElement>('[data-alert-id]'));
 expect(rows.map(row=>row.dataset.alertId)).toEqual(['2','1']);
 expect(screen.getByRole('heading',{name:/Findings1 on this page/})).toBeTruthy();
 expect(screen.getByRole('heading',{name:/Incomplete checks1 on this page/})).toBeTruthy();
 expect(screen.queryByRole('heading',{name:/Coverage records/})).toBeNull();
 expect(rows[0].querySelector('strong')?.textContent).toBe('Acme/api');
 expect(rows[0].querySelector('.alerts-journey-row-summary')?.textContent).toBe('Sensitive path');
 fireEvent.keyDown(rows[0],{key:'ArrowDown'});
 expect(p.onSelect).toHaveBeenCalledWith(1);
 expect(document.activeElement).toBe(rows[1]);
 expect(p.onAction).not.toHaveBeenCalled();
});

it('recovers the source from a legacy generated title when the API omits its repository field',()=>{
 const p=props();
 p.rows=[{...p.rows[0],title:'Sensitive path in EmotiveImpact/nospoilers',coordinate:'push_sensitive_path',rule:'push_sensitive_path'}];
 render(<WatchAlertsWorkspace {...p}/>);
 const row=screen.getByRole('button',{name:'EmotiveImpact/nospoilers. Sensitive path'});
 expect(row.querySelector('strong')?.textContent).toBe('EmotiveImpact/nospoilers');
 expect(row.querySelector('.alerts-journey-row-summary')?.textContent).toBe('Sensitive path');
});
it('explains repository access events without exposure or credential-rotation claims',()=>{
 const p=props();
 p.alerts=[{...p.alerts[0],kind:'repos_added',title:'Another repository connected',body:'Added: org/app.'}];
 p.rows=[{...p.rows[0],title:'Another repository connected',rule:'repos_added',coordinate:'org/app'}];p.selected=p.alerts[0];
 render(<WatchAlertsWorkspace {...p}/>);
 expect(screen.getByText('Event to review')).toBeTruthy();
 expect(screen.getByText(/Connection is not evidence that their release artifacts have been scanned/)).toBeTruthy();
 expect(screen.getByText('Not established')).toBeTruthy();
 expect(screen.queryByText('Reachable for')).toBeNull();
 expect(screen.queryByText('Rotation checklist · read-only')).toBeNull();
 expect(screen.queryByText('Where')).toBeNull();
 expect(screen.getByRole('button',{name:'Acknowledge'})).toBeTruthy();
});
