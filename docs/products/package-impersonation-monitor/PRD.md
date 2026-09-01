# Package Identity — NoSpoilers Module PRD

Package Identity is a later NoSpoilers module. It extends automatic package monitoring with
identity-continuity and impersonation signals.

## Product

Continuously watch package registries for names, publishers and release behavior that impersonate a
customer’s packages or indicate account takeover.

## Buyer

- Open-source program office
- Package/release engineering
- Software supply-chain security
- Maintainer of a widely installed package

It protects package identity and dependency consumers alongside NoSpoilers artifact confidentiality
without creating a second package watch, account or alerting system.

## Problem

Attackers publish typosquats, lookalike scopes, compromised-maintainer releases, dormant-package
resurrections and malicious ownership changes. Existing dependency scanners usually react after a
consumer installs a package.

## Positioning

“Watch your package identity before someone else publishes under a name users will trust.”

Do not attempt to replace Socket, Snyk, GitGuardian or malware sandboxes.

## Phase 1 — protected package registry

- Customer verifies ownership of npm packages/scopes and GitHub organizations.
- Store canonical names, maintainers, repositories, release cadence and known domains.
- Generate bounded, deterministic confusable/typosquat candidates using edit distance, missing or
  extra separators, adjacent-key substitutions, token transposition, Unicode homoglyphs and scope
  confusion. Preserve the exact transformation behind every candidate.
- Monitor candidate registration and new versions.
- Detect maintainer additions/removals and repository/homepage changes.
- Dashboard, email alerts, acknowledgement and allowlist.

Acceptance:

- Ownership verification cannot be bypassed by naming an arbitrary package.
- Candidate generation is reproducible and bounded.
- Existing benign lookalikes can be approved with reason.
- Registry polling is cached, rate-limited and idempotent.

## Phase 2 — behavioral risk

- Dormant package releases after configurable inactivity.
- Version/cadence and package-size anomalies.
- New install scripts, lifecycle hooks or executable entry points.
- Repository/domain mismatch.
- Sudden maintainer or publishing credential change.
- Dependency graph changes toward newly created packages.
- Artifact manifest comparison and high-confidence credential/source-map findings.
- GitHub/npm provenance presence and signature metadata.

Acceptance:

- Every alert explains the changed facts without claiming malware.
- Risk scoring is deterministic and decomposable into signals.
- Package contents are deleted after bounded inspection.
- No code is executed.

## Phase 3 — multi-registry and response

- PyPI, RubyGems, NuGet, crates.io and Maven Central.
- Registry-specific ownership verification.
- Slack, Jira, SIEM and webhooks.
- Takedown evidence package and registry contact workflow.
- Consumer advisory page controlled by the customer.
- API and batch protected-package import.

## Data model

- customers
- protected_namespaces
- protected_packages
- ownership_proofs
- package_identities
- maintainers
- releases
- release_manifests
- candidate_names
- risk_signals
- alerts/incidents
- allowlist_entries
- notification_destinations
- audit_events

## Architecture

```text
Registry feeds/pollers → normalized events → identity/risk rules → bounded artifact worker
                                               ↓
                                    alerts → human response
```

Use one adapter per registry. Keep immutable raw event metadata only where licensing permits; do
not mirror registries or execute package scripts.

Reuse NoSpoilers workspaces, billing accounts, watched packages, release artifacts, queues,
findings, incidents, routing and audit events. Add identity-specific tables rather than duplicating
the platform.

## Security and abuse constraints

- Verify customer ownership before monitoring/protecting a name.
- Never automatically accuse a publisher of malware.
- Never install or execute package code.
- Bound downloads, archive expansion, files and time.
- Redact credentials.
- Resist alert manipulation through package metadata.
- Respect registry terms, caching and rate limits.
- Human approval before public advisory or takedown request.

## Packaging

- Core identity continuity for a customer’s own watched npm packages can strengthen Solo.
- Team receives namespace watchlists, integrations, longer history and broader protected assets.
- Large registry/API programs can become negotiated high-volume terms after demand.
- Do not create a separate Package Identity subscription or change locked NoSpoilers pricing
  without an explicit product decision.

## Metrics

- Verified protected packages/scopes.
- Time from registry event to alert.
- Actionable/approved candidate ratio.
- False accusation rate: target zero.
- Alert acknowledgement and takedown outcomes.
- Customer retention and packages protected per account.

## Non-goals

- Generic CVE/SCA.
- Antivirus verdicts.
- Automated takedowns.
- Installing suspicious packages.
- Ranking maintainer trustworthiness.
- Public threat feed without evidence and legal review.

## First build acceptance

A verified owner adds one real npm package, receives a baseline of current identity/maintainers,
generates bounded lookalike candidates, and detects a controlled metadata/release change in a test
package without executing package code.

## First agent prompt

```text
Continue inside EmotiveImpact/nospoilers after automatic npm monitoring and stable package identity
exist. Read docs/PRODUCT.md, the Ultimate PRD, feature inventory, and this module PRD. Extend the
existing npm adapter with verified protected names, bounded confusable candidates, maintainer and
ownership history, dormant-package and release-burst rules, explainable deduplicated alerts, and
human allowlisting. Reuse NoSpoilers tenancy, billing, package, queue, incident, notification and
audit systems. Do not create a second app/database/login, execute packages, issue malware verdicts,
add other registries, or change billing. Use real npm contracts at the boundary and deterministic
tests. Commit and push; no PR unless asked.
```
