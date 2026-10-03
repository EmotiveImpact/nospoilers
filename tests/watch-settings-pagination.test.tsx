// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {WorkspaceTeam} from '../src/components/watch/WorkspaceTeam';
import {AuditScreen} from '../src/components/watch/screens/AuditScreen';
import {radixUiTestSupport} from './helpers/radix-ui';

radixUiTestSupport();
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

const audit={status:'ready' as const,rows:Array.from({length:65},(_,index)=>({id:index+1,at:'2026-10-03T09:00:00Z',actorLogin:`Actor ${index}`,action:index%2?'member_invited':'policy_updated',summary:`Change ${index}`}))};
const team={role:'owner',archived:false,
 members:Array.from({length:65},(_,index)=>({user_id:`person-${index}`,login:`Person ${index}`,role:index===0?'owner':'viewer',access_source:'explicit'})),
 invites:Array.from({length:25},(_,index)=>({id:`invite-${index}`,login:`Invitee ${index}`,role:'viewer',expires_at:'2026-10-09T09:00:00Z'})),
 events:Array.from({length:100},(_,index)=>({id:`event-${index}`,action:'invited',actor:`Actor ${index}`,subject:null,created_at:'2026-10-03T09:00:00Z'})),
};
const tableRows=(name:string)=>within(screen.getByRole('table',{name})).getAllByRole('row').length-1;
async function chooseSize(label:string,size:30|60){
 await userEvent.click(screen.getByRole('combobox',{name:`${label} per page`}));
 await userEvent.click(screen.getByRole('option',{name:String(size),exact:true}));
}

it('paginates loaded audit events at ten, thirty and sixty while keeping archive scope explicit',async()=>{
 render(<AuditScreen previewing={false} audit={audit} installationId={23}/>);
 expect(tableRows('Administrative changes')).toBe(10);
 expect(screen.getByRole('navigation',{name:'Loaded events pagination'}).textContent).toContain('1–10 of 65 loaded events');
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));
 expect(screen.queryByText('Change 0',{exact:true})).toBeNull();
 expect(screen.getByText('Change 10',{exact:true})).toBeTruthy();
 await chooseSize('Loaded events',30);
 expect(tableRows('Administrative changes')).toBe(30);
 expect(screen.getByText('Change 0',{exact:true})).toBeTruthy();
 await chooseSize('Loaded events',60);
 expect(tableRows('Administrative changes')).toBe(60);
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));
 expect(tableRows('Administrative changes')).toBe(5);
 expect(screen.getByRole('button',{name:'Next',exact:true})).toHaveProperty('disabled',true);
 expect(screen.getByText(/Filters apply to up to 500 loaded events/)).toBeTruthy();
});

it('applies audit filters before pagination and resets the page and installation scope',async()=>{
 const view=render(<AuditScreen previewing={false} audit={audit} installationId={23}/>);
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));
 await userEvent.click(screen.getByRole('combobox',{name:'Audit event'}));
 await userEvent.click(screen.getByRole('option',{name:'member invited',exact:true}));
 expect(tableRows('Administrative changes')).toBe(10);
 expect(screen.getByText('Change 1',{exact:true})).toBeTruthy();
 expect(screen.queryByText('Change 0',{exact:true})).toBeNull();
 expect(screen.getByRole('navigation').textContent).toContain('1–10 of 32 loaded events');
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));
 view.rerender(<AuditScreen previewing={false} audit={audit} installationId={24}/>);
 expect(screen.getByRole('navigation').textContent).toContain('1–10 of 65 loaded events');
 expect(screen.getByText('Change 0',{exact:true})).toBeTruthy();
});

it('hides pagination for small audit lists and removes controls after access fails',()=>{
 const view=render(<AuditScreen previewing={false} audit={{...audit,rows:audit.rows.slice(0,10)}} installationId={23}/>);
 expect(screen.queryByRole('navigation')).toBeNull();
 expect(screen.queryByRole('combobox',{name:'Loaded events per page'})).toBeNull();
 view.rerender(<AuditScreen previewing={false} audit={{status:'error',message:'Access changed'}} installationId={23}/>);
 expect(screen.queryByRole('table')).toBeNull();
 expect(screen.queryByRole('navigation')).toBeNull();
 expect(screen.getByRole('button',{name:'Export audit JSON'})).toHaveProperty('disabled',true);
});

it('paginates each Team section without sending a member or invitation mutation',async()=>{
 const fetcher=vi.fn(async()=>Response.json(team));vi.stubGlobal('fetch',fetcher);
 render(<WorkspaceTeam workspaceId="workspace-a"/>);
 await screen.findByRole('table',{name:'Workspace members'});
 expect(tableRows('Workspace members')).toBe(10);
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));
 expect(screen.queryByText('Person 0',{exact:true})).toBeNull();
 expect(screen.getByText('Person 10',{exact:true})).toBeTruthy();
 await chooseSize('Members',30);
 expect(tableRows('Workspace members')).toBe(30);
 await chooseSize('Members',60);
 expect(tableRows('Workspace members')).toBe(60);
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));
 expect(tableRows('Workspace members')).toBe(5);
 await userEvent.click(screen.getByRole('tab',{name:'Invitations',exact:true}));
 expect(tableRows('Pending invitations')).toBe(10);
 await chooseSize('Invitations',30);
 expect(tableRows('Pending invitations')).toBe(25);
 expect(screen.getByRole('button',{name:'Next',exact:true})).toHaveProperty('disabled',true);
 await userEvent.click(screen.getByRole('tab',{name:'Access activity',exact:true}));
 expect(tableRows('Access activity')).toBe(10);
 await chooseSize('Loaded access events',60);
 expect(tableRows('Access activity')).toBe(60);
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));
 expect(tableRows('Access activity')).toBe(40);
 expect(screen.getByText('Latest 100 access events. Removing access preserves historical attribution.')).toBeTruthy();
 expect(fetcher).toHaveBeenCalledExactlyOnceWith('/api/workspaces/workspace-a/team',expect.objectContaining({signal:expect.any(AbortSignal)}));
});

it('resets Team pages on tab and workspace changes, while retaining a section’s chosen size',async()=>{
 const fetcher=vi.fn(async(url:string)=>Response.json({...team,members:team.members.map(member=>({...member,login:`${url.includes('workspace-b')?'Other':'Person'} ${member.user_id.split('-')[1]}`}))}));
 vi.stubGlobal('fetch',fetcher);
 const view=render(<WorkspaceTeam workspaceId="workspace-a"/>);
 await screen.findByRole('table',{name:'Workspace members'});
 await chooseSize('Members',30);
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));
 await userEvent.click(screen.getByRole('tab',{name:'Access activity',exact:true}));
 await userEvent.click(screen.getByRole('tab',{name:'Members 65',exact:true}));
 expect(tableRows('Workspace members')).toBe(30);
 expect(screen.getByText('Person 0',{exact:true})).toBeTruthy();
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));
 view.rerender(<WorkspaceTeam workspaceId="workspace-b"/>);
 await screen.findByText('Other 0',{exact:true});
 expect(tableRows('Workspace members')).toBe(10);
 expect(screen.queryByText('Person 0',{exact:true})).toBeNull();
 expect(screen.getByRole('navigation').textContent).toContain('1–10 of 65 members');
});

it('keeps small Team lists free of pagination and retains permitted member actions',async()=>{
 const small={...team,members:team.members.slice(0,10),invites:[],events:[]};
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json(small)));
 render(<WorkspaceTeam workspaceId="workspace-a"/>);
 fireEvent.click(await screen.findByRole('button',{name:'Edit role for Person 1'}));
 expect(screen.getByRole('combobox',{name:'Role for Person 1'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Save role for Person 1'})).toHaveProperty('disabled',true);
 expect(screen.queryByRole('navigation')).toBeNull();
});
