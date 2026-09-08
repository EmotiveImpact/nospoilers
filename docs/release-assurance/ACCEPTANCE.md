# Complete vision: implementation and acceptance map

This table is a status ledger, not a feature-completeness claim. No row becomes production-proven because a helper exists or a native test passes.

| Discussed capability | Repository state after this increment | Remaining evidence or work |
| --- | --- | --- |
| Release as central object and canonical detail | Existing ledger/detail preserved; new companion mounted in both detail paths | Integrated visual and route acceptance; reconcile legacy headline |
| Persistent release history | Existing records/retention reused | No perpetual-retention promise; no new history store |
| Release comparison and unexpected files | New bounded, source/channel/format-compatible manifest comparison and UI | Real historical fixtures; stable stream identity for arbitrary uploads |
| Customer-specific normal behaviour | Tested median/MAD helper only | Persist explicit baseline adoption, exclusion/revocation, drift history and alerts |
| Deterministic readiness | New receipt-bound interpretation with ready/review/blocked/unknown | Advisory only; whole-app verdict cutover still open |
| Policy engine and exceptions | Existing policy/exception engine reused | No newly persisted custom assurance policies |
| Policy preview | New reversible stricter-findings preview, labelled unsaved | Not a full policy editor or auto-adoption flow |
| Before/after separation | Implemented in the companion | Reconcile legacy headline and future CI enforcement contract |
| Production verification | Existing saved delivery checks interpreted with binding/freshness | Runtime proof; no new verification worker |
| Production multi-asset parity | Not built by this increment | Deployment/manifest binding, approved representations, multi-origin coverage and races |
| Continuous Coverage | Existing product retained | Existing operational go-live gates; no new CDN schedule |
| Release Passport | New private, redacted unsigned export tied to receipt identity | No independent signature/certification; reuse existing public-sharing approval |
| Remediation to rescan | Existing controls preserved; new rule-based guidance points to them | Direct resolved-by/new-receipt linkage across every source and real end-to-end proof |
| Investigation agent | Deterministic assistant and machine-readable read API built | No LLM investigation or root-cause attribution |
| Model-generated remediation PR | Existing bounded remediation PR workflow retained | No new model provider; explicit review, permissions, budgets and tests required |
| Agent evidence summaries | New rule-based structured summary | No new provider-backed text generation |
| No automatic merges or disclosure | Preserved; new API has no write methods | Verify in full composition/integration tests |
| Artifact Leads / Disclosure Desk separation | Untouched and remains internal | No new commercial CRM lifecycle implemented |
| Commercial versus disclosure states | Separation documented in outreach and handoff | Any commercial-state expansion requires its own implementation |
| Navigation and homepage | Approved baseline preserved | No wholesale navigation or brand redesign in this change |
| Accessibility/behavioural UI | Single main action, native details, keyboard preview, honest states, private export | Native checks pass; real React/assistive-tech/user testing remains |
| Long-term retention | Product/experiment plan documented | No empirical retention result or guarantee |
| Agency portfolio | Not implemented here | Authorised multi-client model, delegated access, reporting and billing scope |
| Enterprise SSO, SBOM, Sigstore | Remain on ice | Separate paying demand/owner approval and implementation |
| Tests | 101 focused cases, 55 native browser checks; wrappers/scripts saved | Full locked Vitest, React, Hono/store, build/lint/CI and private deployment |

## Next implementation sequence

RA-01: finish integrated verification and remove conflicting legacy readiness labels without changing policy semantics silently.

RA-02: introduce a stable release-stream identifier covering workspace, source, product, channel and artefact role. Migrate conservatively; unknown stays unlinked. Require authorised human linking of arbitrary upload streams.

RA-03: baseline adoption must reference eligible immutable receipts, be tenant-scoped, record approver/reason/time/policy, and support revision/revocation. Exclude inconclusive/failed/exception-covered evidence by default. Do not train on findings merely suppressed to clear a screen.

RA-04: build post-deploy asset parity for a deliberately bounded supported path. Store the approved manifest hash and deploy ID; report missing, extra, mismatched, unobserved and unsupported separately. Test CDN compression, transformed assets, cache propagation, redirects, ownership expiry and late deliveries.

RA-05: version and adopt a new preflight enforcement contract, initially advisory. Test timeout and stale-receipt rejection, decision-to-digest binding, concurrency, audited override and rollback. Do not require post-deployment evidence for permission to deploy.

RA-06: add durable remediation linkage: original finding -> reviewed PR -> build -> new signed evidence -> verified resolution. Acknowledgement or exception must not masquerade as resolution.

RA-07: only then add opt-in provider-backed assistance with tenant data boundaries, untrusted-content handling, read/write capability separation, cost ceilings, evaluators and auditable human approval. Never have a model mint a passing receipt.

RA-08: add opt-in outcome summaries and customer research instrumentation after privacy/retention decisions. Use real release events and scoped denominators, not hypothetical money saved or logins as a success proxy.
