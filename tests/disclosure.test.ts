import { describe, expect, it } from "vitest";
import { findingFingerprint } from "../src/receipt.ts";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import {
  DISCLOSURE_CONTACTED_ERROR,
  DISCLOSURE_DUPLICATE_ERROR,
  DISCLOSURE_FIXED_ERROR,
  DISCLOSURE_REVIEW_ERROR,
  DISCLOSURE_SENT_ERROR,
  DISCLOSURE_VERIFIED_ERROR,
  fingerprintsFromFindings,
  matchDoNotContact,
  matchDuplicateReasons,
  ownerMatchesVendorHost,
  parsePolicyUrl,
  previewDisclosureDraft,
  vendorHostFromContact,
  vendorHostFromPolicyUrl,
} from "../src/server/disclosure.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

const json = { "content-type": "application/json" };
const admin = { authorization: "Bearer desk-admin-token", ...json };

const PRETTIER_FINDING = {
  rule: "MAP-001",
  severity: "critical" as const,
  path: "package/dist/index.js.map",
  title: "Source map ships in the artifact",
  detail: "SECRET_VALUE=AKIAIOSFODNN7EXAMPLE should never be stored.",
};

const LEFT_PAD_FINDING = {
  rule: "MAP-001",
  severity: "critical" as const,
  path: "package/dist/index.js.map",
  title: "Source map ships in the artifact",
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
    releaseTag: input.releaseTag ?? "3.9.6",
    artifactName: input.artifactName ?? `${input.packageName}-3.9.6.tgz`,
    artifactUrl: input.artifactUrl,
  });
  await store.completeProspectScan(row.id, {
    fileCount: 2,
    findings: [PRETTIER_FINDING],
  });
  return row.id;
}

describe("Disclosure Desk helpers", () => {
  it("fingerprints omit finding values and policy URLs are stored never fetched", () => {
    const fingerprints = fingerprintsFromFindings([PRETTIER_FINDING]);
    expect(fingerprints).toEqual([findingFingerprint({ ...PRETTIER_FINDING, detail: "" })]);
    expect(fingerprints.join(" ")).not.toContain("AKIA");
    expect(fingerprints.join(" ")).not.toContain("SECRET_VALUE");
    expect(parsePolicyUrl("https://prettier.io/security")).toBe("https://prettier.io/security");
    expect(() => parsePolicyUrl("http://prettier.io/security")).toThrow(/https/);
    expect(() => parsePolicyUrl("https://localhost/security")).toThrow(/not allowed/);
    expect(() => parsePolicyUrl("https://127.0.0.1/security")).toThrow(/not allowed/);
    expect(
      matchDuplicateReasons(
        {
          owner: "prettier",
          repo: "prettier",
          packageName: "prettier",
          fingerprints,
        },
        {
          owner: "prettier",
          repo: "prettier",
          packageName: "prettier",
          fingerprints,
        },
      ),
    ).toEqual(["owner_repo", "package", "fingerprint"]);
    expect(
      matchDuplicateReasons(
        {
          owner: "prettier",
          repo: "prettier",
          packageName: "prettier",
          fingerprints,
          policyUrl: "https://prettier.io/security",
        },
        {
          owner: "prettier",
          repo: "eslint-plugin-prettier",
          packageName: "eslint-plugin-prettier",
          fingerprints: [],
        },
      ),
    ).toEqual(["organization", "domain"]);
    expect(
      matchDuplicateReasons(
        {
          owner: "stevemao",
          repo: "left-pad",
          packageName: "left-pad",
          fingerprints: [],
          securityContact: "security@left-pad.example",
        },
        {
          owner: "prettier",
          repo: "prettier",
          packageName: "prettier",
          fingerprints,
          policyUrl: "https://prettier.io/security",
        },
      ),
    ).toEqual([]);
    expect(vendorHostFromPolicyUrl("https://www.prettier.io/security")).toBe("prettier.io");
    expect(vendorHostFromPolicyUrl("https://github.com/prettier/prettier")).toBeNull();
    expect(vendorHostFromContact("security@prettier.io")).toBe("prettier.io");
    expect(vendorHostFromContact("prettier.io")).toBe("prettier.io");
    expect(ownerMatchesVendorHost("prettier", "prettier.io")).toBe(true);
    expect(ownerMatchesVendorHost("stevemao", "prettier.io")).toBe(false);
    expect(
      matchDoNotContact(
        [
          {
            id: 1,
            owner: null,
            repo: null,
            package_name: null,
            contact: "prettier.io",
            reason: "Vendor domain is do-not-contact.",
            created_by: "EmotiveImpact",
            created_at: new Date().toISOString(),
          },
        ],
        {
          owner: "prettier",
          repo: "eslint-plugin-prettier",
          packageName: "eslint-plugin-prettier",
          securityContact: null,
          policyUrl: "https://prettier.io/security",
        },
      ).map((row) => row.reasons),
    ).toEqual([["domain"]]);
    const draft = previewDisclosureDraft(
      {
        owner: "prettier",
        repo: "prettier",
        package_name: "prettier",
        artifact_name: "prettier-3.9.6.tgz",
        release_tag: "3.9.6",
        source: "npm",
      },
      fingerprints,
    );
    expect(draft.sent).toBe(false);
    expect(draft.body).toContain("Nothing has been sent");
    expect(draft.body).not.toContain("AKIA");
  });
});

describe("Disclosure Desk Phase 1", () => {
  it("verifies a public artifact, blocks outreach, detects duplicates, and never sends mail", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "desk-session-secret" });
      const prettierId = await seedProspect(store, {
        owner: "prettier",
        repo: "prettier",
        packageName: "prettier",
        artifactUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
      });
      const leftPadId = await seedProspect(store, {
        owner: "left-pad",
        repo: "left-pad",
        packageName: "left-pad",
        artifactUrl: "https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz",
        artifactName: "left-pad-1.3.0.tgz",
        releaseTag: "1.3.0",
      });
      await store.completeProspectScan(leftPadId, {
        fileCount: 1,
        findings: [LEFT_PAD_FINDING],
      });
      const prettierAgain = await seedProspect(store, {
        owner: "prettier",
        repo: "prettier",
        packageName: "prettier",
        artifactUrl: "https://registry.npmjs.org/prettier/-/prettier-3.8.0.tgz",
        artifactName: "prettier-3.8.0.tgz",
        releaseTag: "3.8.0",
      });

      const app = createApp({
        config: loadConfig({
          adminToken: "desk-admin-token",
          adminGithubLogin: "EmotiveImpact",
          sessionSecret: "desk-session-secret",
        }),
        store,
        github: unusedGithub(),
      });

      await store.upsertUser({ id: "customer-1", login: "acme-founder" });
      const customer = `ns_session=${signSession("desk-session-secret", await store.createSession("customer-1"))}`;
      const customerGet = await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        headers: { cookie: customer },
      });
      expect(customerGet.status).toBe(401);

      const anonymous = await app.request(`/api/internal/prospects/${prettierId}/disclosure`);
      expect(anonymous.status).toBe(401);

      const missing = await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        headers: admin,
      });
      expect(missing.status).toBe(404);

      const contactedEarly = await app.request(`/api/internal/prospects/${prettierId}`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({ status: "contacted" }),
      });
      expect(contactedEarly.status).toBe(409);
      expect(((await contactedEarly.json()) as { error: string }).error).toBe(
        DISCLOSURE_CONTACTED_ERROR,
      );

      const created = await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({}),
      });
      expect(created.status).toBe(201);
      const createdBody = (await created.json()) as {
        case: {
          state: string;
          fingerprints: string[];
          sent: boolean;
          notes: string | null;
        };
      };
      expect(createdBody.case.state).toBe("signal");
      expect(createdBody.case.sent).toBe(false);
      expect(createdBody.case.fingerprints.join(" ")).not.toContain("AKIA");
      expect(JSON.stringify(createdBody)).not.toContain("AKIA");
      expect(JSON.stringify(createdBody)).not.toContain("notes_ciphertext");

      const duplicateFp = await app.request(`/api/internal/prospects/${leftPadId}/disclosure`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({}),
      });
      expect(duplicateFp.status).toBe(409);
      const duplicateFpBody = (await duplicateFp.json()) as {
        error: string;
        duplicates: { reasons: string[]; packageName: string | null }[];
      };
      expect(duplicateFpBody.error).toBe(DISCLOSURE_DUPLICATE_ERROR);
      expect(duplicateFpBody.duplicates.some((row) => row.reasons.includes("fingerprint"))).toBe(
        true,
      );

      const confirmedLeftPad = await app.request(`/api/internal/prospects/${leftPadId}/disclosure`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({ confirmDuplicate: true }),
      });
      expect(confirmedLeftPad.status).toBe(201);

      const duplicateCompany = await app.request(
        `/api/internal/prospects/${prettierAgain}/disclosure`,
        { method: "POST", headers: admin, body: JSON.stringify({}) },
      );
      expect(duplicateCompany.status).toBe(409);
      const duplicateCompanyBody = (await duplicateCompany.json()) as {
        duplicates: { reasons: string[] }[];
      };
      expect(duplicateCompanyBody.duplicates[0]?.reasons).toEqual(
        expect.arrayContaining(["owner_repo", "package"]),
      );

      const verifiedTooSoon = await app.request(
        `/api/internal/prospects/${prettierId}/disclosure`,
        {
          method: "PATCH",
          headers: admin,
          body: JSON.stringify({ state: "verified" }),
        },
      );
      expect(verifiedTooSoon.status).toBe(400);
      expect(((await verifiedTooSoon.json()) as { error: string }).error).toBe(
        DISCLOSURE_VERIFIED_ERROR,
      );

      const contactNeeded = await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({ checklist: { contact_or_policy: true } }),
      });
      expect(contactNeeded.status).toBe(400);

      const savedContact = await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({
          securityContact: "security@prettier.io",
          policyUrl: "https://prettier.io/security?token=secret",
          notes: "Operator reproduction notes. No secret values.",
          notesExpiresInDays: 30,
          checklist: {
            public_artifact: true,
            reproduced: true,
            fingerprints_recorded: true,
            no_secret_values: true,
            contact_or_policy: true,
          },
        }),
      });
      expect(savedContact.status).toBe(200);
      const saved = (await savedContact.json()) as {
        case: {
          state: string;
          policyUrl: string | null;
          notes: string | null;
          sent: boolean;
        };
      };
      expect(saved.case.state).toBe("verified");
      expect(saved.case.policyUrl).toBe("https://prettier.io/security");
      expect(saved.case.notes).toBe("Operator reproduction notes. No secret values.");
      expect(saved.case.sent).toBe(false);
      expect(JSON.stringify(saved)).not.toContain("token=secret");
      expect(JSON.stringify(saved)).not.toContain("ns1.");

      const sendBlocked = await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({ sent: true }),
      });
      expect(sendBlocked.status).toBe(400);
      expect(((await sendBlocked.json()) as { error: string }).error).toBe(DISCLOSURE_SENT_ERROR);

      const preview = await app.request(
        `/api/internal/prospects/${prettierId}/disclosure/preview`,
        { method: "POST", headers: admin },
      );
      expect(preview.status).toBe(200);
      const previewBody = (await preview.json()) as {
        subject: string;
        body: string;
        sent: boolean;
      };
      expect(previewBody.sent).toBe(false);
      expect(previewBody.subject).toContain("prettier/prettier");
      expect(previewBody.body).toContain("Nothing has been sent");
      expect(previewBody.body).not.toContain("AKIA");

      const ack = await app.request(
        `/api/internal/prospects/${prettierId}/disclosure/acknowledge`,
        {
          method: "POST",
          headers: admin,
          body: JSON.stringify({ note: "Maintainer replied in the simulated inbox." }),
        },
      );
      expect(ack.status).toBe(200);
      const ackBody = (await ack.json()) as { sent: boolean; case: { acknowledgedAt: string } };
      expect(ackBody.sent).toBe(false);
      expect(ackBody.case.acknowledgedAt).toBeTruthy();

      const deadline = await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({
          deadlineAt: "2000-01-01T00:00:00.000Z",
          conversion: "trial",
        }),
      });
      expect(deadline.status).toBe(200);
      const deadlineBody = (await deadline.json()) as {
        case: { deadlineMissed: boolean; conversion: string };
      };
      expect(deadlineBody.case.deadlineMissed).toBe(false);
      expect(deadlineBody.case.conversion).toBe("trial");

      const missed = await sql.query(
        `UPDATE disclosure_cases
         SET acknowledged_at = NULL, acknowledgement_note = NULL
         WHERE prospect_id = $1`,
        [prettierId],
      );
      expect(missed.rows).toEqual([]);
      const missedGet = await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        headers: admin,
      });
      expect(
        ((await missedGet.json()) as { case: { deadlineMissed: boolean } }).case.deadlineMissed,
      ).toBe(true);

      const fixedEarly = await app.request(`/api/internal/prospects/${prettierId}`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({ status: "fixed" }),
      });
      expect(fixedEarly.status).toBe(409);
      expect(((await fixedEarly.json()) as { error: string }).error).toBe(DISCLOSURE_FIXED_ERROR);

      const rescan = await app.request(
        `/api/internal/prospects/${prettierId}/disclosure/rescan`,
        {
          method: "POST",
          headers: admin,
          body: JSON.stringify({ fixVersion: "3.9.7" }),
        },
      );
      expect(rescan.status).toBe(200);
      const rescanBody = (await rescan.json()) as {
        sent: boolean;
        case: { fixVersion: string; lastRescanAt: string };
      };
      expect(rescanBody.sent).toBe(false);
      expect(rescanBody.case.fixVersion).toBe("3.9.7");
      expect(rescanBody.case.lastRescanAt).toBeTruthy();

      const unreviewed = await app.request(`/api/internal/prospects/${prettierId}`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({ status: "contacted" }),
      });
      expect(unreviewed.status).toBe(409);
      expect(((await unreviewed.json()) as { error: string }).error).toBe(DISCLOSURE_REVIEW_ERROR);

      const reviewed = await app.request(`/api/internal/prospects/${prettierId}/disclosure/review`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({ decision: "approve", note: "Public artifact verified for outreach." }),
      });
      expect(reviewed.status).toBe(200);

      const contacted = await app.request(`/api/internal/prospects/${prettierId}`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({ status: "contacted" }),
      });
      expect(contacted.status).toBe(200);

      const fixed = await app.request(`/api/internal/prospects/${prettierId}`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({ status: "fixed" }),
      });
      expect(fixed.status).toBe(200);

      const listed = await app.request("/api/internal/prospects", { headers: admin });
      expect(listed.status).toBe(200);
      const listBody = (await listed.json()) as {
        policy: { disclosureSend: boolean; outreachAutomatic: boolean };
        prospects: { id: number; disclosure: { state: string } | null }[];
      };
      expect(listBody.policy.disclosureSend).toBe(false);
      expect(listBody.policy.outreachAutomatic).toBe(false);
      expect(listBody.prospects.find((row) => row.id === prettierId)?.disclosure?.state).toBe(
        "verified",
      );

      await sql.query(
        `UPDATE disclosure_cases SET notes_expires_at = now() - interval '1 hour' WHERE prospect_id = $1`,
        [prettierId],
      );
      const expired = await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        headers: admin,
      });
      const expiredBody = (await expired.json()) as {
        case: { notes: string | null; notesExpired: boolean };
      };
      expect(expiredBody.case.notes).toBeNull();
      expect(expiredBody.case.notesExpired).toBe(true);
      expect(JSON.stringify(expiredBody)).not.toContain("Operator reproduction notes");

      await expect(sql.query(`UPDATE disclosure_events SET summary = 'mutated'`)).rejects.toThrow(
        /append-only/,
      );
      await expect(sql.query(`DELETE FROM disclosure_events`)).rejects.toThrow(/append-only/);

      const ungated = await store.updateProspectStatus(leftPadId, "contacted");
      expect(ungated?.status).toBe("contacted");
    } finally {
      await sql.close();
    }
  });
});

describe("Disclosure Desk organization and domain matching", () => {
  it("warns on the same GitHub owner or vendor domain and does not wake the worker", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "desk-domain-session" });
      let wakes = 0;
      const prettierId = await seedProspect(store, {
        owner: "prettier",
        repo: "prettier",
        packageName: "prettier",
        artifactUrl: "https://registry.npmjs.org/prettier/-/prettier-3.9.6.tgz",
      });
      const pluginId = await seedProspect(store, {
        owner: "prettier",
        repo: "eslint-plugin-prettier",
        packageName: "eslint-plugin-prettier",
        artifactUrl: "https://registry.npmjs.org/eslint-plugin-prettier/-/eslint-plugin-prettier-5.0.0.tgz",
        artifactName: "eslint-plugin-prettier-5.0.0.tgz",
        releaseTag: "5.0.0",
      });
      await store.completeProspectScan(pluginId, {
        fileCount: 1,
        findings: [
          {
            rule: "SEC-003",
            severity: "critical",
            path: "package/token.json",
            title: "Provider token material",
            detail: "must not be stored",
          },
        ],
      });
      const unrelatedId = await seedProspect(store, {
        owner: "stevemao",
        repo: "left-pad",
        packageName: "left-pad",
        artifactUrl: "https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz",
        artifactName: "left-pad-1.3.0.tgz",
        releaseTag: "1.3.0",
      });
      await store.completeProspectScan(unrelatedId, {
        fileCount: 1,
        findings: [
          {
            rule: "SIZE-001",
            severity: "warn",
            path: "package/index.js",
            title: "Unusually large packed file",
            detail: "must not be stored",
          },
        ],
      });
      const app = createApp({
        config: loadConfig({
          adminToken: "desk-admin-token",
          adminGithubLogin: "EmotiveImpact",
          sessionSecret: "desk-domain-session",
        }),
        store,
        github: unusedGithub(),
        wakeWorker: () => {
          wakes += 1;
        },
      });
      const before = wakes;
      const created = await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({}),
      });
      expect(created.status).toBe(201);
      const policy = await app.request(`/api/internal/prospects/${prettierId}/disclosure`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({ policyUrl: "https://prettier.io/security" }),
      });
      expect(policy.status).toBe(200);
      const orgDup = await app.request(`/api/internal/prospects/${pluginId}/disclosure`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({}),
      });
      expect(orgDup.status).toBe(409);
      const orgBody = (await orgDup.json()) as { duplicates: { reasons: string[] }[] };
      expect(orgBody.duplicates[0]?.reasons).toEqual(
        expect.arrayContaining(["organization", "domain"]),
      );
      expect(orgBody.duplicates[0]?.reasons).not.toContain("owner_repo");
      expect(orgBody.duplicates[0]?.reasons).not.toContain("fingerprint");
      const unrelated = await app.request(`/api/internal/prospects/${unrelatedId}/disclosure`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({}),
      });
      expect(unrelated.status).toBe(201);
      expect(wakes).toBe(before);
    } finally {
      await sql.close();
    }
  });
});
