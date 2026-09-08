# Gate B website source cutover

Repository-grounded implementation checklist, 5 September 2026. This is remaining implementation, not completion evidence. Preserve the approved website → ownership verification → queued check → saved release flow without requiring a GitHub account or manufacturing an installation.

## Current dependency map

**Current checkpoint 100 (6 September; supersedes the dependency snapshot below):** independent workspace sources, verification, shared payer/job admission, real crawl/receipt persistence, retained pause/disconnect/reconnect and Coverage controls are implemented. Opt-in manual/6-hour/daily schedule API and UI now feed the existing poller. Each due window has deterministic identity; queue/reservation/next-due advancement commit together. Active scans do not overlap scheduled admission; revoked members, paused/unverified/disconnected/archived sources and ended allowances cannot queue. Schedule changes invalidate pending scheduled work; worker authority is rechecked before crawl and publication. Scheduling does not require a GitHub installation. Focused acceptance and final broad regression are being collected; no hosted scheduler deployment claim.

Remaining website acceptance: mixed-source workspace entry points, source health/staleness aggregation in Overview, website findings/Alerts and Settings parity, full browser ownership/result/schedule journey and final unchanged-tree regression. The following earlier dependency list is historical, not the current implementation state.

Lifecycle prerequisite implemented through 095: origin disconnection is now retained, deployment tokens revoked, active polling blocked and explicit reconnect requires re-verification. Worker rejects cross-installation origins and uses the saved URL. Origin mutation queries now use effective workspace membership. These fixes do not yet supply independent website ownership: installation_id remains required and the website-only end-to-end flow below is still outstanding.

- `ScanPage.continueWebsite` sends signed-in users to Coverage with `configure=website`; the independent Coverage empty page currently cannot consume that configuration.
- `POST /api/origins` resolves a GitHub installation and rejects website-only workspaces.
- `watched_origins.installation_id` is required; ownership uniqueness is installation + URL.
- Origin reads use workspace-derived source membership, but verification, deploy-token and delete mutations still join `installation_users` directly.
- The `web_origin_scan` worker takes its scope/policy from installationId. Its origin fetch must also validate the origin belongs to the queued scope and remains verified/active immediately before work.
- Origin removal currently deletes the configuration record. Retention requires a disconnected state, stopped work/revoked trigger credentials and retained historical evidence.

## Required implementation order

Foundation checkpoint 096: workspace_id ownership/backfill and immutability now exist; independent creation primitive checks workspace authority/plan/quota and creates a challenge without scanning. Legacy duplicate URL histories are preserved using a partial independent-source unique index. The new primitive is not yet a public workflow. Verification API, independent queue/payer/result path and UI remain outstanding below.

1. Add explicit workspace ownership to website sources; backfill existing mapped sources without moving ownership or altering proofs. Make legacy installation optional for new website-only sources. Uniqueness must be workspace + normalised origin. Resolve unmapped legacy ownership before exposing writes, not by selecting the first workspace.
2. Centralise origin authorisation through live workspace membership (including archival and revocation). Use the same checks for challenge creation, verification, edit, token rotation/revoke, pause/reconnect and removal. Recheck authority after outbound ownership verification, before saving or queueing.
3. Queue jobs with workspace/source identity and immutable organisation/personal payer. Enforce shared plan limits and scan policy. No fabricated installation, second trial, or extra allowance per source/workspace.
4. At worker execution recheck active source, verified domain, workspace scope and job payer; enforce existing SSRF protections and scan bounds. Persist immutable workspace-owned release evidence and provenance. Paused/disconnected sources must not crawl; unused reservations refund once.
5. Add the ownership challenge UI to independent Coverage and route New Scan into it. Include DNS/HTTP challenge, checking, mismatch/failure, verified, queued/running, error/retry, paused, disconnected and expired-plan states. Never display invented results while credentials or ownership are missing.
6. Connect returning Overview, Coverage health/last check/next action, Releases, Alerts and Settings to that same source identity. Retain original check history through rechecks and reconnects.

## Acceptance evidence

Use real local APIs with fixture network responses: website-only workspace owner completes connection/verification/check and reads persisted release; unauthenticated, cross-workspace, revoked-member and viewer mutations reject; wrong-scope/stale jobs never crawl; disconnect preserves evidence and stops tokens; shared billing reservations/refunds remain exact. Browser-verify the ownership and result journey without a GitHub connection. Full regression verification must run against an unchanged source/test tree.
