import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig, parseProcessRole, processRunsHttp, processRunsJobs } from "../src/server/config.ts";
import { JOBS_CHANNEL, notifyJobQueued } from "../src/server/job-wake.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { createRuntime } from "../src/server/runtime.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { serveUi } from "../src/server/static.ts";
import { createStore } from "../src/server/store.ts";

function unusedGithub(): GithubPort {
  const fail = async (): Promise<never> => {
    throw new Error("GitHub mock: unexpected call");
  };
  return {
    exchangeCode: fail,
    getUser: fail,
    listUserInstallations: fail,
    getInstallation: fail,
    getRepo: fail,
    listReleaseAssets: fail,
    getLatestRelease: fail,
    downloadAsset: fail,
    ...skippedGithubWrites(),
  };
}

async function tempUi(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "ns-ui-"));
  await mkdir(path.join(root, "assets"));
  await writeFile(path.join(root, "index.html"), "<!doctype html><div id=\"root\">NoSpoilers</div>");
  await writeFile(path.join(root, "assets", "app.js"), "window.ns=1");
  return root;
}

describe("process roles", () => {
  it("parses web and worker and defaults to all", () => {
    expect(parseProcessRole("web")).toBe("web");
    expect(parseProcessRole("WORKER")).toBe("worker");
    expect(parseProcessRole("")).toBe("all");
    expect(processRunsHttp("web")).toBe(true);
    expect(processRunsHttp("worker")).toBe(false);
    expect(processRunsJobs("web")).toBe(false);
    expect(processRunsJobs("worker")).toBe(true);
    expect(processRunsJobs("all")).toBe(true);
  });
});

describe("built UI", () => {
  it("serves the SPA and never leaves the ui root", async () => {
    const root = await tempUi();
    const watch = await serveUi("/watch", root);
    expect(watch?.status).toBe(200);
    expect(await watch?.text()).toContain("NoSpoilers");
    const asset = await serveUi("/assets/app.js", root);
    expect(await asset?.text()).toBe("window.ns=1");
    expect(await serveUi("/../.env", root)).toBeNull();
    expect(await serveUi("/assets/../index.html", root)).toBeNull();
  });

  it("serves Watch HTML from the API process and keeps /api JSON", async () => {
    const root = await tempUi();
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      const app = createApp({
        config: loadConfig({
          databaseUrl: "pglite://:memory:",
          githubWebhookSecret: "x",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
          uiRoot: root,
          processRole: "all",
        }),
        store,
        github: unusedGithub(),
      });
      const health = await app.request("/api/health");
      const healthBody = (await health.json()) as { role: string; ui: boolean; database: { mode: string } };
      expect(healthBody.role).toBe("all");
      expect(healthBody.ui).toBe(true);
      expect(healthBody.database.mode).toBe("pglite");
      const page = await app.request("/watch");
      expect(page.status).toBe(200);
      expect(page.headers.get("content-type")).toMatch(/text\/html/);
      expect(await page.text()).toContain("NoSpoilers");
      const api = await app.request("/api/destinations/email", { method: "POST" });
      expect(api.status).toBe(401);
    } finally {
      await sql.close();
    }
  });
});

describe("job notify and web role", () => {
  it("notifies after a job is queued and does not throw on PGlite", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await notifyJobQueued(sql, "repo_publicized");
      const queued = await store.enqueueJob({
        priority: "light",
        kind: "fork",
        payload: { fork: "octo/copy" },
      });
      expect(queued.inserted).toBe(true);
      expect(JOBS_CHANNEL).toBe("nospoilers_jobs");
    } finally {
      await sql.close();
    }
  });

  it("does not claim jobs when the process role is web", async () => {
    const runtime = await createRuntime({
      databaseUrl: "pglite://:memory:",
      githubWebhookSecret: "",
      githubAppId: "",
      githubPrivateKey: "",
      githubClientId: "",
      githubClientSecret: "",
      sessionSecret: "test-session-secret-for-runtime-role-web",
      processRole: "web",
      workerIntervalMs: 60 * 60 * 1000,
    });
    try {
      expect(runtime.runJobs).toBe(false);
      runtime.startBackground();
      const queued = await runtime.store.enqueueJob({
        priority: "light",
        kind: "member_added",
        payload: { login: "octo" },
      });
      expect(queued.inserted).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const { rows } = await runtime.sql.query<{ status: string }>("SELECT status FROM jobs");
      expect(rows.map((row) => row.status)).toEqual(["queued"]);
    } finally {
      await runtime.close();
    }
  });
});
