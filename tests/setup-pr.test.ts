import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { getRequestListener } from "@hono/node-server";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { createLogNotifier } from "../src/server/notifier.ts";
import {
  MAX_SETUP_PACKS,
  SETUP_ACTION_PATH,
  SETUP_PACK_GLOBS,
  SETUP_WORKFLOW_PATH,
  isGithubActionsWorkflowPath,
  setupActionScanPython,
  setupActionYaml,
  setupCommitFiles,
  setupFiles,
  setupPullRequestBody,
  setupWorkflowYaml,
} from "../src/server/setup-workflow.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";
import { createWorker } from "../src/server/worker.ts";
import { PACK_FILE_RE } from "../src/scanner/formats.ts";
import { scan } from "../src/scanner/index.ts";

const execFileAsync = promisify(execFile);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = path.join(root, "fixtures/sourcemap.tgz");

function workflowListPython(): string {
  const yaml = setupWorkflowYaml();
  const match = yaml.match(/python3 - <<'PY'\n([\s\S]*?)\n\s*PY\n/);
  if (!match?.[1]) throw new Error("generated workflow is missing pack-list python");
  const lines = match[1].split("\n");
  const indent = lines[0]?.match(/^ */)?.[0].length ?? 0;
  return lines.map((line) => line.slice(indent)).join("\n");
}

function actionScanPythonFromYaml(): string {
  const yaml = setupActionYaml();
  const match = yaml.match(/python3 - <<'PY'\n([\s\S]*?)\n\s*PY\n/);
  if (!match?.[1]) throw new Error("generated action is missing hosted-scan python");
  const lines = match[1].split("\n");
  const indent = lines[0]?.match(/^ */)?.[0].length ?? 0;
  return lines.map((line) => line.slice(indent)).join("\n");
}

async function runScanPython(
  extraEnv: Record<string, string>,
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const script = path.join(
    os.tmpdir(),
    `ns-setup-scan-${Date.now()}-${Math.random().toString(16).slice(2)}.py`,
  );
  await writeFile(script, setupActionScanPython());
  try {
    const { stdout, stderr } = await execFileAsync("python3", [script], {
      cwd,
      env: { PATH: process.env.PATH, ...extraEnv },
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const err = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: typeof err.code === "number" ? err.code : 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}

async function listenJson(
  handler: (
    req: { url?: string; headers: Record<string, string | string[] | undefined> },
    body: Buffer,
  ) => { status: number; json: unknown },
): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const result = handler(req, Buffer.concat(chunks));
      const payload = Buffer.from(JSON.stringify(result.json));
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(payload);
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("server had no port");
  return {
    origin: `http://127.0.0.1:${addr.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function packsFromGithubOutput(text: string): unknown {
  const marker = "packs<<NS_PACKS\n";
  const start = text.indexOf(marker);
  if (start < 0) throw new Error("GITHUB_OUTPUT missing packs delimiter");
  const rest = text.slice(start + marker.length);
  const end = rest.indexOf("\nNS_PACKS");
  if (end < 0) throw new Error("GITHUB_OUTPUT missing packs terminator");
  return JSON.parse(rest.slice(0, end));
}

async function runWorkflowList(
  cwd: string,
  python: string,
  extraEnv: Record<string, string>,
): Promise<string[]> {
  const script = path.join(os.tmpdir(), `ns-list-packs-${Date.now()}-${Math.random().toString(16).slice(2)}.py`);
  const output = path.join(os.tmpdir(), `ns-gh-out-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await writeFile(script, python);
  await writeFile(output, "");
  try {
    await execFileAsync("python3", [script], {
      cwd,
      env: {
        PATH: process.env.PATH,
        GITHUB_OUTPUT: output,
        NS_PACK_GLOBS: JSON.stringify([...SETUP_PACK_GLOBS]),
        NS_PACK_RE: PACK_FILE_RE.source,
        NS_MAX_PACKS: String(MAX_SETUP_PACKS),
        ...extraEnv,
      },
    });
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    throw new Error(err.stderr || err.message || "pack list failed");
  }
  const listed = packsFromGithubOutput(await readFile(output, "utf8"));
  if (!Array.isArray(listed) || listed.some((row) => typeof row !== "string")) {
    throw new Error("pack list was not a string array");
  }
  return listed;
}

function mockGithub(overrides: Partial<GithubPort> = {}): GithubPort {
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
    ...overrides,
  };
}

async function waitUntil(fn: () => Promise<boolean>, label: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 4000) {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`timed out waiting for ${label}`);
}

describe("generated setup workflow", () => {
  it("is reviewable, never auto-merged, and only gates packed artifacts", () => {
    const yaml = setupWorkflowYaml();
    expect(yaml).toContain("never merged automatically");
    expect(yaml).toContain("package.tgz");
    expect(yaml).toContain("dist/*.tgz");
    expect(yaml).toContain("dist/*.zip");
    expect(yaml).toContain("dist/*.asar");
    expect(yaml).toContain("dist/*.vsix");
    expect(yaml).toContain("dist/*.gem");
    expect(yaml).toContain("dist/*.tar");
    expect(yaml).toContain("dist/*.apk");
    expect(yaml).toContain("dist/*.tar.gz");
    expect(yaml).toContain("fromJSON(needs.list-packs.outputs.packs)");
    expect(yaml).toContain("No packed artifact found");
    expect(yaml).toContain("matrix.pack");
    expect(yaml).toContain("uses: ./.github/actions/nospoilers");
    expect(yaml).toContain("vars.NOSPOILERS_API_URL");
    expect(yaml).toContain("secrets.NOSPOILERS_API_TOKEN");
    expect(yaml).not.toContain("EmotiveImpact/nospoilers@main");
    expect(yaml).not.toContain("github.event.inputs.path || 'package.tgz'");
    expect(yaml).not.toMatch(/on:\s*\n\s*push:\s*\n\s*branches/);
    for (const glob of SETUP_PACK_GLOBS) {
      expect(yaml).toContain(`- ${glob}`);
    }
    const files = setupFiles();
    expect(files.map((file) => file.path)).toEqual([SETUP_WORKFLOW_PATH, SETUP_ACTION_PATH]);
    expect(isGithubActionsWorkflowPath(SETUP_WORKFLOW_PATH)).toBe(true);
    expect(isGithubActionsWorkflowPath(SETUP_ACTION_PATH)).toBe(false);
    expect(isGithubActionsWorkflowPath(".github/workflows/nested/dir.yml")).toBe(false);
    expect(setupCommitFiles(false).map((file) => file.path)).toEqual([SETUP_ACTION_PATH]);
    expect(setupCommitFiles(true).map((file) => file.path)).toEqual([
      SETUP_WORKFLOW_PATH,
      SETUP_ACTION_PATH,
    ]);
    expect(setupActionYaml()).toContain("python3 - <<'PY'");
    expect(setupActionYaml()).not.toContain("npm ci");
    expect(setupActionYaml()).not.toContain("npx tsx");
    expect(setupActionYaml()).not.toContain("EmotiveImpact/nospoilers");
    expect(actionScanPythonFromYaml().trim()).toBe(setupActionScanPython().trim());
    const body = setupPullRequestBody();
    expect(body).toContain("**not** merged automatically");
    expect(body).toContain("packed");
    expect(body).toContain("fails closed");
    expect(body).toContain("Do **not** grant Administration");
    expect(body).toContain("does not request Workflows write");
    expect(body).toContain("Optionally mark the **NoSpoilers** check as required");
    expect(body).toContain("NOSPOILERS_API_URL");
    expect(body).toContain("NOSPOILERS_API_TOKEN");
    expect(body).toContain("Mint a scan API token on Watch");
    expect(body).not.toContain("EmotiveImpact/nospoilers@main");
  });

  it("never calls the GitHub merge API", async () => {
    const source = await readFile(path.join(root, "src/server/github.ts"), "utf8");
    expect(source).not.toMatch(/\/merge\b/);
    expect(source).not.toMatch(/mergePullRequest|merge_pull|putMerge|POST merge/i);
    expect(source).toContain("createSetupPullRequest");
  });

  it("lists only existing root/dist packs and fails closed when empty", async () => {
    const python = workflowListPython();
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-setup-packs-"));
    await mkdir(path.join(dir, "dist"));
    await mkdir(path.join(dir, "src"));
    await writeFile(path.join(dir, "package.tgz"), "pack");
    await writeFile(path.join(dir, "dist", "app.vsix"), "vsix");
    await writeFile(path.join(dir, "dist", "notes.txt"), "nope");
    await writeFile(path.join(dir, "src", "secret.tgz"), "secret");
    await symlink(path.join(dir, "src", "secret.tgz"), path.join(dir, "dist", "link.tgz"));

    expect(await runWorkflowList(dir, python, { GITHUB_EVENT_NAME: "push" })).toEqual([
      "dist/app.vsix",
      "package.tgz",
    ]);
    expect(await runWorkflowList(dir, python, { GITHUB_EVENT_NAME: "pull_request" })).toEqual([
      "dist/app.vsix",
      "package.tgz",
    ]);

    const empty = await mkdtemp(path.join(os.tmpdir(), "ns-setup-empty-"));
    expect(await runWorkflowList(empty, python, { GITHUB_EVENT_NAME: "push" })).toEqual([]);

    expect(
      await runWorkflowList(dir, python, {
        GITHUB_EVENT_NAME: "workflow_dispatch",
        NS_DISPATCH_PATH: "dist/app.vsix",
      }),
    ).toEqual(["dist/app.vsix"]);

    await expect(
      runWorkflowList(dir, python, {
        GITHUB_EVENT_NAME: "workflow_dispatch",
        NS_DISPATCH_PATH: "../secret.tgz",
      }),
    ).rejects.toThrow(/workflow_dispatch path/);

    const many = await mkdtemp(path.join(os.tmpdir(), "ns-setup-many-"));
    await mkdir(path.join(many, "dist"));
    for (let i = 0; i < MAX_SETUP_PACKS + 3; i += 1) {
      await writeFile(path.join(many, "dist", `app${i}.tgz`), "pack");
    }
    const listed = await runWorkflowList(many, python, { GITHUB_EVENT_NAME: "push" });
    expect(listed).toHaveLength(MAX_SETUP_PACKS);
  });

  it("exits 1 on failed-policy JSON and 2 when env is missing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-setup-scan-"));
    const pack = path.join(dir, "package.tgz");
    await writeFile(pack, "pack-bytes");

    const missing = await runScanPython({}, dir);
    expect(missing.code).toBe(2);
    expect(missing.stderr).toContain("NOSPOILERS_API_URL");
    expect(missing.stderr).toContain("NOSPOILERS_API_TOKEN");
    expect(missing.stderr).toContain("Do not grant Administration");
    expect(missing.stderr).not.toContain("Grant Administration");

    const captured: { url?: string; auth?: string; filename?: string; body: string }[] = [];
    const server = await listenJson((req, body) => {
      captured.push({
        url: req.url,
        auth: String(req.headers.authorization ?? ""),
        filename: String(req.headers["x-filename"] ?? ""),
        body: body.toString("utf8"),
      });
      if (req.url !== "/api/v1/scan") return { status: 404, json: { error: "not found" } };
      if (String(req.headers.authorization) === "Bearer nsp_failed") {
        return {
          status: 200,
          json: {
            report: { ok: false, status: "failed-policy" },
            receipt: { status: "failed-policy" },
          },
        };
      }
      if (String(req.headers.authorization) === "Bearer nsp_inconclusive") {
        return {
          status: 200,
          json: {
            report: { ok: false, status: "inconclusive", inconclusiveReason: "Encrypted zip." },
            receipt: { status: "inconclusive" },
          },
        };
      }
      if (String(req.headers.authorization) === "Bearer nsp_passed") {
        return {
          status: 200,
          json: {
            report: { ok: true, status: "passed" },
            receipt: { status: "passed" },
          },
        };
      }
      return { status: 500, json: { error: "boom" } };
    });
    try {
      const failed = await runScanPython(
        {
          NOSPOILERS_API_URL: server.origin,
          NOSPOILERS_API_TOKEN: "nsp_failed",
          NOSPOILERS_PACK: "package.tgz",
        },
        dir,
      );
      expect(failed.code).toBe(1);
      expect(failed.stdout).toContain("failed-policy");

      const inconclusive = await runScanPython(
        {
          NOSPOILERS_API_URL: server.origin,
          NOSPOILERS_API_TOKEN: "nsp_inconclusive",
          NOSPOILERS_PACK: "package.tgz",
        },
        dir,
      );
      expect(inconclusive.code).toBe(2);
      expect(inconclusive.stderr).toContain("Encrypted zip.");

      const passed = await runScanPython(
        {
          NOSPOILERS_API_URL: server.origin,
          NOSPOILERS_API_TOKEN: "nsp_passed",
          NOSPOILERS_PACK: "package.tgz",
        },
        dir,
      );
      expect(passed.code).toBe(0);
      expect(passed.stdout).toContain("passed");

      const boom = await runScanPython(
        {
          NOSPOILERS_API_URL: server.origin,
          NOSPOILERS_API_TOKEN: "nsp_boom",
          NOSPOILERS_PACK: "package.tgz",
        },
        dir,
      );
      expect(boom.code).toBe(2);
      expect(boom.stderr).toContain("Hosted scan failed (500)");
    } finally {
      await server.close();
    }

    expect(captured.some((row) => row.url === "/api/v1/scan")).toBe(true);
    expect(captured.some((row) => row.filename === "package.tgz" && row.body === "pack-bytes")).toBe(
      true,
    );
  });
});

describe("setup workflow and PR APIs", () => {
  it("returns YAML to the owning member and 401 when anonymous", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.linkUserInstallation(7, "u1");
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: true,
        htmlUrl: "https://github.com/octo/throwaway",
      });
      const app = createApp({
        config: loadConfig({
          githubWebhookSecret: "wh",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
        }),
        store,
        github: mockGithub(),
      });
      const anon = await app.request("/api/repos/99/setup-workflow");
      expect(anon.status).toBe(401);

      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const owned = await app.request("/api/repos/99/setup-workflow", { headers: { cookie } });
      expect(owned.status).toBe(200);
      const body = (await owned.json()) as {
        workflow: string;
        path: string;
        files: { path: string; content: string }[];
      };
      expect(body.path).toBe(SETUP_WORKFLOW_PATH);
      expect(body.workflow).toContain("never merged automatically");
      expect(body.workflow).toContain("packed artifact");
      expect(body.workflow).toContain("uses: ./.github/actions/nospoilers");
      expect(body.workflow).not.toContain("EmotiveImpact/nospoilers@main");
      expect(body.files.map((file) => file.path)).toEqual([SETUP_WORKFLOW_PATH, SETUP_ACTION_PATH]);
      expect(body.files[1]?.content).toContain("/api/v1/scan");
    } finally {
      await sql.close();
    }
  });

  it("opens a reviewable setup PR and never reports it merged", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.linkUserInstallation(7, "u1");
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: true,
        htmlUrl: "https://github.com/octo/throwaway",
      });
      let opened = 0;
      const app = createApp({
        config: loadConfig({
          githubWebhookSecret: "wh",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
        }),
        store,
        github: mockGithub({
          createSetupPullRequest: async () => {
            opened += 1;
            return {
              htmlUrl: "https://github.com/octo/throwaway/pull/12",
              number: 12,
              existing: false,
            };
          },
        }),
      });
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const created = await app.request("/api/repos/99/setup-pr", {
        method: "POST",
        headers: { cookie },
      });
      expect(created.status).toBe(201);
      expect(opened).toBe(1);
      const body = (await created.json()) as {
        ok: boolean;
        htmlUrl: string;
        number: number;
        existing: boolean;
        merged: boolean;
      };
      expect(body.ok).toBe(true);
      expect(body.htmlUrl).toContain("/pull/12");
      expect(body.number).toBe(12);
      expect(body.existing).toBe(false);
      expect(body.merged).toBe(false);
    } finally {
      await sql.close();
    }
  });

  it("returns 409 with copy-paste files when GitHub write is denied", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.linkUserInstallation(7, "u1");
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: true,
        htmlUrl: "https://github.com/octo/throwaway",
      });
      const app = createApp({
        config: loadConfig({
          githubWebhookSecret: "wh",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
        }),
        store,
        github: mockGithub({
          createSetupPullRequest: async () => ({
            skipped: "permission",
            reason: "Grant Contents write and Pull requests write to open a setup PR. Do not grant Administration.",
            written: [SETUP_ACTION_PATH],
            branch: "nospoilers/setup",
            compareUrl: "https://github.com/octo/throwaway/tree/nospoilers/setup",
          }),
        }),
      });
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const denied = await app.request("/api/repos/99/setup-pr", {
        method: "POST",
        headers: { cookie },
      });
      expect(denied.status).toBe(409);
      const body = (await denied.json()) as {
        skipped: string;
        reason: string;
        workflow: string;
        files: { path: string; content: string }[];
        written: string[];
        branch: string;
        compareUrl: string;
      };
      expect(body.skipped).toBe("permission");
      expect(body.reason).toContain("Do not grant Administration");
      expect(body.written).toEqual([SETUP_ACTION_PATH]);
      expect(body.branch).toBe("nospoilers/setup");
      expect(body.compareUrl).toBe("https://github.com/octo/throwaway/tree/nospoilers/setup");
      expect(body.workflow).toContain("never merged automatically");
      expect(body.workflow).toContain("package.tgz");
      expect(body.workflow).not.toContain("EmotiveImpact/nospoilers@main");
      expect(body.files.map((file) => file.path)).toEqual([SETUP_WORKFLOW_PATH, SETUP_ACTION_PATH]);
      expect(body.files.some((file) => file.content.includes("uses: ./.github/actions/nospoilers"))).toBe(
        true,
      );
    } finally {
      await sql.close();
    }
  });

  it("hides another tenant's repo and refuses unpaid writes", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertUser({ id: "u2", login: "other" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.upsertInstallation({
        id: 8,
        accountLogin: "other",
        accountType: "User",
        accountId: 2,
      });
      await store.linkUserInstallation(7, "u1");
      await store.linkUserInstallation(8, "u2");
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: true,
        htmlUrl: "https://github.com/octo/throwaway",
      });
      const app = createApp({
        config: loadConfig({
          githubWebhookSecret: "wh",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
        }),
        store,
        github: mockGithub({
          createSetupPullRequest: async () => {
            throw new Error("must not open a PR for another tenant");
          },
        }),
      });
      const other = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const hidden = await app.request("/api/repos/99/setup-workflow", { headers: { cookie: other } });
      expect(hidden.status).toBe(403);
      const hiddenPr = await app.request("/api/repos/99/setup-pr", {
        method: "POST",
        headers: { cookie: other },
      });
      expect(hiddenPr.status).toBe(403);
      const missing = await app.request("/api/repos/404404/setup-pr", {
        method: "POST",
        headers: { cookie: other },
      });
      expect(missing.status).toBe(404);

      await sql.query(
        `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
      );
      const owner = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const unpaid = await app.request("/api/repos/99/setup-pr", {
        method: "POST",
        headers: { cookie: owner },
      });
      expect(unpaid.status).toBe(402);
    } finally {
      await sql.close();
    }
  });
});

describe("vendored hosted-scan Action against POST /api/v1/scan", () => {
  it("maps real receipts to CLI exit 0/1/2 without executing the pack", async () => {
    const sql = await openSql("pglite://:memory:");
    let scanWorker: ReturnType<typeof createWorker> | undefined;
    let closeServer: (() => Promise<void>) | undefined;
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "sess" });
      await store.upsertUser({ id: "u1", login: "octo" });
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.linkUserInstallation(7, "u1");
      scanWorker=createWorker({store,github:mockGithub(),notifier:createLogNotifier(store),scan,heavyConcurrency:2,lightConcurrency:2,maxAssetBytes:80*1024*1024,intervalMs:100,receiptSecret:loadConfig({sessionSecret:'sess'}).receiptSecret});
      const app = createApp({
        wakeWorker:()=>{void scanWorker?.tick();},
        config: loadConfig({
          githubWebhookSecret: "wh",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
        }),
        store,
        github: mockGithub(),
      });
      const cookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      const minted = await app.request("/api/scan-tokens", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "CI", installationId: 7 }),
      });
      expect(minted.status).toBe(201);
      const mintedBody = (await minted.json()) as { token: string };
      const server = createServer(getRequestListener(app.fetch));
      await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
      });
      const addr = server.address();
      if (!addr || typeof addr === "string") throw new Error("server had no port");
      const origin = `http://127.0.0.1:${addr.port}`;
      closeServer = () =>
        new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });

      const dirty = await runScanPython(
        {
          NOSPOILERS_API_URL: origin,
          NOSPOILERS_API_TOKEN: mintedBody.token,
          NOSPOILERS_PACK: "fixtures/sourcemap.tgz",
        },
        root,
      );
      expect(dirty.code).toBe(1);

      const clean = await runScanPython(
        {
          NOSPOILERS_API_URL: origin,
          NOSPOILERS_API_TOKEN: mintedBody.token,
          NOSPOILERS_PACK: "fixtures/clean.tgz",
        },
        root,
      );
      expect(clean.code).toBe(0);

      const inconclusive = await runScanPython(
        {
          NOSPOILERS_API_URL: origin,
          NOSPOILERS_API_TOKEN: mintedBody.token,
          NOSPOILERS_PACK: "fixtures/inconclusive.encrypted.zip",
        },
        root,
      );
      expect(inconclusive.code).toBe(2);
      expect(inconclusive.stderr.toLowerCase()).not.toContain("grant administration");
    } finally {
      await closeServer?.();
      await scanWorker?.stop();
      await sql.close();
    }
  }, 15000);
});

describe("release_scan GitHub Checks", () => {
  it("posts a failing check with MAP annotations and still finishes if Checks write is skipped", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: false,
        htmlUrl: "https://github.com/octo/throwaway",
      });
      const bytes = await readFile(FIXTURE);
      const checks: Array<{
        conclusion: string;
        title: string;
        annotations?: { title?: string; path: string }[];
      }> = [];
      const worker = createWorker({
        store,
        github: mockGithub({
          listReleaseAssets: async () => [
            {
              id: 1,
              name: "sourcemap.tgz",
              size: bytes.length,
              url: "https://api.github.com/asset/1",
            },
          ],
          downloadAsset: async () => bytes,
          getRefSha: async () => "a".repeat(40),
          createCheckRun: async (_installationId, _owner, _repo, input) => {
            checks.push(input);
            return { id: 88, htmlUrl: "https://github.com/octo/throwaway/runs/88" };
          },
        }),
        notifier: createLogNotifier(store),
        scan,
        heavyConcurrency: 2,
        lightConcurrency: 2,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 60_000,
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "release_scan",
        payload: {
          installationId: 7,
          releaseId: 1,
          tag: "phase1-fixture",
          targetCommitish: "main",
          repo: {
            id: 99,
            owner: "octo",
            name: "throwaway",
            fullName: "octo/throwaway",
            private: false,
            htmlUrl: "https://github.com/octo/throwaway",
          },
        },
      });
      await worker.tick();
      await waitUntil(async () => {
        const { rows } = await sql.query<{ status: string }>("SELECT status FROM jobs");
        return rows[0]?.status === "done";
      }, "first release_scan");
      await worker.stop();
      expect(checks).toHaveLength(1);
      expect(checks[0]?.conclusion).toBe("failure");
      expect(checks[0]?.title).not.toContain("allowed to ship");
      const rules = (checks[0]?.annotations ?? []).map((row) => row.title);
      expect(rules.some((rule) => rule?.startsWith("MAP-"))).toBe(true);

      const skippedWorker = createWorker({
        store,
        github: mockGithub({
          listReleaseAssets: async () => [
            {
              id: 2,
              name: "sourcemap.tgz",
              size: bytes.length,
              url: "https://api.github.com/asset/2",
            },
          ],
          downloadAsset: async () => bytes,
          getRefSha: async () => "b".repeat(40),
          createCheckRun: async () => ({
            skipped: "permission",
            reason: "Grant Checks write to report release scans. Do not grant Administration.",
          }),
        }),
        notifier: createLogNotifier(store),
        scan,
        heavyConcurrency: 2,
        lightConcurrency: 2,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 60_000,
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "release_scan",
        payload: {
          installationId: 7,
          releaseId: 2,
          tag: "phase1-fixture-2",
          repo: {
            id: 99,
            owner: "octo",
            name: "throwaway",
            fullName: "octo/throwaway",
            private: false,
            htmlUrl: "https://github.com/octo/throwaway",
          },
        },
      });
      await skippedWorker.tick();
      await waitUntil(async () => {
        const { rows } = await sql.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM jobs WHERE status = 'done'`,
        );
        return Number(rows[0]?.n) === 2;
      }, "skipped check still done");
      await skippedWorker.stop();
      const { rows: alerts } = await sql.query<{ n: string }>("SELECT count(*)::text AS n FROM alerts");
      expect(Number(alerts[0]?.n)).toBeGreaterThanOrEqual(2);
    } finally {
      await sql.close();
    }
  });

  it("looks up the tag name, not tags/tag, and still finishes when that commit is missing", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      await store.upsertInstallation({
        id: 7,
        accountLogin: "octo",
        accountType: "User",
        accountId: 1,
      });
      await store.upsertRepo({
        id: 99,
        installationId: 7,
        owner: "octo",
        name: "throwaway",
        fullName: "octo/throwaway",
        private: false,
        htmlUrl: "https://github.com/octo/throwaway",
      });
      const bytes = await readFile(FIXTURE);
      const refs: string[] = [];
      const worker = createWorker({
        store,
        github: mockGithub({
          listReleaseAssets: async () => [
            {
              id: 1,
              name: "sourcemap.tgz",
              size: bytes.length,
              url: "https://api.github.com/asset/1",
            },
          ],
          downloadAsset: async () => bytes,
          getRefSha: async (_installationId, _owner, _repo, ref) => {
            refs.push(ref);
            if (ref.startsWith("tags/")) {
              throw new Error(`GitHub 422: No commit found for SHA: ${ref}`);
            }
            if (ref === "v0.1.7") return null;
            if (ref === "main") return "c".repeat(40);
            return null;
          },
          createCheckRun: async () => ({
            skipped: "permission",
            reason: "Grant Checks write to report release scans. Do not grant Administration.",
          }),
        }),
        notifier: createLogNotifier(store),
        scan,
        heavyConcurrency: 2,
        lightConcurrency: 2,
        maxAssetBytes: 80 * 1024 * 1024,
        intervalMs: 60_000,
      });
      await store.enqueueJob({
        priority: "heavy",
        kind: "release_scan",
        payload: {
          installationId: 7,
          releaseId: 381173289,
          tag: "v0.1.7",
          targetCommitish: "main",
          repo: {
            id: 99,
            owner: "octo",
            name: "throwaway",
            fullName: "octo/throwaway",
            private: false,
            htmlUrl: "https://github.com/octo/throwaway",
          },
        },
      });
      await worker.tick();
      await waitUntil(async () => {
        const { rows } = await sql.query<{ status: string }>("SELECT status FROM jobs");
        return rows[0]?.status === "done";
      }, "release_scan after missing tag SHA");
      await worker.stop();
      expect(refs).toEqual(["v0.1.7", "main"]);
      expect(refs.some((ref) => ref.startsWith("tags/"))).toBe(false);
      const { rows: alerts } = await sql.query<{ title: string; kind: string }>(
        "SELECT title, kind FROM alerts",
      );
      expect(alerts.some((row) => row.kind === "release_scan")).toBe(true);
    } finally {
      await sql.close();
    }
  });
});
