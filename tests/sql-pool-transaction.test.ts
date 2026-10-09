import type pg from 'pg';
import {expect, it} from 'vitest';
import {wrapPool} from '../src/server/sql.ts';

function fakePool(failRollback: boolean) {
  const released: unknown[] = [];
  const queries: string[] = [];
  const client = {
    async query(text: string) {
      queries.push(text);
      if (text === 'ROLLBACK' && failRollback) throw new Error('rollback failed: connection lost');
      return {rows: []};
    },
    release(error?: unknown) {
      released.push(error);
    },
  };
  const pool = {connect: async () => client} as unknown as pg.Pool;
  return {pool, released, queries};
}

it('rethrows the original error and discards the client when ROLLBACK fails', async () => {
  const {pool, released, queries} = fakePool(true);
  const original = new Error('duplicate key');
  await expect(wrapPool(pool).transaction(async () => {throw original;})).rejects.toBe(original);
  expect(queries).toEqual(['BEGIN', 'ROLLBACK']);
  expect(released).toHaveLength(1);
  expect(released[0]).toBeInstanceOf(Error);
  expect((released[0] as Error).message).toContain('rollback failed');
});

it('returns a cleanly rolled back client to the pool', async () => {
  const {pool, released} = fakePool(false);
  const original = new Error('duplicate key');
  await expect(wrapPool(pool).transaction(async () => {throw original;})).rejects.toBe(original);
  expect(released).toEqual([undefined]);
});
