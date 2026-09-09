# NoSpoilers agent entry point

## Mandatory reading order

Before continuing this branch, read:

1. `docs/release-assurance/BUSINESS-NORTH-STAR.md`
2. `docs/release-assurance/CONTEXT-AUDIT.md`
3. `docs/release-assurance/RESEARCH-SNAPSHOT.md`
4. `docs/release-assurance/COMMERCIAL-VALIDATION-PLAN.md`
5. `docs/PRODUCT.md`
6. `docs/PRODUCT-DIRECTION.md`
7. `docs/GATE-B-FINAL-EVIDENCE-MATRIX.md`
8. `docs/release-assurance/INTELLIGENCE-HANDOFF.md`
9. `docs/release-assurance/ACCEPTANCE.md`
10. `docs/release-assurance/ARCHITECTURE.md`
11. `docs/release-assurance/BEHAVIOURAL-DESIGN.md`
12. `docs/release-assurance/BEHAVIOURAL-EXPERIMENTS.md`
13. `docs/growth/OUTREACH-LIBRARY-v2.md`
14. `docs/MONTH1.md`
15. current draft PR #44 description, diff and checks

`BUSINESS-NORTH-STAR.md` is the durable commercial/product context from the originating strategy work: the £500k-MRR ambition, release-assurance category, retention thesis, release intelligence, behavioural-design approach, agent strategy, acquisition/lead-generator model, pricing constraints, buyer segments, metrics, falsification tests and next-build order. `RESEARCH-SNAPSHOT.md` preserves the dated competitor, market, outreach/legal, partner and ecosystem research. Future agents should not require the originating chat to understand why the product is being built this way.

`CONTEXT-AUDIT.md` maps the discussion to files and preserves corrections and decision provenance. `COMMERCIAL-VALIDATION-PLAN.md` supplies currency-aware revenue scenarios, metric definitions, customer-validation steps, unit-economics assumptions and risk/decision gates. `BEHAVIOURAL-EXPERIMENTS.md` qualifies the behavioural evidence and defines experiments; it is not a claim that those experiments have run or improved retention. These are documentation/planning additions, not new runtime capability, approved spending or changed customer terms.

The newer intelligence handoff supersedes the original companion-only status in `docs/release-assurance/HANDOFF.md` where they conflict. The latest `ACCEPTANCE.md` is the implementation-status ledger. Strategy documents do not authorise calling unverified functionality complete.

The branch now includes the original advisory assurance companion plus explicit release streams, compact persistent snapshots, versioned human-adopted references, historical anomaly analysis, customer controls and a CI scan-and-record workflow. It introduces migration `ra_002_release_intelligence` and scoped mutation routes. Do not repeat the earlier claim that this branch has no migration or only read APIs.

This is NOT a completed autonomous release-security platform or a production-readiness declaration. The intelligence remains advisory; it cannot rewrite receipts, silently adopt baselines or change CI policy. Recording history remains explicit through the UI/API or CI command; migration `ra_003_automatic_capture` also adds an opt-in exact-source completion hook for connected GitHub release assets, npm and websites. No rule is enabled automatically. Remaining implementation and integration checks are documented.

Preserve the approved homepage, existing release/coverage flows, workspace authorisation, billing, scanner isolation and immutable evidence. Reuse existing scanner, policies, receipts, deployment checks and remediation workflows. Do not make private records public, introduce fake customer data, remove isolation guards, change prices, merge, deploy, send disclosures or activate providers without corresponding owner approval.

Commercial direction remains Solo $29/month and Team $99/month USD with the shared five-day trial unless the owner explicitly changes it. The strategic £500k goal is GBP: same-number USD customer-count examples are not a GBP forecast. Larger-price scenarios in strategy documents are hypotheses, not current entitlements. Responsible disclosure remains separate from sales and nothing is auto-sent.

Use the existing branch `codex/release-assurance-spine-v1` and draft PR #44. Do not push to `main`. The branch-specific Vercel deployment guard must remain until reviewed. Run the actual locked project checks before declaring integration complete. Native focused tests and injected authentication ports are not the full suite or production evidence.

The original `SOURCE-HASHES.json` is a historical manifest for the companion checkpoint; subsequent runtime/panel changes are intentional. Regenerate commit-bound evidence after validation rather than reverting new work to match an old manifest.

Read the latest head before writes and never force-push over another agent's work. Keep handoff, acceptance and PR description synchronised. Report exact tested source, commands, results and limitations; separate implementation from integration and deployment evidence. A research citation, competitor price or design theory is not customer validation.
