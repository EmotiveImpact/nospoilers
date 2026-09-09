// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {SetupScreen} from '../src/components/watch/screens/SetupScreen';
import {SourcesScreen} from '../src/components/watch/screens/SourcesScreen';
const state=vi.hoisted(()=>({ended:true,view:'setup'}));
vi.mock('../src/components/watch/useWatchScreenContext',()=>({useWatchScreenContext:()=>({
 ended:state.ended,route:{view:state.view},search:'',sourceRows:[],
 CoverageLock:()=> <button>See plans</button>,
 WatchSourcesSummary:()=> <button>Configure source</button>,
})}));
afterEach(()=>{cleanup();state.ended=true;state.view='setup';});
for(const [name,Component] of [['setup',SetupScreen],['sources',SourcesScreen]] as const){
 it(`makes covered ${name} controls inert while keeping subscription actions available`,()=>{
  state.view=name;const view=render(<Component/>);
  expect(screen.getByText('Configure source').closest('[inert]')).not.toBeNull();
  expect(screen.getByRole('button',{name:'See plans'}).closest('[inert]')).toBeNull();
  state.ended=false;view.rerender(<Component/>);
  expect(screen.getByRole('button',{name:'Configure source'}).closest('[inert]')).toBeNull();
  expect(screen.queryByRole('button',{name:'See plans'})).toBeNull();
 });
}
