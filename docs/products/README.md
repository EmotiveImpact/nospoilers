# Product and module map

This directory holds detailed briefs. It does not mean every folder becomes separate software.

## Final structure

```text
Emotive Impact
├── NoSpoilers platform                    ← current software/repository
│   ├── Artifact and web exposure scanning
│   ├── GitHub visibility and response
│   ├── Release Ledger module
│   ├── Package Identity module
│   ├── Internal Disclosure Desk
│   └── Isolated Electron worker later
└── Employee Public Footprint              ← separate future application/repository
```

## What is software today

Only NoSpoilers has application code. The other documents are specifications, not built apps.

## NoSpoilers modules

### Release Ledger

`release-ledger/PRD.md`

Artifact hashes, signed receipts, provenance, SBOM evidence and delivery-drift verification use the
same customer, artifact, release manifest and billing account as NoSpoilers. Building this as a
separate app would duplicate the most sensitive data and workflow.

### Package Identity

`package-impersonation-monitor/PRD.md`

Typosquat, maintainer, ownership, dormant-package and release-behavior monitoring extends the same
npm/package watch already required by NoSpoilers. It is an optional later module, not a new login
or product database.

### Disclosure Desk

`disclosure-desk/PRD.md`

Artifact Leads grows into an internal verification and responsible-disclosure workflow. It remains
admin-only. If an external consultancy product is ever justified, copy the approved PRD into a new
repository then; do not build that commercial app now.

### Electron

DMG/EXE/AppImage/MSI scanning stays in the NoSpoilers UI and subscription. It runs in a separate
disposable worker service for safety; a separate worker is not a separate product.

## Separate application

### Employee Public Footprint

`employee-public-footprint/PRD.md`

This alone receives a separate repository, database, permissions and Cloud Agent conversation. It
monitors enrolled employees’ personal public repositories and therefore has materially different
privacy, legal and authorization requirements.

## Development order

1. **Done in this repo:** NoSpoilers Phases 0–2 customer surfaces, Release Ledger and Package
   Identity foundations, internal Disclosure Desk. See [`docs/STATUS.md`](../STATUS.md).
2. **Next:** human-gated launch (Stripe, Resend, Railway, domain) in [`docs/ROADMAP.md`](../ROADMAP.md).
3. Keep Disclosure Desk internal. Do not split it into a consultancy app.
4. Create Employee Public Footprint in a new repository only when that work is intentionally started.

Do not create four repositories or a multi-product monorepo.
