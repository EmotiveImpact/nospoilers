import pg from "pg";
import type { SqlClient } from "./sql.ts";

export const JOBS_CHANNEL = "nospoilers_jobs";

export async function notifyJobQueued(sql: SqlClient, kind: string): Promise<void> {
  try {
    await sql.query("SELECT pg_notify($1, $2)", [JOBS_CHANNEL, kind.replace(/\s+/g, " ").slice(0, 64)]);
  } catch {
    // PGlite and some local engines have no NOTIFY. In-process wake still runs.
  }
}

export async function listenJobQueued(
  databaseUrl: string,
  onWake: () => void,
): Promise<() => Promise<void>> {
  if (!databaseUrl || databaseUrl.startsWith("pglite:")) {
    return async () => undefined;
  }
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query(`LISTEN ${JOBS_CHANNEL}`);
  const handler = (message: { channel?: string }) => {
    if (message.channel === JOBS_CHANNEL) onWake();
  };
  client.on("notification", handler);
  return async () => {
    client.off("notification", handler);
    try {
      await client.query(`UNLISTEN ${JOBS_CHANNEL}`);
    } catch {
      // closing anyway
    }
    await client.end();
  };
}
