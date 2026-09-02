import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import {
  DISCLOSURE_DNC_CREATE_ERROR,
  DISCLOSURE_DNC_ERROR,
  DISCLOSURE_SENT_ERROR,
  applyDisclosureTemplate,
  matchDoNotContact,
} from "../src/server/disclosure.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { deadlineMissedTitle } from "../src/server/internal-notify.ts";
import { hashArtifactBytes } from "../src/server/prospects.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

const SOURCEMAP_DIGESTS = hashArtifactBytes(readFileSync(path.resolve("fixtures/sourcemap.tgz")));
const REPRO_STEPS =
  "Downloaded the public npm tarball and confirmed the packed source map path from the scan fingerprints.";

const json = { "content-type": "application/json" };
const admin = { authorization: "Bearer desk2-admin-token", ...json };

const PRETTIER_FINDING = {
  rule: "MAP-001",
  severity: "critical" as const,
  path: "package/dist/index.js.map",
  title: "Source map ships in the artifact",
  detail: "SECRET_VALUE=AKIAIOSFODNN7EXAMPLE should never be stored.",
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

async function seedProspect(
  store: ReturnType<typeof createStore>,
  input: {
    owner: string;
    repo: string;
    packageName: string;
    artifactUrl: string;
    artifactName?: string;
    releaseTag?: string;
  },
) {
  const row = await store.upsertProspect({
    source: "npm",
    owner: input.owner,
    repo: input.repo,
    repositoryUrl: `https://github.com/${input.owner}/${input.repo}`,
    packageName: input.packageName,
    releaseTag: input.releaseTag ?? "1.0.0",
    artifactName: input.artifactName ?? `${input.packageName}-1.0.0.tgz`,
    artifactUrl: input.artifactUrl,
  });
  await store.completeProspectScan(row.id, {
    fileCount: 2,
    findings: [PRETTIER_FINDING],
    artifactSha256: SOURCEMAP_DIGESTS.sha256,
    artifactSha512: SOURCEMAP_DIGESTS.sha512,
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

describe("Disclosure Desk Phase 2 helpers", () => {
  it("substitutes template placeholders and matches do-not-contact keys", () => {
    const draft = applyDisclosureTemplate(
      {
        subject: "Findings in {{coordinate}} via {{channel}}",
        body: "Pack {{package}}\n{{fingerprints}}",
      },
      {
        coordinate: "prettier/prettier",
        package: "prettier 3.9.6",
        fingerprints: "- MAP-001|critical|package/dist/index.js.map|Source map ships in the artifact",
        channel: "security_email",
      },
    );
    expect(draft.sent).toBe(false);
    expect(draft.subject).toBe("Findings in prettier/prettier via security_email");
    expect(draft.body).toContain("prettier 3.9.6");
    expect(draft.body).not.toContain("AKIA");
    expect(deadlineMissedTitle("prettier", "prettier")).toBe(
      "Disclosure deadline missed for prettier/prettier",
    );
    expect(
      matchDoNotContact(
        [
          {
            id: 1,
            owner: "Prettier",
            repo: "prettier",
            package_name: "prettier",
            contact: "security@prettier.io",
            reason: "Maintainer asked for no further mail.",
            created_by: "EmotiveImpact",
            created_at: new Date().toISOString(),
          },
        ],
        {
          owner: "prettier",
          repo: "prettier",
          packageName: "prettier",
          securityContact: "security@prettier.io",
        },
      ).map((row) => row.reasons),
    ).toEqual([["owner_repo", "package", "contact", "domain"]]);
  });
});

describe("Disclosure Desk Phase 2 minus send", () => {
  it("enforces templates, do-not-contact, outcomes, and internal deadline reminders", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "desk2-session-secret" });
      const prettierId = await seedProspect(store, {
        owner: "prettier",
        repo: "prettier",
        packageName: "prettier",
        artifactUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
        artifactName: "prettier-3.9.6.tgz",
        releaseTag: "3.9.6",
      });
      const onceId = await seedProspect(store, {
        owner: "once",
        repo: "once",
        packageName: "once",
        artifactUrl: "https://registry.npmjs.org/once/-/once-1.4.0.tgz",
      });
      const leftPadId = await seedProspect(store, {
        owner: "stevemao",
        repo: "left-pad",
        packageName: "left-pad",
        artifactUrl: "https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz",
        artifactName: "left-pad-1.3.0.tgz",
        releaseTag: "1.3.0",
      });

      const app = createApp({
        config: loadConfig({
          adminToken: "desk2-admin-token",
          adminGithubLogin: "EmotiveImpact",
          sessionSecret: "desk2-session-secret",
        }),
        store,
        github: unusedGithub(),
      });

      await store.upsertUser({ id: "customer-1", login: "acme-founder" });
      const customer = `ns_session=${signSession("desk2-session-secret", await store.createSession("customer-1"))}`;
      expect(
        (await app.request("/api/internal/disclosure/templates", { headers: { cookie: customer } }))
          .status,
      ).toBe(401);
      expect(
        (
          await app.request("/api/internal/disclosure/do-not-contact", {
            headers: { cookie: customer },
          })
        ).status,
      ).toBe(401);

      const listedTemplates = await app.request("/api/internal/disclosure/templates", {
        headers: admin,
      });
      expect(listedTemplates.status).toBe(200);
      const seeded = (await listedTemplates.json()) as {
        templates: { id: number; name: string }[];
        policy: { sent: boolean };
      };
      expect(seeded.policy.sent).toBe(false);
      expect(seeded.templates.some((row) => row.name === "standard")).toBe(true);

      const createdTemplate = await app.request("/api/internal/disclosure/templates", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          name: "researcher-note",
          subject: "Private note for {{coordinate}}",
          body: "Channel {{channel}} for {{package}}\n{{fingerprints}}\nNothing mailed.",
        }),
      });
      expect(createdTemplate.status).toBe(201);
      const templateId = ((await createdTemplate.json()) as { template: { id: number } }).template.id;

      const opened = await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({}),
      });
      expect(opened.status).toBe(201);

      const verified = await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({
          securityContact: "security@prettier.io",
          policyUrl: "https://prettier.io/security",
          vendorChannel: "security_email",
          outcomeCredit: "Hall of thanks",
          outcomeCve: "pending",
          outcomeNotes: "No bounty. Credit only if they want it.",
          reproducibilitySteps: REPRO_STEPS,
          checklist: CHECKLIST,
        }),
      });
      expect(verified.status).toBe(200);
      const verifiedBody = (await verified.json()) as {
        case: {
          state: string;
          vendorChannel: string;
          outcomeCredit: string;
          outcomeCve: string;
          sent: boolean;
        };
      };
      expect(verifiedBody.case.state).toBe("verified");
      expect(verifiedBody.case.vendorChannel).toBe("security_email");
      expect(verifiedBody.case.outcomeCredit).toBe("Hall of thanks");
      expect(verifiedBody.case.outcomeCve).toBe("pending");
      expect(verifiedBody.case.sent).toBe(false);

      const sendBlocked = await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({ sent: true }),
      });
      expect(sendBlocked.status).toBe(400);
      expect(((await sendBlocked.json()) as { error: string }).error).toBe(DISCLOSURE_SENT_ERROR);

      const builtIn = await app.request(
        `/api/internal/prospects/${prettierId}/disclosure/preview`,
        { method: "POST", headers: admin, body: JSON.stringify({}) },
      );
      expect(builtIn.status).toBe(200);
      const builtInBody = (await builtIn.json()) as {
        sent: boolean;
        body: string;
        recipients: string[];
        channel: string;
        templateId: number | null;
      };
      expect(builtInBody.sent).toBe(false);
      expect(builtInBody.templateId).toBeNull();
      expect(builtInBody.channel).toBe("security_email");
      expect(builtInBody.recipients).toEqual(["security@prettier.io"]);
      expect(builtInBody.body).toContain("Nothing has been sent");
      expect(JSON.stringify(builtInBody)).not.toContain("AKIA");

      const templated = await app.request(
        `/api/internal/prospects/${prettierId}/disclosure/preview`,
        {
          method: "POST",
          headers: admin,
          body: JSON.stringify({ templateId }),
        },
      );
      expect(templated.status).toBe(200);
      const templatedBody = (await templated.json()) as {
        subject: string;
        body: string;
        sent: boolean;
        templateId: number;
      };
      expect(templatedBody.sent).toBe(false);
      expect(templatedBody.templateId).toBe(templateId);
      expect(templatedBody.subject).toBe("Private note for prettier/prettier");
      expect(templatedBody.body).toContain("Channel security_email for prettier 3.9.6");
      expect(templatedBody.body).toContain("MAP-001|critical|");
      expect(templatedBody.body).not.toContain("AKIA");

      const dnc = await app.request("/api/internal/disclosure/do-not-contact", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          owner: "prettier",
          repo: "prettier",
          reason: "Maintainer asked for no further mail.",
        }),
      });
      expect(dnc.status).toBe(201);

      const contacted = await app.request(`/api/internal/prospects/${prettierId}`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({ status: "contacted" }),
      });
      expect(contacted.status).toBe(409);
      const contactedBody = (await contacted.json()) as {
        error: string;
        dnc: { reasons: string[] }[];
      };
      expect(contactedBody.error).toBe(DISCLOSURE_DNC_ERROR);
      expect(contactedBody.dnc[0]?.reasons).toContain("owner_repo");

      const onceDnc = await app.request("/api/internal/disclosure/do-not-contact", {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          packageName: "once",
          reason: "Package requested no contact.",
        }),
      });
      expect(onceDnc.status).toBe(201);

      const blockedCreate = await app.request(`/api/internal/prospects/${onceId}/disclosure`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({}),
      });
      expect(blockedCreate.status).toBe(409);
      expect(((await blockedCreate.json()) as { error: string }).error).toBe(
        DISCLOSURE_DNC_CREATE_ERROR,
      );

      const research = await app.request(`/api/internal/prospects/${onceId}/disclosure`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({ confirmDuplicate: true, researchOnly: true }),
      });
      expect(research.status).toBe(201);

      await app.request(`/api/internal/prospects/${onceId}/disclosure`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({
          securityContact: "security@example.com",
          policyUrl: "https://github.com/once/once#security",
          reproducibilitySteps: REPRO_STEPS,
          checklist: CHECKLIST,
        }),
      });
      const researchContact = await app.request(`/api/internal/prospects/${onceId}`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({ status: "contacted" }),
      });
      expect(researchContact.status).toBe(409);
      expect(((await researchContact.json()) as { error: string }).error).toBe(DISCLOSURE_DNC_ERROR);

      const leftPadCase = await app.request(`/api/internal/prospects/${leftPadId}/disclosure`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({ confirmDuplicate: true }),
      });
      expect(leftPadCase.status).toBe(201);
      const missed = await app.request(`/api/internal/prospects/${leftPadId}/disclosure`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({ deadlineAt: "2000-01-01T00:00:00.000Z" }),
      });
      expect(missed.status).toBe(200);
      expect(
        ((await missed.json()) as { case: { deadlineMissed: boolean } }).case.deadlineMissed,
      ).toBe(true);

      const notices = await app.request("/api/internal/notifications", { headers: admin });
      expect(notices.status).toBe(200);
      const noticeBody = (await notices.json()) as {
        unread: number;
        policy: { sent: boolean };
        notifications: { kind: string; title: string; rules: string[] }[];
      };
      expect(noticeBody.policy.sent).toBe(false);
      const deadlineNotice = noticeBody.notifications.find((row) => row.kind === "deadline_missed");
      expect(deadlineNotice?.title).toBe("Disclosure deadline missed for stevemao/left-pad");
      expect(deadlineNotice?.rules).toEqual([]);
      expect(JSON.stringify(noticeBody)).not.toContain("AKIA");

      const again = await app.request("/api/internal/prospects", { headers: admin });
      const againBody = (await again.json()) as {
        policy: { disclosureSend: boolean; doNotContactEnforced: boolean };
        notifications: { items: { kind: string; title: string }[] };
      };
      expect(againBody.policy.disclosureSend).toBe(false);
      expect(againBody.policy.doNotContactEnforced).toBe(true);
      expect(
        againBody.notifications.items.filter((row) => row.kind === "deadline_missed"),
      ).toHaveLength(1);
    } finally {
      await sql.close();
    }
  });
});
