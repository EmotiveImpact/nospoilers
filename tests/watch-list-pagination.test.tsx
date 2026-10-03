// @vitest-environment jsdom
import {act,cleanup,render,renderHook,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {ListPagination} from '../src/components/watch/ListPagination';
import {useListPagination} from '../src/components/watch/useListPagination';
import {parsePageSize} from '../src/watch/pagination';
import {radixUiTestSupport} from './helpers/radix-ui';

radixUiTestSupport();
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

it('starts at ten rows and keeps page changes inside the available range',()=>{
 const {result}=renderHook(()=>useListPagination(65,'workspace-a'));
 expect(result.current).toMatchObject({page:0,pageSize:10,offset:0,pageCount:7});
 act(()=>result.current.onPageChange(3));
 expect(result.current).toMatchObject({page:3,offset:30});
 act(()=>result.current.onPageChange(99));
 expect(result.current).toMatchObject({page:6,offset:60});
 act(()=>result.current.onPageChange(-1));
 expect(result.current).toMatchObject({page:0,offset:0});
});

it('returns to the first page when changing rows per page',()=>{
 const {result}=renderHook(()=>useListPagination(65,'workspace-a'));
 act(()=>result.current.onPageChange(5));
 act(()=>result.current.onPageSizeChange(30));
 expect(result.current).toMatchObject({page:0,pageSize:30,offset:0,pageCount:3});
 act(()=>result.current.onPageChange(2));
 act(()=>result.current.onPageSizeChange(60));
 expect(result.current).toMatchObject({page:0,pageSize:60,offset:0,pageCount:2});
});

it('resets a changed filter or workspace without reviving the old page when returning',()=>{
 const {result,rerender}=renderHook(({scope})=>useListPagination(100,scope),{initialProps:{scope:'workspace-a:all'}});
 act(()=>result.current.onPageSizeChange(30));
 act(()=>result.current.onPageChange(2));
 rerender({scope:'workspace-a:attention'});
 expect(result.current).toMatchObject({page:0,pageSize:30,offset:0});
 rerender({scope:'workspace-a:all'});
 expect(result.current.page).toBe(0);
 act(()=>result.current.onPageChange(1));
 rerender({scope:'workspace-b:all'});
 expect(result.current.page).toBe(0);
 rerender({scope:'workspace-a:all'});
 expect(result.current.page).toBe(0);
});

it('clamps a shrinking result list and does not revive an unavailable page after it grows',()=>{
 const {result,rerender}=renderHook(({total})=>useListPagination(total,'workspace-a'),{initialProps:{total:100}});
 act(()=>result.current.onPageChange(7));
 rerender({total:15});
 expect(result.current).toMatchObject({page:1,offset:10,pageCount:2});
 rerender({total:100});
 expect(result.current).toMatchObject({page:1,offset:10});
 rerender({total:0});
 expect(result.current).toMatchObject({page:0,offset:0,pageCount:1});
});

it.each([10,30,60,'10','30','60'])('accepts the supported page size %s',value=>{
 expect(parsePageSize(value)).toBe(Number(value));
});

it.each(['',undefined,null,'all','30.5','60x','300',0,-10,50,61])('keeps invalid page size %s bounded to the fallback',value=>{
 expect(parsePageSize(value)).toBe(10);
 expect(parsePageSize(value,30)).toBe(30);
});

const props={label:'Loaded events',pageSize:10 as const,page:1,count:10,total:65,hasPrevious:true,hasNext:true,onPageSizeChange:vi.fn(),onPrevious:vi.fn(),onNext:vi.fn()};

it('labels its range and controls so pagination is distinguishable from other lists',async()=>{
 const onPageSizeChange=vi.fn();render(<ListPagination {...props} onPageSizeChange={onPageSizeChange}/>);
 const nav=screen.getByRole('navigation',{name:'Loaded events pagination'});
 expect(nav.textContent).toContain('11–20 of 65 loaded events');
 expect(nav.querySelector('[aria-live="polite"]')).toBeTruthy();
 await userEvent.click(screen.getByRole('combobox',{name:'Loaded events per page'}));
 expect(screen.getAllByRole('option').map(option=>option.textContent)).toEqual(['10','30','60']);
 await userEvent.click(screen.getByRole('option',{name:'60',exact:true}));
 expect(onPageSizeChange).toHaveBeenCalledExactlyOnceWith(60);
});

it('disables unavailable directions and all pagination controls while loading',async()=>{
 const onPrevious=vi.fn(),onNext=vi.fn(),onPageSizeChange=vi.fn();
 const view=render(<ListPagination {...props} page={0} hasPrevious={false} onPrevious={onPrevious} onNext={onNext} onPageSizeChange={onPageSizeChange}/>);
 await userEvent.click(screen.getByRole('button',{name:'Previous',exact:true}));
 expect(onPrevious).not.toHaveBeenCalled();
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));
 expect(onNext).toHaveBeenCalledOnce();
 view.rerender(<ListPagination {...props} disabled onPrevious={onPrevious} onNext={onNext} onPageSizeChange={onPageSizeChange}/>);
 expect(screen.getByRole('button',{name:'Previous',exact:true})).toHaveProperty('disabled',true);
 expect(screen.getByRole('button',{name:'Next',exact:true})).toHaveProperty('disabled',true);
 const picker=screen.getByRole('combobox',{name:'Loaded events per page'});
 expect(picker).toHaveProperty('disabled',true);
 await userEvent.click(picker);
 expect(screen.queryByRole('listbox')).toBeNull();
 expect(onPageSizeChange).not.toHaveBeenCalled();
});

it('does not invent an archive total for cursor pages or negative ranges for an empty page',()=>{
 const view=render(<ListPagination {...props} page={2} count={7} total={undefined}/>);
 expect(screen.getByRole('navigation').textContent).toContain('Page 3 · 7 loaded events');
 view.rerender(<ListPagination {...props} page={0} count={0} total={0} hasPrevious={false} hasNext={false}/>);
 expect(screen.getByRole('navigation').textContent).toContain('0 loaded events');
 expect(screen.getByRole('navigation').textContent).not.toContain('1–0');
});

it('navigates without submitting a surrounding settings form',async()=>{
 const submit=vi.fn(event=>event.preventDefault()),onNext=vi.fn();
 render(<form onSubmit={submit}><ListPagination {...props} onNext={onNext}/></form>);
 await userEvent.click(screen.getByRole('button',{name:'Next',exact:true}));
 expect(onNext).toHaveBeenCalledOnce();
 expect(submit).not.toHaveBeenCalled();
});
