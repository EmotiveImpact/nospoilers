import { expect, it } from 'vitest';
import { migrate, openSql } from '../src/server/sql.ts';
import { createStore } from '../src/server/store.ts';
import { ensureUserWorkspaces, listUserWorkspaces } from '../src/server/workspaces.ts';
import { productEventIntegritySchema } from '../src/server/product-event-integrity-schema.ts';

it('preserves product audit events against updates, deletion and truncation', async () => {
  const sql = await openSql('pglite://:memory:');
  try {
    await migrate(sql);
    await createStore(sql).upsertUser({ id: 'audit-owner', login: 'audit-owner' });
    await ensureUserWorkspaces(sql, 'audit-owner');
    const workspace = (await listUserWorkspaces(sql, 'audit-owner'))[0]!;
    await sql.query(`INSERT INTO product_workspace_events(id,workspace_id,actor_user_id,action)
      VALUES ($1,$2,'audit-owner','created')`, [crypto.randomUUID(), workspace.id]);
    await sql.query(`INSERT INTO product_organization_events(id,organization_id,actor_user_id,subject_user_id,action,detail)
      VALUES ($1,$2,'audit-owner','audit-owner','role_changed','{}')`, [crypto.randomUUID(), workspace.organization_id]);
    await sql.query(`INSERT INTO product_billing_events(id,organization_id,actor_user_id,action)
      VALUES ($1,$2,'audit-owner','portal')`, [crypto.randomUUID(), workspace.organization_id]);
    // Re-applying this additive DDL must neither erase history nor weaken its guards.
    await sql.exec(productEventIntegritySchema);
    for (const table of ['product_workspace_events', 'product_organization_events', 'product_billing_events']) {
      const before = (await sql.query(`SELECT * FROM ${table}`)).rows;
      expect(before.length).toBeGreaterThan(0);
      await expect(sql.query(`UPDATE ${table} SET actor_user_id='other'`)).rejects.toThrow('append-only');
      await expect(sql.query(`DELETE FROM ${table}`)).rejects.toThrow('append-only');
      await expect(sql.query(`TRUNCATE ${table}`)).rejects.toThrow('append-only');
      expect((await sql.query(`SELECT * FROM ${table}`)).rows).toEqual(before);
    }
  } finally { await sql.close(); }
});
