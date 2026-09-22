// @vitest-environment jsdom
import {render,screen,cleanup} from '@testing-library/react';
import {it,afterEach,expect,vi} from 'vitest';
import {WorkspaceWebsiteSources} from '../src/components/watch/WorkspaceWebsiteSources';
const context=vi.hoisted(()=>({route:{view:'sources'},search:'?workspace=one&install=7&sourceType=website',locked:false}));
vi.mock('../src/components/watch/useWatchScreenContext',()=>({useWatchScreenContext:()=>context}));
vi.mock('../src/components/watch/WorkspaceWebsites',()=>({WorkspaceWebsites:({workspaceId,disabledReason}:{workspaceId:string;disabledReason:string|null})=><p>{workspaceId} {disabledReason??'editable'}</p>}));
afterEach(()=>{cleanup();context.route.view='sources';context.search='?workspace=one&install=7&sourceType=website';context.locked=false;});
it('uses workspace identity rather than selected GitHub identity and respects locked access',()=>{
 const view=render(<WorkspaceWebsiteSources/>);expect(screen.getByText('one editable')).toBeTruthy();
 context.search='?workspace=two&install=8&sourceType=website';context.locked=true;view.rerender(<WorkspaceWebsiteSources/>);
 expect(screen.queryByText('one editable')).toBeNull();expect(screen.getByText(/two Scanning and source changes/)).toBeTruthy();
});
it('does not invent workspace scope for legacy URLs or unrelated pages',()=>{
 context.search='?install=7';const view=render(<WorkspaceWebsiteSources/>);expect(view.container.textContent).toBe('');
 context.search='?workspace=one';context.route.view='releases';view.rerender(<WorkspaceWebsiteSources/>);expect(view.container.textContent).toBe('');
});
it('does not append unrelated independent websites to a connected health result',()=>{
 context.search='?workspace=one&sourceType=website&coverageHealth=delayed';
 const view=render(<WorkspaceWebsiteSources/>);expect(view.container.textContent).toBe('');
 context.search='?workspace=one&sourceType=website&coverageHealth=invalid';view.rerender(<WorkspaceWebsiteSources/>);
 expect(screen.getByText('one editable')).toBeTruthy();
});

it.each(['github','npm','map','all'])('does not show website setup on the %s inventory tab',filter=>{
 context.search=`?workspace=one&sourceType=${filter}`;
 const view=render(<WorkspaceWebsiteSources/>);
 expect(view.container.textContent).toBe('');
});
it.each(['github','npm','map'])('ignores stale website configuration on the %s tab',filter=>{
 context.search=`?workspace=one&sourceType=${filter}&configure=website`;
 const view=render(<WorkspaceWebsiteSources/>);
 expect(view.container.textContent).toBe('');
});
it('keeps explicit website connection reachable from All sources',()=>{
 context.search='?workspace=one&configure=website';
 render(<WorkspaceWebsiteSources/>);
 expect(screen.getByText('one editable')).toBeTruthy();
});
