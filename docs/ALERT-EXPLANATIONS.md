# Alert explanations

Alert detail uses deterministic, reviewed guidance from `src/watch/alert-guidance.ts`. No AI provider is invoked, no customer evidence is sent externally and explanations never change a verdict, receipt, alert status or access permission.

The catalog covers 25 scanner rules and 41 event kinds, plus sensitive-path warnings, supported scan families, map-custody checks and incomplete checks. Each provides an evidence-scoped meaning, suggested action and verification step. Unknown events/rules remain visible with an explicit limitation instead of a guessed explanation.

For mixed scanner findings, detail groups paths by rule and shows the distinct correction and verification for each. One rule is expanded initially; multiple rules can be expanded separately. The reviewable **Prepare AI fix brief** uses this same guidance and includes only selected recorded identity/rule/path fields, not file contents or raw provider responses. Nothing is copied or sent until the user chooses to copy it.

Repository/package metadata events describe access, identity or publication changes. They do not automatically establish exposed contents or compromise. Event-only detail uses **Event to review**, avoids exposure-duration claims and omits an irrelevant empty rotation checklist. Scan findings preserve their recorded evidence and existing response controls.

Examples:

- A source-map reference does not prove its external map was accessible.
- A credential pattern is not checked by authenticating with the credential.
- npm size/provenance metadata is not a downloaded-size measurement or signature verification.
- Added repository access does not mean its releases have been scanned.
- An incomplete check is neither a passing scan nor proof of a leak.

When adding a rule or event, add its explanation and a regression covering the scope of evidence, correction and verification. Do not infer root cause from a title, invent missing paths, or claim that resolving an alert proves a fix. Optional aggregate release explanations in `release-assurance/EXPLANATIONS.md` remain a separate, inactive provider integration.
