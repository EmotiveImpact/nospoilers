# Product portfolio

This directory contains standalone product PRDs. It is not a monorepo scaffold. Each product should
receive its own private repository and Cloud Agent conversation when development begins.

## Product boundary

| Product | Repository | Relationship |
| --- | --- | --- |
| NoSpoilers | `EmotiveImpact/nospoilers` | Current product |
| Employee Public Footprint | New separate repo | Different privacy model and security buyer |
| Release Ledger | New separate repo | Artifact integrity/provenance |
| Package Impersonation Monitor | New separate repo | Registry identity/supply-chain threats |
| Disclosure Desk | New separate repo if commercialized | Research/consultancy disclosure workflow |

## What stays inside NoSpoilers

- Release/package/web scanning
- GitHub visibility and incident response
- npm monitoring and CI prevention
- Release Diff, policies, baseline and receipts
- Sentry/Bugsnag custody
- VSIX, browser extension, language package and deployment-bundle formats
- AI-context protection
- Internal Artifact Leads
- Electron installer scanning in a separate worker service

A separate worker is not automatically a separate product. DMG/EXE/AppImage/MSI scans use an
isolated service but remain inside the NoSpoilers UI and subscription.

## Standalone PRDs

- `employee-public-footprint/PRD.md`
- `release-ledger/PRD.md`
- `package-impersonation-monitor/PRD.md`
- `disclosure-desk/PRD.md`

Each PRD contains its own first-agent prompt, acceptance criteria, data model, architecture,
security constraints and pricing hypothesis.

## Recommended development order

1. Complete NoSpoilers Phases 0–2.
2. Create one private repository per standalone product.
3. Start separate Cloud Agent conversations using the exact prompts in each PRD.
4. Build only each product’s Phase 1 proof first.
5. Do not copy customer records, secrets or source between products.

The products may share high-level patterns, not a production database, billing account, queue or
tenant boundary. Shared scanner code should become a versioned package only after two products
need the same stable interface; do not copy-paste it preemptively.

## Cloud Agent launch plan

For each product:

1. Create the private repository.
2. Add only that product’s PRD as the initial commit.
3. Configure a separate Neon project/branch and secrets.
4. Start a Cloud Agent from that repository with the PRD’s first-agent prompt.
5. Keep branches, deployments and billing isolated.

Do not launch those agents from `EmotiveImpact/nospoilers`; doing so would accidentally turn this
repository into a multi-product monorepo.
