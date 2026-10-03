// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {WatchCommandPalette} from '../src/components/WatchCommandPalette';

afterEach(()=>{cleanup();window.history.replaceState({},'','/');});
const props={open:true,search:'?workspace=one&install=7',teamOnly:false,adminOnly:false,alerts:[],sources:[],releases:[],onClose:vi.fn()};

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
