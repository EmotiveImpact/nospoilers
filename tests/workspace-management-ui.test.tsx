// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {SettingsTabs} from '../src/components/watch/design/SettingsTabs';
import {WorkspaceManagement} from '../src/components/watch/WorkspaceManagement';
import {WorkspaceSwitcher} from '../src/components/watch/WorkspaceSwitcher';
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},'','/');});
const workspace={id:'w1',name:'Original',organization_id:'o1',role:'owner',archived_at:null,installation_id:null};
const organizations=[{id:'o1',name:'Account',role:'owner',workspace_limit:2}];
it('submits workspace creation through its visible button',async()=>{
  const fetcher=vi.fn((_url:string,options?:RequestInit)=>Promise.resolve(new Response(JSON.stringify(options?.method?{}:{workspaces:[workspace],organizations,invites:[]}))));
  vi.stubGlobal('fetch',fetcher);render(<WorkspaceManagement/>);
  act(()=>{window.history.replaceState({},'','/watch/workspaces?workspaceTab=create');window.dispatchEvent(new PopStateEvent('popstate'));});
  fireEvent.change(await screen.findByLabelText('Workspace name'),{target:{value:'Production'}});
  fireEvent.click(screen.getByRole('button',{name:'Create workspace'}));
  await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/api/workspaces',expect.objectContaining({method:'POST',body:JSON.stringify({organizationId:'o1',name:'Production'})})));
});
it('submits a renamed workspace through Save name',async()=>{
  const fetcher=vi.fn((_url:string,options?:RequestInit)=>Promise.resolve(new Response(JSON.stringify(options?.method?{}:{workspaces:[workspace],organizations,invites:[]}))));
  vi.stubGlobal('fetch',fetcher);render(<WorkspaceManagement/>);
  fireEvent.click(await screen.findByRole('button',{name:'Manage Original'}));
  fireEvent.click(screen.getByRole('button',{name:'Rename'}));
  fireEvent.change(screen.getByDisplayValue('Original'),{target:{value:'Renamed'}});
  fireEvent.click(screen.getByRole('button',{name:'Save name'}));
  await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/api/workspaces/w1',expect.objectContaining({method:'PATCH',body:JSON.stringify({name:'Renamed'})})));
});
it('does not expose workspace mutations to a viewer',async()=>{
  vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve(new Response(JSON.stringify({workspaces:[{...workspace,role:'viewer'}]})))));
  render(<WorkspaceManagement/>);await screen.findByRole('heading',{name:'Original'});
  expect(screen.queryByRole('button',{name:'Create workspace'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Create new workspace'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Rename'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Archive'})).toBeNull();
});
it('refreshes the sidebar after workspace changes without a page reload',async()=>{
  let name='Original';
  vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve(new Response(JSON.stringify({workspaces:[{...workspace,name}]})))));
  render(<WorkspaceSwitcher search="?workspace=w1" installationId={null}/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Workspace'}).textContent).toContain('Original'));
  name='Renamed';
  fireEvent(window,new Event('nospoilers:workspaces-changed'));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Workspace'}).textContent).toContain('Renamed'));
  expect(screen.queryByText('Original')).toBeNull();
});
it('clears stale workspace choices on failed refresh and recovers explicitly',async()=>{
 let unavailable=false;
 vi.stubGlobal('fetch',vi.fn(async()=>unavailable?new Response('{}',{status:403}):new Response(JSON.stringify({workspaces:[workspace]}))));
 render(<WorkspaceSwitcher search="?workspace=w1" installationId={null}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Workspace'}).textContent).toContain('Original'));
 expect(screen.queryByText('Loading workspaces…')).toBeNull();
 unavailable=true;fireEvent(window,new Event('nospoilers:workspaces-changed'));
 await screen.findByRole('alert');
 expect(screen.queryByText('Original')).toBeNull();
 expect((screen.getByRole('button',{name:'Workspace'}) as HTMLButtonElement).disabled).toBe(true);
 unavailable=false;fireEvent.click(screen.getByRole('button',{name:'Retry workspaces'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Workspace'}).textContent).toContain('Original'));
 expect(screen.queryByRole('alert')).toBeNull();
});
it('shows available workspace avatars and readable initials when absent or unavailable',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({workspaces:[{...workspace,name:'Release Team',avatar_url:'/workspace-avatar.png'},{...workspace,id:'w2',name:'Client Studio'}],invites:[]})));
  const {container}=render(<WorkspaceManagement/>);
  await screen.findByRole('heading',{name:'Release Team'});
  const avatar=container.querySelector('img[src="/workspace-avatar.png"]');
  expect(avatar).not.toBeNull();expect(screen.getByText('CS')).toBeTruthy();
  fireEvent.error(avatar!);
  expect(container.querySelector('img')).toBeNull();expect(screen.getByText('RT')).toBeTruthy();
});
it('keeps the existing creation form without a duplicate plus tile',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({workspaces:[workspace],organizations,invites:[]})));
  render(<WorkspaceManagement/>);
  act(()=>{window.history.replaceState({},'','/watch/workspaces?workspaceTab=create');window.dispatchEvent(new PopStateEvent('popstate'));});
  expect(await screen.findByLabelText('Workspace name')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Create workspace'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Create new workspace'})).toBeNull();
});

it('offers workspace choices with avatars and a plus creation action in the sidebar menu',async()=>{
 vi.stubGlobal('ResizeObserver',class {observe(){}unobserve(){}disconnect(){}});
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({workspaces:[workspace,{...workspace,id:'w2',name:'Client Studio',installation_id:7,avatar_url:'/client.png'}]})));
 const view=render(<WorkspaceSwitcher search="?workspace=w1" installationId={null}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Workspace'}).textContent).toContain('Original'));
 await userEvent.click(screen.getByRole('button',{name:'Workspace'}));
 expect(screen.queryByRole('button',{name:'Manage workspaces'})).toBeNull();
 const target=await screen.findByRole('menuitem',{name:'Client Studio'});
 expect(target.querySelector('img')?.getAttribute('src')).toBe('/client.png');
 fireEvent.error(target.querySelector('img')!);expect(target.textContent).toContain('CS');
 await userEvent.click(target);expect(window.location.search).toBe('?workspace=w2&install=7');
 view.rerender(<WorkspaceSwitcher search="?workspace=w2&install=7&upload=old&uploadView=detail&configure=github" installationId={7}/>);
 await userEvent.click(screen.getByRole('button',{name:'Workspace'}));
 const create=await screen.findByRole('menuitem',{name:'Create new workspace'});
 expect(create.querySelector('svg')).not.toBeNull();await userEvent.click(create);
 expect(window.location.pathname).toBe('/watch/workspaces');
 const query=new URLSearchParams(window.location.search);
 expect(Object.fromEntries(query)).toEqual({workspaceTab:'create',workspace:'w2',install:'7'});
});

it('supports workspace typeahead and Escape without changing workspace, then returns focus',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({workspaces:[workspace,{...workspace,id:'w2',name:'Client Studio',installation_id:7}]})));
 window.history.replaceState({},'','/watch?workspace=w1');
 render(<WorkspaceSwitcher search="?workspace=w1" installationId={null}/>);
 const trigger=await screen.findByRole('button',{name:'Workspace'});
 await waitFor(()=>expect(trigger.textContent).toContain('Original'));
 trigger.focus();await userEvent.keyboard('{ArrowDown}');await screen.findByRole('menu');await userEvent.keyboard('cli');
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('menuitem',{name:'Client Studio'})));
 await userEvent.keyboard('{Escape}');
 await waitFor(()=>expect(screen.queryByRole('menu')).toBeNull());
 await waitFor(()=>expect(document.activeElement).toBe(trigger));
 expect(window.location.search).toBe('?workspace=w1');
});

it('uses the explicitly selected organisation when creating a workspace',async()=>{
 const fetcher=vi.fn((_url:string,options?:RequestInit)=>Promise.resolve(Response.json(options?.method?{}:{workspaces:[workspace],organizations:[...organizations,{...organizations[0],id:'o2',name:'Client account'}],invites:[]})));
 vi.stubGlobal('fetch',fetcher);render(<WorkspaceManagement/>);
 act(()=>{window.history.replaceState({},'','/watch/workspaces?workspaceTab=create');window.dispatchEvent(new PopStateEvent('popstate'));});
 await userEvent.click(await screen.findByRole('combobox',{name:'Organisation'}));
 await userEvent.click(screen.getByRole('option',{name:'Client account · existing subscription'}));
 fireEvent.change(screen.getByLabelText('Workspace name'),{target:{value:'Client production'}});
 fireEvent.click(screen.getByRole('button',{name:'Create workspace'}));
 await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/api/workspaces',expect.objectContaining({method:'POST',body:JSON.stringify({organizationId:'o2',name:'Client production'})})));
});

it('opens the create deep link and keeps its draft while moving between settings tabs',async()=>{
 window.history.replaceState({},'','/watch/workspaces?workspaceTab=create');
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({workspaces:[workspace],organizations,invites:[]})));
 render(<WorkspaceManagement/>);
 const createTab=await screen.findByRole('tab',{name:'Create workspace'});
 await waitFor(()=>expect(createTab.getAttribute('aria-selected')).toBe('true'));
 fireEvent.change(screen.getByLabelText('Workspace name'),{target:{value:'Draft workspace'}});
 await userEvent.click(screen.getByRole('tab',{name:'Workspaces',exact:true}));
 expect(screen.queryByRole('button',{name:'Create workspace'})).toBeNull();
 await userEvent.click(createTab);
 expect(screen.getByLabelText('Workspace name')).toHaveProperty('value','Draft workspace');
});

it('reveals the active settings tab after activation and resize by scrolling only its tab list',async()=>{
 vi.stubGlobal('ResizeObserver',undefined);
 const scrollPage=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 const scrollElement=vi.spyOn(HTMLElement.prototype,'scrollIntoView');
 let width=100;
 const bounds=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
  if(this.getAttribute('role')==='tablist')return new DOMRect(0,0,width,40);
  if(this.getAttribute('role')==='tab'){
   const left=this.textContent==='Organisation'?90:0;
   return new DOMRect(left-(this.parentElement?.scrollLeft??0),0,90,40);
  }
  return new DOMRect();
 });
 try{
  const tabs=[{id:'workspaces',label:'Workspaces',content:<p>Workspace content</p>},{id:'organisation',label:'Organisation',content:<p>Organisation content</p>}];
  const view=render(<SettingsTabs label="Settings" tabs={tabs} value="workspaces"/>);
  const list=screen.getByRole('tablist',{name:'Settings'});
  expect(list.scrollLeft).toBe(0);
  view.rerender(<SettingsTabs label="Settings" tabs={tabs} value="organisation"/>);
  expect(list.scrollLeft).toBe(80);
  width=60;fireEvent(window,new Event('resize'));
  expect(list.scrollLeft).toBe(120);
  expect(scrollPage).not.toHaveBeenCalled();expect(scrollElement).not.toHaveBeenCalled();
 }finally{bounds.mockRestore();scrollPage.mockRestore();scrollElement.mockRestore();}
});

it('keeps a creation draft when an unrelated workspace is archived',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(_url:string,init?:RequestInit)=>Response.json(init?.method?{}:{workspaces:[workspace],organizations,invites:[]})));
 render(<WorkspaceManagement/>);
 act(()=>{window.history.replaceState({},'','/watch/workspaces?workspaceTab=create');window.dispatchEvent(new PopStateEvent('popstate'));});
 fireEvent.change(await screen.findByLabelText('Workspace name'),{target:{value:'Unfinished workspace'}});
 await userEvent.click(screen.getByRole('tab',{name:'Workspaces',exact:true}));
 if(!screen.queryByRole('button',{name:'Archive'}))await userEvent.click(await screen.findByRole('button',{name:'Manage Original'}));
 await userEvent.click(screen.getByRole('button',{name:'Archive'}));
 await screen.findByRole('button',{name:'Archive'});
 act(()=>{window.history.replaceState({},'','/watch/workspaces?workspaceTab=create');window.dispatchEvent(new PopStateEvent('popstate'));});
 expect(await screen.findByLabelText('Workspace name')).toHaveProperty('value','Unfinished workspace');
});

it('removes stale workspace mutation controls after a failed list refresh',async()=>{
 let saved=false;
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  if(init?.method){saved=true;return Response.json({});}
  if(url==='/api/workspaces'&&saved)return Response.json({error:'Access revoked'},{status:403});
  return Response.json({workspaces:[workspace],organizations,invites:[]});
 }));
 render(<WorkspaceManagement/>);
 await userEvent.click(await screen.findByRole('button',{name:'Manage Original'}));
 await userEvent.click(screen.getByRole('button',{name:'Archive'}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Could not load workspaces.'));
 expect(screen.queryByRole('button',{name:'Archive'})).toBeNull();
 expect(screen.queryByText('No workspaces yet')).toBeNull();
 act(()=>{window.history.replaceState({},'','/watch/workspaces?workspaceTab=create');window.dispatchEvent(new PopStateEvent('popstate'));});
 expect(screen.queryByRole('button',{name:'Create workspace'})).toBeNull();
 await userEvent.click(screen.getByRole('tab',{name:'Organisation',exact:true}));
 expect(screen.queryByText('Account · organisation administration')).toBeNull();
 expect(screen.queryByText('No organisation administration access')).toBeNull();
});

it('requires a fresh organisation choice when the selected organisation disappears on refresh',async()=>{
 let saved=false;
 const fetcher=vi.fn(async(_url:string,init?:RequestInit)=>{
  if(init?.method){saved=true;return Response.json({});}
  return Response.json({workspaces:[workspace],organizations:saved?organizations:[...organizations,{...organizations[0],id:'o2',name:'Client'}],invites:[]});
 });
 vi.stubGlobal('fetch',fetcher);render(<WorkspaceManagement/>);
 act(()=>{window.history.replaceState({},'','/watch/workspaces?workspaceTab=create');window.dispatchEvent(new PopStateEvent('popstate'));});
 await userEvent.click(await screen.findByRole('combobox',{name:'Organisation'}));
 await userEvent.click(screen.getByRole('option',{name:'Client · existing subscription'}));
 fireEvent.change(screen.getByLabelText('Workspace name'),{target:{value:'Client draft'}});
 await userEvent.click(screen.getByRole('tab',{name:'Workspaces',exact:true}));
 if(!screen.queryByRole('button',{name:'Archive'}))await userEvent.click(await screen.findByRole('button',{name:'Manage Original'}));
 await userEvent.click(screen.getByRole('button',{name:'Archive'}));
 await screen.findByRole('button',{name:'Archive'});
 act(()=>{window.history.replaceState({},'','/watch/workspaces?workspaceTab=create');window.dispatchEvent(new PopStateEvent('popstate'));});
 const button=await screen.findByRole('button',{name:'Create workspace'});
 expect(button).toHaveProperty('disabled',true);
 expect(screen.getByRole('combobox',{name:'Organisation'}).textContent).toContain('Choose an organisation');
 expect(screen.getByLabelText('Workspace name')).toHaveProperty('value','Client draft');
 fireEvent.submit(button.closest('form')!);
 expect(fetcher.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(0);
});

it('synchronises popstate tabs without rewriting scoped history or discarding the create draft',async()=>{
 window.history.replaceState({},'','/watch/workspaces?workspace=w1&install=7&workspaceTab=create');
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({workspaces:[workspace],organizations,invites:[]})));
 render(<WorkspaceManagement/>);
 fireEvent.change(await screen.findByLabelText('Workspace name'),{target:{value:'Keep this draft'}});
 await userEvent.click(screen.getByRole('tab',{name:'Connections',exact:true}));
 expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({workspace:'w1',install:'7',workspaceTab:'connections'});
 act(()=>{window.history.replaceState({},'','/watch/workspaces?workspace=w1&install=7&workspaceTab=create');window.dispatchEvent(new PopStateEvent('popstate'));});
 expect(screen.getByRole('tab',{name:'Create workspace'}).getAttribute('aria-selected')).toBe('true');
 expect(screen.getByLabelText('Workspace name')).toHaveProperty('value','Keep this draft');
});

it('includes billing in workspace tabs and exposes administration only after Manage',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({workspaces:[workspace],organizations,invites:[]})));
 render(<WorkspaceManagement/>);await screen.findByRole('heading',{name:'Original'});
 expect(screen.getAllByRole('tab').map(tab=>tab.textContent)).toEqual(['Workspaces','Connections','Organisation','Plan & billing']);
 expect(screen.queryByRole('button',{name:'Archive'})).toBeNull();
 await userEvent.click(screen.getByRole('button',{name:'Manage Original'}));
 expect(screen.getByRole('region',{name:'Manage Original'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Review deletion'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Archive'})).toBeTruthy();
});

const clientOrganization={id:'o2',name:'Client account',role:'owner',workspace_limit:3,billing_available:true};
const multiOrgRows=[workspace,{...workspace,id:'w2',name:'Client workspace',organization_id:'o2'}];
const multiOrgs=[{...organizations[0],billing_available:true},clientOrganization];
function multiOrgFetcher(){
 return vi.fn(async(url:string,_init?:RequestInit)=>{
  if(url.startsWith('/api/organizations/')){
   const org=multiOrgs.find(row=>url.includes(`/${row.id}/`))!;
   return Response.json({organization:org,members:[{user_id:`user-${org.id}`,login:`owner-${org.id}`,role:'owner'}],events:[]});
  }
  if(url.startsWith('/api/billing?'))return Response.json({stripe:false,billing:{plan:'trial',trialEndsAt:null,status:null,periodEnd:null,hasCustomer:false,subscribed:false}});
  return Response.json({workspaces:multiOrgRows,organizations:multiOrgs,invites:[]});
 });
}

it('opens only the selected workspace organisation and changes its context explicitly',async()=>{
 window.history.replaceState({},'','/watch/workspaces?workspace=w2&workspaceTab=organisation');
 const fetcher=multiOrgFetcher();vi.stubGlobal('fetch',fetcher);
 render(<WorkspaceManagement/>);
 expect(await screen.findByRole('region',{name:'Client account organisation administration'})).toBeTruthy();
 expect(screen.queryByRole('region',{name:'Account organisation administration'})).toBeNull();
 expect(screen.getAllByRole('tablist')).toHaveLength(1);
 await userEvent.click(screen.getByRole('combobox',{name:'Organisation'}));
 await userEvent.click(screen.getByRole('option',{name:'Account',exact:true}));
 expect(await screen.findByRole('region',{name:'Account organisation administration'})).toBeTruthy();
 expect(screen.queryByRole('region',{name:'Client account organisation administration'})).toBeNull();
 expect(fetcher.mock.calls.every(([,init])=>!init?.method)).toBe(true);
});

it('opens one billing context for the current workspace and carries an explicit organisation choice across tabs',async()=>{
 window.history.replaceState({},'','/watch/workspaces?workspace=w2&workspaceTab=billing');
 const fetcher=multiOrgFetcher();vi.stubGlobal('fetch',fetcher);
 render(<WorkspaceManagement/>);
 await screen.findByRole('region',{name:'Organisation billing'});
 expect(screen.getAllByRole('region',{name:'Organisation billing'})).toHaveLength(1);
 expect(fetcher.mock.calls.some(([url])=>url==='/api/billing?organizationId=o2')).toBe(true);
 expect(fetcher.mock.calls.some(([url])=>url==='/api/billing?organizationId=o1')).toBe(false);
 await userEvent.click(screen.getByRole('combobox',{name:'Organisation'}));
 await userEvent.click(screen.getByRole('option',{name:'Account',exact:true}));
 await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>url==='/api/billing?organizationId=o1')).toBe(true));
 await userEvent.click(screen.getByRole('tab',{name:'Organisation',exact:true}));
 expect(await screen.findByRole('region',{name:'Account organisation administration'})).toBeTruthy();
 await userEvent.click(screen.getByRole('button',{name:'Billing',exact:true}));
 expect(screen.getByRole('tab',{name:'Plan & billing'}).getAttribute('aria-selected')).toBe('true');
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(screen.getAllByRole('region',{name:'Organisation billing'})).toHaveLength(1);
 expect(fetcher.mock.calls.every(([,init])=>!init?.method)).toBe(true);
});

it('defaults workspace creation to the current client organisation rather than the first account',async()=>{
 window.history.replaceState({},'','/watch/workspaces?workspace=w2&workspaceTab=create');
 const fetcher=multiOrgFetcher();vi.stubGlobal('fetch',fetcher);
 render(<WorkspaceManagement/>);
 const choice=await screen.findByRole('combobox',{name:'Organisation'});
 expect(choice.textContent).toContain('Client account');
 expect(fetcher.mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
 fireEvent.change(screen.getByLabelText('Workspace name'),{target:{value:'Client staging'}});
 fireEvent.click(screen.getByRole('button',{name:'Create workspace'}));
 await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/api/workspaces',expect.objectContaining({method:'POST',body:JSON.stringify({organizationId:'o2',name:'Client staging'})})));
});

it('does not substitute another owned organisation billing when the current client subscription is owner-managed',async()=>{
 window.history.replaceState({},'','/watch/workspaces?workspace=w2&workspaceTab=billing');
 const fetcher=vi.fn(async(url:string,_init?:RequestInit)=>url.startsWith('/api/billing?')?Response.json({stripe:false,billing:{plan:'trial',trialEndsAt:null,status:null,periodEnd:null,hasCustomer:false,subscribed:false}}):Response.json({workspaces:multiOrgRows,organizations:[multiOrgs[0],{...clientOrganization,billing_available:false}],invites:[]}));
 vi.stubGlobal('fetch',fetcher);render(<WorkspaceManagement/>);
 await screen.findByRole('heading',{name:'Subscription managed by your organisation owner'});
 expect(screen.queryByRole('region',{name:'Organisation billing'})).toBeNull();
 expect(fetcher.mock.calls.some(([url])=>url.startsWith('/api/billing?'))).toBe(false);
 const selector=screen.getByRole('combobox',{name:'Organisation'});
 expect(selector.textContent).not.toContain('Account');
 await userEvent.click(selector);
 await userEvent.click(screen.getByRole('option',{name:'Account',exact:true}));
 expect(await screen.findByRole('region',{name:'Organisation billing'})).toBeTruthy();
 expect(fetcher.mock.calls.some(([url])=>url==='/api/billing?organizationId=o1')).toBe(true);
 expect(fetcher.mock.calls.some(([url])=>url==='/api/billing?organizationId=o2')).toBe(false);
 expect(fetcher.mock.calls.every(([,init])=>!init?.method)).toBe(true);
});


it('returns to an explicitly authorised billing organisation and never substitutes one for an invalid return',async()=>{
 window.history.replaceState({},'','/watch/workspaces?workspace=w1&workspaceTab=billing&billingOrganization=o2&billing=returned');
 const fetcher=multiOrgFetcher();vi.stubGlobal('fetch',fetcher);
 render(<WorkspaceManagement/>);
 await screen.findByRole('region',{name:'Organisation billing'});
 expect(fetcher.mock.calls.some(([url])=>url==='/api/billing?organizationId=o2')).toBe(true);
 expect(fetcher.mock.calls.some(([url])=>url==='/api/billing?organizationId=o1')).toBe(false);
 await userEvent.click(screen.getByRole('combobox',{name:'Organisation'}));
 await userEvent.click(screen.getByRole('option',{name:'Account',exact:true}));
 await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>url==='/api/billing?organizationId=o1')).toBe(true));
 act(()=>{window.history.replaceState({},'','/watch/workspaces?workspace=w1&workspaceTab=billing&billingOrganization=unavailable');window.dispatchEvent(new PopStateEvent('popstate'));});
 expect(screen.queryByRole('region',{name:'Organisation billing'})).toBeNull();
 expect(fetcher.mock.calls.some(([url])=>url==='/api/billing?organizationId=unavailable')).toBe(false);
});

it('omits unrelated workspace context when opening another managed organisation billing',async()=>{
 window.history.replaceState({},'','/watch/workspaces?workspace=w1&workspaceTab=billing&billingOrganization=o2');
 const fetcher=vi.fn(async(url:string,init?:RequestInit)=>{
  if(init?.method)return Response.json({error:'Portal unavailable.'},{status:502});
  if(url.startsWith('/api/billing?'))return Response.json({stripe:true,billing:{plan:'team',trialEndsAt:null,status:'active',periodEnd:null,hasCustomer:true,subscribed:true}});
  return Response.json({workspaces:[workspace],organizations:multiOrgs,invites:[]});
 });vi.stubGlobal('fetch',fetcher);render(<WorkspaceManagement/>);
 await userEvent.click(await screen.findByRole('button',{name:'Manage subscription'}));
 expect(fetcher).toHaveBeenCalledWith('/api/billing/portal',expect.objectContaining({body:JSON.stringify({organizationId:'o2',plan:'solo',interval:'month'})}));
});
