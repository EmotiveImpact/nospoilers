/**
 * Close the loop on fix pull requests: when the next release of the same
 * repository is scanned and none of the targeted findings come back, the fix is
 * "verified closed" and the original alert is resolved with that evidence.
 *
 * Verification is driven only by fresh scanner output. An inconclusive scan
 * proves nothing and is ignored. Merging a pull request on its own never closes
 * an alert.
 */
import type { Finding, ScanStatus } from "../scanner/types.ts";
import type { SqlClient } from "./sql.ts";
import { fixStillPresent, type FixTarget } from "./fix-pr.ts";

export const VERIFIER_LOGIN = "nospoilers";

export type FixVerification = { fixId: number; alertId: number; outcome: "verified_closed" | "still_present" };

export async function verifyFixesAfterReleaseScan(
  sql: SqlClient,
  input: { repoId: number; tag: string; status: ScanStatus; findings: Finding[]; alertId: number | null },
): Promise<FixVerification[]> {
  if (input.status === "inconclusive") return [];
  const open = await sql.query<{ id: string; alert_id: string; targets: unknown; last_checked_tag: string | null }>(
    `SELECT id,alert_id,targets,last_checked_tag FROM alert_fix_prs
     WHERE repo_id=$1 AND state<>'verified_closed' AND ($2::bigint IS NULL OR alert_id<>$2) ORDER BY id`,
    [input.repoId, input.alertId],
  );
  const results: FixVerification[] = [];
  for (const row of open.rows) {
    const targets = (typeof row.targets === "string" ? JSON.parse(row.targets) : row.targets) as FixTarget[];
    const fixId = Number(row.id);
    const alertId = Number(row.alert_id);
    if (fixStillPresent(targets, input.findings)) {
      if (row.last_checked_tag !== input.tag) {
        await sql.query("UPDATE alert_fix_prs SET state='still_present',last_checked_tag=$2 WHERE id=$1", [fixId, input.tag]);
      }
      results.push({ fixId, alertId, outcome: "still_present" });
      continue;
    }
    const note = `Verified closed: release ${input.tag.slice(0, 120)} was scanned and none of the findings targeted by the fix pull request came back.`;
    await sql.transaction(async (tx) => {
      const updated = await tx.query(
        `UPDATE alert_fix_prs SET state='verified_closed',last_checked_tag=$2,verified_tag=$2,verified_alert_id=$3,verified_at=now()
         WHERE id=$1 AND state<>'verified_closed' RETURNING id`,
        [fixId, input.tag, input.alertId],
      );
      if (!updated.rows.length) return;
      const alert = (await tx.query<{ resolved_at: unknown; installation_id: string | null; workspace_id: string | null }>(
        "SELECT resolved_at,installation_id,workspace_id FROM alerts WHERE id=$1 FOR UPDATE",
        [alertId],
      )).rows[0];
      if (!alert) return;
      if (!alert.resolved_at) {
        await tx.query(
          `UPDATE alerts SET resolved_at=now(),resolved_by_login=$2,resolution_note=$3,
           acknowledged_at=COALESCE(acknowledged_at,now()),acknowledged_by_login=COALESCE(acknowledged_by_login,$2) WHERE id=$1`,
          [alertId, VERIFIER_LOGIN, note],
        );
        await tx.query(
          "INSERT INTO alert_events(alert_id,installation_id,workspace_id,actor_login,action,detail) VALUES($1,$2,$3,$4,'resolved',$5)",
          [alertId, alert.installation_id, alert.workspace_id, VERIFIER_LOGIN, note],
        );
      } else {
        await tx.query(
          "INSERT INTO alert_events(alert_id,installation_id,workspace_id,actor_login,action,detail) VALUES($1,$2,$3,$4,'note',$5)",
          [alertId, alert.installation_id, alert.workspace_id, VERIFIER_LOGIN, note],
        );
      }
    });
    results.push({ fixId, alertId, outcome: "verified_closed" });
  }
  return results;
}

export type FixPrView = {
  branch: string;
  number: number | null;
  url: string | null;
  kinds: string[];
  state: "open" | "still_present" | "verified_closed";
  lastCheckedTag: string | null;
  verifiedTag: string | null;
  verifiedAt: string | null;
  openedBy: string;
  createdAt: string;
};

export async function readFixPr(sql: SqlClient, alertId: number): Promise<FixPrView | null> {
  const row = (await sql.query<{ branch: string; pr_number: number | null; pr_url: string | null; fix_kinds: string[] | string; state: FixPrView["state"]; last_checked_tag: string | null; verified_tag: string | null; verified_at: string | Date | null; opened_by_login: string; created_at: string | Date }>(
    "SELECT branch,pr_number,pr_url,fix_kinds,state,last_checked_tag,verified_tag,verified_at,opened_by_login,created_at FROM alert_fix_prs WHERE alert_id=$1",
    [alertId],
  )).rows[0];
  if (!row) return null;
  const kinds = Array.isArray(row.fix_kinds) ? row.fix_kinds : String(row.fix_kinds).replace(/^\{|\}$/g, "").split(",").filter(Boolean);
  return {
    branch: row.branch,
    number: row.pr_number,
    url: row.pr_url,
    kinds,
    state: row.state,
    lastCheckedTag: row.last_checked_tag,
    verifiedTag: row.verified_tag,
    verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : null,
    openedBy: row.opened_by_login,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
