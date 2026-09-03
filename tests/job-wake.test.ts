import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import {
  directListenDatabaseUrl,
  JOBS_CHANNEL,
  LISTEN_RETRY_MS,
  listenJobQueued,
  type JobListenClient,
} from "../src/server/job-wake.ts";

class FakeClient extends EventEmitter {
  queries: string[] = [];
  ended = false;

  async query(text: string): Promise<void> {
    this.queries.push(text);
  }

  async end(): Promise<void> {
    this.ended = true;
  }
}

function asListenClient(client: FakeClient): JobListenClient {
  return client as unknown as JobListenClient;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("listenJobQueued", () => {
  it("uses Neon's direct endpoint for session-bound LISTEN connections", () => {
    expect(
      directListenDatabaseUrl(
        "postgresql://user:pass@ep-example-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
      ),
    ).toBe(
      "postgresql://user:pass@ep-example.us-east-2.aws.neon.tech/neondb?sslmode=require",
    );
    expect(directListenDatabaseUrl("postgres://db.example.com/app")).toBe(
      "postgres://db.example.com/app",
    );
  });

  it("reconnects the LISTEN socket slower than 500 ms empty polling", () => {
    expect(LISTEN_RETRY_MS).toBeGreaterThan(500);
  });

  it("is a no-op for PGlite", async () => {
    const stop = await listenJobQueued("pglite://:memory:", () => {
      throw new Error("should not wake");
    });
    await stop();
  });

  it("wakes on NOTIFY and reconnects after the listen socket dies", async () => {
    const clients: FakeClient[] = [];
    const wakes: number[] = [];
    const stop = await listenJobQueued(
      "postgres://example/neondb",
      () => {
        wakes.push(Date.now());
      },
      {
        retryDelayMs: 15,
        connect: async () => {
          const client = new FakeClient();
          clients.push(client);
          return asListenClient(client);
        },
      },
    );
    try {
      expect(clients).toHaveLength(1);
      expect(clients[0]?.queries).toEqual([`LISTEN ${JOBS_CHANNEL}`]);
      clients[0]?.emit("notification", { channel: JOBS_CHANNEL });
      expect(wakes).toHaveLength(1);
      clients[0]?.emit("error", new Error("Connection terminated unexpectedly"));
      await wait(40);
      expect(clients).toHaveLength(2);
      expect(clients[0]?.ended).toBe(true);
      clients[1]?.emit("notification", { channel: JOBS_CHANNEL });
      expect(wakes).toHaveLength(2);
    } finally {
      await stop();
      expect(clients[1]?.ended).toBe(true);
    }
  });

  it("retries the first listen connect without throwing", async () => {
    let attempts = 0;
    const client = new FakeClient();
    const stop = await listenJobQueued("postgres://example/neondb", () => undefined, {
      retryDelayMs: 15,
      connect: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("Neon is waking");
        return asListenClient(client);
      },
    });
    try {
      expect(attempts).toBe(1);
      await wait(40);
      expect(attempts).toBe(2);
      expect(client.queries).toEqual([`LISTEN ${JOBS_CHANNEL}`]);
    } finally {
      await stop();
    }
  });

  it("stop prevents further reconnects", async () => {
    const clients: FakeClient[] = [];
    const stop = await listenJobQueued("postgres://example/neondb", () => undefined, {
      retryDelayMs: 15,
      connect: async () => {
        const client = new FakeClient();
        clients.push(client);
        return asListenClient(client);
      },
    });
    clients[0]?.emit("error", new Error("gone"));
    await stop();
    await wait(40);
    expect(clients).toHaveLength(1);
  });
});
