import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { processUploadedScan } from '../src/server/upload-worker.ts';
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";
import { scan } from "../src/scanner/index.ts";
import {createWorkspace,ensureUserWorkspaces,listUserWorkspaces,updateWorkspace} from '../src/server/workspaces.ts';

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

describe("public acquisition scan", () => {
  afterEach(()=>vi.unstubAllEnvs());
  it("stages anonymous bytes and starts scanning only after authentication", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql);
      let scanCalls = 0;
      const app = createApp({
        config: loadConfig({
          appBaseUrl: "http://127.0.0.1:4347",
          sessionSecret: "sess",
        }),
        store,
        github: unusedGithub(),
        scan: async (target) => {
          scanCalls += 1;
          return await scan(target);
        },
      });

      const submitted = await app.request("/api/scan", {
        method: "POST",
        headers: { "x-filename": "sourcemap.tgz" },
        body: await readFile("fixtures/sourcemap.tgz"),
      });
      expect(submitted.status).toBe(202);
      const anonymousBody = (await submitted.json()) as Record<string, unknown>;
      expect(anonymousBody).toMatchObject({ pending: true, expiresInMinutes: 60 });
      expect(anonymousBody).not.toHaveProperty("findings");
      expect(scanCalls).toBe(0);
      const pendingCookie = submitted.headers.get("set-cookie")?.split(";")[0];
      expect(pendingCookie).toContain("ns_pending_scan=");

      const anonymousReveal = await app.request("/api/scan/pending", {
        headers: { cookie: pendingCookie ?? "" },
      });
      expect(anonymousReveal.status).toBe(401);

      await store.upsertUser({ id: "u1", login: "octo" });
      await ensureUserWorkspaces(sql,'u1');
      const [personal]=await listUserWorkspaces(sql,'u1');
      const destination=await createWorkspace(sql,'u1',personal.organization_id,'Selected destination');
      const sessionCookie = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
      await updateWorkspace(sql,'u1',destination.id,{archived:true});
      const deniedClaim=await app.request(`/api/scan/pending?workspaceId=${destination.id}`,{
        method:'POST',headers:{cookie:`${sessionCookie}; ${pendingCookie}`},
      });
      expect(deniedClaim.status).toBe(403);
      expect(await store.listUploadedScans('u1')).toEqual([]);
      expect(scanCalls).toBe(0);
      await updateWorkspace(sql,'u1',destination.id,{archived:false});
      const revealed = await app.request(`/api/scan/pending?workspaceId=${destination.id}`, {
        method: 'POST',
        headers: { cookie: `${sessionCookie}; ${pendingCookie}` },
      });
      expect(revealed.status).toBe(202);
      const queued = await revealed.json() as {uploadId:string};
      expect((await store.listUploadedScans('u1',undefined,destination.id)).map(row=>row.id)).toContain(queued.uploadId);
      expect(await store.listUploadedScans('u1',undefined,personal.id)).toEqual([]);
      expect(scanCalls).toBe(0);
      await processUploadedScan(queued.uploadId,store,scan,'sess');
      const saved=await store.getUploadedScan('u1',queued.uploadId);
      expect(saved?.status).toBe('done');
      expect(saved?.report_json?.findings.map(f=>f.rule)).toContain('MAP-001');
      expect(saved?.receipt_json?.ok).toBe(false);
      const reopened = await app.request(`/api/uploads/${queued.uploadId}`, { headers: { cookie: sessionCookie } });
      expect(reopened.status).toBe(200);
      expect(await reopened.json()).toMatchObject({ upload: { id: queued.uploadId, status: 'done' } });
      const releases = await app.request('/api/uploads', { headers: { cookie: sessionCookie } });
      expect(await releases.json()).toMatchObject({ uploads: [{ id: queued.uploadId }] });

      const cached = await app.request("/api/scan/pending", {
        headers: { cookie: `${sessionCookie}; ${pendingCookie}` },
      });
      expect(cached.status).toBe(200);
      expect(scanCalls).toBe(0);
      const usageBefore=(await sql.query('SELECT * FROM personal_scan_usage')).rows;
      const jobsBefore=(await sql.query('SELECT count(*) AS count FROM jobs')).rows;
      const replay=await app.request(`/api/scan/pending?workspaceId=${personal.id}`,{
        method:'POST',headers:{cookie:`${sessionCookie}; ${pendingCookie}`},
      });
      expect(replay.status).toBe(202);
      expect(await replay.json()).toMatchObject({uploadId:queued.uploadId});
      expect((await sql.query('SELECT * FROM personal_scan_usage')).rows).toEqual(usageBefore);
      expect((await sql.query('SELECT count(*) AS count FROM jobs')).rows).toEqual(jobsBefore);
      expect(await store.listUploadedScans('u1',undefined,personal.id)).toEqual([]);
      expect((await store.listUploadedScans('u1',undefined,destination.id)).map(row=>row.id)).toEqual([queued.uploadId]);

      await store.upsertUser({ id: "u2", login: "other" });
      const otherSession = `ns_session=${signSession("sess", await store.createSession("u2"))}`;
      const forbidden = await app.request(`/api/uploads/${queued.uploadId}`, { headers: { cookie: otherSession } });
      expect(forbidden.status).toBe(404);
      const csrf = await app.request('/api/scan/pending', { method: 'POST', headers: { cookie: sessionCookie, origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' } });
      expect(csrf.status).toBe(403);
      const stolen = await app.request("/api/scan/pending", {
        method:'POST',
        headers: { cookie: `${otherSession}; ${pendingCookie}` },
      });
      expect(stolen.status).toBe(404);

      // Expiry must reject admission, not merely free staging capacity.
      const expiring = await app.request('/api/scan', {
        method:'POST',headers:{'x-filename':'clean.tgz'},
        body:await readFile('fixtures/clean.tgz'),
      });
      expect(expiring.status).toBe(202);
      const expiringCookie=expiring.headers.get('set-cookie')?.split(';')[0];
      await sql.query("UPDATE pending_scans SET expires_at=now()-interval '1 second'");
      const expired=await app.request(`/api/scan/pending?workspaceId=${destination.id}`,{
        method:'POST',headers:{cookie:`${sessionCookie}; ${expiringCookie}`},
      });
      expect(expired.status).toBe(404);
      expect(await expired.json()).toMatchObject({error:expect.stringContaining('expired')});
      expect((await sql.query('SELECT count(*) AS count FROM jobs')).rows).toEqual(jobsBefore);
      expect((await sql.query('SELECT * FROM personal_scan_usage')).rows).toEqual(usageBefore);
      expect((await store.listUploadedScans('u1',undefined,destination.id)).map(row=>row.id)).toEqual([queued.uploadId]);
    } finally {
      await sql.close();
    }
  });

  it("carries a production URL through local authentication without scanning it anonymously", async () => {
    vi.stubEnv('NOSPOILERS_LOCAL_REVIEW','1');
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const app = createApp({
        config: loadConfig({ appBaseUrl: "http://127.0.0.1:4347", sessionSecret: "sess" }),
        store: createStore(sql),
        github: unusedGithub(),
      });
      const intent = await app.request("/api/origin-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://app.example.com/checkout" }),
      });
      expect(intent.status).toBe(200);
      expect(await intent.json()).toMatchObject({ ok: true, authUrl: "/api/auth/development" });
      const cookie = intent.headers.get("set-cookie")?.split(";")[0] ?? "";
      const login = await app.request("/api/auth/development", { headers: { cookie } });
      expect(login.status).toBe(302);
      expect(login.headers.get("location")).toBe(
        "/watch/sources?configure=website&origin=https%3A%2F%2Fapp.example.com%2Fcheckout",
      );
    } finally {
      await sql.close();
    }
  });
});
