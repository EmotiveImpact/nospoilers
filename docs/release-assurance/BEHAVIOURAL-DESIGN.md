# Behavioural design and durable customer value

8 September 2026. These are product hypotheses and design decisions, not claims that a UI treatment guarantees multi-year retention.

## Retention thesis

A customer should stay because each new release produces useful checks, comparable evidence and a shorter path to a well-informed decision. They should not stay because export, cancellation or migration is deliberately painful. Accumulated knowledge is useful only when accurate, portable, appropriately retained and attributable to the correct release stream.

The emotional target is relief plus competence: “I understand what happened and what to do next.” Excitement should come from a useful first check, an unexpected but verified change explained clearly, or a completed remediation loop. Do not manufacture fear or problems to make the product appear valuable.

## Built in this increment

| Mechanism / hypothesis | Actual implementation | Guardrail |
| --- | --- | --- |
| Salience and reduced choice burden | One prominent contextual next action; secondary refresh/export | Never hide relevant evidence or necessary choices |
| Progressive disclosure | Native details for checks, file changes, guidance and limitations | Scope and unknown delivery remain visible before expanding |
| Recognition rather than recall | Side-by-side recorded stage labels, earlier release ID and exact change counts | No comparison across unrelated sources or channels |
| Reversible exploration | Explicit stricter-review simulation with keyboard announcement | No checkbox silently saves policy, activates enforcement or bills |
| Visible outcomes | Actual manifest additions/removals/changes and accepted-risk counts | No fabricated first-release baseline, fake safety score or invented prevented loss |
| Competence / closure | Rule-specific next steps ending in a new scan record | Guidance is not an autonomous fix or verified remediation result |
| Autonomy and portability | Private passport export; original evidence retained separately | Not a lock-in mechanism or public trust badge |
| Predictable feedback | Distinct missing, stale, inconclusive, failure and permission states | A failed fetch never becomes green; refresh never secretly scans |

The reviewed native renderer supports keyboard-operated details, visible focus, text status labels, reduced motion and mobile layout. Existing app-wide accessibility still needs integrated acceptance. No new engagement telemetry is sent.

## Corrections to earlier conversational suggestions

“Nothing ships until NoSpoilers says it is safe” is too broad. Prefer “Checks the recorded release against the selected exposure policy”. A scanner does not prove absence of every security problem.

A signed receipt is evidence integrity, not certification. An unsigned passport must not acquire a “verified” badge merely because it contains a digest. Attestation presence is not cryptographic provenance verification.

“Hidden source map” does not mean the output map is absent. Preserve private debugging while checking actual published bytes. Do not prescribe a configuration toggle as proof of remediation.

“Cancelling would remove your history” must not become a threat. Honour the actual retention/export/deletion contract. Do not imply indefinite retention, secretly retain personal data for churn prevention, or add cancellation friction.

Do not make a post-deployment check a prerequisite for the deployment that creates its evidence. Before and after are distinct states.

## Next experiments, not yet implemented

Test the simplest useful onboarding: one customer-authorised release surface, completed check, understood outcome and one clear continuation action. Avoid an artificial setup score in which optional integrations prevent completion. Genuine empty states should invite the next useful action without inventing a sample incident.

Test an optional release outcome summary. Measure actual checked releases, unresolved findings and coverage gaps with explicit time windows. “Nothing blocking found in the inspected scope” is a useful outcome. Do not estimate money saved or breaches prevented without evidence.

Test consented notification cadence rather than daily streaks. A release-driven security product should not manufacture reasons to log in every day. Quiet successful automation is a valid customer outcome.

Test the remediation completion experience: link the original issue to the new passing scoped check, distinguish accepted risk, and make the follow-up action easy. Do not celebrate a dismissal as a fix.

## Measurement plan

Start with moderated task testing and a small customer cohort. Define the success metric before changing the UI. No retention percentage has been established here.

Activation: a completed authorised check that the customer can explain, not a signup or finding count. Repeat value: compatible subsequent releases checked and useful comparisons reviewed. Efficiency: time to understand and act on evidence, measured with consent rather than invasive employee monitoring. Quality guardrails: false-positive burden, missed scope, incorrect “ready”, abandoned permission paths and support requests. Retention: paying organisations continuing at 30/90/180 days, segmented by release activity. Do not confuse a company with no releases that month with a failed daily engagement streak.

For each experiment, record baseline, cohort/selection limits, primary outcome, guardrails, duration and a stop rule. Preserve opt-outs. Collect only necessary metadata and apply a defined retention period. Do not export source, secrets or private file paths to an analytics/AI provider as a side effect.

## Explicit exclusions

No fake social proof or scarcity; no preselected purchase; no confusing trial renewal; no countdown-driven panic; no artificial security score; no public naming from a discovery signal; no automatic risk acceptance; no variable-reward incidents; no cancellation obstruction; no hostage evidence. The aim is customer effectiveness, not dependence through confusion.

## Sources and interpretation

Primary sources consulted 8 September 2026. Their guidance supports the interaction/safety choices, not a forecast of NoSpoilers retention.

- GOV.UK task list: https://design-system.service.gov.uk/components/task-list/ . Use real task states and simplify the service before adding a long checklist. Applied here as a design constraint, not a claim that this panel implements the GOV.UK component.
- W3C status messages: https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html . Dynamic feedback should be available to assistive technology without unnecessary focus moves. Used for the reversible preview announcement.
- FTC dark-pattern report summary: https://www.ftc.gov/news-events/news/press-releases/2022/09/ftc-report-shows-rise-sophisticated-dark-patterns-designed-trick-trap-consumers . Documents deceptive choices and cancellation friction; used to exclude those tactics, not as UK legal advice.
- webpack devtool documentation: https://webpack.js.org/configuration/devtool/ . Hidden-source-map omits the reference rather than preventing map generation. Used to correct remediation guidance.
