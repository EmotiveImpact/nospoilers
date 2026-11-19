// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {WatchCommandPalette} from '../src/components/WatchCommandPalette';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();

afterEach(()=>{cleanup();window.history.replaceState({},'','/');});
const props={open:true,search:'?workspace=one&install=7',teamOnly:false,adminOnly:false,alerts:[],sources:[],releases:[],onClose:vi.fn()};

it('keeps listbox children to option groups that hold only options',async()=>{
 render(<WatchCommandPalette {...props}/>);
 const listbox=await screen.findByRole('listbox');
 const groups=Array.from(listbox.children);
 expect(groups.length).toBeGreaterThan(1);
 for(const group of groups){
  expect(group.getAttribute('role')).toBe('group');
  expect(group.getAttribute('aria-label')).toBeTruthy();
  for(const child of Array.from(group.children))expect(child.getAttribute('role')==='option'||child.getAttribute('aria-hidden')==='true').toBe(true);
 }
 expect(screen.getByRole('group',{name:'Pages'})).toBeTruthy();
});

it('opens in place and lets users clear a query without losing keyboard focus',async()=>{
 render(<WatchCommandPalette {...props}/>);
 const input=await screen.findByRole('combobox');
 await waitFor(()=>expect(document.activeElement).toBe(input));
 const panel=document.querySelector<HTMLElement>('.watch-search-panel')!;
 expect(panel.style.transform===''||panel.style.transform==='none').toBe(true);
 expect(screen.getByText('Pages')).toBeTruthy();
 expect(screen.getByText('Actions')).toBeTruthy();
 expect(screen.queryByText('Recent')).toBeNull();
 await userEvent.type(input,'billing');
 expect(screen.getByRole('option',{name:'Plan & billing'})).toBeTruthy();
 expect(screen.getByRole('status').textContent).toBe('1 match shown');
 await userEvent.click(screen.getByRole('button',{name:'Clear search'}));
 expect(input).toHaveProperty('value','');
 expect(document.activeElement).toBe(input);
 expect(screen.getByRole('option',{name:'New scan'})).toBeTruthy();
 expect(document.getElementById(input.getAttribute('aria-activedescendant')!)?.getAttribute('aria-selected')).toBe('true');
});

it('pages every matching loaded record with 10, 30 and 60 choices and keyboard navigation across pages',async()=>{
 const sources=Array.from({length:65},(_,index)=>({key:`repo-${index+1}`,name:`project-${String(index+1).padStart(2,'0')}`}));
 render(<WatchCommandPalette {...props} sources={sources}/>);
 const input=await screen.findByRole('combobox',{name:'Search pages and commands'});
 await userEvent.type(input,'project');
 expect(screen.getAllByRole('option')).toHaveLength(10);
 expect(screen.getByRole('navigation',{name:'Search results pagination'}).textContent).toContain('1–10 of 65 search results');
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));
 expect(screen.getByRole('option',{name:'project-11, Source'}).getAttribute('aria-selected')).toBe('true');
 expect(screen.queryByRole('option',{name:'project-01, Source'})).toBeNull();
 for(const size of [30,60]){
  await userEvent.click(screen.getByRole('combobox',{name:'Search results per page'}));
  await userEvent.click(screen.getByRole('option',{name:String(size),exact:true}));
  expect(screen.getAllByRole('option')).toHaveLength(size);
  expect(screen.getByRole('option',{name:'project-01, Source'})).toBeTruthy();
 }
 input.focus();await userEvent.keyboard('{End}');
 expect(screen.getAllByRole('option')).toHaveLength(5);
 expect(document.getElementById(input.getAttribute('aria-activedescendant')!)?.textContent).toContain('project-65');
 await userEvent.keyboard('{Enter}');
 expect(new URLSearchParams(window.location.search).get('source')).toBe('repo-65');
 expect(new URLSearchParams(window.location.search).get('workspace')).toBe('one');
});
it('does not navigate while composing text, then opens the scoped billing result on Enter',async()=>{
 const onClose=vi.fn();render(<WatchCommandPalette {...props} onClose={onClose}/>);
 const input=await screen.findByRole('combobox');
 await userEvent.type(input,'billing');
 fireEvent.keyDown(input,{key:'Enter',isComposing:true});
 expect(window.location.pathname).toBe('/');expect(onClose).not.toHaveBeenCalled();
 await userEvent.keyboard('{Enter}');
 expect(window.location.pathname).toBe('/watch/workspaces');
 expect(new URLSearchParams(window.location.search).get('workspaceTab')).toBe('billing');
 expect(new URLSearchParams(window.location.search).get('workspace')).toBe('one');
 expect(onClose).toHaveBeenCalledOnce();
});
it('resets a search when the surrounding shell closes it and exposes an explicit close button',async()=>{
 const onClose=vi.fn();const view=render(<WatchCommandPalette {...props} onClose={onClose}/>);
 await userEvent.type(await screen.findByRole('combobox'),'retention');
 view.rerender(<WatchCommandPalette {...props} open={false} onClose={onClose}/>);
 view.rerender(<WatchCommandPalette {...props} onClose={onClose}/>);
 expect(await screen.findByRole('combobox')).toHaveProperty('value','');
 await userEvent.click(screen.getByRole('button',{name:'Close search'}));
 expect(onClose).toHaveBeenCalledOnce();
});
