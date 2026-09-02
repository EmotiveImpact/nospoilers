import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import {
  OPERATOR_CONFIRM_ERROR,
  OPERATOR_GRANT_ERROR,
  OPERATOR_OWNER_ERROR,
} from "../src/server/operator-grants.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

const json = { "content-type": "application/json" };
const admin = { authorization: "Bearer desk-op-admin", ...json };

function unusedGithub(): GithubPort {
  const unused = async (): Promise<never> => {
    throw new Error("GitHub should not be called.");
  };
  return {
    exchangeCode: unused,
    getUser: unused,
    listUserInstallations: unused,
    getInstallation: unused,
    getRepo: unused,
    listReleaseAssets: unused,
    getLatestRelease: unused,
    downloadAsset: unused,
    ...skippedGithubWrites(),
  };
}

describe("Disclosure Desk researcher roles", () => {
  it("lets the owner grant operator access without queue rights or a worker wake", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "desk-op-session" });
      await store.upsertProspect({
        source: "npm",
        owner: "prettier",
        repo: "prettier",
        repositoryUrl: "https://github.com/prettier/prettier",
        packageName: "prettier",
        releaseTag: "3.9.6",
        artifactName: "prettier-3.9.6.tgz",
        artifactUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
      });
      await store.upsertUser({ id: "customer-1", login: "not-admin" });
      await store.upsertUser({ id: "researcher-1", login: "desk-researcher" });
      let wakes = 0;
      const app = createApp({
        config: loadConfig({
          adminToken: "desk-op-admin",
          adminGithubLogin: "EmotiveImpact",
          sessionSecret: "desk-op-session",
        }),
        store,
        github: unusedGithub(),
        wakeWorker: () => {
          wakes += 1;
        },
      });
      const customer = {
        cookie: `ns_session=${signSession("desk-op-session", await store.createSession("customer-1"))}`,
      };
      const researcherHeaders = {
        cookie: `ns_session=${signSession("desk-op-session", await store.createSession("researcher-1"))}`,
      };

      const unauth = await app.request("/api/internal/operators");
      expect(unauth.status).toBe(401);
      const customerOps = await app.request("/api/internal/operators", { headers: customer });
      expect(customerOps.status).toBe(401);
      const customerDesk = await app.request("/api/internal/prospects", { headers: customer });
      expect(customerDesk.status).toBe(401);
      const ungated = await app.request("/api/internal/prospects", { headers: researcherHeaders });
      expect(ungated.status).toBe(401);

      const missingConfirm = await app.request("/api/internal/operators", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({ githubLogin: "desk-researcher" }),
      });
      expect(missingConfirm.status).toBe(400);
      expect(((await missingConfirm.json()) as { error: string }).error).toBe(OPERATOR_CONFIRM_ERROR);

      const ownerLogin = await app.request("/api/internal/operators", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({ githubLogin: "EmotiveImpact", confirm: "EmotiveImpact" }),
      });
      expect(ownerLogin.status).toBe(400);
      expect(((await ownerLogin.json()) as { error: string }).error).toBe(OPERATOR_GRANT_ERROR);

      const before = wakes;
      const granted = await app.request("/api/internal/operators", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({ githubLogin: "desk-researcher", confirm: "desk-researcher" }),
      });
      expect(granted.status).toBe(201);
      const grantedBody = (await granted.json()) as {
        operator: { id: number; githubLogin: string };
      };
      expect(grantedBody.operator.githubLogin).toBe("desk-researcher");

      const duplicate = await app.request("/api/internal/operators", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({ githubLogin: "Desk-Researcher", confirm: "Desk-Researcher" }),
      });
      expect(duplicate.status).toBe(409);

      const listed = await app.request("/api/internal/operators", { headers: admin });
      expect(listed.status).toBe(200);
      const listedBody = (await listed.json()) as {
        operators: { githubLogin: string }[];
        policy: { timeTracking: boolean };
      };
      expect(listedBody.operators).toHaveLength(1);
      expect(listedBody.policy.timeTracking).toBe(false);

      const desk = await app.request("/api/internal/prospects", { headers: researcherHeaders });
      expect(desk.status).toBe(200);
      const deskBody = (await desk.json()) as {
        actor: { login: string; role: string };
        prospects: { package_name: string | null }[];
      };
      expect(deskBody.actor).toEqual({ login: "desk-researcher", role: "operator" });
      expect(deskBody.prospects[0]?.package_name).toBe("prettier");

      const queue = await app.request("/api/internal/queue", { headers: researcherHeaders });
      expect(queue.status).toBe(403);
      const queueBody = await queue.json();
      expect((queueBody as { error: string }).error).toBe(OPERATOR_OWNER_ERROR);
      expect(JSON.stringify(queueBody)).not.toMatch(/customerHeavyToday/);

      const grantAsOperator = await app.request("/api/internal/operators", {
        method: "POST",
        headers: { ...researcherHeaders, ...json },
        body: JSON.stringify({ githubLogin: "someone-else", confirm: "someone-else" }),
      });
      expect(grantAsOperator.status).toBe(403);

      const ownerDesk = await app.request("/api/internal/prospects", { headers: admin });
      expect(ownerDesk.status).toBe(200);
      expect(((await ownerDesk.json()) as { actor: { role: string } }).actor.role).toBe("owner");

      const deleted = await app.request(`/api/internal/operators/${grantedBody.operator.id}`, {
        method: "DELETE",
        headers: admin,
        body: JSON.stringify({ confirm: "desk-researcher" }),
      });
      expect(deleted.status).toBe(200);
      const empty = await app.request("/api/internal/operators", { headers: admin });
      expect(((await empty.json()) as { operators: unknown[] }).operators).toHaveLength(0);
      const revoked = await app.request("/api/internal/prospects", { headers: researcherHeaders });
      expect(revoked.status).toBe(401);
      expect(wakes).toBe(before);
    } finally {
      await sql.close();
    }
  });
});
