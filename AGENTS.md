# NoSpoilers agent entry point

Read `docs/PRODUCT.md`, `docs/PRODUCT-DIRECTION.md`, `docs/GATE-B-FINAL-EVIDENCE-MATRIX.md`, `docs/release-assurance/INTELLIGENCE-HANDOFF.md`, and `docs/release-assurance/ACCEPTANCE.md` before continuing this branch. The newer intelligence handoff supersedes the original companion-only status in `docs/release-assurance/HANDOFF.md`.

The branch now includes the original advisory assurance companion plus explicit release streams, compact persistent snapshots, versioned human-adopted references, historical anomaly analysis, customer controls and a CI scan-and-record workflow. It introduces migration `ra_002_release_intelligence` and scoped mutation routes. Do not repeat the earlier claim that this branch has no migration or only read APIs.

This is NOT a completed autonomous release-security platform or a production-readiness declaration. The intelligence remains advisory; it cannot rewrite receipts, silently adopt baselines or change CI policy. Recording history is explicit through the UI/API or CI command, not an automatically installed hook for every provider event. Remaining implementation and integration checks are documented.

Preserve the approved homepage, existing release/coverage flows, workspace authorisation, billing, scanner isolation and immutable evidence. Reuse existing scanner, policies, receipts, deployment checks and remediation workflows. Do not make private records public, introduce fake customer data, remove isolation guards, change prices, merge, deploy, send disclosures or activate providers without corresponding owner approval.

Use the existing branch `codex/release-assurance-spine-v1` and draft PR #44. Do not push to `main`. The branch-specific Vercel deployment guard must remain until reviewed. Run the actual locked project checks before declaring integration complete. Native focused tests and injected authentication ports are not the full suite or production evidence.

The original `SOURCE-HASHES.json` is a historical manifest for the companion checkpoint; subsequent runtime/panel changes are intentional. Regenerate commit-bound evidence after validation rather than reverting new work to match an old manifest.
