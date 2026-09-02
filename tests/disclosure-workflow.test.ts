import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import {
  DISCLOSURE_ATTACHMENT_KIND_ERROR,
  DISCLOSURE_REVIEW_ERROR,
  attachmentLooksPacked,
} from "../src/server/disclosure.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

const json = { "content-type": "application/json" };
const admin = { authorization: "Bearer desk3-admin-token", ...json };

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

describe("Disclosure Desk workflow helpers", () => {
  it("rejects packed attachment magic", () => {
    expect(attachmentLooksPacked(Buffer.from("PK\u0003\u0004hello"))).toBe(true);
    expect(attachmentLooksPacked(Buffer.from([0x1f, 0x8b, 0x08]))).toBe(true);
    expect(attachmentLooksPacked(Buffer.from("Vendor said they will ship 3.9.7.\n"))).toBe(false);
  });
});

describe("Disclosure Desk replies, review, and redacted reports", () => {
  it("records vendor replies and attachments, gates outreach on review, and redacts reports", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "desk3-session-secret" });
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

      const app = createApp({
        config: loadConfig({
          adminToken: "desk3-admin-token",
          adminGithubLogin: "EmotiveImpact",
          sessionSecret: "desk3-session-secret",
        }),
        store,
        github: unusedGithub(),
      });

      const unauth = await app.request(`/api/internal/prospects/${prospect.id}/disclosure/replies`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ channel: "security_email", summary: "Vendor replied by email." }),
      });
      expect(unauth.status).toBe(401);

      await store.upsertUser({ id: "u1", login: "octo" });
      const cookie = `ns_session=${signSession("desk3-session-secret", await store.createSession("u1"))}`;
      const customer = await app.request(`/api/internal/prospects/${prospect.id}/disclosure/report`, {
        headers: { cookie },
      });
      expect(customer.status).toBe(401);

      await app.request(`/api/internal/prospects/${prospect.id}/disclosure`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({}),
      });
      await app.request(`/api/internal/prospects/${prospect.id}/disclosure`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({
          securityContact: "security@prettier.io",
          policyUrl: "https://github.com/prettier/prettier#security",
          checklist: CHECKLIST,
          notes: "Operator reproduction notes must not appear in reports.",
        }),
      });

      const assigned = await app.request(`/api/internal/prospects/${prospect.id}/disclosure/assign`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({ assignee: "EmotiveImpact" }),
      });
      expect(assigned.status).toBe(200);
      const assignedBody = (await assigned.json()) as {
        case: { assignee: string; reviewState: string; sla: { verifiedAt: string | null } };
      };
      expect(assignedBody.case.assignee).toBe("EmotiveImpact");
      expect(assignedBody.case.reviewState).toBe("pending");
      expect(assignedBody.case.sla.verifiedAt).toBeTruthy();

      const earlyContact = await app.request(`/api/internal/prospects/${prospect.id}`, {
        method: "PATCH",
        headers: admin,
        body: JSON.stringify({ status: "contacted" }),
      });
      expect(earlyContact.status).toBe(409);
      expect(((await earlyContact.json()) as { error: string }).error).toBe(DISCLOSURE_REVIEW_ERROR);

      const reply = await app.request(`/api/internal/prospects/${prospect.id}/disclosure/replies`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          channel: "security_email",
          summary: "Vendor acknowledged the map finding and named 3.9.7.",
        }),
      });
      expect(reply.status).toBe(201);
      const replyBody = (await reply.json()) as { sent: boolean; case: { replies: { summary: string }[] } };
      expect(replyBody.sent).toBe(false);
      expect(replyBody.case.replies[0]?.summary).toContain("3.9.7");

      const note = Buffer.from("Vendor said they will ship 3.9.7.\n");
      const attached = await app.request(
        `/api/internal/prospects/${prospect.id}/disclosure/attachments`,
        {
          method: "POST",
          headers: admin,
          body: JSON.stringify({
            filename: "vendor-note.txt",
            mediaType: "text/plain",
            bytes: note.toString("base64"),
          }),
        },
      );
      expect(attached.status).toBe(201);
      const attachedBody = (await attached.json()) as {
        case: { attachments: { id: number; filename: string; byteLength: number }[] };
      };
      expect(attachedBody.case.attachments[0]?.filename).toBe("vendor-note.txt");
      expect(attachedBody.case.attachments[0]?.byteLength).toBe(note.length);

      const packed = await app.request(
        `/api/internal/prospects/${prospect.id}/disclosure/attachments`,
        {
          method: "POST",
          headers: admin,
          body: JSON.stringify({
            filename: "evil.tgz",
            mediaType: "text/plain",
            bytes: Buffer.from("PK\u0003\u0004packed").toString("base64"),
          }),
        },
      );
      expect(packed.status).toBe(400);
      expect(((await packed.json()) as { error: string }).error).toBe(DISCLOSURE_ATTACHMENT_KIND_ERROR);

      const download = await app.request(
        `/api/internal/prospects/${prospect.id}/disclosure/attachments/${attachedBody.case.attachments[0]?.id}`,
        { headers: admin },
      );
      expect(download.status).toBe(200);
      expect(await download.text()).toBe(note.toString());

      const reviewed = await app.request(`/api/internal/prospects/${prospect.id}/disclosure/review`, {
        method: "POST",
        headers: admin,
        body: JSON.stringify({
          decision: "approve",
          note: "Public prettier artifact is verified for outreach.",
        }),
      });
      expect(reviewed.status).toBe(200);

      const jsonReport = await app.request(
        `/api/internal/prospects/${prospect.id}/disclosure/report?format=json`,
        { headers: admin },
      );
      expect(jsonReport.status).toBe(200);
      const reportBody = (await jsonReport.json()) as {
        sent: boolean;
        report: {
          notesIncluded: boolean;
          attachmentBytesIncluded: boolean;
          coordinate: string;
          assignee: string;
          reviewState: string;
          replies: { summary: string }[];
          attachments: { filename: string }[];
        };
      };
      expect(reportBody.sent).toBe(false);
      expect(reportBody.report.notesIncluded).toBe(false);
      expect(reportBody.report.attachmentBytesIncluded).toBe(false);
      expect(reportBody.report.coordinate).toBe("prettier/prettier");
      expect(reportBody.report.assignee).toBe("EmotiveImpact");
      expect(reportBody.report.reviewState).toBe("approved");
      expect(reportBody.report.replies[0]?.summary).toContain("3.9.7");
      expect(reportBody.report.attachments[0]?.filename).toBe("vendor-note.txt");
      expect(JSON.stringify(reportBody)).not.toContain("AKIA");
      expect(JSON.stringify(reportBody)).not.toContain("Operator reproduction notes");
      expect(JSON.stringify(reportBody)).not.toContain(note.toString("base64"));

      const html = await app.request(
        `/api/internal/prospects/${prospect.id}/disclosure/report?format=html`,
        { headers: admin },
      );
      expect(html.status).toBe(200);
      const htmlText = await html.text();
      expect(htmlText).toContain("prettier/prettier");
      expect(htmlText).not.toContain("Operator reproduction notes");

      const pdf = await app.request(
        `/api/internal/prospects/${prospect.id}/disclosure/report?format=pdf`,
        { headers: admin },
      );
      expect(pdf.status).toBe(200);
      expect(pdf.headers.get("content-type")).toBe("application/pdf");
      const pdfBytes = Buffer.from(await pdf.arrayBuffer());
      expect(pdfBytes.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdfBytes.toString("latin1")).not.toContain("Operator reproduction notes");

      await expect(sql.query(`UPDATE disclosure_vendor_replies SET summary = 'x'`)).rejects.toThrow(
        /append-only/,
      );
      await expect(sql.query(`DELETE FROM disclosure_attachments`)).rejects.toThrow(/append-only/);
    } finally {
      await sql.close();
    }
  });
});
