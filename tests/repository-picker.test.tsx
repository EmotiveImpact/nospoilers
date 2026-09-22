// @vitest-environment jsdom
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,it,expect,vi} from 'vitest';
import {RepositoryPicker} from '../src/components/watch/RepositoryPicker';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
afterEach(cleanup);
const repos=[{id:7,full_name:'Acme/website'},{id:8,full_name:'Acme/mobile-app'}];
it('filters case-insensitively and selects the matching repository with the keyboard',async()=>{
 const change=vi.fn();render(<RepositoryPicker repos={repos} value="" onChange={change}/>);
 const input=screen.getByRole('combobox',{name:'Repository'});
 await userEvent.type(input,' MOBILE ');
 expect(await screen.findByRole('option',{name:'Acme/mobile-app'})).toBeTruthy();
 expect(screen.queryByRole('option',{name:'Acme/website'})).toBeNull();
 expect(change).not.toHaveBeenCalled();
 await userEvent.keyboard('{ArrowDown}{Enter}');
 expect(change).toHaveBeenCalledWith('8');
});
it('keeps the selected repository when an unmatched search is cancelled',async()=>{
 const change=vi.fn();render(<RepositoryPicker repos={repos} value="7" onChange={change}/>);
 const input=screen.getByRole('combobox',{name:'Repository'});
 await userEvent.clear(input);await userEvent.type(input,'missing');
 expect(await screen.findByRole('status')).toHaveProperty('textContent','No repositories match “missing”.');
 await userEvent.keyboard('{Escape}');
 await waitFor(()=>expect(input).toHaveProperty('value','Acme/website'));
 expect(change).not.toHaveBeenCalled();
});
