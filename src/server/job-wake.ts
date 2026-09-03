import pg from "pg";
import { logJson } from "./log.ts";
import type { SqlClient } from "./sql.ts";

export const JOBS_CHANNEL = "nospoilers_jobs";
/** Reconnect the LISTEN socket. This is not empty-queue polling. */
export const LISTEN_RETRY_MS = 2_000;

export type JobListenClient = {
  query: (text: string) => Promise<unknown>;
  on: (event: "notification" | "error" | "end", listener: (message?: unknown) => void) => unknown;
  off: (event: "notification" | "error" | "end", listener: (message?: unknown) => void) => unknown;
  end: () => Promise<void>;
};

export type ListenJobQueuedOptions = {
  connect?: () => Promise<JobListenClient>;
  retryDelayMs?: number;
};

async function defaultConnect(databaseUrl: string): Promise<JobListenClient> {
  const client = new pg.Client({ connectionString: databaseUrl, keepAlive: true });
  await client.connect();
  return {
    query: (text) => client.query(text),
    on(event, listener) {
      if (event === "notification") client.on(event, listener);
      else if (event === "error") client.on(event, listener);
      else client.on(event, listener);
      return client;
    },
    off(event, listener) {
      if (event === "notification") client.off(event, listener);
      else if (event === "error") client.off(event, listener);
      else client.off(event, listener);
      return client;
    },
    end: () => client.end(),
  };
}

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
  options: ListenJobQueuedOptions = {},
): Promise<() => Promise<void>> {
  if (!databaseUrl || databaseUrl.startsWith("pglite:")) {
    return async () => undefined;
  }

  const retryDelayMs = options.retryDelayMs ?? LISTEN_RETRY_MS;
  const connect = options.connect ?? (() => defaultConnect(databaseUrl));

  let closed = false;
  let generation = 0;
  let current: JobListenClient | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let connecting: Promise<void> | undefined;

  const onNotification = (message?: unknown) => {
    if (
      message &&
      typeof message === "object" &&
      "channel" in message &&
      message.channel === JOBS_CHANNEL
    ) {
      onWake();
    }
  };

  function detach(client: JobListenClient): void {
    client.off("notification", onNotification);
    client.off("error", onDead);
    client.off("end", onDead);
  }

  function onDead(): void {
    const client = current;
    if (!client || closed) return;
    current = undefined;
    generation += 1;
    detach(client);
    void client.end().catch(() => undefined);
    scheduleReconnect();
  }

  function scheduleReconnect(): void {
    if (closed || reconnectTimer || connecting) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void attach().catch((error) => {
        logJson("warn", "jobs.listen.reconnect_failed", {
          message: error instanceof Error ? error.message : "reconnect failed",
        });
        scheduleReconnect();
      });
    }, retryDelayMs);
  }

  async function attach(): Promise<void> {
    if (closed) return;
    connecting = (async () => {
      const mine = ++generation;
      const client = await connect();
      if (closed || mine !== generation) {
        await client.end().catch(() => undefined);
        return;
      }
      await client.query(`LISTEN ${JOBS_CHANNEL}`);
      if (closed || mine !== generation) {
        await client.end().catch(() => undefined);
        return;
      }
      current = client;
      client.on("notification", onNotification);
      client.on("error", onDead);
      client.on("end", onDead);
    })();
    try {
      await connecting;
    } finally {
      connecting = undefined;
    }
  }

  try {
    await attach();
  } catch (error) {
    logJson("warn", "jobs.listen.start_failed", {
      message: error instanceof Error ? error.message : "listen failed",
    });
    scheduleReconnect();
  }

  return async () => {
    closed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
    const client = current;
    current = undefined;
    generation += 1;
    if (!client) return;
    detach(client);
    try {
      await client.query(`UNLISTEN ${JOBS_CHANNEL}`);
    } catch {
      // closing anyway
    }
    await client.end().catch(() => undefined);
  };
}
