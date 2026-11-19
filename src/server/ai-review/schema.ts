/** Migration 125: AI release review results and fix pull requests per alert. */
export const AI_REVIEW_MIGRATION = "125_ai_review_fix_prs";

export const aiReviewSchema = `
CREATE TABLE alert_ai_reviews(
  id BIGSERIAL PRIMARY KEY,
  alert_id BIGINT NOT NULL UNIQUE REFERENCES alerts(id) ON DELETE CASCADE,
  installation_id BIGINT REFERENCES installations(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES product_workspaces(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK(state IN ('queued','running','complete','failed','skipped')),
  source_kind TEXT NOT NULL CHECK(source_kind IN ('release','website','package')),
  source_label TEXT NOT NULL CHECK(length(source_label) BETWEEN 1 AND 200),
  -- Identifiers only (routes, flag keys, internal hosts, env names). Never code or secret values.
  surface JSONB,
  result JSONB,
  failure TEXT CHECK(failure IS NULL OR length(failure)<=300),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CHECK(state<>'complete' OR result IS NOT NULL)
);
CREATE INDEX alert_ai_reviews_installation ON alert_ai_reviews(installation_id,created_at DESC);
CREATE TABLE ai_review_budgets(
  scope TEXT NOT NULL,
  day DATE NOT NULL,
  reviews INTEGER NOT NULL CHECK(reviews>=0),
  PRIMARY KEY(scope,day)
);
CREATE TABLE alert_fix_prs(
  id BIGSERIAL PRIMARY KEY,
  alert_id BIGINT NOT NULL UNIQUE REFERENCES alerts(id) ON DELETE CASCADE,
  installation_id BIGINT NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  repo_id BIGINT NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  branch TEXT NOT NULL,
  pr_number INTEGER,
  pr_url TEXT,
  fix_kinds TEXT[] NOT NULL,
  targets JSONB NOT NULL,
  opened_by_login TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('open','still_present','verified_closed')),
  last_checked_tag TEXT,
  verified_tag TEXT,
  verified_alert_id BIGINT REFERENCES alerts(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(state<>'verified_closed' OR (verified_tag IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE INDEX alert_fix_prs_repo_open ON alert_fix_prs(repo_id) WHERE state<>'verified_closed';
`;
