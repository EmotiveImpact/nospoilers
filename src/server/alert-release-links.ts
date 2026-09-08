import type { SqlClient } from './sql.ts';

export const alertReleaseLinksSchema = `
CREATE TABLE IF NOT EXISTS alert_release_links (
  alert_id BIGINT NOT NULL REFERENCES alerts(id) ON DELETE RESTRICT,
  revision_id BIGINT NOT NULL REFERENCES release_revisions(id) ON DELETE RESTRICT,
  PRIMARY KEY(alert_id, revision_id)
);
CREATE OR REPLACE FUNCTION guard_alert_release_link() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Alert release links are immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM alerts a JOIN release_revisions r
    ON r.installation_id=a.installation_id
    WHERE a.id=NEW.alert_id AND r.id=NEW.revision_id
      AND (a.repo_id IS NULL OR a.repo_id=r.repo_id))
  THEN RAISE EXCEPTION 'Release does not belong to this alert source'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS alert_release_link_guard ON alert_release_links;
CREATE TRIGGER alert_release_link_guard BEFORE INSERT OR UPDATE OR DELETE ON alert_release_links
FOR EACH ROW EXECUTE FUNCTION guard_alert_release_link();
DROP TRIGGER IF EXISTS alert_release_links_no_truncate ON alert_release_links;
CREATE TRIGGER alert_release_links_no_truncate BEFORE TRUNCATE ON alert_release_links
FOR EACH STATEMENT EXECUTE FUNCTION guard_alert_release_link();
`;

/** Associations are supplied by the scan producer, never inferred from human-readable text. */
export async function insertAlertWithReleaseLinks(sql: SqlClient, input: {
  installationId: number; repoId?: number | null; kind: string; title: string; body: string;
  findings?: unknown; githubDeliveryId?: string | null; releaseRevisionIds?: number[];
}): Promise<number> {
  const ids = [...new Set(input.releaseRevisionIds ?? [])];
  if (ids.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new Error('Invalid release revision ID');
  return sql.transaction(async tx => {
    // Serialise webhook retries before looking up the immutable original association.
    if (input.githubDeliveryId) {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [input.githubDeliveryId]);
      const existing = await tx.query<{id: number; installation_id: number}>(
        'SELECT id, installation_id FROM alerts WHERE github_delivery_id=$1 LIMIT 1', [input.githubDeliveryId]);
      if (existing.rows[0]) {
        if (Number(existing.rows[0].installation_id) !== input.installationId) throw new Error('Alert source mismatch');
        return Number(existing.rows[0].id);
      }
    }
    const inserted = await tx.query<{id: number}>(
      `INSERT INTO alerts(installation_id,repo_id,kind,title,body,findings,github_delivery_id)
       VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING id`,
      [input.installationId,input.repoId ?? null,input.kind,input.title,input.body,
        input.findings ? JSON.stringify(input.findings) : null,input.githubDeliveryId ?? null]);
    const id = Number(inserted.rows[0].id);
    for (const revisionId of ids) await tx.query(
      'INSERT INTO alert_release_links(alert_id,revision_id) VALUES($1,$2)', [id,revisionId]);
    return id;
  });
}

/** An empty result reveals neither a foreign alert nor any foreign revision. */
export async function listAlertReleaseLinks(sql: SqlClient, userId: string, alertId: number, installationId: number) {
  const result = await sql.query<{id: number; coordinate: string; created_at: string}>(
    `SELECT r.id,r.coordinate,r.created_at FROM alert_release_links l
     JOIN alerts a ON a.id=l.alert_id
     JOIN release_revisions r ON r.id=l.revision_id AND r.installation_id=a.installation_id
     WHERE a.id=$1 AND a.installation_id=$2
       AND EXISTS(SELECT 1 FROM installation_users u WHERE u.installation_id=a.installation_id AND u.user_id=$3)
       AND row_within_retention(a.installation_id,a.created_at)
       AND row_within_retention(r.installation_id,r.created_at)
     ORDER BY r.id`, [alertId,installationId,userId]);
  return result.rows.map(row=>({...row,id:Number(row.id)}));
}
