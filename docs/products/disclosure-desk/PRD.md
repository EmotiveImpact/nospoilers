# Disclosure Desk — Internal NoSpoilers PRD

**Status:** Phase 2 minus send is **built** on Artifact Leads. Nothing is mailed. Customer sessions
stay 401. Aggregate research stays planned. [`docs/STATUS.md`](../../STATUS.md).

Disclosure Desk extends Artifact Leads for our own responsible disclosure and acquisition.
It is not a customer product.

## Product

A private case-management system for security researchers and consultancies to verify public
artifact findings, avoid duplicate outreach, coordinate responsible disclosure, track remediation,
and generate defensible reports.

## Operator

- NoSpoilers operator verifying public artifact findings.
- Authorized internal reviewer coordinating responsible disclosure.

Independent researchers and consultancies are only a future commercialization hypothesis. If that
decision is ever made, this PRD must be copied into a separate repository and undergo fresh legal,
abuse and tenancy review.

## Problem

Public artifact research produces noisy findings, duplicate companies, unclear contacts and
sensitive evidence. Spreadsheets do not reliably separate unverified signals from disclosures,
deadlines and remediation. Automation can easily become spam or public shaming.

## Positioning

“A private, evidence-first desk for coordinated vulnerability disclosure.”

## Principles

1. Finding discovery never equals verified vulnerability.
2. Human approval before every external message.
3. No automatic public naming or disclosure.
4. Minimize evidence; encrypt sensitive attachments; expire them.
5. Preserve an auditable communication timeline.
6. Respect vendor security policies and safe-harbor terms.
7. Prevent duplicate contact across researchers/cases.

## Phase 1 — case and evidence workflow

- Organizations/workspaces and researcher roles.
- Cases with target, product, artifact URL/version/hash and finding category.
- Verification checklist and reproducibility steps.
- Finding states: signal, verifying, verified, false positive, duplicate.
- Encrypted notes/evidence with expiry.
- Duplicate matching by organization/domain/artifact/fingerprint.
- Security contact and policy records with source URL.
- Immutable activity log.

Acceptance:

- A signal cannot enter outreach state without verification evidence.
- Duplicate warning appears before a new case is created/contacted.
- Sensitive evidence is encrypted and has retention/expiry.
- Cases are private by default.

## Phase 2 — coordinated disclosure

- Human-edited templates.
- Contact approval and send preview.
- Preferred vendor channel: security email, form, security.txt or platform advisory.
- Disclosure timestamps, acknowledgement and follow-up reminders.
- Configurable deadlines that never publish automatically.
- Vendor replies and attachments.
- Fix-version tracking and controlled rescan.
- Resolution, credit/CVE/bounty outcome fields.

Acceptance:

- No message is sent without an authenticated human confirmation.
- Recipients, subject, body and evidence are visible before send.
- Unsubscribe/do-not-contact and vendor policy constraints are enforced.
- Missed deadline creates an internal reminder only.

## Phase 3 — consultancy operations

- Client projects and separation.
- Assignment, review/approval and service-level tracking.
- Redacted PDF/HTML/JSON reports.
- Jira/webhook integrations.
- Researcher workload without productivity surveillance.
- Billing/time fields only if consultancies request them.
- Aggregate anonymized trend reporting.

## Data model

- workspaces/users/roles
- organizations/domains
- security_contacts/policies
- cases
- artifacts/artifact_fingerprints
- findings/verification_steps
- duplicate_links
- evidence_objects/retention
- communications/approvals/deliveries
- disclosure_deadlines
- remediation_versions/rescans
- outcomes/credits
- audit_events
- do_not_contact entries

## Architecture

```text
Researcher → private web/API → Postgres case metadata
                           → encrypted evidence object storage with expiry
                           → approved mail/provider adapters
Public artifact adapters → bounded scanner → unverified signals
```

Discovery and communication workers must be separate. A scanner result can never call the mail
adapter directly.

Reuse the existing NoSpoilers internal admin boundary, prospects, scan findings and audit patterns.
Keep internal prospect/disclosure data logically isolated from customer tenancy and never expose it
through customer APIs.

## Security, legal and abuse controls

- Strong workspace isolation and MFA-ready auth.
- Encrypted evidence and integration credentials.
- Configurable retention and verified deletion.
- Rate limits and anti-spam limits independent of subscription.
- Do-not-contact and vendor-policy enforcement.
- Human approval evidence for every send.
- No credential values in routine reports.
- Legal review for safe harbor, embargo and cross-border data.
- Abuse reporting and account suspension.
- No public searchable target/finding database.

## Commercialization rule

- Internal use has no subscription.
- If external researchers/consultancies later request the workflow, create a separate product and
  database after legal and abuse review.
- A future hypothesis is $29/month researcher and $249/month consultancy.
- Never price per disclosure or bounty percentage; that incentivizes bad behavior.

## Metrics

- Verified vs false-positive signals.
- Duplicate cases prevented.
- Vendor acknowledgement and remediation rates.
- Median time to acknowledgement/fix.
- Messages sent per verified case.
- Complaints/abuse reports: target zero.
- Evidence deleted on schedule.
- Retained paid workspaces.

## Non-goals

- Automated cold outreach.
- Public shaming/timed auto-publication.
- Exploit marketplace.
- Bug-bounty payment processor.
- Dark-web intelligence.
- Retaining harvested secrets/source.
- AI-generated vulnerability claims without human verification.

## First build acceptance

A researcher creates a private signal from a real public test artifact, completes verification,
detects a duplicate, previews a disclosure message, records a manually simulated acknowledgement,
and closes a fixed-version rescan. No external message is sent in Phase 1.

## First agent prompt

```text
Continue inside EmotiveImpact/nospoilers after customer-critical launch work. Read docs/PRODUCT.md,
the Ultimate PRD, feature inventory, and this internal PRD. Extend `/internal/prospects` with
verification checklists, company/finding deduplication, security contact/policy provenance,
responsible-disclosure drafts, deadlines, remediation versions, fixed-version rescans, conversion
attribution and immutable internal audit history. Reuse the existing scanner/prospect data; keep it
separate from customer APIs. Do not send messages automatically, publish targets, add billing,
store source/credential values, or create a second application. Use real user-entered/public data
only; no seeded target companies. Commit and push; no PR unless asked.
```
