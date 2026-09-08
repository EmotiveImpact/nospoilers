import type { SqlClient } from './sql.ts';

export const PUBLIC_STAGING_BYTES = 256 * 1024 * 1024;
export const TOTAL_STAGING_BYTES = 1024 * 1024 * 1024;
export const MAX_STAGED_OBJECTS = 1000;

/** Hold this row lock until the caller's INSERT commits. Counts cannot race across replicas. */
export async function reserveStagingCapacity(tx: SqlClient, bytes: number, publicIntake: boolean,
  limits = { publicBytes: PUBLIC_STAGING_BYTES, totalBytes: TOTAL_STAGING_BYTES, objects: MAX_STAGED_OBJECTS }) {
  await tx.query("SELECT name FROM resource_locks WHERE name='staging' FOR UPDATE");
  await tx.query('DELETE FROM pending_scans WHERE expires_at<=now()');
  const {rows} = await tx.query<{public_bytes:unknown; total_bytes:unknown; objects:unknown}>(`
    SELECT p.bytes AS public_bytes, p.bytes+u.bytes AS total_bytes, p.n+u.n AS objects
    FROM (SELECT COALESCE(sum(octet_length(artifact_bytes)),0) AS bytes,count(*) AS n FROM pending_scans) p,
         (SELECT COALESCE(sum(octet_length(artifact_bytes)),0) AS bytes,count(*) AS n FROM uploaded_scans WHERE artifact_bytes IS NOT NULL) u`);
  const row=rows[0];
  if(bytes<0 || !Number.isSafeInteger(bytes) || Number(row.total_bytes)+bytes>limits.totalBytes ||
    (publicIntake && Number(row.public_bytes)+bytes>limits.publicBytes) || Number(row.objects)>=limits.objects) {
    throw Object.assign(new Error('Upload storage is temporarily at capacity. Please try again later.'),{status:429});
  }
}
