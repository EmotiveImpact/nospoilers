# NoSpoilers release-candidate acceptance — 21 September 2026

## Post-candidate update — 22 September 2026

Main now includes migration `123_product_identity`, separate GitHub connector credentials and stable
`ADMIN_USER_ID` owner authorization. Neon Managed Better Auth is selected but not active; WorkOS is
reserved for later enterprise SSO/SCIM. Railway production and the digest-pinned Vercel Sandbox path
have passed a clean live scan and complete worker preflight. Final source verification passed
**1,660/1,660 tests across 271 files**, typecheck, frontend/API builds, lint with existing warnings
and diff check. The remaining acceptance list is maintained in [Bugs and fixes](../../bugsandfixes.md)
and [Status](../STATUS.md). This update does not convert the original candidate record into a public
production declaration.

## Candidate scope

This record covers the curated source on `codex/release-assurance-spine-v1` over base commit `f85fae1`. It includes the current production UI/workflow implementation, local upload/receipt hardening, Overview/Alerts work ownership, connected-workspace notification outbox support and hosted-worker readiness safeguards. Local design studies, browser caches, screenshots and generated output are excluded.

This is release-candidate evidence. It is not a production deployment or a claim that external providers are configured.

## Product behavior accepted locally

- Overview presents real saved release evidence as **Release reviews** and separately reports generated alerts requiring response.
- Alerts is the acknowledgement/assignment/resolution inbox. Saved release reviews route to Releases; missing-release checks route to Coverage and retained history.
- The local package path previously completed a blocked three-finding scan and a corrected zero-finding scan. Both records survived a graceful restart.
- An authentic saved receipt verified, while the same receipt against a mismatched archive was rejected.
- Release detail preserves independent Findings, Files, History and Proof responsibilities and conditional state labels without inventing production or approval evidence.
- Future connected-GitHub workspace alerts can enter the notification outbox without historical enumeration/backfill. Existing workspace scope, generic notification content and retry idempotence remain.
- Production worker startup fails closed unless the required database, HTTPS origin, GitHub configuration, secrets, immutable scanner image, container isolation, notification path and worker-local clean-scan probe are present.

## Verification

- `npx vitest run`: **1,643/1,643 tests passed in 269 files** on the unrestricted frozen source. A preceding restricted run's seven failures were local listener/CLI sandbox denials; the identical complete run passed outside that restriction.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and 33 warnings.
- `npm run build`: passed with the existing bundle chunk-size advisory.
- `npm run build:api`: passed.
- Overview and Alerts browser console review: no warnings or errors.

## Remaining launch evidence

1. Resolve the GitHub Actions account payment/spending-limit block and rerun the PR checks.
2. Link the intended Railway project/service and supply the required isolated worker-local scanner executor/image. The current Railpack environment intentionally fails the readiness preflight.
3. Prove fresh hosted GitHub sign-in, repository selection, queued worker scan and persisted result.
4. Configure one real notification provider and prove an invitation/notification without exposing private evidence.
5. Complete native 200% zoom and audible screen-reader checks.

Stripe checkout, webhook and entitlement acceptance is deferred by the owner. No provider was activated, no external message was sent, and no deployment or merge was performed for this acceptance record.
