# Mockup to production contract

Current product parity: artifact Overview has real all-history totals and recent attempts; empty workspaces retain First Proof. Release detail keeps approved Mock 3 structure and adds explicit redacted proof sharing. Artifact settings now contain real Team, Policy, Retention and Audit routes; unavailable connection actions are excluded from sidebar/palette rather than represented by simulated controls. Repository-alert rechecks create a new latest-release result, never silently resolve existing evidence. Prototype files remain unchanged. This does not close remaining source ownership, website monitoring or enterprise acceptance requirements.

Reviewed 5 September 2026. Reference: `public/mockup-review/master-flow/`. Earlier `mock3-release-readiness` stays available as a visual reference.

## Verdict

The approved layout is a strong design target, not a finished enterprise specification. Its navigation, evidence hierarchy, restrained red accents and soft central spotlight should carry into the product. Its data, credentials, approval actions and verification results are simulated; none establishes an API connection.

## What changed in this review

- Added **Daily overview** (`?view=overview`) for the returning-customer state.
- Added **Release history** (`?view=releases`) with independent row selection, side preview and explicit full-detail navigation.
- Added release states: hold, queued, failed/retry, inconclusive and clean; the selector is a review tool only.
- Added a scoped **sample proof** explanation (`?view=proof`), including what the check did not cover.
- Added **Workspace settings** (`?view=settings`): team, identity, policy, evidence/retention, integrations and billing. Policy edits and delivery outcomes simulate state changes locally; identity is clearly planned.
- Linked the existing Settings and Releases sidebar items to their proper destinations.
- Corrected the 250 MB upload promise to the current application's 80 MB authenticated / 25 MB public staging limits. Hosting ingress may require a smaller limit or direct object-storage uploads; final copy must come from server capabilities.
- Removed the unverified encryption/deletion blanket claim from scan guidance.
- Escaped editable alert notes/assignees when rendering; added arrow navigation for tab groups and visible keyboard focus.

## Screen and data contract

Workspace/sign-in extension: `IDENTITY-WORKSPACES.md` defines the target model. Master-flow remains the primary design reference, with Mock 3 as release-detail inspiration. Workspace switching/creation, invitations and multiple source connections must be designed against that model, not treated as already-wired mock controls. Independent workspace APIs and provider-neutral authentication remain new work.

| Screen | Production owner | Required data/state | Outstanding work |
| --- | --- | --- | --- |
| First Proof | WatchFirstProofOverview | Workspace coverage and first scan state | Four steps must reflect evidence, not setup capability count |
| Daily Overview | WatchOverview | Current decisions, open alerts, stale coverage, recent releases | Real counts, filters and exact empty→live transition |
| New Scan | ScanPage in WatchRouteContent | Capabilities, tenant, entitlement, upload/job state | One shared browser/CI pipeline; real progress and recovery |
| Coverage | SourcesScreen / WatchSourcesSummary | Persistent connections, last check, next action, owner | Full detail/edit/pause/reconnect and saved-filter states |
| Releases index | ReleasesScreen | Paginated release revisions and selected ID | Durable URL selection and independent mini-preview |
| Release Detail | WatchReleaseBrief | Digest, scope, engine/policy, decision, findings, proof | Unknown/partial states, exception policy and rescan history |
| Alerts | AlertsScreen / WatchAlertsWorkspace | Status, assignment, immutable evidence, action log | Verify role enforcement and resolve/recheck distinction |
| Proof | VerifyPage + public release API | Signature, digest, issuer, time, scope, revocation | Real sharing/revoke/invalid states; redacted public projection |
| Workspace settings | Existing Watch settings screens | Roles, identity, policy, retention, destinations, tokens, plan | Consolidate current APIs; implement enterprise identity separately |

## Complete state checklist before calling the design production-ready

For each data view: loading, empty, ready, stale, unavailable, permission denied and retry. For each mutation: validation, submitting, success, server rejection, lost network and duplicate/retry. For scans: staged, authentication-required, claimed, queued, running, cancelled, failed, inconclusive, findings-present and policy-passed. For access: first-time, returning, viewer, responder, administrator, expired trial, suspended integration and removed teammate.

Remaining prototype scope: full upload progress/cancel, domain ownership challenge, scoped exception approval and expiry, workspace switching, token reveal/revoke, retention save/error, integration credential entry, SSO recovery, audit export, public proof invalid/revoked outcomes and keyboard/focus coverage across every existing control. These are explicitly not all implemented by the current extension.

## Terminology that must stay consistent

- Coverage = ongoing connections and monitoring scope.
- Releases = immutable results for specific artifacts/deployments.
- New scan = a global action with contextual entry points.
- Alerts = exposure response workflow.
- Proof = a signed, scoped, dated record; it never means all software vulnerabilities have been ruled out.
- Setup = connection configuration/diagnostics. Five capabilities do not mean five mandatory onboarding steps.
- An alert can be resolved without rewriting its original evidence; passing proof requires a qualifying completed check and policy decision.

## Verification notes

Current local DOM inspection confirms production Setup still presents five technical coverage capabilities, and the original mockup's Settings had no destination. The extension now supplies Settings and release-history interactions. Screenshots captured through the current browser transport showed cropping/scaling; reject these for final pixel-fidelity acceptance and use a complete viewport capture before visual sign-off. DOM geometry and interaction checks remain valid for the inspected states.

This document supplies the UI work for Gate B/C in `ENTERPRISE-READINESS-PLAN.md`. API security is governed by `SECURITY-READINESS-REVIEW.md`; repository/domain organization is governed by `WEB-APP-ARCHITECTURE.md`.
