# GitHub error audit — 22 September 2026

Audited from main `353993f` after CI `35685459469` passed for runtime commit `a3fdfe197b18fef6a808cf98bacaa97c5379941e`. The intervening commit only recorded verification.

## Current code

- No open GitHub issues were returned.
- Latest CI passed all 1,697 tests and its build/scanner checks. Historical failed runs remain historical evidence and were not deleted or rerun against obsolete source.
- `npm audit` found one low-severity esbuild advisory, GHSA-g7r4-m6w7-qqqr (Windows development-server file access). `npm update` could not resolve it within tsup's declared 0.27 range. An explicit esbuild 0.28.2 override now deduplicates tsup, tsx and Vite onto the patched version. Remove the override when upstream constraints permit the patched release without it. The updated lockfile audit reports zero vulnerabilities.
- Lint exits successfully with 36 warnings. These are not resolved by this dependency patch and should not be described as a warning-free codebase.

## Open pull requests

| PR | Check evidence | Relationship to current main |
| --- | --- | --- |
| #40 Coverage attribution | September 8 jobs could not start because of account billing/spending limits; branch conflicts | Empty source coordinates are already filtered in `src/watch/view-models.ts`; `tests/watch-evidence-integrity.test.ts` covers absent versions, unrelated alerts and whitespace coordinates. Do not merge the old branch over current implementation. |
| #16 Alerts filter prototype | September 4 jobs blocked by billing/spending limits | Historical mockup branch, not the current product runtime. |
| #12 Premium Watch prototype | Old `tests/secrets.test.ts` owner-discovery test timed out; later job passed | Historical prototype; current full regression includes this test and passes. |
| #9 Watch desk 2B | Old owner-discovery test timed out | Current full regression passes. |
| #5 Watch desk redesign | One old timeout and one passing job | Current full regression passes. |
| #4 Design exploration | Checks passed | No failing checks found. |
| #3 Watch desk architectures | Old owner-discovery test timed out | Current full regression passes. |

Prototype PRs and branches were preserved. Their failed historical checks are not evidence that current main is failing, nor does this audit validate merging their obsolete diffs.

## Security visibility limits

GitHub reports Dependabot alerts disabled, secret scanning disabled, and no code-scanning analysis. The authenticated CLI also reports a scope limitation on some security endpoints. A clean npm dependency audit is not a source-code or secret-scanning audit. No security results were dismissed and no broader token permissions were requested.

## Verification of the dependency change

`npm run build` (including TypeScript), `npm run build:api`, `git diff --check` and `NOSPOILERS_INTERNAL_LOCAL_SCAN=1 npm test` passed. The full suite passed 1,697/1,697 tests across 276 files in 357.28 seconds. Replacement GitHub CI is recorded separately in BUILD-LOG; local verification is not a claim that a remote run has completed.
