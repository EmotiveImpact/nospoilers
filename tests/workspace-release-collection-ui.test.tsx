// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {WorkspaceReleaseCollection} from '../src/components/watch/WorkspaceReleaseCollection';
import {navigate} from '../src/nav';
vi.mock('../src/nav',()=>({navigate:vi.fn()}));
vi.mock('../src/components/watch/UploadedReleases',()=>({UploadedReleases:({collection}:{collection:string})=><div>Collection: {collection}</div>}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('offers only real artifact collections and scopes tab changes',()=>{
 render(<WorkspaceReleaseCollection search="?workspace=one&uploadStatus=attention"/>);
 expect(screen.getByRole('heading',{name:'Release evidence.'})).toBeTruthy();
 expect(screen.getByRole('tab',{name:'Uploaded builds'}).getAttribute('aria-selected')).toBe('true');
 expect(screen.queryByRole('tab',{name:'Connected releases'})).toBeNull();
 fireEvent.keyDown(screen.getByRole('tab',{name:'Uploaded builds'}),{key:'End'});
 expect(navigate).toHaveBeenLastCalledWith('/watch/releases?workspace=one&releaseView=attempts');
});
it('keeps incomplete records available and respects archived scan restrictions',()=>{
 render(<WorkspaceReleaseCollection search="?workspace=one&uploadStatus=active" canScan={false}/>);
 expect(screen.getByRole('tab',{name:'Attempts'}).getAttribute('aria-selected')).toBe('true');
 expect(screen.getByText('Collection: attempts')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'New scan'})).toBeNull();
});
it('does not wrap full evidence in an extra collection header',()=>{
 render(<WorkspaceReleaseCollection search="?workspace=one&upload=u&uploadView=detail"/>);
 expect(screen.queryByRole('tablist')).toBeNull();
 expect(screen.queryByRole('heading')).toBeNull();
});
