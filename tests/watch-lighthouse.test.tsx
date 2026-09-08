// @vitest-environment jsdom
import {render,cleanup,act} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import {WatchLoadingBoundary,WatchLoadingSignal} from '../src/components/watch/WatchLighthouse';
afterEach(()=>{cleanup();vi.useRealTimers();});
it('waits for all real loading stages before turning forward and clearing the overlay',()=>{
 vi.useFakeTimers();
 const view=render(<WatchLoadingBoundary><WatchLoadingSignal/><WatchLoadingSignal/></WatchLoadingBoundary>);
 act(()=>vi.advanceTimersByTime(5000));expect(view.container.querySelector('.is-loading')).toBeTruthy();
 view.rerender(<WatchLoadingBoundary><WatchLoadingSignal/></WatchLoadingBoundary>);
 act(()=>vi.advanceTimersByTime(1000));expect(view.container.querySelector('.is-loading')).toBeTruthy();
 view.rerender(<WatchLoadingBoundary><p>Actual workspace</p></WatchLoadingBoundary>);
 act(()=>vi.advanceTimersByTime(1));expect(view.container.querySelector('.is-ready')).toBeTruthy();
 act(()=>vi.advanceTimersByTime(650));expect(view.container.querySelector('.watch-lighthouse')).toBeNull();
 expect(view.getByText('Actual workspace')).toBeTruthy();
});
it('returns to loading if a new blocking stage starts during the reveal',()=>{
 vi.useFakeTimers();const view=render(<WatchLoadingBoundary><WatchLoadingSignal/></WatchLoadingBoundary>);
 view.rerender(<WatchLoadingBoundary><p>Stage complete</p></WatchLoadingBoundary>);act(()=>vi.advanceTimersByTime(1));
 view.rerender(<WatchLoadingBoundary><WatchLoadingSignal/></WatchLoadingBoundary>);act(()=>vi.advanceTimersByTime(1000));
 expect(view.container.querySelector('.is-loading')).toBeTruthy();
});
