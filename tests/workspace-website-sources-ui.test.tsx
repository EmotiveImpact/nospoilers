// @vitest-environment jsdom
import {render,screen,cleanup} from '@testing-library/react';
import {it,afterEach,expect,vi} from 'vitest';
import {WorkspaceWebsiteSources} from '../src/components/watch/WorkspaceWebsiteSources';
const context=vi.hoisted(()=>({route:{view:'sources'},search:'?workspace=one&install=7',locked:false}));
vi.mock('../src/components/watch/useWatchScreenContext',()=>({useWatchScreenContext:()=>context}));
vi.mock('../src/components/watch/WorkspaceWebsites',()=>({WorkspaceWebsites:({workspaceId,disabledReason}:{workspaceId:string;disabledReason:string|null})=><p>{workspaceId} {disabledReason??'editable'}</p>}));
afterEach(()=>{cleanup();context.route.view='sources';context.search='?workspace=one&install=7';context.locked=false;});
it('uses workspace identity rather than selected GitHub identity and respects locked access',()=>{
 const view=render(<WorkspaceWebsiteSources/>);expect(screen.getByText('one editable')).toBeTruthy();
 context.search='?workspace=two&install=8';context.locked=true;view.rerender(<WorkspaceWebsiteSources/>);
 expect(screen.queryByText('one editable')).toBeNull();expect(screen.getByText(/two Scanning and source changes/)).toBeTruthy();
});
it('does not invent workspace scope for legacy URLs or unrelated pages',()=>{
 context.search='?install=7';const view=render(<WorkspaceWebsiteSources/>);expect(view.container.textContent).toBe('');
 context.search='?workspace=one';context.route.view='releases';view.rerender(<WorkspaceWebsiteSources/>);expect(view.container.textContent).toBe('');
});
