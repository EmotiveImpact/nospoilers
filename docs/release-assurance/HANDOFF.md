# Release assurance handoff

8 September 2026. Branch: `codex/release-assurance-spine-v1`.
Base main commit: `675916b4b9b843bff2cb0651ec13034f2f62775d`.

## Read this first

For the durable company/product context from the originating strategy work, read `BUSINESS-NORTH-STAR.md` and `RESEARCH-SNAPSHOT.md` before relying on this older implementation checkpoint. They preserve the £500k-MRR ambition, release-assurance category, retention thesis, pricing constraints, release-intelligence strategy, behavioural design, agent strategy, acquisition/lead-generator model, buyer segments, external market research and next-build priorities so a future agent does not need the originating chat.

For current implementation status, `INTELLIGENCE-HANDOFF.md` and the latest `ACCEPTANCE.md` supersede this file where they conflict. This file primarily describes the original Release Assurance companion checkpoint at commit `25b1abbf5de12fe45768dc82890a267913b7a667`.

Actual code, not just a proposal, has been added. This original checkpoint was a bounded first increment of the requested Release Assurance vision. Do not claim the entire platform is finished. The later continuation has since implemented explicit release streams, compact persistent history, versioned human-adopted references and historical intelligence; see the newer handoff/status ledger. Autonomous AI investigation, authoritative enforcement, comprehensive web-asset parity and durable remediation linkage remain separate implementation work unless a newer ledger says otherwise.

The newer `GATE-B-FINAL-EVIDENCE-MATRIX.md` records Gate B complete. Preserve that baseline. This change neither reopens those historical acceptance rows by assertion nor proves new changes satisfy them. Gate A deployment/isolation and the other operational launch approvals remain separate.

## Original companion checkpoint

`src/assurance/` adds a typed interpretation of existing signed evidence: receipt/identity validation, explicit ready/review/blocked/unknown states, separate published-delivery freshness, eligible historical comparison, deterministic next-step playbooks, strict-review simulation, a private unsigned passport and a native DOM renderer with a React lifecycle wrapper.

`src/server/assurance-api.ts` provides the original read-only request handling. `assurance-app.ts` composes it before the original Hono catch-all. `runtime.ts` wires the wrapper using the existing receipt secret and store. Later continuation work adds scoped history/baseline writes; do not repeat the old claim that all new branch routes are read-only.

`HostedReleaseEvidence.tsx` and `UploadedReleaseBrief.tsx` mount the companion in actual release detail screens. These are additive mounts; the approved main interface, original findings, exceptions, proof-sharing and scan controls remain. The companion is advisory, not a replacement global verdict or deployed gate unless and until the later authority-cutover work is verified and adopted.

## Original routes

- `GET /api/assurance/releases/:id` uses existing session-authorised release/receipt reads.
- `GET /api/assurance/uploads/:uuid` uses the existing authorised upload record.
- `GET /api/assurance/scans/:uuid` uses the existing bearer-token result route.

The later Release Intelligence continuation adds history/baseline routes and migration `ra_002_release_intelligence`; see `INTELLIGENCE-HANDOFF.md`.

## Original verification checkpoint

101 shared domain/API cases passed under Node 22.16.0's native test runner with TypeScript stripping for the original companion checkpoint. The same cases were registered by Vitest wrappers. Those tests did not run the later full continuation.

55 browser checks passed against the original native renderer, validator and export helper, using synthetic evidence at 390/768/1440 pixels. This is not complete React application or live API/browser acceptance for the current branch.

Strict semantic checks passed for the original dependency-free domain subset using the available TypeScript 5.8.3 compiler. The repository pins TypeScript 6; this did not replace its full semantic build.

Do not present these historical counts as the current branch's full test status. Use the latest `ACCEPTANCE.md`, current PR checks and new continuation test evidence.

## Required continuation

1. Read `BUSINESS-NORTH-STAR.md` and `RESEARCH-SNAPSHOT.md` so the commercial/retention/product intent is preserved.
2. Read `INTELLIGENCE-HANDOFF.md` and `ACCEPTANCE.md` for what is now built versus still open.
3. Run the full locked regression, typecheck, lint, frontend/API builds, Hono/auth/store/HMAC integration, production-like PostgreSQL migration/concurrency checks and integrated React/browser review.
4. Reconcile the old headline readiness model with the new evidence model so one authoritative release decision exists.
5. Continue the latest priority sequence: authorised automatic history capture, approved-build/production parity, versioned enforcement, durable remediation linkage, opt-in provider-backed agent/tool layer, outcome/retention UX and later agency portfolio architecture.
6. Keep the draft PR unmerged and branch deployment guard in place until applicable verification and operational approvals are complete.

## Commercial and safety boundaries

Solo remains $29/month and Team $99/month, both USD; the shared five-day trial remains unless explicitly changed by the owner. Larger prices in `BUSINESS-NORTH-STAR.md` are hypotheses, not current entitlements. Disclosure Desk remains internal and unsent. Responsible disclosure stays separate from sales. Evidence retention remains the actual configured policy, not an indefinite archive promise. Public proof sharing remains explicitly authorised.
