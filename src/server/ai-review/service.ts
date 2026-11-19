import type { AttackSurface } from "../../scanner/attack-surface.ts";
import type { Finding } from "../../scanner/types.ts";
import { asFindings } from "../fix-pr.ts";
import type { SqlClient } from "../sql.ts";
import type { Store } from "../store.ts";
import { logJson } from "../log.ts";
import { aiReviewConfigFromEnv, createProvider, type ModelProvider } from "./providers.ts";
import { reviewInput, runAiReview, type AiReviewResult, type ReviewSource } from "./review.ts";

export const AI_REVIEW_JOB = "ai_release_review";
export const AI_REVIEW_ACTOR = "nospoilers-ai";

export type AiReviewEngine = {
  reasoning: ModelProvider;
  triage: ModelProvider | null;
  dailyReviews: number;
  timeoutMs: number;
};

/** Null unless the operator switched AI review on with a policy-compliant provider. */
export function aiReviewEngineFromEnv(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): AiReviewEngine | null {
  const config = aiReviewConfigFromEnv(env);
  if (!config) return null;
  return {
    reasoning: createProvider(config.reasoning, fetchImpl),
    triage: config.triage ? createProvider(config.triage, fetchImpl) : null,
    dailyReviews: config.dailyReviews,
    timeoutMs: 300_000,
  };
}

/**
 * Queue a review for an alert that carries findings. Called after scan evidence is
 * committed, so a review can never delay or alter the saved result.
 */
export async function queueAiReview(
  store: Store,
  engine: AiReviewEngine | null | undefined,
  input: { alertId: number; installationId: number; source: ReviewSource; findings: Finding[]; surface: AttackSurface | null | undefined },
): Promise<boolean> {
  if (!engine || input.findings.length === 0) return false;
  const inserted = await store.sql.query<{ id: string }>(
    `INSERT INTO alert_ai_reviews(alert_id,installation_id,workspace_id,state,source_kind,source_label,surface)
     SELECT a.id,a.installation_id,a.workspace_id,'queued',$2,$3,$4::jsonb FROM alerts a WHERE a.id=$1
     ON CONFLICT (alert_id) DO NOTHING RETURNING id`,
    [input.alertId, input.source.kind, input.source.label.slice(0, 200) || "Scan", input.surface ? JSON.stringify(input.surface) : null],
  );
  if (!inserted.rows.length) return false;
  const job = await store.enqueueJob({
    deliveryId: `ai-review:${input.alertId}`,
    priority: "light",
    kind: AI_REVIEW_JOB,
    payload: { alertId: input.alertId, installationId: input.installationId },
    installationId: input.installationId,
  });
  if (job.skipped) {
    await store.sql.query("UPDATE alert_ai_reviews SET state='skipped',failure=$2,completed_at=now() WHERE alert_id=$1", [
      input.alertId,
      "AI review needs active coverage.",
    ]);
    return false;
  }
  return true;
}

async function reserveBudget(sql: SqlClient, scope: string, limit: number): Promise<boolean> {
  const row = await sql.query<{ reviews: number }>(
    `INSERT INTO ai_review_budgets(scope,day,reviews) VALUES($1,(now() AT TIME ZONE 'UTC')::date,1)
     ON CONFLICT(scope,day) DO UPDATE SET reviews=ai_review_budgets.reviews+1 WHERE ai_review_budgets.reviews<$2
     RETURNING reviews`,
    [scope, limit],
  );
  return row.rows.length > 0;
}

export async function processAiReview(sql: SqlClient, alertId: unknown, engine: AiReviewEngine | null | undefined): Promise<void> {
  const id = Number(alertId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("AI review job is missing its alert.");
  const row = (
    await sql.query<{ state: string; installation_id: string | null; workspace_id: string | null; source_kind: ReviewSource["kind"]; source_label: string; surface: unknown; findings: unknown; attempts: number }>(
      `SELECT r.state,r.installation_id,r.workspace_id,r.source_kind,r.source_label,r.surface,a.findings,r.attempts
       FROM alert_ai_reviews r JOIN alerts a ON a.id=r.alert_id WHERE r.alert_id=$1`,
      [id],
    )
  ).rows[0];
  if (!row || row.state === "complete" || row.state === "skipped") return;
  if (!engine) {
    await sql.query("UPDATE alert_ai_reviews SET state='skipped',failure='AI review is switched off.',completed_at=now() WHERE alert_id=$1", [id]);
    return;
  }
  if (row.attempts === 0) {
    const scope = row.installation_id ? `installation:${row.installation_id}` : `workspace:${row.workspace_id}`;
    if (!(await reserveBudget(sql, scope, engine.dailyReviews))) {
      await sql.query("UPDATE alert_ai_reviews SET state='skipped',failure='Daily AI review limit reached for this account.',completed_at=now() WHERE alert_id=$1", [id]);
      return;
    }
  }
  await sql.query("UPDATE alert_ai_reviews SET state='running',attempts=attempts+1 WHERE alert_id=$1", [id]);
  const surface = (typeof row.surface === "string" ? JSON.parse(row.surface) : row.surface) as AttackSurface | null;
  const input = reviewInput({ kind: row.source_kind, label: row.source_label }, asFindings(row.findings), surface);
  let result: AiReviewResult;
  try {
    result = await runAiReview(input, { reasoning: engine.reasoning, triage: engine.triage }, AbortSignal.timeout(engine.timeoutMs));
  } catch (error) {
    // Provider errors can echo request content; log the class of failure only.
    logJson("warn", "ai_review.failed", { alertId: id, reason: error instanceof Error ? error.name : "unknown" });
    await sql.query("UPDATE alert_ai_reviews SET state='failed',failure='The AI review could not finish. The scanner result is unaffected.' WHERE alert_id=$1", [id]);
    throw error;
  }
  await sql.transaction(async (tx) => {
    await tx.query("UPDATE alert_ai_reviews SET state='complete',result=$2::jsonb,failure=NULL,completed_at=now() WHERE alert_id=$1", [id, JSON.stringify(result)]);
    const confirmed = result.findings.filter((finding) => finding.verdict === "confirmed").length;
    await tx.query(
      `INSERT INTO alert_events(alert_id,installation_id,workspace_id,actor_login,action,detail)
       SELECT id,installation_id,workspace_id,$2,'note',$3 FROM alerts WHERE id=$1`,
      [id, AI_REVIEW_ACTOR, `AI release review ready: ${confirmed} of ${result.findings.length} finding(s) confirmed. Advisory only; the scanner result stands.`],
    );
  });
}

export type AiReviewView = {
  state: "queued" | "running" | "complete" | "failed" | "skipped";
  failure: string | null;
  result: AiReviewResult | null;
  surface: AttackSurface | null;
  completedAt: string | null;
};

export async function readAiReview(sql: SqlClient, alertId: number): Promise<AiReviewView | null> {
  const row = (
    await sql.query<{ state: AiReviewView["state"]; failure: string | null; result: unknown; surface: unknown; completed_at: string | Date | null }>(
      "SELECT state,failure,result,surface,completed_at FROM alert_ai_reviews WHERE alert_id=$1",
      [alertId],
    )
  ).rows[0];
  if (!row) return null;
  const json = (value: unknown) => (typeof value === "string" ? JSON.parse(value) : value ?? null);
  return {
    state: row.state,
    failure: row.failure,
    result: json(row.result) as AiReviewResult | null,
    surface: json(row.surface) as AttackSurface | null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  };
}
