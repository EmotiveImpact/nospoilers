// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,within} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {SourcesScreen} from '../src/components/watch/screens/SourcesScreen';
import {Button} from '../src/components/ui/button';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
const state=vi.hoisted(()=>({filter:'github',source:'repo-7',admin:true,confirm:vi.fn(),nav:vi.fn()}));
vi.mock('../src/nav',()=>({navigate:state.nav}));
vi.mock('../src/components/watch/useWatchScreenContext',()=>({useWatchScreenContext:()=>({
 Button,route:{view:'sources',sourceConfigure:'github',sourceFilter:state.filter,sourceKey:state.source},search:'?install=3&configure=github&source=repo-7',
 sourceSectionState:{status:'ready'},WatchSourcesSummary:()=> <p>Coverage inventory</p>,
 deskRepos:[{id:7,full_name:'owner/app',html_url:'https://github.com/owner/app',private:true},{id:8,full_name:'owner/other',private:false}],repos:{status:'ready'},sourceRows:[],
 installAdmin:state.admin,workflowDraft:{},githubByRepo:{},setupStatusByRepo:{},setupByRepo:{},remediateByRepo:{},confirmForm:()=>null,
 setGithubByRepo:vi.fn(),beginConfirm:state.confirm,deletePackAssetsConfirm:(name:string)=>name,
})}));
afterEach(()=>{cleanup();state.filter='github';state.source='repo-7';state.admin=true;vi.clearAllMocks();});
it('ignores stale GitHub configuration on the Websites tab',()=>{
 state.filter='website';render(<SourcesScreen/>);
 expect(screen.getByText('Coverage inventory')).toBeTruthy();
 expect(screen.queryByText('Repository checks.')).toBeNull();
 expect(screen.queryByRole('button',{name:'Make private'})).toBeNull();
});
it('shows only the selected repository with grouped controls and preserved confirmation',()=>{
 render(<SourcesScreen/>);
 expect(screen.queryByText('Coverage inventory')).toBeNull();
 expect(screen.getByRole('combobox',{name:'Repository'})).toBeTruthy();
 expect(screen.getByRole('tabpanel',{name:'Checks'})).toBeTruthy();
 fireEvent.mouseDown(screen.getByRole('tab',{name:'CI setup'}),{button:0,ctrlKey:false});
 expect(screen.getByRole('tabpanel',{name:'CI setup'})).toBeTruthy();
 fireEvent.mouseDown(screen.getByRole('tab',{name:'Repository actions'}),{button:0,ctrlKey:false});
 const actions=within(screen.getByRole('tabpanel',{name:'Repository actions'}));
 expect(actions.getByRole('button',{name:'Make private'})).toHaveProperty('disabled',true);
 fireEvent.click(actions.getByRole('button',{name:'Remove pack assets'}));
 expect(state.confirm).toHaveBeenCalledWith({kind:'delete-pack-assets',id:7,expected:'owner/app'});
 expect(screen.queryByText('owner/other')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Back to Coverage'}));
 expect(state.nav).toHaveBeenCalledWith('/watch/sources?install=3&sourceType=github');
});
it('requires explicit selection instead of rendering every repository',()=>{
 state.source='';render(<SourcesScreen/>);
 expect(screen.getByText(/Choose the repository you want to manage/)).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Scan latest release'})).toBeNull();
});
it('keeps administration actions unavailable to non-administrators',()=>{
 state.admin=false;render(<SourcesScreen/>);
 fireEvent.mouseDown(screen.getByRole('tab',{name:'CI setup'}),{button:0,ctrlKey:false});
 expect(screen.getByRole('button',{name:'Setup status'})).toBeTruthy();
 expect(screen.queryByRole('region',{name:'Repository actions'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Setup PR'})).toBeNull();
});
it('resets to Checks when choosing a different repository',()=>{
 const view=render(<SourcesScreen/>);
 fireEvent.mouseDown(screen.getByRole('tab',{name:'Repository actions'}),{button:0,ctrlKey:false});
 expect(screen.getByRole('tab',{name:'Repository actions'}).getAttribute('aria-selected')).toBe('true');
 state.source='repo-8';view.rerender(<SourcesScreen/>);
 expect(screen.getByRole('tab',{name:'Checks'}).getAttribute('aria-selected')).toBe('true');
 expect(screen.queryByRole('button',{name:'Remove pack assets'})).toBeNull();
});
