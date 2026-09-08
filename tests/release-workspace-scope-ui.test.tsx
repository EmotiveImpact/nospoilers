// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {ReleasesScreen} from '../src/components/watch/screens/ReleasesScreen';
const state=vi.hoisted(()=>({search:'',activeInstallId:7,route:{view:'releases'},releases:[]}));
vi.mock('../src/components/watch/useWatchScreenContext',()=>({useWatchScreenContext:()=>state}));
vi.mock('../src/components/watch/UploadedReleases',()=>({UploadedReleases:({installationId}:{installationId:number|null})=><p>Saved scope: {installationId??'workspace'}</p>}));
afterEach(cleanup);
it('does not hide an independent website attempt behind the selected GitHub ledger',()=>{
 state.search='?workspace=workspace-one&install=7&upload=website-attempt&uploadView=detail';
 render(<ReleasesScreen/>);
 expect(screen.getByText('Saved scope: workspace')).toBeTruthy();
});
it('retains installation isolation for legacy URLs without workspace scope',()=>{
 state.search='?install=7&upload=ci-attempt&uploadView=detail';
 render(<ReleasesScreen/>);
 expect(screen.getByText('Saved scope: 7')).toBeTruthy();
});
