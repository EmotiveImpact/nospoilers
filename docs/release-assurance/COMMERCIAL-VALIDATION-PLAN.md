# Commercial validation and operating plan

Date: 9 September 2026. Status: proposed operating framework, not live instrumentation, approved spending or achieved results.

Read BUSINESS-NORTH-STAR for strategy, ACCEPTANCE for engineering state and ../growth/OUTREACH-LIBRARY-v2.md for messages. This document operationalises the existing business discussion. It does not add product scope or change the $29/$99 contract.

## 1. What must be proved

The business hypothesis is that software teams will repeatedly pay for accurate, low-friction release exposure checks, comparable history and useful evidence after the first configuration problem is fixed. An installation, security finding, interview compliment or signed-up trial is not sufficient proof.

Working commercial milestone: ten independent paying organisations that keep NoSpoilers in their release workflow across subsequent genuine releases. This is a proposed decision milestone, not statistical proof of product-market fit or a forecast. Track cancellations and teams with no subsequent releases too, rather than selecting only success stories.

## 2. Revenue model and currency discipline

Owner ambition: £500,000 MRR, or £6,000,000 annualised recurring run rate. This is revenue, not profit, bank balance, valuation or personal income.

Current subscription amounts are USD. Calculate MRR in the contract currency first. For an internal GBP report, record the selected conversion source, date and GBP-per-USD rate `g`; preserve an additional constant-currency view so FX movements are not confused with customer growth. No current exchange rate is assumed here.

Undiscounted monthly-plan illustration:

`MRR_USD = 99 × Team_accounts + 29 × Solo_accounts`

`MRR_GBP = g × MRR_USD`

`Team_accounts_for_£500k = ceil(500000 / (99 × g))`

| Plan/billing illustration | Monthly normalised USD amount | Accounts for $100k MRR | Accounts for $500k MRR |
| --- | ---: | ---: | ---: |
| Team monthly | $99 | 1,011 | 5,051 |
| Solo monthly | $29 | 3,449 | 17,242 |
| Team annual at $990/year | $82.50 | 1,213 | 6,061 |
| Solo annual at $290/year | $24.1667 approximately | 4,138 | 20,690 |

Annual examples use the documented ten-month-price annual offer; validate the actual checkout amounts before quoting. Rounding customer counts is always upward. Discounts and interval mix change the answer. Invoicing $990 upfront does not create $990 of MRR.

Preserved same-currency monthly examples: 3,000 × 99 + 7,000 × 29 = 500,000; 4,000 × 99 + 3,587 × 29 = 500,023. With the actual current prices these are USD, not GBP. 5,000 Team accounts yield $495,000, not $500,000.

### Alternative larger-contract scenario from the discussion

This is not the approved plan ladder. Do not relabel the current $99 features or add these prices to checkout.

| Hypothetical GBP monthly contract | Customers at £100k scenario | Customers at £500k scenario |
| --- | ---: | ---: |
| £500 | 60 = £30,000 | 300 = £150,000 |
| £2,000 | 20 = £40,000 | 100 = £200,000 |
| £5,000 | 6 = £30,000 | 30 = £150,000 |
| Total | 86 organisations = £100,000 | 430 organisations = £500,000 |

Those contract values would require validated buyer value and real supported scope. They are not demonstrated willingness to pay. The previously discussed £1,000 to £3,000 assisted onboarding/pilot amount is also an optional services hypothesis, not the default entry route or MRR. A paid pilot means the customer pays NoSpoilers; no pilot payments to prospects are assumed.

### Acquisition and churn arithmetic

Illustration only: to reach 5,051 accounts from zero over 36 monthly periods with constant 1% monthly account churn and flat monthly additions `a`, use `N = a × (1 - (1-c)^t) / c`. This needs about 166.38 new paying accounts per month, so 167 in a rounded flat model. Early slow growth would require faster additions later. This is a $500k monthly-Team-price illustration, not a £500k forecast or committed deadline.

With hypothetical 10% trial-to-paid and 2% visitor-to-trial conversion, that acquisition rate implies roughly 1,664 trial starts and 83,189 visits per month. These percentages are deliberately invented scenario inputs, not researched benchmarks. Replace them with observed channel-specific rates; do not equate visitors with qualified organisations.

At 5,051 $99 accounts, 1% account churn at the same price is approximately $5,000.49 MRR lost per month before expansion. At 430 equally valued accounts, 1% account churn would need roughly 4.3 replacement accounts monthly, but real enterprise churn is lumpy. Account churn and revenue churn must be reported separately.

## 3. First market and offer

Primary test segment: commercial software teams with recurring supported releases, broadly the previously discussed 10 to 100 engineers. Secondary test segment: agencies maintaining substantial client applications. Segment sizes are targeting hypotheses, not strict qualification facts.

For each account, record the application/artefact type, supported scope, release cadence, current checking process, problem owner, buying authority, evaluation criterion and recurrence reason. Do not assume a public repository is proprietary or that intentionally published source maps represent a problem.

Start with a researched list of about 30 software businesses and 20 agencies as a manageable founder-led experiment. Candidate organisations from RESEARCH-SNAPSHOT are leads to research, not prequalified buyers. Recheck role/contact routes before using them. Keep commercial outreach away from security-reporting inboxes unless discussing an actual disclosure.

Default offer: evaluate a real authorised release using the documented five-day trial and accurately state the actual billing behaviour. Never promise no card, no automatic renewal, extended access or a free assisted cohort until that exception is approved and working. State billing terms before checkout. A positive case study, logo use or testimonial is optional and separately consented.

## 4. Commercial execution stages

These are relative operating windows after appropriate launch readiness, not delivery estimates or a promise to work asynchronously. Deployment security gates remain mandatory and separate from sales hypotheses.

### Initial readiness and discovery

Prove a customer can authenticate, authorise the intended surface, complete a bounded scan, understand the decision, receive an enabled notification and use the billing flow. Verify cancellation, revocation and evidence access according to actual terms. Use the existing Gate A/launch documents rather than calling an adapter live because it exists.

In parallel, conduct approximately 20 buyer conversations. Ask for the last concrete release problem, the current control and its owner, the cost in work, what a clean result would mean, what would justify ongoing payment, and what would cause cancellation. Do not lead with claimed leaks or a broad list of proposed features. Save permissioned notes with dates and distinguish exact customer statements from our interpretation.

Use a controlled demonstration: incorrect release content, scoped finding, reviewed configuration fix, rebuilt artefact and new evidence. Synthetic demonstrations must be labelled. Do not substitute a fictional customer result for a pilot.

### First evaluations

Invite five to ten appropriate organisations through the normal trial or a specifically approved assisted arrangement. Agree the supported scope and success criterion in advance. Observe setup, first result comprehension, false-positive handling and the next genuine release. A clean scan is not a failed evaluation simply because it found no issue.

At the end ask what they would keep, whether they will continue at the actual price, and which objection prevents continuation. Record a paid account only from reconciled billing evidence, not from a manually changed prospect status.

### Repeatability review

Review the whole cohort after enough time for further releases and a renewal decision. Choose the stronger segment based on repeat use, retained revenue and delivery burden. Do not extrapolate the ten-account milestone into a guaranteed £500k business.

The historical MONTH1 estimate of four to eight early paying accounts and the later ambition of ten retained business accounts came from different go-to-market assumptions. Neither is achieved, and they must not be combined into one confident forecast. Treat the proposed first 90-day programme as an experiment; actual pace depends on readiness, recruitment and release cadence.

### Scaling decisions

Scale acquisition only after the chosen segment has repeat value, onboarding is reproducible, cost to serve is understood and security failures have an accountable response. Start with founder-led sales and a technical onboarding/support role when measured work requires it; do not imply those people have been hired. Larger sales teams or paid acquisition need observed channel economics and owner budget approval.

Agency referral/portfolio pilots should begin with explicit client authority. Do not promise a consolidated multi-client product, revenue share, white labelling or support SLA before implementation and commercial approval. Platform licensing and large partnerships are upside hypotheses, not included as guaranteed revenue.

## 5. Metric dictionary

These are proposed internal definitions for consistent measurement, not a statement of formal accounting treatment. Reconcile financial reporting with the responsible finance adviser.

| Metric | Definition and limits |
| --- | --- |
| Qualified organisation | A documented supported use case, real business, relevant owner and recurring release need. A scanner signal alone does not qualify. |
| Trial start | Actual trial lifecycle event from the product. Store start/end, cohort and offer terms; do not infer from a page visit. |
| Technical activation | First completed, authorised production-intended scan with available scoped evidence, not merely an upload, signup or queued job. |
| Comprehension | In research, the user can state the decision, scope and next action. This cannot be inferred simply because a page rendered. |
| Repeat release use | A subsequent genuine release in the intended stream receives a check. Identical retries must not inflate this metric. |
| Paid conversion | A billing-confirmed paid subscription, using a fixed conversion window. Report matured cohorts and censored recent trials separately. |
| MRR | Normalised contractual recurring monthly value, after recurring discounts; exclude one-off services, bounties and pass-through taxes in this internal measure. Report currency and handling of refunds, delinquency and cancellations. |
| ARR run rate | 12 × MRR on the same basis; not cash receipts or a guaranteed next-year revenue total. |
| Logo retention | Original paying organisations still paying at the selected cohort age divided by that original cohort. Show the raw counts. |
| Gross revenue retention | (Opening cohort MRR - churn - contraction) / opening cohort MRR. Exclude new accounts and expansion. |
| Net revenue retention | (Opening cohort MRR - churn - contraction + expansion) / opening cohort MRR. Exclude new-account MRR. |
| Gross margin | (Recurring revenue - consistently classified direct delivery costs) / recurring revenue. Include the chosen support/hosting/model/notification allocation; do not change the allocation to flatter results. |
| CAC | Fully loaded, attributed acquisition cost divided by new paying accounts from the same channel/cohort. Include founder time in a separate fully loaded view. |
| CAC payback | CAC / monthly gross profit per acquired account, with assumptions and actual retention shown. Do not use revenue instead of gross profit. |
| False-positive burden | Human-confirmed unhelpful findings and review time, segmented by rule and release format. Disagreement without adjudication is not automatically a false positive. |
| Verified remediation time | Time from the recorded issue to appropriate new evidence resolving it. Record censored unresolved cases; exceptions are separate. |
| Coverage health | Fresh supported checks divided by explicitly configured eligible surfaces, with unavailable/paused/excluded counts. This is not all software the customer owns. |

Do not use simple lifetime-value formulas on a tiny, immature cohort to justify large acquisition spend. Distinguish observed costs from assumptions.

### Unit-economics guardrail examples

At a hypothetical 80% direct gross-margin target, a $99 monthly account has $19.80 and a $29 account $5.80 of direct delivery-cost allowance. These are arithmetic planning limits, not measured costs or approved targets. Annual discounts reduce those allowances. Measure archive bytes, processing time, retries, retention storage and support work before promising broad unlimited service.

Earlier discussion mentioned 75% or greater gross margin and CAC payback inside twelve months as possible planning goals. They are not measured results or universal industry requirements. Adopt or revise them only after actual cost data and budget approval.

## 6. Proposed event and attribution contract

Not implemented by this document. Before instrumentation, approve privacy, retention, access and consent requirements. Prefer existing operational events and billing records; do not buy an analytics service by default.

Suggested events: `trial_started`, `scan_completed`, `stream_record_captured`, `baseline_adopted`, `baseline_revoked`, `remediation_verified`, `subscription_paid`, `subscription_cancelled`, and `notification_preference_changed`. Treat these as proposed names, not existing API endpoints.

Minimal metadata: pseudonymous organisation/workspace and record IDs, event type/time, schema version, plan/currency where necessary, coarse outcome, authorised scope, experiment assignment and internal acquisition source. Deduplicate by stable source event and count organisations separately from installations or seats. Record window start/end and ingestion delays. Avoid source code, secret values, private paths, raw artefacts, emails and signed public-sharing tokens in analytics.

Paid state comes from billing; security-case verification comes from the desk; product activation comes from completed work. Do not collapse all three into one prospect status or export disclosure details to a marketing provider.

## 7. Risk and decision register

| Risk | Signal to investigate | Response / evidence required |
| --- | --- | --- |
| One-time-fix value | Customers cancel after the original issue is resolved | Interview cancellations, observe subsequent releases and change the offer before adding unrelated features. |
| Noise or weak novelty signals | Unhelpful alerts and repeated dismissals | Calibrate by format/stream; show sample and scope; never lower detection truth to improve engagement. |
| False green or deployment mismatch | A result implies more than the inspected evidence | Pause affected claims/enforcement, investigate, fix tests and notify through the approved incident process. |
| NoSpoilers itself blocks releases during outage | Queue delays, unknown evidence and customer bypasses | Define supported latency, timeout/fail behaviour and reviewed emergency override; no silent fail-open for adopted enforcement. |
| Tenant, retention or credential failure | Unauthorised read, retained evidence beyond policy, exposed values | Treat as a security issue; scope/pause affected rollout and verify access/deletion/recovery. |
| $29/$99 service is uneconomic | Heavy processing or support dominates account revenue | Measure workload, preserve fair-use terms and test operational improvements; no surprise scan charges. |
| Founder-assisted work cannot scale | Each trial needs substantial custom engineering | Standardise onboarding, narrow the segment or explicitly price approved services. |
| Model assistance invents facts or changes | Unsupported explanation, unsafe patch, data leakage | Keep deterministic result authority; test evidence grounding, capability limits and review; disable unsafe capability. |
| Revenue depends on uncommitted partner | Forecast includes a hypothetical large contract | Exclude from base case; validate direct customer demand first. |
| Research overstatement | List prices or theory quoted as customer proof | Attach evidence level; correct public copy before use. |

Responsible functions initially: owner for commercial/rollout approvals, engineering for integration and evidence correctness, product/design for task testing, security/operations for incident and access controls. These are responsibility labels, not claims that a staffed department exists. No production customer rollout without named accountable people and a support/incident route.

## 8. Decision gates and evidence storage

Gate A: integration and operational requirements genuinely pass; see the existing acceptance/launch documents. Gate B: customers reach a comprehensible first result. Gate C: subsequent releases and payments show recurring value. Gate D: acquisition and support are repeatable with understood unit economics. Gate E: expand a proven channel or higher-value offer. These commercial labels do not replace the repository's existing engineering Gate A/Gate B terminology; use the full phrase 'commercial decision gate' in reports to avoid confusion.

For each research account, record use case, baseline workflow, supported scope, dates, consent, success criterion, product version, observed result, payment evidence, cancellation reason and follow-up permission. Store sensitive customer notes in an approved private system, not this source repository. Commit redacted aggregate conclusions and dated decisions only.

Before calling a pilot successful, distinguish real data from synthetic fixtures, stated intention from paid continuation, and correlation from an experimentally supported effect. A working scan does not alone prove retention. A renewed account does not alone prove that a particular UI treatment caused renewal.

## 9. Next action

The next engineering work remains integrated verification and one consistent release authority, followed by the existing documented capture/parity/enforcement/remediation sequence. The next commercial work is a small, supported evaluation cohort once the relevant readiness gates pass. Do not use this plan as a reason to keep adding strategy documents instead of validating the product.
