# NoSpoilers agent entry point

Read `docs/PRODUCT.md`, `docs/PRODUCT-DIRECTION.md`, `docs/GATE-B-FINAL-EVIDENCE-MATRIX.md`, and `docs/release-assurance/HANDOFF.md` before continuing this branch.

The release-assurance work is an implemented, read-only companion and a documented continuation plan. It is NOT a completed autonomous release-security platform or a production-readiness declaration. Its scope and unverified integration are explicit in the handoff and acceptance matrix.

Preserve the approved homepage, existing release/coverage flows, workspace authorisation, billing, scanner isolation and immutable evidence. Reuse existing scanner, policies, receipts, deployment checks and remediation workflows. Do not make private records public, introduce fake customer data, remove isolation guards, change prices, merge, deploy, send disclosures or activate providers without the corresponding owner approval.

Use the existing branch `codex/release-assurance-spine-v1`. Do not push to `main`. The branch-specific Vercel deployment guard must remain until reviewed. Run the actual locked project checks before declaring integration complete. Native focused tests are not the full suite.
