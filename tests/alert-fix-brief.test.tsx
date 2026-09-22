// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {AlertFixBrief,buildAlertFixBrief} from '../src/components/watch/AlertFixBrief';
const alert={id:1,kind:'push_sensitive_path',title:'Sensitive path in owner/app',body:'This push touched .env.example. NoSpoilers did not unpack the git tree.',findings:null,created_at:'2026-09-22T03:00:00Z'};
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('explains a filename warning without claiming credentials were exposed',()=>{
 render(<AlertFixBrief alert={alert}/>);
 expect(screen.getByText('.env.example')).toBeTruthy();
 expect(screen.getByText(/does not establish that credentials leaked/)).toBeTruthy();
 expect(buildAlertFixBrief(alert)).toContain('placeholders');
 expect(buildAlertFixBrief(alert)).toContain('Never claim the issue is fixed without fresh verification');
});
it('requires reviewing the brief and copies the actual instructions without making requests',async()=>{
 const copy=vi.fn().mockResolvedValue(undefined);
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:copy}});
 render(<AlertFixBrief alert={alert}/>);
 expect(copy).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Prepare AI fix brief'}));
 expect(screen.getByRole('dialog')).toBeTruthy();
 expect(screen.getByRole('textbox',{name:'Agent instructions'})).toHaveProperty('value',buildAlertFixBrief(alert));
 fireEvent.click(screen.getByRole('button',{name:'Copy brief',exact:true}));
 expect(await screen.findByText(/Copied. Paste/)).toBeTruthy();
 expect(copy).toHaveBeenCalledWith(buildAlertFixBrief(alert));
});
it('keeps incomplete checks and unknown paths honest',()=>{
 const brief=buildAlertFixBrief({...alert,kind:'scan_latest_release',body:'Unavailable',title:'Check failed'},true);
 expect(brief).toContain('This check did not complete');
 expect(brief).toContain('Not recorded');
 expect(brief).not.toContain('.env.example');
});
it('keeps the brief available for manual copying if the clipboard fails',async()=>{
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockRejectedValue(new Error('denied'))}});
 render(<AlertFixBrief alert={alert}/>);
 fireEvent.click(screen.getByRole('button',{name:'Prepare AI fix brief'}));
 fireEvent.click(screen.getByRole('button',{name:'Copy brief',exact:true}));
 expect(await screen.findByText(/Clipboard unavailable/)).toBeTruthy();
 expect(screen.getByRole('textbox',{name:'Agent instructions'})).toHaveProperty('value',buildAlertFixBrief(alert));
});
it('shows the same rule-specific correction in the UI and copyable brief',()=>{
 const record={...alert,kind:'release_scan',findings:[{rule:'SEC-003',path:'config.json'},{rule:'MAP-002',path:'app.map'}]};
 render(<AlertFixBrief alert={record}/>);
 expect(screen.getByText('Credential pattern detected')).toBeTruthy();
 expect(screen.getByText('Original source embedded in a map')).toBeTruthy();
 const brief=buildAlertFixBrief(record);
 expect(brief).toContain('server-side secret storage');expect(brief).toContain('private storage');
 expect(brief).toContain('config.json');expect(brief).toContain('app.map');
 expect(brief).not.toContain('Sensitive-looking file changed');
});
