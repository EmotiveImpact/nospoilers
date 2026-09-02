import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import {
  criticalFingerprints,
  notificationRules,
  notificationTitle,
} from "../src/server/internal-notify.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

const json = { "content-type": "application/json" };
const admin = { authorization: "Bearer notice-admin-token", ...json };

const CRITICAL = {
  rule: "MAP-001",
  severity: "critical" as const,
  path: "package/dist/app.js.map",
  title: "Source map ships in the artifact",
  detail: "SECRET_VALUE=AKIAIOSFODNN7EXAMPLE must not be copied.",
};

const WARN = {
  rule: "SIZE-001",
  severity: "warn" as const,
  path: "package/README.md",
  title: "Pack is large",
  detail: "another secret that must not be copied",
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

async function seed(
  store: ReturnType<typeof createStore>,
  input: {
    owner: string;
    repo: string;
    packageName: string;
    artifactUrl: string;
    findings: Array<typeof CRITICAL | typeof WARN>;
  },
) {
  const row = await store.upsertProspect({
    source: "npm",
    owner: input.owner,
    repo: input.repo,
    repositoryUrl: `https://github.com/${input.owner}/${input.repo}`,
    packageName: input.packageName,
    releaseTag: "1.0.0",
    artifactName: `${input.packageName}-1.0.0.tgz`,
    artifactUrl: input.artifactUrl,
  });
  await store.completeProspectScan(row.id, {
    fileCount: 2,
    findings: input.findings,
  });
  return row.id;
}

const CHECKLIST = {
  public_artifact: true,
  reproduced: true,
  fingerprints_recorded: true,
  no_secret_values: true,
  contact_or_policy: true,
};

describe("verified-critical notification helpers", () => {
  it("keeps only critical fingerprints and rule ids", () => {
    const fingerprints = [
      "MAP-001|critical|package/dist/app.js.map|Source map ships in the artifact",
      "SIZE-001|warn|package/README.md|Pack is large",
    ];
    expect(criticalFingerprints(fingerprints)).toEqual([fingerprints[0]]);
    expect(notificationRules(fingerprints)).toEqual(["MAP-001"]);
    expect(notificationTitle("prettier", "prettier")).toBe(
      "Verified critical findings in prettier/prettier",
    );
    expect(fingerprints[0]).not.toContain("AKIA");
  });
});

describe("verified-critical internal notifications", () => {
  it("notifies only after a verified critical case and never sends mail", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "notice-session" });
      const prettierId = await seed(store, {
        owner: "prettier",
        repo: "prettier",
        packageName: "prettier",
        artifactUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
        findings: [CRITICAL],
      });
      const warnId = await seed(store, {
        owner: "once",
        repo: "once",
        packageName: "once",
        artifactUrl: "https://registry.npmjs.org/once/-/once-1.4.0.tgz",
        findings: [WARN],
      });

      const app = createApp({
        config: loadConfig({
          adminToken: "notice-admin-token",
          adminGithubLogin: "EmotiveImpact",
          sessionSecret: "notice-session",
        }),
        store,
        github: unusedGithub(),
      });

      await store.upsertUser({ id: "customer-1", login: "acme-founder" });
      const customer = `ns_session=${signSession("notice-session", await store.createSession("customer-1"))}`;
      expect(
        (
          await app.request("/api/internal/notifications", {
            headers: { cookie: customer },
          })
        ).status,
      ).toBe(401);

      await store.completeProspectScan(prettierId, {
        fileCount: 2,
        findings: [CRITICAL],
      });
      const afterScan = await app.request("/api/internal/notifications", { headers: admin });
      expect(afterScan.status).toBe(200);
      expect(((await afterScan.json()) as { unread: number }).unread).toBe(0);

      await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({}),
      });
      const afterSignal = await app.request("/api/internal/notifications", { headers: admin });
      expect(((await afterSignal.json()) as { unread: number }).unread).toBe(0);

      await app.request(`/api/internal/prospects/${warnId}/disclosure`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({ confirmDuplicate: true }),
      });
      const warnVerified = await app.request(`/api/internal/prospects/${warnId}/disclosure`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({
          securityContact: "security@example.com",
          policyUrl: "https://github.com/once/once#security",
          checklist: CHECKLIST,
        }),
      });
      expect(warnVerified.status).toBe(200);
      expect(((await warnVerified.json()) as { case: { state: string } }).case.state).toBe(
        "verified",
      );
      expect(
        ((await (await app.request("/api/internal/notifications", { headers: admin })).json()) as {
          unread: number;
        }).unread,
      ).toBe(0);

      const verified = await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({
          securityContact: "security@prettier.io",
          policyUrl: "https://prettier.io/security",
          notes: "Do not copy SECRET_VALUE=AKIAIOSFODNN7EXAMPLE",
          checklist: CHECKLIST,
        }),
      });
      expect(verified.status).toBe(200);

      const listed = await app.request("/api/internal/notifications", { headers: admin });
      expect(listed.status).toBe(200);
      const listBody = (await listed.json()) as {
        unread: number;
        policy: { sent: boolean; unverified: boolean };
        notifications: {
          id: number;
          title: string;
          rules: string[];
          fingerprints: string[];
          readAt: string | null;
        }[];
      };
      expect(listBody.unread).toBe(1);
      expect(listBody.policy).toEqual({ sent: false, unverified: false });
      expect(listBody.notifications).toHaveLength(1);
      expect(listBody.notifications[0]?.title).toBe(
        "Verified critical findings in prettier/prettier",
      );
      expect(listBody.notifications[0]?.rules).toEqual(["MAP-001"]);
      expect(listBody.notifications[0]?.readAt).toBeNull();
      expect(JSON.stringify(listBody)).not.toContain("AKIA");
      expect(JSON.stringify(listBody)).not.toContain("SECRET_VALUE");
      expect(JSON.stringify(listBody)).not.toContain("notes_ciphertext");

      const again = await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({ state: "verifying" }),
      });
      expect(again.status).toBe(200);
      await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({ state: "verified", checklist: CHECKLIST }),
      });
      const stillOne = await app.request("/api/internal/notifications", { headers: admin });
      expect(((await stillOne.json()) as { notifications: unknown[] }).notifications).toHaveLength(
        1,
      );

      const desk = await app.request("/api/internal/prospects", { headers: admin });
      const deskBody = (await desk.json()) as {
        notifications: { unread: number; items: { title: string }[] };
        policy: { criticalNotifyUnverified: boolean; disclosureSend: boolean };
      };
      expect(deskBody.notifications.unread).toBe(1);
      expect(deskBody.notifications.items[0]?.title).toContain("prettier/prettier");
      expect(deskBody.policy.criticalNotifyUnverified).toBe(false);
      expect(deskBody.policy.disclosureSend).toBe(false);

      const read = await app.request(
        `/api/internal/notifications/${listBody.notifications[0]?.id}`,
        {
          method: "PATCH",
          headers: admin,
          body: JSON.stringify({ read: true }),
        },
      );
      expect(read.status).toBe(200);
      expect(
        ((await (await app.request("/api/internal/notifications", { headers: admin })).json()) as {
          unread: number;
        }).unread,
      ).toBe(0);
    } finally {
      await sql.close();
    }
  });
});
