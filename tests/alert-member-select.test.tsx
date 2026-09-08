// @vitest-environment jsdom
import {createRef} from 'react';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {AlertMemberSelect,CLEAR_ALERT_ASSIGNMENT} from '../src/components/watch/AlertMemberSelect';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('uses workspace assignees and clears the previous member list on scope changes',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({members:[{id:'a',login:'Old member'}]}))).mockImplementationOnce(()=>new Promise(()=>{}));vi.stubGlobal('fetch',fetch);
 const props={alertId:1,value:'',onChange:vi.fn(),inputRef:createRef<HTMLSelectElement>()};
 const view=render(<AlertMemberSelect {...props} workspaceId="first"/>);
 await screen.findByRole('option',{name:'Old member'});
 expect(fetch.mock.calls[0][0]).toBe('/api/workspaces/first/alerts/1/assignees');
 view.rerender(<AlertMemberSelect {...props} workspaceId="second"/>);
 expect(screen.queryByRole('option',{name:'Old member'})).toBeNull();
 expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(true);
 expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
});
it('selects internal member IDs, not display names, without assigning on mount',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({members:[{id:'internal-1',login:'Taylor'}]})));vi.stubGlobal('fetch',fetch);
 const onChange=vi.fn();render(<AlertMemberSelect alertId={1} value="" onChange={onChange} inputRef={createRef()}/>);
 await screen.findByRole('option',{name:'Taylor'});expect(onChange).not.toHaveBeenCalled();
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'internal-1'}});expect(onChange).toHaveBeenCalledWith('internal-1');
 expect(fetch.mock.calls[0][0]).toBe('/api/alerts/1/assignees');
 fireEvent.change(screen.getByRole('combobox'),{target:{value:CLEAR_ALERT_ASSIGNMENT}});expect(onChange).toHaveBeenLastCalledWith(CLEAR_ALERT_ASSIGNMENT);
});
