import {describe,it,expect} from 'vitest';
import {outcomeMonth} from '../src/release-intelligence/outcomes.ts';
describe('UTC outcome windows',()=>{
  it('uses real calendar boundaries and a partial current month',()=>{
    expect(outcomeMonth('2024-02',Date.parse('2024-03-02T12:00:00Z'))).toMatchObject({start:'2024-02-01T00:00:00.000Z',end:'2024-03-01T00:00:00.000Z',through:'2024-03-01T00:00:00.000Z'});
    expect(outcomeMonth(undefined,Date.parse('2026-09-09T12:00:00Z'))).toMatchObject({month:'2026-09',through:'2026-09-09T12:00:00.000Z'});
  });
  it.each(['2026-13','2026-00','2027-01','1999-12','2026-9','not-a-date'])('rejects invalid or future window %s',month=>{
    expect(()=>outcomeMonth(month,Date.parse('2026-09-09T12:00:00Z'))).toThrow('calendar month');
  });
});
