# NoSpoilers product overview

**Review draft. Internal buyer-material preparation, not approved sales commitments.**

Evidence baseline: `eb46118030643a8f27847302784867df4e84c6da` on `codex/v20-homepage-auth-mock3`. Product flows are being completed separately in Codex. Reconcile this draft with that completed code and operational evidence before external use.

## Purpose and audience

NoSpoilers inspects supported release archives and verified website assets for release exposure. Its audience is a software team deciding whether the material it distributes contains source maps, credential patterns or unintended internal content. Repository visibility and supported publishing events provide a separate monitoring surface.

It complements repository review. It is not a complete vulnerability assessment, malware execution service, penetration test or guarantee of confidentiality.

## Implemented application paths

| Capability | Evidence and boundary |
| --- | --- |
| Browser and CI archive intake | `src/pages/ScanPage.tsx`, `src/cli.ts`, `src/server/upload-store.ts`. Public intake is staging, not an anonymous report. Hosted work requires authentication and entitlement. |
| Independent workspaces and roles | `src/server/workspace-membership.ts`, `src/server/workspaces.ts`. Product membership is separate from GitHub source approval and organisation billing authority. |
| Verified website checks | `src/server/domain-verification.ts`, `src/components/watch/WorkspaceWebsites.tsx`. Explicit DNS/HTTP verification, bounded checks and opt-in schedules; not whole-domain coverage. |
| Saved results and response | `src/components/watch/UploadedReleaseBrief.tsx`, `src/components/watch/WorkspaceAlerts.tsx`. A response action does not rewrite a saved report. |
| Scoped exceptions | `src/server/workspace-exceptions.ts`, `src/server/workspace-policy.ts`. Saved-finding scope, expiry and independent approval where required. |
| Proof and sharing | `src/receipt.ts`, `src/server/upload-proof-sharing.ts`. HMAC receipt verification and redacted public summaries are distinct. |

## Awaiting operational verification

Gate B acceptance, mixed-source customer journeys, complete role/error states, configured production providers, worker deployment/isolation, backup/restore and release operations are not proven by this website implementation. Use the authoritative [Gate B audit](../GATE-B-COMPLETION-AUDIT.md) and [enterprise readiness plan](../ENTERPRISE-READINESS-PLAN.md), not this summary, to determine readiness.

A successful local fixture or configuration flag is not proof that a customer's GitHub installation, notification provider or production worker is healthy.

## Planned or not included as an operational promise

Multi-provider sign-in, SSO, SCIM, custom enterprise roles, native hosting-provider OAuth, dedicated infrastructure and regional/residency commitments require separate work or agreement. Public-key/third-party proof verification is not equivalent to the current HMAC model. No certification, customer testimonial or service-level guarantee is asserted.

## Commercial facts and review conditions

The confirmed public information is a five-day trial, Solo at USD 29/month or USD 290/year and Team at USD 99/month or USD 990/year. There is no permanent free scanner. Active entitlement and fair-use limits apply; workspaces do not multiply trials. Live price IDs, checkout totals, taxes, seat/workspace packaging, an enterprise price, contract and support terms require confirmation rather than inference.

Existing contact: `emotiveimpact@gmail.com`. No new sales address or submission backend was created. The external-facing `/enterprise` page uses an explicit email link and makes no submission-success claim.
