# Private monthly outcomes

## Customer flow

In a recorded release's Release intelligence section, select its stream and open **Monthly outcomes · private**. Off by default. An administrator explicitly enables summaries; authorized viewers can read them. Select a UTC month, inspect the counts and follow the newest recorded release. Download is private unsigned JSON, re-fetched under current authority. Turning summaries off is one action and does not delete original evidence or require an active scan subscription. It does not retract a file someone already downloaded.

## What is counted

Only retained snapshots explicitly recorded in that stream and scanned within the selected UTC month. Current month stops at request time. Signed adapter evidence must agree with the recorded workspace/source/channel/format/digest/fingerprint/time. Missing or unverifiable evidence is unavailable, never silently green. Distinct artifact digests are different bytes, not deployments, customers or a confidence score. Repeated checks remain visible without inflating distinct releases. Exclusions, holds and suppressed findings are separately counted; historical passing scan status is not deployment permission.

The current approved reference and current remediation checks are evaluated now, not retroactively at month end. Accepted risk and closed alerts do not establish a fix. Missing/deleted/stale linked rebuilds cannot remain currently verified. An empty month does not mean nothing shipped or everything was covered. Only recordable snapshots contribute; this is not a log of every scanner attempt.

## Bounds and privacy

- Newest 100 monthly records, 16MB serialized evidence and 100,000 manifest entries. Partial windows are explicit.
- Newest 100 monthly reference events and 20 current remediation cases. Case counts span all dates and reuse bounded existing case evaluation.
- Monthly reads: 10/minute per actor, cooperative 20-second deadline; cancellation is checked at await boundaries, not database-query preemption.
- Derived schema-v1 events contain ID, type, workspace/stream IDs, timestamp and optional coarse scan outcome. Types: `scan_evidence_observed`, `baseline_adopted`, `baseline_revoked`.
- No people, raw paths, source contents, reasons, billing data, employee tracking, external ingestion or provider calls in the derived event projection. The surrounding private summary includes stream identity and record references.
- Preferences and existing operational consent audit persist; summaries/events are derived on read, not a new analytics archive. Original retention/deletion rules remain authoritative. Workspace/source access and preference revision are rechecked before return.

This is an implemented data-minimization contract, not external privacy certification or completed customer research. No measured retention improvement, savings estimate, security certificate or full-workspace coverage is claimed. Provider-backed explanations, wider operational/accessibility acceptance and later agency delegation remain separate work.
