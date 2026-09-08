# Coverage, scan, and Alerts IA revision

Audited and revised 5 September 2026 using the local production workspace and the master-flow prototype.

## User goal

Understand what is persistently monitored, start a new check without confusing it with setup, inspect the resulting release, and respond to alerts.

## Steps

1. **Coverage — healthy prototype.** Persistent repositories, packages, websites, and private map destinations now have a dedicated inventory, health summary, filters, selection, and detail panel.
2. **New scan — healthy prototype.** The scanner remains a separate global action and launcher. It no longer masquerades as the Coverage page.
3. **Release detail — healthy prototype.** Scans and monitoring feed durable release records and their evidence.
4. **Alerts — healthy prototype base.** Open, In progress, and Resolved are visually separate, mutually exclusive, and interactive. Assignment remains an independent filter. The content begins 78px higher than the annotated version.

## Production mapping

- Customer-facing `Sources` becomes `Coverage`; the internal `/watch/sources` route can remain stable.
- Authenticated `New scan` becomes a global product action and dedicated launcher.
- The public `/scan` page remains the pre-auth acquisition intent; scanning and findings begin after authentication.
- Releases remain the history and decision record produced by scans and monitoring.

## Strengths

- The model now uses outcome language instead of ingestion terminology.
- Inventory, action, result, and response are separate concepts.
- Alert status controls have clear spacing, 40px targets, count badges, selected state, and working filter behavior.

## Remaining risks and limits

- The prototype still uses simulated data and is not API-connected.
- Production needs loading, empty, permission, expired coverage, connection failure, and retry states.
- Visual inspection confirms text labels and keyboard-addressable controls, but full screen-reader, zoom, contrast, and reduced-motion testing remains outstanding.

## Evidence

- `00-production-sources.png` — current production Sources empty state used for comparison.
- `01-coverage.png` — new Coverage inventory and selected source detail.
- `02-alerts-in-progress.png` — revised Alerts status control and vertically tightened workspace.
