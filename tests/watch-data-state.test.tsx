// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {WatchSkeleton} from '../src/components/WatchDataState';

afterEach(cleanup);

it('announces loading without rendering visible placeholder blocks',()=>{
 const {container}=render(<WatchSkeleton variant="detail" className="mt-6 rounded-lg border" label="Reading release evidence"/>);
 const status=screen.getByRole('status',{name:'Reading release evidence'});
 expect(status.className).toBe('sr-only');
 expect(status.getAttribute('aria-live')).toBe('polite');
 expect(status.getAttribute('aria-atomic')).toBe('true');
 expect(status.textContent).toBe('Reading release evidence');
 expect(container.querySelector('.animate-pulse')).toBeNull();
 expect(container.querySelector('.bg-panel')).toBeNull();
});
