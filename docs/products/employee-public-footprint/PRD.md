# Employee Public Footprint — Standalone Product PRD

Working name only. Build in a separate repository/application from NoSpoilers.

## Product

Monitor public repositories and artifacts created under employees’ personal GitHub accounts when
those accounts are associated with a customer organization. Detect accidental company exposure
that organization-level GitHub controls cannot see.

## Buyer and user

- Buyer: Head of Security, IT, AppSec, or engineering leadership.
- User: Security analyst or incident responder.
- Subject: Organization members whose public activity is monitored under documented company policy.

This is separate from NoSpoilers because it introduces employee privacy, organization membership,
identity lifecycle, broad public-data monitoring, and a different buyer.

## Problem

An employee can place company code, internal package names, domains, credentials, or copied files
in a personal public repository. The company does not own that repository and may receive no
organization webhook.

## Positioning

“Know when company material appears in employee-owned public GitHub repositories.”

Not employee productivity scoring, surveillance of private accounts, or a general secret scanner.

## Principles

1. Customer must prove control of the organization.
2. Monitor only public data and documented organization members.
3. Show why an identity is in scope.
4. Minimize and expire data.
5. Never infer productivity, intent, politics, health, or performance.
6. Human review before contacting an employee or filing an incident.
7. Never publish findings.

## Core workflow

1. Security admin connects a GitHub organization.
2. Product imports current public member identities with appropriate permission.
3. Admin reviews scope, policy notice, exclusions, contractors and former-member retention.
4. Baseline existing public repositories.
5. Detect newly public/newly created personal repositories or material changes.
6. Scan public metadata/content for customer-specific indicators and high-confidence credentials.
7. Analyst verifies, assigns, contacts through company process, and resolves.

## Phase 1 — organization and identity baseline

- GitHub organization connection and ownership verification.
- Monitoring policy recording purpose, lawful basis, jurisdictions, employee notice, retention and
  prohibited uses; collection cannot start until it is active.
- Member import with source and last-confirmed timestamp.
- Include/exclude controls and policy acknowledgement.
- Employee self-service view for notice, identity correction/dispute, export and deletion requests
  where applicable.
- Public repository inventory per monitored identity.
- Baseline approval to avoid treating all history as new.
- Admin-only dashboard, roles, audit log and retention controls.

Acceptance:

- Only verified organization admins can create a program.
- Every monitored identity has evidence linking it to current membership.
- Existing repositories are baseline, not automatically incidents.
- Removed members stop new monitoring under configured policy.

## Phase 2 — public change detection

- GitLab and Bitbucket public-identity adapters.
- Scheduled public repository discovery.
- New repository, visibility, fork and ownership-change detection.
- Customer indicators: approved domains, package scopes, copyright strings, internal project names.
- High-confidence credential metadata with values redacted.
- File fingerprint comparison without retaining full source.
- Severity, assignment, acknowledgement, notes and resolution.
- Email/Slack alerts.

Acceptance:

- Repeated polling produces no duplicate incidents.
- Findings include public URL, timestamp, reason, hash and reproducible evidence.
- Credential values and full repository snapshots are not stored.
- Analyst approval is required before outreach.

## Phase 3 — lifecycle and response

- HR/identity provider and SCIM feed for joiner/mover/leaver scope, only with legal approval.
- Former-member monitoring window with explicit retention.
- Jira/SIEM/webhook routing.
- Evidence export and remediation history.
- Public fork/mirror correlation.
- Customer-approved employee notification templates.
- Repository removal/private-state verification.

Acceptance:

- Data subject request and deletion workflow exists.
- Monitoring stops and data expires according to policy.
- Every export and contact action is audited.

## Data model

- organizations
- admins and roles
- monitoring_policies
- monitored_identities
- identity_membership_evidence
- scope_exclusions
- public_repositories
- repository_snapshots/fingerprints
- customer_indicators
- findings
- incidents and incident_events
- notification_destinations/deliveries
- retention_policies
- privacy_requests
- audit_events

Do not store private repository content, credentials, or unrelated personal profile enrichment.

## Architecture

```text
Admin dashboard → API → Postgres
GitHub organization/member APIs → discovery scheduler
Public repository metadata/content → bounded worker → fingerprints/findings
Findings → human verification → company-owned notification channels
```

Use strict per-organization API and compute budgets. Customer programs must not share finding data.

## Permissions and integrations

- GitHub organization member read permission where required.
- Public GitHub APIs for public repositories.
- Optional identity provider only after legal review.
- Email, Slack, Jira, SIEM/custom webhooks.
- No request for employee account OAuth or private repository access.

## Privacy/legal requirements

- Customer confirms lawful basis and employee notice.
- Data protection impact assessment template.
- Purpose limitation: security exposure only.
- Configurable region and retention.
- Subject access/deletion process.
- No biometric/demographic inference.
- No productivity or performance analytics.
- No automated disciplinary recommendation.
- Human verification before escalation.

## Pricing hypothesis

- Governed pilot: approximately $750/month for one organization and up to 250 enrolled identities.
- Business: approximately $2,500/month for larger identity bands, SSO, ticketing and governance.
- Larger programs: private quote only after demand.

Pricing is a hypothesis; do not publish until legal and GitHub API costs are measured.

## Success metrics

- Verified organizations activated.
- Percentage of members successfully scoped.
- New public repository detection latency.
- Verified incident rate and false-positive rate.
- Time to acknowledgement and remediation.
- Monthly logo retention.
- Data-deletion SLA compliance.

## Non-goals

- Private account/repository access.
- Employee productivity measurement.
- Background checks.
- Generic internet identity intelligence.
- Automated employee contact.
- Public naming.
- Full SAST or dependency scanning.

## First build acceptance

A verified admin connects one disposable organization, imports consenting test members, baselines
their public repositories, creates one new public test repository, and receives one correctly
deduplicated dashboard event. No private content or unrelated personal data is stored.

## First agent prompt

```text
Create a new private repository for the Employee Public Footprint product. Read this PRD. Build only
Phase 1 plus the smallest Phase 2 proof using a disposable GitHub organization and consenting test
accounts. Do not import NoSpoilers code wholesale, monitor private data, contact employees, add
billing, or claim legal compliance. Use TypeScript, Postgres, a queued public-metadata worker, strict
tenant isolation, audit events, configurable retention, and real GitHub data at the boundary. Ship
desktop/mobile empty/loading/error states, tests for organization authorization and deduplication,
README setup, and a clear privacy threat model. Commit and push; no PR unless asked.
```
