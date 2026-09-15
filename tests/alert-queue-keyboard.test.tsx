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

it('shows a concise repository and issue in incomplete-check rows without internal job labels',()=>{
 const p=props();
 p.alerts=[{...p.alerts[0],title:'No release on Acme/web'}];
 p.rows=[{...p.rows[0],title:'No release on Acme/web',coordinate:'scan_latest_release',rule:'scan_latest_release',operational:true,exposure:'Saved check'}];
 p.selected=p.alerts[0];
 render(<WatchAlertsWorkspace {...p}/>);
 const row=screen.getByRole('button',{name:'Acme/web. No published release'});
 expect(row.textContent).not.toContain('scan_latest_release');
 expect(row.textContent).not.toContain('Saved check');
 expect(screen.getByText('Latest release check').getAttribute('title')).toBe('scan_latest_release');
 expect(screen.getByRole('heading',{name:'No release on Acme/web'})).toBeTruthy();
});
