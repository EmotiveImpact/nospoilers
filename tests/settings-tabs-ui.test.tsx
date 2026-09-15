// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {SettingsTabs} from '../src/components/watch/design/SettingsTabs';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const tabs=[{id:'rules',label:'Rules',content:<label>Rule draft<input defaultValue="Initial"/></label>},{id:'history',label:'History',content:<p>Saved history</p>}];
it('moves keyboard focus without activating and waits for a controlled value change',async()=>{
 const changed=vi.fn();render(<SettingsTabs label="Settings" tabs={tabs} value="rules" onValueChange={changed}/>);
 const rules=screen.getByRole('tab',{name:'Rules'}),history=screen.getByRole('tab',{name:'History'});
 rules.focus();await userEvent.keyboard('{ArrowRight}');
 await waitFor(()=>expect(document.activeElement).toBe(history));
 expect(rules.getAttribute('aria-selected')).toBe('true');expect(changed).not.toHaveBeenCalled();
 await userEvent.keyboard('{Enter}');
 expect(changed).toHaveBeenCalledWith('history');
 expect(rules.getAttribute('aria-selected')).toBe('true');
 expect(screen.getByRole('tabpanel',{name:'Rules'})).toBeTruthy();
 expect(screen.queryByRole('tabpanel',{name:'History'})).toBeNull();
});
it('keeps controlled inactive panels inaccessible without discarding drafts, and falls back if a tab is removed',async()=>{
 const view=render(<SettingsTabs label="Settings" tabs={tabs} value="rules"/>);
 await userEvent.clear(screen.getByRole('textbox',{name:'Rule draft'}));
 await userEvent.type(screen.getByRole('textbox',{name:'Rule draft'}),'Unsaved edit');
 view.rerender(<SettingsTabs label="Settings" tabs={tabs} value="history"/>);
 expect(screen.queryByRole('textbox',{name:'Rule draft'})).toBeNull();
 expect(screen.getByRole('tabpanel',{name:'History'})).toBeTruthy();
 view.rerender(<SettingsTabs label="Settings" tabs={tabs.slice(0,1)} value="history"/>);
 expect(screen.queryByRole('tab',{name:'History'})).toBeNull();
 expect(screen.getByRole('tab',{name:'Rules'}).getAttribute('aria-selected')).toBe('true');
 expect(screen.getByRole('textbox',{name:'Rule draft'})).toHaveProperty('value','Unsaved edit');
});
