# Build and verification log

## 9 September 2026 — integrated branch repair

Increment based on `a4a3e10`, preserving the existing release-intelligence implementation. Extracted the universal assurance-view validator from browser download code; corrected strict API test decoding and unused test bindings. Fixed package-mode navigation and staged-claim workspace/install preservation, contextual skeleton accessibility, and the stream-key HTML validation pattern. The disposable browser fixture now composes both real assurance/intelligence wrappers and accepts an isolated port.

Added `tests/release-intelligence-integration.test.ts`: real Hono composition, stores, signed scanner receipts and migrations, with session/token/source isolation, revoked access, expired billing, signature rejection, concurrent reference adoption and private export assertions. Ran it with PGlite and a disposable native PostgreSQL database; both passed. The PostgreSQL instance was stopped and its temporary database files removed. No Docker or production database was used.

Supported bundled Node 24.19.0: locked `npm ci` passed. Full `npm test` passed **205 files / 1,222 tests** (267.83 seconds). The final HTML pattern-only correction followed that run; no broader completion claim follows from this count. Earlier focused native cases passed 210; the focused scan/team suite passed 28. Typecheck, lint (warnings, no errors), frontend and API builds passed during this increment; final post-pattern build checks are recorded in the commit handoff when complete.

Integrated disposable-browser evidence: stream creation saved the initial signed record, a failing release could not be adopted as an approved reference, and exclusion preserved original findings. Remaining browser coverage includes complete hosted/upload reference lifecycle, retry/conflict, keyboard and reduced-motion checks. This is partial integrated UI evidence, not a completed browser matrix.

GitHub Actions is externally blocked before steps start: the check annotation reports failed account payments or an increased spending limit is required. No billing changes or check bypass were made. Canonical readiness reconciliation and RA-02 through RA-08 remain open; no merge, deployment or provider activation.

Final post-pattern checks also passed: `npm run typecheck`, `npm run build`, `npm run build:api`, `npm run lint`, and `git diff --check`. Lint reports warnings, and the frontend retains its bundle-size warning; neither is represented as warning-free. The full regression count above precedes only that HTML pattern correction and documentation updates.

8 September 2026. Started at main `675916b4b9b843bff2cb0651ec13034f2f62775d` and created isolated branch `codex/release-assurance-spine-v1`.

Bootstrap: consolidated duplicate Vercel `git` configuration keys, preserved both existing branch guards, disabled deployment for this branch before publishing product changes. Added a contents-read-only review workflow. No production migration, provider activation, customer notification, merge or push to main.

Repository review: Gate B's final matrix is newer than the older STATUS/ROADMAP wording and records complete acceptance of that earlier work. Original source boundaries and three exact file hashes were verified before additive patches.

Implemented: scoped receipt interpretation, stable-source comparison, after-deployment freshness, deterministic guidance, stricter-review simulation, private unsigned passport, read-only API composition and native/React release-detail integration. The acceptance matrix records the rest of the vision as separate work.

Local verification after final logic edits:

| Check | Result | Boundary |
| --- | --- | --- |
| Shared native Node domain/API cases | 101 passed, 0 failed | Actual new functions/handler; injected auth/read/signature ports |
| Native browser renderer | 55 passed, 0 failed | Four synthetic states at three widths plus interactions; not full React/API |
| Strict TypeScript 5.8.3 subset check | Passed | Dependency-free source/handler/cases only; repo pins TS6 |
| Source transpilation syntax | 15 files passed | Not semantic React/Hono validation |
| Initial GitHub Actions | Failed before test steps | Review run 34268285866; original CI 34268285788; cause unconfirmed |
| Full pinned suite/build/lint | Unverified in this runtime | Complete checkout/dependencies unavailable |
| Live production scans / worker isolation | Not run | Separate operational gates |

The browser harness exercised keyboard disclosure, reversible preview/focus, actual JSON download, malicious filename escaping, unknown/stale scope, reduced motion, lifecycle cleanup and document overflow. See `BROWSER-CHECKS.json` and the reproducible scripts. Synthetic fixtures do not imply customer adoption or production results.

Known limitations and next steps are in HANDOFF.md and ACCEPTANCE.md. Do not turn these results into “all features complete”, “all tests pass”, “full security audit” or “ready for production”.
