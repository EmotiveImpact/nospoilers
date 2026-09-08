# Behavioural evidence and testable experience hypotheses

Date checked: 9 September 2026. Status: research and experiment design only. No experiment below has been run by this documentation change and no retention uplift is claimed.

Read BEHAVIOURAL-DESIGN for the existing UI decisions and anti-dark-pattern rules. This companion turns the earlier behavioural-economics vocabulary into a qualified evidence register and test protocol. A published effect in another context is not proof that it works in a release-security product.

## 1. Evidence register

### R1. Motivation through competence and autonomy

Ryan and Deci (2000), *Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being*. American Psychologist, 55(1), 68-78. Publisher abstract inspected: https://doi.org/10.1037/0003-066X.55.1.68

The theory describes autonomy, competence and relatedness as psychological needs relevant to motivation. This supports a question to test, not a subscription-retention prediction: does clear evidence plus reversible, explicit control help the operator feel capable? No claim is made about neurotransmitters, addiction or a quantified NoSpoilers effect. The complete paper was not analysed in this audit.

### R2. Goal proximity and visible progress

Kivetz, Urminsky and Zheng (2006), *The Goal-Gradient Hypothesis Resurrected: Purchase Acceleration, Illusionary Goal Progress, and Customer Retention*. Journal of Marketing Research, 43(1), 39-58. Publisher abstract inspected: https://journals.sagepub.com/doi/10.1509/jmkr.43.1.39

The reported experiments concern reward programmes and task effort as a reward approaches, including artificial progress. Transfer to B2B security is unproven. NoSpoilers should test only truthful progress such as completed checks and eligible distinct history. Artificial head starts, invented maturity and daily streak penalties are explicitly rejected. Never conflate a count threshold with scientific confidence.

### R3. Choice overload is not a universal law

Scheibehenne, Greifeneder and Todd (2010), *Can There Ever Be Too Many Options? A Meta-Analytic Review of Choice Overload*. Journal of Consumer Research, 37(3), 409-425. Publisher abstract inspected: https://doi.org/10.1086/651235

The review reports a near-zero average effect with substantial variation across 50 experiments. It does not establish that reducing choices always improves outcomes. A prominent next action is therefore a task-specific design hypothesis, not justification for removing essential alternatives. Expert users must retain access to detailed evidence and controls. No full-text meta-analysis was performed here.

### R4. Status-message accessibility

W3C, *Understanding Success Criterion 4.1.3: Status Messages*, WCAG 2.2 guidance. Official page inspected: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html

Status changes should be available to assistive technology without unnecessary focus changes. Apply this to asynchronous progress, preview state and errors. This is accessibility guidance, not causal evidence that a status message improves SaaS retention. Avoid an excessively chatty interface.

### R5. Genuine task states

GOV.UK Design System, *Task list*. Official component guidance inspected: https://design-system.service.gov.uk/components/task-list/

The guidance describes completed and outstanding tasks and appropriate use of a task list. For NoSpoilers, use real task states only when the workflow needs them. A one-release check must not require every optional integration to achieve a fabricated 100% score. This is a design reference, not proof that the current app implements that component or meets an accessibility standard.

### R6. Technical truth overrides reassuring copy

webpack, *Devtool*. Official documentation inspected: https://webpack.js.org/configuration/devtool/

The hidden-source-map option still creates a map while omitting its reference comment. Therefore a suggested configuration change cannot itself justify 'exposure resolved'. Confirm the rebuilt and published artefacts within scope. This technical source corrects an earlier conversational example; it is not behavioural research.

Other terms used in BUSINESS-NORTH-STAR, including peak-end effects, endowment and loss aversion, are retained as design prompts, not empirically established NoSpoilers mechanisms. This audit does not claim to have independently reviewed every underlying theory. In particular, describing accurate consequences is not itself a validated loss-aversion intervention.

## 2. Experiment protocol

Start with moderated task sessions, not a large automated A/B programme on ten customers. Use synthetic or expressly authorised evidence and prevent research controls from changing real deployment policy. Record the version, recruitment criteria, session count, task, expected interpretation, observed mistakes and limitations.

For later controlled product experiments, assign at organisation/workspace level to avoid teammates receiving contradictory variants. Define eligibility, analysis window, primary metric, meaningful improvement threshold, guardrails and stop rule before exposure. Determine sample size from observed baseline rates and the minimum effect worth detecting; do not invent significance from small cohorts or repeated peeking. Release cadence and self-selection can confound history/retention associations.

Never randomise weaker security rules, more permissive access, misleading green states, billing disclosures, cancellation access or withholding a verified issue. Safety and accessibility are constraints, not conversion variables.

## 3. Proposed experiments

| ID | Hypothesis and proposed treatment | Primary observation | Safety and interpretation guardrails |
| --- | --- | --- | --- |
| BX-01 First useful result | A scoped first-check flow with one continuation action is easier than an all-integrations checklist | Time and completion to first authorised check, plus the user's explanation of scope | GitHub optional when the actual flow supports that. Never expose a third party's detailed website evidence. No fake progress. |
| BX-02 Decision comprehension | A clear decision with adjacent scope, time and unknowns improves correct interpretation | Correct answer to 'what passed, what is unknown and what should happen next?' | Include clean, blocked, missing and stale cases. Stop if users read 'passed' as a universal safety certificate. |
| BX-03 Historical context | Baseline identity and eligible distinct sample counts make changes easier to assess | Correct recognition of first-seen versus dangerous; time to explain the comparison | Show exclusions, retention gaps and changed policy/engine. Do not reward repeated identical uploads. |
| BX-04 Reversible policy preview | An explicitly unsaved preview helps users understand stricter treatment | Correct prediction of the preview and confirmation that no setting was saved | No auto-save, no hidden enforcement, no charge. Retain the actual source policy and receipt. |
| BX-05 Verified closure | Linking the original finding to new evidence reduces uncertainty after remediation | Correct distinction between resolved, accepted risk and still unknown | Requires the real durable linkage implementation. No celebration of a dismissal as a fix; current guidance alone is not sufficient. |
| BX-06 Quiet outcome summary | An opt-in summary makes useful background work visible without forcing visits | Recipient's ability to explain coverage and unresolved items; useful replies | Implement only after privacy and notification controls. Monitor unsubscribes/complaints; no invented savings or mandatory daily interaction. |
| BX-07 Easy evidence portability | A clearly scoped private export helps the buyer use the result internally | Successful export and correct understanding of public versus private sharing | Explicit publication remains separate. Verify redaction and retention; no data hostage or invented certification. |

BX-01 to BX-04 and BX-07 can test existing components, but full integration must still be verified. BX-05 and BX-06 depend on documented unfinished product work. Describing a test is not a claim that the underlying feature is shipped.

## 4. Concrete research tasks

Ask the participant to choose an appropriate release surface, complete a check, state what was not checked, interpret a new .map finding, explain a failed network observation, compare two distinct releases and identify the human-approved reference. Then ask them to preview stricter review, demonstrate that it is unsaved, and export privately without publishing.

A response that treats novelty as proof of a vulnerability, attestation presence as cryptographic verification, or an unknown observation as clean is a critical comprehension issue even when task completion is fast. Record errors rather than optimising only for speed or button clicks.

For a reference-change session, ask what adopting a new baseline changes about historical evidence. The correct model must preserve old receipts. For a cancellation/export session, test that the customer can understand actual retention terms without fear-based persuasion.

## 5. Honest completion copy

Proposed examples only; populate from verified product state:

- Completed artefact check: 'This artefact passed the recorded exposure policy. Production delivery has not been checked.'
- Historical observation: 'New in the 12 eligible distinct releases compared. Novelty alone is not a vulnerability.'
- Inconclusive inspection: 'The inspection did not complete. No passing decision is available.'
- Reference changed: 'Reference adopted for subsequent checks. Earlier receipts are unchanged.'
- Verified remediation, after that lifecycle exists: 'The original finding was not reproduced in the rebuilt artefact checked on [time]. See the scope and new receipt.'

Do not claim the release has not shipped merely because it lacks NoSpoilers approval. Other deployment paths may exist. Do not claim all public assets matched when the crawler observed only a bounded subset. A calm successful state needs no confetti, fabricated incidents or inflated financial impact.

## 6. Measurement and stop rules

Use the definitions in COMMERCIAL-VALIDATION-PLAN. Primary early outcomes are correct comprehension, authorised completion, subsequent genuine release checks and actionable remediation. D30/D90/D180 paid retention is a later outcome, reported with cohort counts and observation windows.

Pause a treatment immediately for incorrect safety interpretation, unauthorised exposure, accidental writes/publication, inaccessible required controls or misleading billing. Investigate whether the problem is copy, interaction or underlying evidence rather than hiding the warning.

Prototype a measurement before implementing telemetry. Any eventual collection needs defined purpose, retention, access and opt-out handling. Do not track individual employee productivity or send source, secrets, paths or disclosure cases to analytics/model providers. Quiet successful automation counts as value even when the dashboard is not opened.

## 7. Required research record

For every experiment, save an ID, hypothesis, code/design version, recruitment/eligibility, treatment and comparison, primary outcome and guardrails, sample/window plan, researcher, approval, dates, result and limitations, decision and next action. Customer-identifying notes remain in an approved private research system; commit redacted conclusions only.

Until results exist, describe these as hypotheses. A behavioural reference helps design a test; the customer's observed experience decides whether the treatment earns its place.
