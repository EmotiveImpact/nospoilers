# Pilot evaluation plan

**Review draft. Proposed measures, not an accepted pilot agreement or performance guarantee.**

## Preconditions and agreed scope

Name the buyer's technical champion, authorised data owner and decision-maker. Choose a small set of release archives and, only where ownership can be verified, a controlled website. Record the environment, permitted data, plan/allowance, operator, required integrations and retention expectations before submitting anything. Use local QA fixtures until operational and data-handling approvals are complete.

Confirm the remaining [Gate B acceptance](../GATE-B-COMPLETION-AUDIT.md) and operational [readiness requirements](../ENTERPRISE-READINESS-PLAN.md). Do not conduct an external pilot on the strength of a marketing page or an unverified provider-enabled flag.

## Proposed measurable success criteria

| Exercise | Measure and proposed acceptance condition | Evidence to retain |
| --- | --- | --- |
| First saved scan | 100% of agreed test submissions receive an identifiable saved attempt or an explicit admission failure. Record elapsed time, without inventing a target. | Attempt IDs, timestamps, actual queue and final state. |
| Known release exposure | Every agreed fixture exposure is either explained by a finding or explicitly identified as outside/unfinished inspection. No inconclusive result is labelled passing. | Expected fixture manifest, actual report, engine and scope. |
| Corrected release | A corrected package creates a new attempt; previous report and receipt bytes remain unchanged. | Before/after digests and saved records. |
| Role isolation | Zero successful unauthorised cross-workspace reads or mutations in the agreed test matrix. Viewers cannot initiate restricted actions. | Redacted HTTP outcomes and authorised test identities. |
| Alert response | Assignment and resolution record the intended actor and note; resolution creates no new passing scan. | Exact alert, response events and related attempt. |
| Independent approval | When required, a requester cannot approve their own exception; approved scope applies only to an eligible later check. | Request/decision history, scope and subsequent result. |
| Website ownership | An unverified origin cannot start protected work; a verified controlled origin can obtain an appropriately scoped saved outcome. | Challenge procedure, redacted verification response, result. |
| CI admission and result | A 202 response is treated as queued, not clean; the job is followed to a final report. Credentials are not printed in logs. | Redacted CI run and exact attempt/report link. |
| Notifications, if included | Explicit tests and provider acceptance are distinguished from configuration and recipient reading. | Redacted delivery records; no claim of exactly-once delivery. |
| Proof and retention | Verification starts no scan. Revocation makes the shared link unavailable; disconnection retains authorised evidence. | Private verification outcome and authorised retained evidence. |

These are proposed acceptance thresholds to agree, not a claim that every test has already passed. Add a numerical latency target only after establishing the environment and baseline. Report all misses, unsupported scope and unresolved operational risks.

## Evaluation sequence

1. Review scope and approvals, then run the authorised fixture baseline.
2. Exercise the core scan/result/recheck and access journeys using the actual application and APIs.
3. Evaluate selected live providers only after configuration and external-action approval.
4. Review evidence with the buyer, separating product gaps from setup/operational failures.
5. Agree go/no-go, remediation ownership and any paid conversion terms in writing.

No fixed pilot duration, SLA, automatic conversion, custom feature commitment or customer-data deletion is authorised by this plan. Stop work on an unexpected scope/access failure, preserve evidence and escalate through the agreed private contact path.
