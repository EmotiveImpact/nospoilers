# Codex continuation prompt: NoSpoilers Release Assurance

Prepared 9 September 2026. Context checked against draft PR #44 at `a0076702ac3fb8715ddc96ffe7e88eac1a19ec5b`. That is a historical reference, NOT a checkout/reset target. Fetch the latest branch and inspect subsequent changes before acting.

This is an implementation brief, not evidence that unfinished features are built. Existing security invariants and later explicit owner decisions remain authoritative.

## Task

Continue building the real NoSpoilers application in `EmotiveImpact/nospoilers` on `codex/release-assurance-spine-v1`, using existing draft PR #44. Implement, test, commit and push reviewable increments to this branch. Do not stop at an audit, another strategy document, isolated helpers or a mock-up. Integrate completed capabilities into the actual customer journey.

The owner is building towards a £500,000-MRR business through recurring customer value: trustworthy release checks, useful historical context, faster remediation, supported production verification and portable evidence. This is an ambition, not achieved revenue or permission to expand scope without discipline. Current plans remain Solo $29/month and Team $99/month, USD, with the shared five-day trial. Do not change pricing or promise different trial terms.

## 1. Establish the real starting point

Inspect the remote, working tree, latest branch head, PR state, diff, comments and checks. Preserve uncommitted and concurrent work. Never reset to the historical commit above, force-push, discard files, start a replacement repository or create a duplicate PR. If PR #44 has since merged or the named branch is no longer the active continuation branch, establish the new authoritative state before writing rather than recreating an obsolete branch.

Read root `AGENTS.md` and applicable nested instructions. Follow its mandatory reading order in full, including:

- business north star, context audit, research snapshot and commercial validation plan;
- product contract, product direction and Gate B final evidence matrix;
- intelligence handoff, current acceptance ledger and architecture;
- behavioural design and behavioural experiments;
- outreach library and the historical month-one plan.

These documents contain the context; do not ask the owner to reproduce this chat. The latest applicable handoff and verified code take precedence over superseded status prose. Research hypotheses and illustrations are not implemented features or customer evidence.

Existing work includes the assurance companion, release streams, compact historical snapshots, adopted references, exclusions, anomaly analysis, UI controls, explicit capture, CI scan-and-record and migration `ra_002_release_intelligence`. Inspect and improve these; do not rebuild them from scratch or assume they already pass integration.

## 2. First milestone: verify and reconcile the existing application

Use the repository's supported runtime and locked dependencies. Run the relevant focused suites, then the full supported regression, typecheck, lint, frontend build and API build. Diagnose actual failures, including CI setup failures, rather than repeating an old environmental explanation. Do not delete tests, loosen evidence checks, bypass auth, regenerate the lockfile casually or fabricate green results.

Exercise real Hono composition, sessions, workspace tokens, HMAC verification and store access. Cover anonymous access, viewers, revoked membership/tokens, cross-workspace/source access, expired billing, archived workspaces, missing historical receipts, cancellation and original-route regression.

Validate the actual migration, adoption/revocation revision conflicts, retention/deletion and transaction behaviour with disposable test databases, including production-like PostgreSQL where available. Do not run migrations on a production database. Do not install or require Docker on the owner's Mac; preserve the existing production parser-isolation guard.

Exercise the integrated React application, not just the native companion harness: both release-detail paths, stream creation, capture, comparison, reference adoption/revocation, exclusion/restoration, export, error/retry, direct navigation and workspace changes. Check mobile, keyboard, focus, reduced motion and absence of accidental publication.

Then reconcile legacy readiness and the new assurance presentation into one canonical, server-grounded interpretation. Update dependent UI/API/CLI surfaces together where applicable. Preserve scoped READY / REVIEW / BLOCKED / UNKNOWN semantics. Attestation presence is not cryptographic verification; unknown is not passing; a passing scan is not a universal safety certificate. Separate execution state, scan outcome, governance and post-deployment observation. Do not silently change existing policy or enable new enforcement during this cutover.

## 3. Continue the documented implementation sequence

After the first milestone, continue through the remaining acceptance work in coherent, tested increments rather than opening many unfinished subsystems.

### A. Opt-in automatic history capture

Connect existing GitHub, npm and website completion paths to explicitly authorised release streams. Use stable source, workspace, channel, format and artefact-role identity. Preserve explicit capture. Make retries idempotent, handle stale workers and revoked source access, and expose capture failures without falsifying the scan result. Never infer product identity from a filename, inflate history with duplicate bytes, or let accepted exceptions silently become a clean reference.

### B. Bounded approved-build-to-production parity

Bind an approved manifest and deployment identity to observations from customer-authorised origins. Distinguish matched, missing, extra, mismatched, unobserved and unsupported/transformed assets. Cover compressed representations, cache propagation, redirects, ownership expiry, delayed observations and stale evidence. State the observed scope explicitly; no bounded crawler can justify a claim about every public asset. Reuse existing safe transport and worker controls.

### C. Versioned Release Gate

Implement explicitly adopted advisory/warn/enforce behaviour with policy revision, exact artefact/stream binding, freshness and replay checks, tested concurrency, authorised audited override and rollback. Preserve the existing CLI's scan outcome. A recorded unknown must never masquerade as an enforcement pass. Post-deployment evidence must not be required before the deployment that creates it. Newly implemented enforcement stays opt-in and is not activated on live customer workspaces by this task.

### D. Durable remediation lifecycle

Link the original finding to investigation, a reviewed change/PR, rebuilt artefact, new signed evidence and a scoped resolution determination. Reuse existing remediation workflows. Closing an alert, approving a PR or accepting risk is not proof of a fix. Show the linked evidence and retain previous receipts unchanged.

### E. Agent and MCP/tool layer

Build on the existing evidence APIs. Separate deterministic tool results from optional model explanations and separate read capabilities from write capabilities. Provide useful release-status, comparison, anomaly, evidence and remediation-context tools. Research current primary protocol/provider documentation before implementation. Add tenant isolation, prompt-injection handling, budgets, cancellation, audit and human review. Never use discovered credentials, execute untrusted artefacts, invent a responsible commit, merge automatically or allow a model to issue a passing receipt. Provider-backed functionality remains opt-in; test contracts locally without claiming live-provider proof or silently enabling paid services.

### F. Retention outcomes and later agency work

Apply the existing behavioural documents to the actual interface: clear next action, genuine history maturation, reversible controls, verified closure, visible scope and useful private exports. Build opt-in outcome summaries and minimal privacy-reviewed event contracts without sending messages or activating telemetry providers. Measure recurring release value, not forced logins. No fake scarcity, daily streak penalties, invented savings, dopamine claims or cancellation friction.

Agency portfolio/delegation remains after the core release loop is proven. Reuse workspace boundaries and require explicit client authority. Do not flatten multiple clients into an insecure shared view or invent agency prices, SLAs or revenue-share terms. Existing on-ice features remain on ice.

## 4. Engineering and operational boundaries

Preserve the approved homepage, black/off-white/red design language, existing navigation and authentic customer data. Improve coherence and accessibility without an unrelated redesign. Prefer the existing TypeScript/PostgreSQL/worker stack; justify additions rather than importing a new platform by default.

No merge or push to main, no force-push, no automatic deployment, no infrastructure purchase, no production migration, no provider activation, no emails/disclosures and no public sharing of private evidence. Preserve the branch-specific Vercel deployment guard and keep PR #44 draft. Building a feature is not permission to activate it for customers.

Keep raw source, secret values, tokens and private customer research out of logs, committed fixtures, analytics and model inputs unless specifically authorised and necessary under the documented data contract. Evidence retention and export terms remain real constraints, not growth levers.

## 5. Verification, documentation and delivery

Start with focused tests for each change, then run the broader checks after the final code changes:

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm run build:api
```

Follow additional commands and environment requirements in AGENTS.md, package.json, CI and the latest handoff. Run against disposable fixtures, never live customer configuration. Record environmental failures separately from product failures. Historical counts such as 101 native tests and 55 browser checks are not results for this run.

When a genuine external dependency blocks one area, investigate the blocker, continue independent authorised implementation/testing where safe, and leave that area explicitly unverified. Do not reduce the whole assignment to documentation, but do not substitute stubs or unchecked code for completion either. A missing credential is not an explanation for code that has not been implemented.

For each substantial increment, update the existing acceptance ledger, applicable handoff and build log with exact changed files, executed commands, tested commit/tree, results and remaining work. Preserve research sources, hypotheses and behavioural decisions without copying sensitive data or repeating motivational prose. Update the PR description to match the branch.

Commit coherent changes, fetch again before pushing, integrate concurrent work without destructive history rewrites, and push to the existing branch. Verify the remote SHA and PR head after the push. If publishing is unavailable, retain local commits and state that clearly; do not call them pushed.

Final report: branch and remote commit; PR link; implemented customer-visible changes; tests actually run with results and scope; screenshots from the integrated app with synthetic fixtures labelled; genuinely unfinished work; and the precise next action. Distinguish implemented-but-unverified, verified-in-a-stated-environment and not-implemented. Do not claim production readiness or completion of the whole platform unless the evidence supports it.

Begin with the current checkout and integration verification, then implement. Do not ask for another confirmation for ordinary work already authorised on this feature branch.
