# Build and verification log

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
