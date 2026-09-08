# NoSpoilers business and product north star

Last consolidated: 9 September 2026.

This is the durable business, product, retention, behavioural-design and commercial context for NoSpoilers. It exists so a future agent can continue the company without needing the originating chat. Read this alongside `PRODUCT.md`, `PRODUCT-DIRECTION.md`, `INTELLIGENCE-HANDOFF.md`, `ACCEPTANCE.md`, `BEHAVIOURAL-DESIGN.md`, `RESEARCH-SNAPSHOT.md` and the current branch/PR state.

This file records strategy and hypotheses. It does not override implemented security invariants, customer entitlements, billing contracts, production-readiness gates or evidence semantics.

---

## 1. Company ambition

The owner is building NoSpoilers as a serious, multi-million-pound software business, not a side utility.

The current long-range commercial target is **£500,000 monthly recurring revenue**, equivalent to **£6 million ARR** before churn, expansion, discounts, taxes or currency effects. This is a target, not a forecast or achieved result.

The strategic question is therefore not only “can NoSpoilers find exposures?” It is:

> Can NoSpoilers become a product that software teams depend on every time they release software, remains useful after the first issue is fixed, compounds in value with release history, and is easy enough to adopt that thousands of teams can use it?

The answer the product should pursue is **release assurance infrastructure**.

---

## 2. Current commercial contract

Unless the owner explicitly changes it, the product contract remains:

- Solo: **$29/month**
- Team: **$99/month**
- five-day full trial
- annual pricing approximately 10 months for 12 months
- no free three-repository tier
- coverage subscription, not scan-credit pricing

Do not silently introduce an Enterprise public pricing tile, per-scan charges, credit packs, disclosure-based pricing or a new free tier.

### Revenue maths

For simple planning in the same currency unit:

- 500,000 / 99 = approximately **5,051 Team accounts**
- 500,000 / 29 = approximately **17,242 Solo accounts**
- 3,000 Team accounts × 99 + 7,000 Solo accounts × 29 = **500,000/month**
- 4,000 Team accounts × 99 + 3,587 Solo accounts × 29 ≈ **500,023/month**

These are arithmetic illustrations only. The current plans are priced in USD while the strategic target is expressed in GBP, so literal customer counts for £500k MRR depend on exchange rates, discounts and plan mix.

The key lesson is that the present $29/$99 model can mathematically reach very large recurring revenue, but it requires **thousands of paying accounts and strong self-service distribution**. Higher-ARPA business, agency or enterprise contracts may later reduce the required customer count, but those prices must be validated and explicitly approved before becoming product contracts.

Planning hypotheses discussed, not current prices:

- approximately £500/month software-team offer
- approximately £2,000/month larger product-team offer
- approximately £5,000/month agency/enterprise agreement

These are research hypotheses only. Do not implement them as billing entitlements without owner approval and customer evidence.

---

## 3. What NoSpoilers is becoming

### Entry category

**Release exposure protection**

> Git scanners tell you what was written. NoSpoilers tells you what escaped.

NoSpoilers checks what a team actually releases, not only what exists in source control.

### Expansion category

**Release security**

> Is this particular release acceptable under the organisation’s recorded release policy?

### Long-term category

**Release assurance infrastructure**

> What exactly are we shipping, what changed, what evidence do we have, does it meet policy, what actually reached production, what needs remediation, and can we prove the decision later?

The company should not become “another secret scanner with more rules”. Detection breadth matters, but the durable value is the **workflow and evidence loop around every release**.

### Safe positioning language

Avoid absolute claims such as:

> Nothing ships until NoSpoilers says it is safe.

Preferred direction:

> NoSpoilers checks the recorded release against the selected release policy, explains what changed, verifies supported production evidence, and preserves the decision trail.

A scanner cannot prove that software is universally safe. READY means the configured and recorded checks support release under the applicable policy and evidence scope, not absence of every possible vulnerability.

---

## 4. The product spine

The Release is the central product object.

```text
SOURCE / BUILD
     ↓
RELEASE STREAM
     ↓
ARTEFACT INSPECTION
     ↓
HISTORICAL COMPARISON
     ↓
APPROVED BASELINE / REFERENCE
     ↓
ORGANISATION POLICY
     ↓
READY / REVIEW / BLOCKED / UNKNOWN
     ↓
INVESTIGATE / REMEDIATE
     ↓
REBUILD + NEW SIGNED EVIDENCE
     ↓
DEPLOY
     ↓
PRODUCTION OBSERVATION / PARITY
     ↓
RELEASE PASSPORT / RECEIPT
     ↓
CONTINUOUS COVERAGE
     ↓
NEXT RELEASE
```

The user should not have to understand internal scanner categories as separate products. Secrets, source maps, debug files, repository visibility, package identity and production assets are engines underneath one release decision and evidence experience.

Target customer-facing navigation remains centred on:

- Overview
- Releases
- Coverage
- Alerts
- Policies
- Team

“New scan” is an action, not a permanent inventory category.

---

## 5. The five questions NoSpoilers should answer for every release

### 5.1 What exactly are we shipping?

Inspect the final artefact or public release surface, not only the repository.

Relevant formats can include npm packages, archives, browser bundles, extensions, desktop installers, mobile packages, serverless bundles and other supported final artefacts.

### 5.2 Is anything present that should not be there?

Examples include:

- credential material
- environment files
- source maps and embedded source
- internal source
- debug artefacts
- backup/database/crash material
- internal paths/network context
- unexpected files and file families
- repository visibility changes
- other deterministic exposure rules supported by the scanner

### 5.3 What changed from the last known release or approved reference?

This is one of the strongest retention features.

Examples:

- first source maps in 31 releases
- 14 new public files
- package size 70% above recent median
- new executable-like extension
- finding reappeared after being absent
- files present in current release but not the approved baseline

### 5.4 Did the approved release actually reach production?

The long-term goal is approved-build to production parity, not merely a one-URL hash check.

NoSpoilers should be able to distinguish:

- matched
- missing
- extra
- mismatched
- unobserved
- unsupported / transformed

Do not require a post-deployment observation before the deployment that creates that observation. Preflight permission and post-deploy verification are distinct phases.

### 5.5 Can we prove what happened later?

A durable receipt/passport should answer:

- release identity
- source revision
- artefact digest
- policy revision
- check result
- exceptions
- approval/hold decision
- production evidence where applicable
- timestamps
- immutable signed record reference

The passport is evidence, not a universal security certification.

---

## 6. Retention thesis

The biggest commercial risk is a one-time-fix product:

> We found your source map. You fixed it. Why keep paying?

The durable product must instead create recurring value every time the customer ships.

Retention loops:

1. **Continuous release checks** — every new release creates a new decision.
2. **Historical intelligence** — the product becomes more useful with legitimate release history.
3. **Production monitoring** — public state can differ from build-time expectations.
4. **Policies and release gates** — the product becomes part of the team’s delivery workflow.
5. **Remediation closure** — original issue links to the rebuilt, rechecked release.
6. **Team workflow** — approvals, exceptions, assignments and evidence become operational practice.
7. **Proof and reporting** — release evidence can support internal security, agencies, procurement and audits.
8. **Agency distribution** — one partner may operate the release-assurance workflow across multiple authorised clients.

The switching cost should come from **earned value and workflow integration**, not hostage data or cancellation friction. Keep export/deletion honest.

---

## 7. Release Intelligence: how the compounding value works

NoSpoilers does not need a giant model trained on customer source code to “learn normal”. The core should remain structured, deterministic and explainable.

### Current built direction

The branch now contains:

- explicit release streams
- compact persistent snapshots linked to original evidence
- human-adopted, versioned references/baselines
- exclusions/restoration with audit
- median/MAD-based advisory analysis
- release-history comparisons
- explicit UI/API/CI capture

See `INTELLIGENCE-HANDOFF.md` and `ACCEPTANCE.md` for implementation status.

### Data that can legitimately compound

Prefer derived release evidence and metrics, not retained customer source:

- release stream identity
- artefact digest and size
- file count
- path/extension frequencies where permitted by retention contract
- per-file hash evidence already covered by the relevant receipt/manifest contract
- finding fingerprints
- policy/engine version
- production observation summaries
- source revision and release timing
- approved reference history

Do not store discovered secret values as part of “learning”.

### Statistical techniques

Simple and robust statistics are enough for the early product:

- median
- median absolute deviation (MAD)
- percentiles where sample size permits
- frequency / seen-in-N-of-M releases
- first-seen / returned-after-absence
- change ratios
- bounded rolling windows
- explicit minimum sample sizes

Examples:

```text
Previous 31 releases: source maps = 0
Current release: source maps = 17
→ first-observed source-map family; high-confidence historical novelty
```

```text
Recent artefact size median: 44 MB
Current artefact: 91 MB
→ materially outside recent range; review required, not automatically a vulnerability
```

### Cold start

Be honest:

- 1 release: history started; no baseline claim
- several compatible releases: early context
- sufficient eligible history: historical comparison active
- approved human reference: baseline comparison available

Do not manufacture confidence from repeated identical scans or allow suppressed findings to silently define “normal”.

### Future ML, only if justified by real data

Potential later additions:

- Isolation Forest or similar anomaly detection over release metrics
- clustering for different legitimate release modes
- pgvector for similarity retrieval across past findings/remediations

None of these is required for the core product. PostgreSQL plus deterministic TypeScript is sufficient until evidence shows otherwise.

---

## 8. Release decision and enforcement strategy

The product should eventually have a single authoritative model:

- **READY** — recorded applicable checks support release under the adopted policy
- **REVIEW** — non-blocking or ambiguous evidence needs human attention
- **BLOCKED** — deterministic adopted policy prevents release
- **UNKNOWN** — evidence is absent, stale, unsupported, inconsistent or inconclusive

Do not turn UNKNOWN into green.

### Enforcement maturity

1. advisory
2. warn
3. enforce

Enforcement must be explicitly adopted, versioned and reversible. Bind it to:

- exact artefact digest
- policy revision
- receipt freshness
- source/release identity
- authorised override with audit

Post-deployment evidence should not be required to permit the deployment that creates it.

---

## 9. Remediation lifecycle

The sticky workflow is not merely “show a finding”. It is:

```text
original finding
    ↓
investigation
    ↓
reviewed proposed remediation
    ↓
PR / configuration change
    ↓
rebuild
    ↓
new signed scan evidence
    ↓
compare old vs new
    ↓
verified resolution
```

An acknowledgement, dismissal or accepted exception is not a verified fix.

This lifecycle should become a first-class durable relationship in the data model.

---

## 10. Agent strategy

AI should sit **above deterministic evidence**, not replace it.

### Useful agent jobs

**Investigation assistant**

- explain why a release is blocked/review
- connect the finding with release history
- identify likely configuration or change context where authorised evidence supports it
- distinguish fact from hypothesis

**Remediation assistant**

- propose a bounded fix
- prepare a reviewable patch/PR using existing permissions
- never merge automatically

**Verification assistant**

- compare the rebuilt release with the original
- explain what changed
- point to the new signed evidence

**Evidence assistant**

- answer “why is this blocked?”
- answer “what changed?”
- generate scoped summaries from recorded evidence

### Proposed tool/MCP surface

Future tool names may include:

- `get_release_status`
- `get_release_evidence`
- `compare_releases`
- `get_release_anomalies`
- `get_blocking_findings`
- `explain_finding`
- `prepare_remediation_context`
- `verify_remediation`
- `get_release_passport`

The tool interface should be usable by customers’ existing coding agents where appropriate.

### Agent guardrails

- no automatic merges
- no permission expansion by the model
- no testing or use of discovered credential values
- no automatic responsible-disclosure outreach
- no model override of deterministic failed/inconclusive evidence
- untrusted artefact content must be treated as data, not instructions
- explicit tenant boundaries
- read/write capability separation
- cost ceilings and rate budgets
- human review for security-impacting writes
- a model can never mint a passing signed receipt

---

## 11. Behavioural design and customer psychology

The complete behavioural-design rules live in `BEHAVIOURAL-DESIGN.md`. This section captures the business intent.

The emotional target is:

> I understand what happened, I know what to do next, and I am relieved this system is watching the release process.

Excitement should come from genuine usefulness, not fear manipulation.

### Behavioural mechanisms worth using ethically

**Salience**

Surface the single most important decision/action first. Do not make the customer interpret 30 scanner outputs equally.

**Recognition over recall**

Show previous release, approved reference, exact change counts and policy reason in context.

**Progressive disclosure**

Lead with the decision, then let engineers drill into evidence and manifests.

**Goal-gradient / visible maturation**

History can honestly show when useful context is accumulating: first release, early history, sufficient comparison history, adopted reference. Never turn this into a fake setup score.

**Competence and closure**

A successful cycle should feel complete:

```text
Release checked
Finding understood
Fix reviewed
Rebuild passed
Production observed
Receipt sealed
```

**Autonomy and reversibility**

Previews, policy adoption and enforcement should be reversible and explicit. Customers should feel in control.

**Loss aversion, only through factual state**

It is legitimate to say a release has a blocking finding or that production drift exists. Do not exaggerate hypothetical breach losses or create countdown panic.

**Endowment through earned history**

Customers may value the history they have accumulated. Keep it portable and honest. Do not weaponise that value by blocking exports or cancellation.

**Peak-end completion**

A clean, fully-evidenced release should have a satisfying but restrained completion state. Celebrate the work completed, not “NoSpoilers saved you £X”.

### Explicit anti-patterns

Do not use:

- fake social proof
- fake scarcity
- fear-driven countdowns
- artificial daily streaks
- variable-reward incidents
- deceptive preselected purchase
- confusing trial renewal
- cancellation obstruction
- fake security scores
- invented savings/breaches prevented
- public naming from an unverified discovery signal
- security evidence as hostage data

Quiet automation is a successful outcome; do not manufacture reasons to log in daily.

---

## 12. The desired customer experience

### First value

The first session should get to a real, authorised release check quickly.

Target sequence:

```text
connect or upload
→ inspect one real release
→ understand the result
→ see one clear next action
→ keep the release surface under Coverage
```

### Compounding value

Subsequent releases should progressively unlock:

- meaningful comparisons
- reference/baseline context
- historical novelty
- reappearing findings
- production drift context
- evidence history

### Completion moments

Example language direction:

> Release checked. No blocking findings were recorded in the inspected scope. Production evidence is current. Receipt sealed.

or:

> Good catch. This release is blocked before approval because one deterministic policy rule failed. The finding did not appear in the previous 24 eligible releases.

Do not say “safe” or “breach prevented” unless the evidence supports that exact claim.

---

## 13. Internal lead generation and acquisition

Artifact Leads / Disclosure Desk is an **internal acquisition and responsible-disclosure system**, not the customer-facing product.

The current default discovery query has historically focused on Electron/public artefacts. That is a research proxy, not necessarily a purchasing-power filter.

### Lead quality should have two separate scores

**Technical confidence**

- public artefact is supported
- finding reproduced
- unintended nature reasonably supported
- fingerprint/evidence recorded
- uncertainty explicit

**Commercial fit**

- real software business behind the project
- proprietary product/release workflow
- regular releases
- likely engineering/security owner
- recurring release-assurance need
- supported source/artefact type

Do not merge those into “vulnerability severity”.

### Preferred acquisition sequence

```text
relevant organisation
→ supported public artefact or ordinary commercial fit
→ verify any security signal separately
→ private responsible disclosure when applicable
→ optional authorised product evaluation
→ recurring protection if they choose it
```

Never condition vulnerability evidence on purchase.

A company can be a normal sales prospect without any security finding at all.

---

## 14. Sales outreach and disclosure separation

Use `docs/growth/OUTREACH-LIBRARY-v2.md` as the reusable copy library.

### Ordinary sales outreach

Position around release workflow and what actually ships.

Example direction:

> NoSpoilers checks the packages, builds and public web assets a team actually releases, alongside GitHub exposure monitoring. We are opening it to a small number of teams and would like to test it against a real release workflow.

The default early evaluation is the existing five-day trial / assisted founding-team evaluation where explicitly offered. Do not lead cold outreach with “paid pilot”.

### Responsible disclosure

Responsible disclosure is not a sales email.

- verify first
- preferred security channel
- minimal necessary evidence
- no secret values
- human review before every message
- no auto-send
- no sales link in the disclosure
- respect do-not-contact and vendor security policy
- no threats or public shaming

If the vendor later asks how to prevent recurrence, a separate normal product conversation may be appropriate.

---

## 15. Ideal early customers

### Primary segment

Commercial software companies roughly 10–100 engineers with frequent proprietary releases.

Good shapes include:

- developer tools
- CLIs
- SDKs
- npm/package publishers
- Electron/desktop apps
- browser applications
- extensions
- teams with real build/deploy pipelines

Likely buyers/champions:

- CTO
- Head of Engineering
- Platform Engineering lead
- Release Engineering lead
- AppSec / DevSecOps / Security Engineering lead

The early promise is not “replace all AppSec”. It is:

> Inspect the release, catch unintended exposure, explain what changed, help close the issue, keep watching, and preserve evidence.

### Secondary segment: agencies and engineering partners

Prefer agencies that maintain and continuously ship client software, not one-off brochure websites.

Long-term agency value:

- portfolio release estate
- same release-assurance workflow across authorised clients
- client-facing release evidence
- added value inside maintenance/security retainers

Do not build agency portfolio tenancy casually. It requires proper delegation and client data separation.

---

## 16. Distribution thesis

At $99/month, the £500k-MRR ambition requires substantial scale. The product therefore needs both strong self-service adoption and higher-value distribution channels over time.

Likely channels:

1. helpful, verified private disclosure where a real public artefact issue exists
2. warm design partners / founder-led outreach
3. developer/security communities using original research and evidence
4. content based on real aggregate findings after privacy review
5. agency/referral partners
6. ecosystem integrations/marketplaces after product-market evidence
7. eventually larger contracts when demanded

Do not assume SEO or Product Hunt alone creates the business.

Early repository planning estimated a likely 4–8 paying customers in the first 30 days after a genuinely working public launch, with 40 activated trials / six paid / at least one Team as an operating target. This is an old planning estimate, not a promise; see `MONTH1.md`.

---

## 17. Partner and ecosystem strategy

Do not wait for a giant platform partnership before proving customer value.

Logical ecosystem directions include:

- Vercel technology/marketplace partnership after real adoption
- Sentry as a complementary ecosystem around private source-map custody and release debugging
- coding-agent/MCP ecosystem after the agent interface is trustworthy
- agencies in the Vercel/Next.js ecosystem for portfolio distribution
- developer workflow platforms whose own release models make them good design-partner candidates

Candidate organisations are research targets only, not claims of vulnerability or existing commercial interest. See `RESEARCH-SNAPSHOT.md`.

---

## 18. Competitive positioning

NoSpoilers should not compete by saying “we also scan secrets”. GitHub, GitGuardian and many others already validate that market.

Differentiation should be:

- final artefact / release-surface focus
- what escaped, not only what was committed
- release-to-release historical context
- explicit policy decision
- production observation / parity
- remediation closure
- durable receipt/passport
- low-friction self-service at $29/$99

ReversingLabs validates that final-build / software-supply-chain assurance is a serious category, but NoSpoilers should seek a simpler, more developer-native, release-workflow product rather than copying an enterprise suite.

---

## 19. Defensibility / moat

Do not rely on a moat of scanner regexes.

Potential defensibility:

- high-quality validated detection corpus
- historical release-stream intelligence
- customer-specific approved references and release patterns
- remediation outcomes linked to new signed evidence
- reliable, trusted release decision semantics
- embedded CI/CD workflow
- agency and ecosystem distribution
- accumulated but portable evidence history

Do not build a moat by storing unnecessary customer source or secret values.

---

## 20. The product ladder

```text
NoSpoilers Scan
Check what shipped.

      ↓

NoSpoilers Coverage
Continuously monitor supported release surfaces.

      ↓

NoSpoilers Release Assurance
Compare, apply policy and produce READY / REVIEW / BLOCKED / UNKNOWN.

      ↓

NoSpoilers Protect
Enforce an explicitly adopted release gate.

      ↓

NoSpoilers Agent
Investigate, explain and prepare reviewed remediation.

      ↓

NoSpoilers Proof
Preserve and share scoped release evidence.

      ↓

NoSpoilers Release Assurance Platform
Release history + policy + enforcement + production parity + remediation + proof.
```

Names in this ladder are strategic descriptors, not necessarily separate billable products.

---

## 21. What must be built next

Current priority sequence from the latest acceptance ledger:

### P0 — Integrated verification

- full locked tests
- typecheck/lint/build/API build
- real Hono/store/session/token/HMAC integration
- production-like PostgreSQL migration/concurrency/retention
- integrated React/browser/accessibility checks
- tenant/billing/revocation boundaries

### P1 — Single authoritative release decision

Reconcile old headline and new assurance logic. One source of truth.

### P2 — Opt-in automatic history capture

Provider/worker completions can join streams only when stable authorised identity is known. Never guess from filenames.

### P3 — Approved build to production multi-asset parity

Bound expected release manifest to deploy identity and distinguish missing/extra/mismatched/unobserved/unsupported.

### P4 — Versioned Release Gate

Advisory → warn → enforce with digest/policy binding, stale evidence protection, override audit and rollback.

### P5 — Durable remediation linkage

Original finding → reviewed change → rebuilt release → new signed receipt → verified resolution.

### P6 — Opt-in provider-backed agent/tool layer

Only with tenant isolation, prompt-injection controls, cost ceilings, evaluations and human review.

### P7 — Outcome/retention layer

Real monthly summaries, baseline maturity, release milestones and privacy-reviewed instrumentation.

### P8 — Agency portfolio

Delegated multi-client architecture after the core loop is proven.

---

## 22. Features deliberately not prioritised

Existing on-ice work remains on ice unless customer demand or owner approval changes it, including historically:

- isolated Electron installer worker expansion
- SBOM product expansion
- Sigstore/SLSA verification productisation
- scheduled registry/CDN checks beyond currently approved scope
- SSO/SAML
- native Vercel/Netlify/Cloudflare OAuth
- aggregate Artifact Leads research productisation

Never add:

- automatic malware verdict/takedown
- automated public naming
- automated disclosure outreach
- scan-credit pricing
- CLI DRM
- storage of source/credential values as a growth moat
- GitHub App Administration permission merely for convenience

---

## 23. Metrics that matter

Do not optimise for scans, logins or emails sent in isolation.

### Acquisition

- qualified organisations
- positive reply rate
- trials started
- first real release completed
- time to first useful value
- trial → paid conversion

### Product value

- compatible releases processed per active organisation
- release streams with useful history
- time to understand a review/block
- time from finding to verified remediation
- false-positive burden
- coverage gaps
- production drift events correctly detected
- percentage of decisions backed by current evidence

### Retention

- paying organisations at 30/90/180 days
- retention segmented by actual release activity
- expansion in authorised release surfaces/streams
- agency/referral-sourced retention

### Business

- MRR
- net revenue retention when meaningful
- gross margin
- cost to serve
- CAC and payback once enough data exists
- churn and churn reasons

A useful North Star question is:

> How many organisations repeatedly keep NoSpoilers in their real release process because it reduces uncertainty and produces trustworthy evidence?

---

## 24. Falsification tests

The strategy is not automatically correct. Look for evidence that disproves it.

1. **One-time-only value** — if customers consistently fix one issue and see no reason for continuous monitoring, retention is not proven.
2. **Interesting but irrelevant findings** — if anomalies are technically novel but do not change customer decisions, improve qualification/analysis before adding more rules.
3. **Too much friction** — if customers cannot reach a real first release quickly, onboarding must be simplified.
4. **No willingness to pay** — if activated teams do not convert at $29/$99, determine whether the issue is value, scope, trust, pricing or distribution before adding random features.
5. **Agency mismatch** — if agencies cannot safely separate client tenancy or clients do not value the evidence, do not force portfolio mode.
6. **Agent novelty without productivity** — if AI assistance does not reduce investigation/remediation time or creates trust problems, keep deterministic workflows primary.

---

## 25. Durable decisions from the originating strategy work

Unless explicitly changed by the owner:

- build Release Assurance as the product spine, not a collection of disconnected scanners
- Release is the central object
- historical release intelligence should compound value over time
- use deterministic evidence and statistics before ML/LLM inference
- keep AI above the evidence layer
- keep responsible disclosure separate from sales
- keep Artifact Leads / Disclosure Desk internal
- preserve human approval for disclosure and security-impacting writes
- keep current $29/$99 plans and five-day trial unless explicitly changed
- do not merge PR #44 or deploy the release-assurance branch without applicable verification/approval
- build retention through utility, history and workflow, not dark patterns
- preserve customer export/deletion rights and avoid hostage evidence
- aim for a scalable self-service business while validating larger contracts and agency distribution rather than assuming either model

---

## 26. Reading order for future agents

Before major product/commercial work, read:

1. `AGENTS.md`
2. `docs/release-assurance/BUSINESS-NORTH-STAR.md` — this file
3. `docs/release-assurance/RESEARCH-SNAPSHOT.md`
4. `docs/PRODUCT.md`
5. `docs/PRODUCT-DIRECTION.md`
6. `docs/release-assurance/INTELLIGENCE-HANDOFF.md`
7. `docs/release-assurance/ACCEPTANCE.md`
8. `docs/release-assurance/ARCHITECTURE.md`
9. `docs/release-assurance/BEHAVIOURAL-DESIGN.md`
10. `docs/growth/OUTREACH-LIBRARY-v2.md`
11. `docs/MONTH1.md`
12. current PR #44 description, checks and diff

When documents conflict, implementation/security invariants and the most recent explicit status ledger take precedence over older strategy prose. Strategy never authorises claiming unverified functionality as built.