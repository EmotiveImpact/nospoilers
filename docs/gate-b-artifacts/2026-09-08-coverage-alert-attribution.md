# Gate B: Coverage alert attribution regression

Date: 8 September 2026

Status: partial B3 correctness fix; Gate B remains in progress. This note does not accept B3 or replace the completion audit.

Base branch: `codex/v20-homepage-auth-mock3`

Change branch: `codex/gate-b-coverage-alert-attribution`

## Defect and scope

In `src/watch/view-models.ts`, package source coordinates include an empty string when `last_version` is null or empty. The existing `alertCountFor` substring comparison accepts that empty string for any usable alert coordinate. An unrelated unresolved alert can consequently increment an unversioned package's alert count, change its attention state to critical, and include it in the attention-only source filter.

The fix requires each source comparison value to be non-empty before applying the existing coordinate comparisons. It does not change the matching rules for non-empty values, source ownership, workspace authorisation, provider scanning, persistence, or UI layout. Broader substring-matching ambiguity is not addressed by this patch.

## Regression coverage

`tests/coverage-source-alerts.test.ts` adds 16 cases covering null and empty package versions, unrelated repository coordinates and finding paths, genuine package-name/version/path matches, one count per alert, multiple matching alerts, resolved and acknowledged state, missing coordinates, recorded passing status, delayed monitoring, a mixed-source attention filter, and input immutability.

Fixtures are synthetic. No live provider credentials or customer data are used.

## Checks actually executed

An isolated Node.js TypeScript-stripping harness ran the real `view-models.ts`, `format.ts` and `verdict.ts` source modules. The test assertions are the same as the committed Vitest test file. Only the runner import was replaced from `vitest` to `node:test` in a temporary local copy.

| Source under test | Cases | Passed | Failed |
| --- | ---: | ---: | ---: |
| Original source | 16 | 8 | 8 |
| Patched source | 16 | 16 | 0 |

The production source diff is one added condition. Its patched Git blob hash was checked against the committed file: `e303b9a813b58980da261b240739af9fee7db8e6`.

This is not a Vitest run, a TypeScript typecheck, a full-project regression, an API test, or browser acceptance evidence. The isolated test result cannot establish overall Gate B completion.

## Required verification in a complete checkout

The execution environment used for this patch could read and write through the GitHub connector but could not resolve GitHub from its local runtime to clone the repository. Full dependencies and the running application were unavailable.

Run the following against this change branch in the existing supported project environment:

```sh
npx vitest run tests/coverage-source-alerts.test.ts tests/watch-desk.test.ts
npm run typecheck
npm run lint
npm run build
npm test
```

These commands are pending, not reported as passing here. Inspect the existing test scripts and honour the continuation prompt's restriction on opt-in Docker integration paths. Existing CI already defines lint, typechecking, build and test steps; historical runs are not evidence for this new branch.

For local browser verification, exercise Coverage with an unversioned package and a separate source with an unresolved alert. Confirm the package has no falsely attributed alert, its actual unknown/passed/delayed state is retained, the genuinely affected source remains visible, and attention-only filtering reflects those states. Also verify a genuinely matching package alert and a resolved matching alert. Capture fresh evidence in the project's prescribed local browser workflow.

Keep the PR in draft until the project checks and review are complete. Reconcile verified results with `docs/GATE-B-COMPLETION-AUDIT.md`; do not mark Gate B complete on the strength of this isolated fix. The remaining acceptance work in that ledger and `docs/CONTINUE-GATE-B-PROMPT.md` is unchanged.

## Boundaries

No changes to `main`, no merge, no deployment, no Docker or daemon launch, no live billing/provider action, and no Pro sync were performed as part of this patch. The PR is intended to target the specified continuation branch, not `main`.
