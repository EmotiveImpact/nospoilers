// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {HostedBriefFixture} from './ui-fixtures/HostedBriefFixture';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('keeps the recorded receipt status separate from a legal hold',()=>{
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(()=>{})));
 render(<HostedBriefFixture mode="brief-blocked"/>);
 expect(screen.getByText('Receipt status').nextElementSibling?.textContent).toBe('Scan passed');
 expect(screen.getAllByText('Legal hold').length).toBeGreaterThan(0);
});
