import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import {
  DISCLOSURE_DESTINATION_JIRA_ERROR,
  DISCLOSURE_DESTINATION_URL_ERROR,
  DISCLOSURE_NOTIFY_STATE_ERROR,
  disclosureDestinationPayload,
  disclosureWebhookTestPayload,
} from "../src/server/disclosure-destinations.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

const json = { "content-type": "application/json" };
const admin = { authorization: "Bearer desk-dest-admin", ...json };

const PRETTIER_FINDING = {
  rule: "MAP-001",
  severity: "critical" as const,
  path: "package/dist/index.js.map",
  title: "Source map ships in the artifact",
  detail: "SECRET_VALUE=AKIAIOSFODNN7EXAMPLE should never be stored.",
};

const CHECKLIST = {
  public_artifact: true,
  reproduced: true,
  fingerprints_recorded: true,
  no_secret_values: true,
  contact_or_policy: true,
};

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

describe("Disclosure Desk destinations", () => {
  it("keeps webhook/Jira owner-only, redacted, and never invents an incident", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "desk-dest-session" });
      const prospect = await store.upsertProspect({
        source: "npm",
        owner: "prettier",
        repo: "prettier",
        repositoryUrl: "https://github.com/prettier/prettier",
        packageName: "prettier",
        releaseTag: "3.9.6",
        artifactName: "prettier-3.9.6.tgz",
        artifactUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
      });
      await store.completeProspectScan(prospect.id, {
        fileCount: 2,
        findings: [PRETTIER_FINDING],
      });

      const posted: { url: string; body: string }[] = [];
      let wakes = 0;
      const app = createApp({
        config: loadConfig({
          adminToken: "desk-dest-admin",
          adminGithubLogin: "EmotiveImpact",
          sessionSecret: "desk-dest-session",
        }),
        store,
        github: unusedGithub(),
        wakeWorker: () => {
          wakes += 1;
        },
        webhookLookup: async () => [{ address: "1.1.1.1", family: 4 }],
        slackFetch: async (url, init) => {
          posted.push({ url: String(url), body: String(init?.body ?? "") });
          if (String(url).includes("/rest/api/3/issue")) {
            return new Response(JSON.stringify({ key: "SEC-1" }), { status: 201 });
          }
          return new Response("{}", { status: 200 });
        },
      });

      const unauth = await app.request("/api/internal/disclosure/destinations");
      expect(unauth.status).toBe(401);

      await store.upsertUser({ id: "u1", login: "octo" });
      const cookie = `ns_session=${signSession("desk-dest-session", await store.createSession("u1"))}`;
      const customer = await app.request("/api/internal/disclosure/destinations", {
        headers: { cookie },
      });
      expect(customer.status).toBe(401);

      const privateUrl = await app.request("/api/internal/disclosure/destinations/webhook", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          url: "https://127.0.0.1/hook",
          confirm: "127.0.0.1",
        }),
      });
      expect(privateUrl.status).toBe(400);
      expect(((await privateUrl.json()) as { error: string }).error).toBe(
        DISCLOSURE_DESTINATION_URL_ERROR,
      );

      const slackUrl = await app.request("/api/internal/disclosure/destinations/webhook", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          url: "https://hooks.slack.com/services/T000/B000/XXX",
          confirm: "hooks.slack.com",
        }),
      });
      expect(slackUrl.status).toBe(400);

      const missingConfirm = await app.request("/api/internal/disclosure/destinations/webhook", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({ url: "https://hooks.example.com/desk" }),
      });
      expect(missingConfirm.status).toBe(400);

      const saved = await app.request("/api/internal/disclosure/destinations/webhook", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          url: "https://hooks.example.com/desk?token=secret-hook",
          confirm: "hooks.example.com",
        }),
      });
      expect(saved.status).toBe(201);
      const savedBody = (await saved.json()) as {
        destination: { id: number; kind: string; host: string };
        sent: boolean;
      };
      expect(savedBody.sent).toBe(false);
      expect(savedBody.destination.kind).toBe("webhook");
      expect(savedBody.destination.host).toBe("hooks.example.com");
      expect(JSON.stringify(savedBody)).not.toContain("secret-hook");
      expect(JSON.stringify(savedBody)).not.toContain("token=");

      const listed = await app.request("/api/internal/disclosure/destinations", { headers: admin });
      expect(listed.status).toBe(200);
      const listBody = (await listed.json()) as {
        destinations: { id: number; host: string }[];
        policy: { sent: boolean; inventedIncident: boolean };
      };
      expect(listBody.policy).toEqual({ sent: false, inventedIncident: false });
      expect(listBody.destinations).toHaveLength(1);
      expect(JSON.stringify(listBody)).not.toContain("secret-hook");

      const tested = await app.request(
        `/api/internal/disclosure/destinations/${savedBody.destination.id}/test`,
        { method: "POST", headers: admin },
      );
      expect(tested.status).toBe(200);
      const testBody = (await tested.json()) as { ok: boolean; inventedIncident: boolean; sent: boolean };
      expect(testBody.ok).toBe(true);
      expect(testBody.inventedIncident).toBe(false);
      expect(testBody.sent).toBe(false);
      expect(posted[0]?.body).toContain("delivery test");
      expect(posted[0]?.body).not.toContain("secret-hook");

      const earlyNotify = await app.request(`/api/internal/prospects/${prospect.id}/disclosure/notify`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          destinationId: savedBody.destination.id,
          confirm: "prettier/prettier",
        }),
      });
      expect(earlyNotify.status).toBe(404);

      await app.request(`/api/internal/prospects/${prospect.id}/disclosure`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({}),
      });
      const unverified = await app.request(`/api/internal/prospects/${prospect.id}/disclosure/notify`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          destinationId: savedBody.destination.id,
          confirm: "prettier/prettier",
        }),
      });
      expect(unverified.status).toBe(409);
      expect(((await unverified.json()) as { error: string }).error).toBe(DISCLOSURE_NOTIFY_STATE_ERROR);

      await app.request(`/api/internal/prospects/${prospect.id}/disclosure`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({
          securityContact: "security@prettier.io",
          policyUrl: "https://github.com/prettier/prettier#security",
          checklist: CHECKLIST,
          notes: "Operator reproduction notes must not leave the desk.",
        }),
      });

      const mismatch = await app.request(`/api/internal/prospects/${prospect.id}/disclosure/notify`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          destinationId: savedBody.destination.id,
          confirm: "wrong/repo",
        }),
      });
      expect(mismatch.status).toBe(400);

      posted.length = 0;
      const filed = await app.request(`/api/internal/prospects/${prospect.id}/disclosure/notify`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          destinationId: savedBody.destination.id,
          confirm: "prettier/prettier",
        }),
      });
      expect(filed.status).toBe(200);
      const filedBody = (await filed.json()) as {
        ok: boolean;
        sent: boolean;
        inventedIncident: boolean;
      };
      expect(filedBody.ok).toBe(true);
      expect(filedBody.sent).toBe(false);
      expect(filedBody.inventedIncident).toBe(false);
      expect(posted[0]?.body).toContain("prettier/prettier");
      expect(posted[0]?.body).toContain("MAP-001");
      expect(posted[0]?.body).not.toContain("AKIA");
      expect(posted[0]?.body).not.toContain("Operator reproduction notes");
      expect(posted[0]?.body).not.toContain("security@prettier.io");
      expect(posted[0]?.body).not.toMatch(/timeTo|Ms|secret-hook/i);

      const desk = await app.request(`/api/internal/prospects/${prospect.id}/disclosure`, {
        headers: admin,
      });
      const deskBody = (await desk.json()) as { case: { events: { action: string; summary: string }[] } };
      expect(deskBody.case.events.some((row) => row.action === "destination.notify")).toBe(true);
      expect(JSON.stringify(deskBody)).not.toContain("secret-hook");

      const badJira = await app.request("/api/internal/disclosure/destinations/jira", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          site: "evil.example.com",
          email: "ops@example.com",
          token: "jira-token-value",
          projectKey: "SEC",
          confirm: "SEC",
        }),
      });
      expect(badJira.status).toBe(400);
      expect(((await badJira.json()) as { error: string }).error).toBe(DISCLOSURE_DESTINATION_JIRA_ERROR);

      const jira = await app.request("/api/internal/disclosure/destinations/jira", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          site: "emotiveimpact.atlassian.net",
          email: "ops@example.com",
          token: "jira-token-value",
          projectKey: "SEC",
          confirm: "SEC",
        }),
      });
      expect(jira.status).toBe(201);
      const jiraBody = (await jira.json()) as { destination: { id: number; kind: string; host: string } };
      expect(jiraBody.destination.kind).toBe("jira");
      expect(jiraBody.destination.host).toBe("emotiveimpact.atlassian.net");
      expect(JSON.stringify(jiraBody)).not.toContain("jira-token-value");
      expect(JSON.stringify(jiraBody)).not.toContain("ops@example.com");

      posted.length = 0;
      const jiraTest = await app.request(
        `/api/internal/disclosure/destinations/${jiraBody.destination.id}/test`,
        { method: "POST", headers: admin },
      );
      expect(jiraTest.status).toBe(200);
      expect(((await jiraTest.json()) as { inventedIncident: boolean }).inventedIncident).toBe(false);
      expect(posted.every((row) => !row.url.includes("/rest/api/3/issue"))).toBe(true);
      expect(posted.some((row) => row.url.includes("/rest/api/3/myself"))).toBe(true);

      posted.length = 0;
      const jiraFile = await app.request(`/api/internal/prospects/${prospect.id}/disclosure/notify`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          destinationId: jiraBody.destination.id,
          confirm: "prettier/prettier",
        }),
      });
      expect(jiraFile.status).toBe(200);
      expect(posted.some((row) => row.url.includes("/rest/api/3/issue"))).toBe(true);
      expect(posted.some((row) => row.body.includes("Disclosure Desk"))).toBe(true);
      expect(JSON.stringify(posted)).not.toContain("Operator reproduction notes");

      const deleted = await app.request(
        `/api/internal/disclosure/destinations/${savedBody.destination.id}`,
        {
          method: "DELETE",
          headers: admin,
          body: JSON.stringify({ confirm: "hooks.example.com" }),
        },
      );
      expect(deleted.status).toBe(200);
      const jiraDeleted = await app.request(
        `/api/internal/disclosure/destinations/${jiraBody.destination.id}`,
        {
          method: "DELETE",
          headers: admin,
          body: JSON.stringify({ confirm: "SEC" }),
        },
      );
      expect(jiraDeleted.status).toBe(200);
      const empty = await app.request("/api/internal/disclosure/destinations", { headers: admin });
      expect(((await empty.json()) as { destinations: unknown[] }).destinations).toEqual([]);
      expect(wakes).toBe(0);

      expect(disclosureWebhookTestPayload().inventedIncident).toBe(false);
      expect(
        JSON.stringify(
          disclosureDestinationPayload({
            sent: false,
            notesIncluded: false,
            attachmentBytesIncluded: false,
            coordinate: "prettier/prettier",
            packageName: "prettier",
            state: "verified",
            fingerprints: ["MAP-001|critical|package/dist/index.js.map|Source map ships in the artifact"],
            vendorChannel: "security_email",
            securityContact: "security@prettier.io",
            policyUrl: "https://github.com/prettier/prettier#security",
            assignee: "EmotiveImpact",
            reviewState: "approved",
            sla: {
              openedAt: "2026-09-01T00:00:00.000Z",
              verifiedAt: "2026-09-01T01:00:00.000Z",
              acknowledgedAt: null,
              deadlineAt: null,
              deadlineMissed: false,
              timeToVerifyMs: 3_600_000,
              timeToAckMs: null,
            },
            outcomes: { credit: null, cve: null, notes: null },
            replies: [],
            attachments: [],
            events: [],
          }),
        ),
      ).not.toMatch(/security@|timeTo|Ms/i);
    } finally {
      await sql.close();
    }
  });
});
