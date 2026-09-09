# NoSpoilers — four-agent implementation goal

Continue building the actual NoSpoilers application to fulfil the complete saved continuation brief. This is an implementation task, not another strategy document, standalone mockup or endless audit. Keep the full scope intact; do not redefine completion around whichever features already pass.

Repository: `/Users/augustusedem/Nospoilers` — `EmotiveImpact/nospoilers`
Branch: `codex/release-assurance-spine-v1`
Existing draft PR: #44

Owner correction: synthetic customer dev review has been removed. Do not restore it or start it as the owner's workspace. Internal isolated fixtures may still support tests. Real GitHub configuration and live-provider verification are deferred to production by request; preserve this as unverified rather than blocking unrelated implementation or simulating completion.

## Start once, then maintain continuity

At the start of a genuinely new work session, inspect the local working tree, current branch and existing running work. Fetch the remote once and inspect PR #44 once to establish the starting point. Preserve existing/concurrent edits and local commits. Never reset to an old SHA, force-push, create a replacement repository or duplicate the PR.

The orchestrator must read `AGENTS.md`, follow its mandatory reading order, and execute `docs/release-assurance/CODEX-CONTINUATION-PROMPT.md` in full. Include the business north star, research, context audit, commercial validation, behavioural design/experiments, product contracts, architecture, intelligence handoff and latest acceptance ledger. Use `docs/WEB-APP-ARCHITECTURE.md` where applicable. Do not ask me to reproduce the previous conversation.

After this initial orientation, retain context and work from the local application and current files. Do not repeat the full repository audit, document reading or GitHub status check at every automatic continuation. Re-read changed or relevant instructions when needed, not the whole history by default.

Only check GitHub again when preparing to publish, verifying a completed push, resolving an actual divergence/remote dependency, or when I explicitly ask. Do not repeatedly poll unchanged PR checks, billing failures or comments. A failed external CI setup is not a reason to stop independent local implementation.

## Run four coordinated roles

You are the orchestrator. Explicitly launch three subagents when there are independent, concrete tasks ready. Four agents total—not four subagents. Use the configured models; do not introduce model overrides or paid providers.

1. **Orchestrator — you:** maintain the full requirements and acceptance map, decide priorities, assign bounded file ownership, integrate results, review the product flow and run the final combined checks. Maintain the handoff and publishing. Resolve conflicting findings and keep the team moving toward finished customer workflows.
2. **Builder:** implement missing connected features and discoverable entry points in the actual app. Reuse existing architecture and approved mockup direction. Deliver complete vertical slices, not disconnected helpers or placeholders.
3. **Investigator/fixer:** trace existing UI/API/data flows, diagnose missing wiring and misleading states, implement fixes, and handle reproducible failures supplied by the tester. Check permissions, stale state, evidence integrity and prerequisites—not only visual details.
4. **Tester:** independently exercise the actual application and add focused regression coverage. Send the fixer exact reproduction steps, expected/actual behaviour and relevant evidence. Retest fixes. Distinguish source inspection, mocked tests, real API/database checks and browser verification.

Assign non-overlapping runtime/test files before work starts. Agents must preserve other agents' edits, communicate before changing shared files and follow applicable repository/skill instructions. Do not invent low-value tasks merely to keep every agent busy. Reuse agents for the next useful work package. Only the orchestrator stages, commits, pushes, edits the PR or controls shared full-suite runs.

The browser, development servers and disposable databases are shared resources. Give one agent explicit ownership at a time. Do not kill another agent's process or restart a test solely because it has not produced output recently. Poll the confirmed live handle until terminal, or establish that it no longer exists. Keep my normal local review server and data intact.

## What to complete

Use the saved brief and current implementation as authoritative. Much of the core may already exist: do not rebuild it or treat superseded “unbuilt” notes as current facts. Classify requirements as built-and-verified, built-but-unverified, partly built, genuinely unbuilt or blocked, then close the actual gaps.

Complete the connected release loop:

- One canonical, server-grounded readiness interpretation across existing and new UI/API/CLI surfaces.
- Explicit streams, retained release history, comparisons and human-approved references.
- Opt-in automatic capture from supported connected sources.
- Bounded approved-build-to-production observations with honest identity, freshness and scope.
- Versioned advisory/warn/enforce gates and explicitly authorized CI consumption.
- Durable finding → reviewed change → rebuilt artifact → signed evidence → scoped remediation determination.
- Scoped agent/MCP tools, separated deterministic evidence and optional model explanations, budgets, cancellation, audit and human review. Implement missing provider contracts locally without paid activation or pretending live-provider proof exists.
- Optional private outcome summaries, useful history, clear next actions and portable evidence under the real retention contract.
- Remaining cross-flow permissions, error/retry, stale-state, lifecycle, concurrency, accessibility and operational acceptance required by the brief.

Make implemented features discoverable in the actual application. Explain what a stream enables before hiding its tools behind setup. Distinguish missing wiring from legitimate requirements such as administrator access, a recorded build, an approved reference or verified origin. Show useful prerequisite explanations and navigation; never silently enable a source, policy, grant or provider merely to make a feature visible.

Preserve the approved website/product structure and black/off-white/red styling. Use skeletons for ordinary data reads; preserve the lighthouse for initial Watch loading. Keep authentic evidence and the approved design direction; no unrelated redesign or invented customer data.

Agency portfolio/delegation follows proof of the core loop. Preserve tenant boundaries and require explicit client authority. Do not discard this later scope, but do not jump to it while the core remains unreliable. On-ice enterprise features remain on ice unless explicitly authorized.

## Build and verify efficiently

Work in coherent batches that complete meaningful customer workflows. The builder and fixer should continue useful independent work while the tester verifies completed slices. Do not alternate a tiny cosmetic change with a fresh full-project run every time, and do not postpone all testing until the end.

Run focused tests for each meaningful change, then one orchestrator-owned cumulative regression/build pass once that batch's runtime is stable. Do not run duplicate full suites concurrently. If source changes after verification, rerun the affected checks and clearly state which source the results cover; run the applicable cumulative checks before calling the integrated batch verified.

Use the supported runtime and locked dependencies. Establish a valid locked install at session start if not already verified; repeat `npm ci` when dependency/lockfile/runtime changes require it, not for every UI edit. Applicable final checks include:

```
npm test
npm run typecheck
npm run lint
npm run build
npm run build:api
```

Exercise actual Hono/session/token/HMAC/store composition and disposable databases where relevant. Verify real UI transitions, both release-detail paths, role restrictions, workspace changes, empty/loading/error states, current evidence, private exports, keyboard/mobile behaviour and absence of accidental publication. Mocked tests alone do not prove end-to-end integration. No Docker and no production migrations.

Fix reproducible failures instead of only listing them. Do not weaken tests or evidence checks to manufacture green results. When blocked, state the exact dependency and continue independent work. Historical test totals are not current verification. Passing tests are not proof that unimplemented requirements are complete.

## Product and security boundaries

Our goal is recurring customer value: accurate release checks, useful historical context, clear next actions, faster verified remediation and trustworthy evidence. No fake scores, manufactured fear, forced engagement, invented savings, misleading safety certificates or cancellation friction.

Preserve authorization, billing, source ownership, parser isolation, immutable receipts and retention/deletion rules. Unknown/stale evidence must not become passing. A closed alert or reviewed PR is not proof of a fix. Do not expose secrets, raw customer source, credentials or private research in logs, commits, telemetry or model inputs.

Do not push to main, merge, deploy, run production migrations, change pricing, buy infrastructure, activate paid providers, send outreach/disclosures, publish private evidence or remove the branch deployment guard. Keep PR #44 draft. No autonomous merges or model-issued passing receipts.

## Publish coherent milestones, not every small edit

The orchestrator should review the complete batch and preserve concurrent work. Before publishing, fetch once and check divergence; integrate safely if needed. Stage only the intended files, commit coherent changes, push to the existing feature branch and verify the remote commit and PR head once afterward. Never force-push.

Update the acceptance ledger, handoff, architecture where changed, build log and PR description at meaningful milestones. Reconcile contradictory current-status rows instead of accumulating new disclaimers over stale claims. Keep the remaining checklist concrete and finite; do not repeatedly replace “next” with another vague audit.

Report concise progress while working: completed customer-visible work, meaningful findings and genuine blockers—not narration of every command or unchanged poll. Do not invent completion percentages.

At a milestone report the remote commit, PR link, visible changes and where to find them, tests actually run/results, integrated UI evidence, remaining work and the precise next step. Distinguish local-only changes from pushed work and verified scope from unbuilt features. Keep pursuing the complete objective until requirement-by-requirement evidence proves it; do not call the whole application complete because a batch passed.

Begin implementation now. Reuse any already-running agents/processes and unfinished local work before starting replacements.
