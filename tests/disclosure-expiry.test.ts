import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { DISCLOSURE_ATTACHMENT_EXPIRED_ERROR } from "../src/server/disclosure.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore, signSession } from "../src/server/store.ts";

const json = { "content-type": "application/json" };
const admin = { authorization: "Bearer desk-expiry-admin", ...json };

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

describe("Disclosure Desk expired evidence sweep", () => {
  it("zeros expired attachment and notes ciphertext without deleting rows or waking work", async () => {
    const sql = await openSql("pglite://:memory:");
    try {
      await migrate(sql);
      const store = createStore(sql, { tokenSecret: "desk-expiry-session" });
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
          adminToken: "desk-expiry-admin",
          adminGithubLogin: "EmotiveImpact",
          sessionSecret: "desk-expiry-session",
        }),
        store,
        github: unusedGithub(),
      });

      await store.upsertUser({ id: "u1", login: "octo" });
      const cookie = `ns_session=${signSession("desk-expiry-session", await store.createSession("u1"))}`;
      const customer = await app.request("/api/internal/prospects", { headers: { cookie } });
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
          notes: "Operator notes that must be deleted after expiry.",
          notesExpiresInDays: 1,
        }),
      });

      const created = await store.getDisclosureCaseByProspect(prospect.id);
      if (!created) throw new Error("missing case");
      const live = await store.insertDisclosureAttachment({
        caseId: created.id,
        filename: "vendor-note.txt",
        mediaType: "text/plain",
        bytes: Buffer.from("Vendor said they will ship 3.9.7.\n"),
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        createdBy: "EmotiveImpact",
      });
      const expired = await store.insertDisclosureAttachment({
        caseId: created.id,
        filename: "expired-note.txt",
        mediaType: "text/plain",
        bytes: Buffer.from("This ciphertext must be deleted.\n"),
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        createdBy: "EmotiveImpact",
      });

      await sql.query(
        `UPDATE disclosure_cases SET notes_expires_at = now() - interval '1 hour' WHERE id = $1`,
        [created.id],
      );

      await expect(
        sql.query(`UPDATE disclosure_attachments SET filename = 'nope.txt' WHERE id = $1`, [
          expired.id,
        ]),
      ).rejects.toThrow(/append-only/);
      await expect(
        sql.query(`UPDATE disclosure_attachments SET ciphertext = '' WHERE id = $1`, [live.id]),
      ).rejects.toThrow(/append-only/);
      await expect(sql.query(`DELETE FROM disclosure_attachments WHERE id = $1`, [expired.id])).rejects.toThrow(
        /append-only/,
      );

      const beforeJobs = await sql.query<{ n: string }>(`SELECT count(*)::text AS n FROM jobs`);
      const listed = await app.request("/api/internal/prospects", { headers: admin });
      expect(listed.status).toBe(200);

      const { rows: after } = await sql.query<{
        id: string;
        filename: string;
        ciphertext: string;
        byte_length: number;
      }>(`SELECT id::text, filename, ciphertext, byte_length FROM disclosure_attachments ORDER BY id`);
      const liveRow = after.find((row) => Number(row.id) === live.id);
      const expiredRow = after.find((row) => Number(row.id) === expired.id);
      expect(liveRow?.ciphertext.length).toBeGreaterThan(0);
      expect(expiredRow?.ciphertext).toBe("");
      expect(expiredRow?.byte_length).toBeGreaterThan(0);

      const { rows: notes } = await sql.query<{ notes_ciphertext: string | null }>(
        `SELECT notes_ciphertext FROM disclosure_cases WHERE id = $1`,
        [created.id],
      );
      expect(notes[0]?.notes_ciphertext).toBeNull();

      const loaded = await app.request(`/api/internal/prospects/${prospect.id}/disclosure`, {
        headers: admin,
      });
      expect(loaded.status).toBe(200);
      const loadedBody = (await loaded.json()) as {
        case: {
          notes: string | null;
          notesExpired: boolean;
          attachments: Array<{ filename: string; expired: boolean; ciphertextDeleted: boolean }>;
          events: Array<{ action: string; summary: string }>;
        };
      };
      expect(loadedBody.case.notes).toBeNull();
      expect(loadedBody.case.notesExpired).toBe(true);
      const expiredView = loadedBody.case.attachments.find((row) => row.filename === "expired-note.txt");
      const liveView = loadedBody.case.attachments.find((row) => row.filename === "vendor-note.txt");
      expect(expiredView).toMatchObject({ expired: true, ciphertextDeleted: true });
      expect(liveView).toMatchObject({ expired: false, ciphertextDeleted: false });
      expect(loadedBody.case.events.some((row) => row.action === "attachment.expire")).toBe(true);
      expect(loadedBody.case.events.some((row) => row.action === "notes.expire")).toBe(true);
      expect(JSON.stringify(loadedBody)).not.toContain("This ciphertext must be deleted");
      expect(JSON.stringify(loadedBody)).not.toContain("Operator notes that must be deleted");

      const gone = await app.request(
        `/api/internal/prospects/${prospect.id}/disclosure/attachments/${expired.id}`,
        { headers: admin },
      );
      expect(gone.status).toBe(410);
      expect(((await gone.json()) as { error: string }).error).toBe(DISCLOSURE_ATTACHMENT_EXPIRED_ERROR);

      const kept = await app.request(
        `/api/internal/prospects/${prospect.id}/disclosure/attachments/${live.id}`,
        { headers: admin },
      );
      expect(kept.status).toBe(200);

      const afterJobs = await sql.query<{ n: string }>(`SELECT count(*)::text AS n FROM jobs`);
      expect(afterJobs.rows[0]?.n).toBe(beforeJobs.rows[0]?.n);

      const second = await store.sweepExpiredDisclosureEvidence();
      expect(second).toEqual({ attachments: 0, notes: 0 });

      await migrate(sql);
      await expect(
        sql.query(`UPDATE disclosure_attachments SET filename = 'nope.txt' WHERE id = $1`, [
          expired.id,
        ]),
      ).rejects.toThrow(/append-only/);
      const { rows: remigrated } = await sql.query<{ ciphertext: string }>(
        `SELECT ciphertext FROM disclosure_attachments WHERE id = $1`,
        [expired.id],
      );
      expect(remigrated[0]?.ciphertext).toBe("");
    } finally {
      await sql.close();
    }
  });
});
