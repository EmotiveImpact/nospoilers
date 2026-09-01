# Complete feature inventory

Nothing in this file is implied or silently discarded. It is the exhaustive inventory discussed
through 2026-09-01. `docs/expansion/NO-SPOILERS-ULTIMATE-PRD.md` assigns it to phases.

Legend: **Built**, **Partial**, **Planned**, **Deferred**, **Separate product**, **Do not build**.

## Commercial and platform foundation

| Feature | Status | Home |
| --- | --- | --- |
| Neon application runtime | Built: app boots on Neon `neondb` | NoSpoilers |
| GitHub OAuth login | Built: real GitHub user session on Neon | NoSpoilers |
| GitHub App installation | Built: live App install and HMAC webhooks | NoSpoilers |
| Installation ownership verification | Built | NoSpoilers |
| Real throwaway-repository proof | Partial: created-public webhook → job → Watch alert | NoSpoilers |
| Installation-scoped billing account | Built: 14-day trial per GitHub install | NoSpoilers |
| Complete unpaid webhook/worker/poller/scan enforcement | Built: webhook 200, work skipped | NoSpoilers |
| Stripe monthly/yearly checkout | Planned | NoSpoilers |
| Card-on-file 14-day trial | Planned | NoSpoilers |
| Stripe lifecycle webhooks | Planned | NoSpoilers |
| Billing portal | Planned | NoSpoilers |
| Railway web/API and worker deployment | Planned | NoSpoilers |
| Cloudflare DNS/custom domain | Planned | NoSpoilers |
| Resend email delivery | Planned | NoSpoilers |
| Job retry/backoff | Built: 5 attempts, exponential backoff | NoSpoilers |
| Stale-lock recovery/dead-letter visibility | Partial: stale running jobs requeued; tenant failed jobs listed on Watch; no owner global UI | NoSpoilers |
| Upload/API rate limiting | Built: hosted `/api/scan` per address | NoSpoilers |
| Readiness/health checks and structured logs | Built: `/api/health` liveness, `/api/ready` DB ping, JSON logs | NoSpoilers |
| Secure cookies and strong secret validation | Built: Secure cookies on https; Neon/https refuse weak secrets | NoSpoilers |
| Encryption for GitHub OAuth/integration tokens | Built: AES-GCM at rest, plaintext rows migrated on read | NoSpoilers |
| Privacy, Terms, retention, refund and support pages | Built | NoSpoilers |
| Cloud usage warnings and hard budget controls | Planned | Infrastructure |

## Scanner and release automation

| Feature | Status | Home |
| --- | --- | --- |
| Directory, `.tar`, tgz/tar.gz, ZIP, asar and single-file scanning | Built | NoSpoilers |
| Source maps, embedded source and map URL rules | Built | NoSpoilers |
| Environment, private key and high-confidence token rules | Built | NoSpoilers |
| Credential config, AI context, internal location, debug rules | Built | NoSpoilers |
| Git/source/size rules | Built | NoSpoilers |
| Hard input/unpacked/file/time budgets | Built | NoSpoilers |
| JSON and SARIF reports | Built | NoSpoilers |
| Automatic npm package watching | Built: public registry.npmjs.org and private HTTPS registries per GitHub install | NoSpoilers |
| New npm version detection | Built: hourly check + Watch “Check now” | NoSpoilers |
| npm dist-tag and prerelease-channel changes | Built: tag-only light alert, no extra download | NoSpoilers |
| Changed tarball bytes under the same package coordinate | Built: latest shasum change enqueues a rescan | NoSpoilers |
| Private npm registry support | Built: encrypted per-install token, same-host HTTPS tarballs, SSRF blocked | NoSpoilers |
| npm/pnpm/Yarn/Bun monorepo discovery | Built: packed artifacts list roots and members; never executed; not auto-watched | NoSpoilers |
| Pre-publish CI gate | Partial: Action exists; optional `policy` input; generated workflow gates packed artifacts only | NoSpoilers |
| App-generated setup PR | Partial: reviewable PR, never merged; 409 YAML copy-paste until Contents+PR write | NoSpoilers |
| GitHub Checks and annotations | Partial: hosted release scans post Checks with rule/path annotations; skipped on 403/404 | NoSpoilers |
| Required-check setup guidance | Partial: setup PR body tells maintainers to mark NoSpoilers required; App does not set branch protection | NoSpoilers |
| Release manifest: path, size, hash | Built: per-file path/size/SHA-256 on every scan | NoSpoilers |
| Release Diff between approved versions | Built: approved baseline receipt if present, else last two | NoSpoilers |
| Baseline approval | Built: attributable `scan_baselines`, supersedes the previous | NoSpoilers |
| Path/rule allowlist with expiry and reason | Built: exact-rule, expiring, never silent DELETE | NoSpoilers |
| `.nospoilers.yml` policy file | Built: CLI/Action + hosted DB exceptions | NoSpoilers |
| Unexpected package-size increase | Partial: Release Diff flags a 2× or ≥5 MiB unpacked jump | NoSpoilers |
| Files newly absent/present vs approved release | Built: added/removed/changed paths only | NoSpoilers |
| Nested archive scanning | Built: unpack nested tgz/zip/asar up to 3 levels, never execute | NoSpoilers |
| Escaping/suspicious symlink detection | Built: absolute and `..` targets, not followed | NoSpoilers |
| Source archives and backup files | Built: BAK-001 | NoSpoilers |
| Database exports/dumps | Built: DB-001 | NoSpoilers |
| SSH/cloud/service-account configuration | Built: `.ssh/`, kube, AWS, Azure, GCP, Docker, tfstate, PKCS12, service-account JSON | NoSpoilers |
| Crash dumps and additional debug symbols | Built: CRASH-001 for cores/minidumps (never executed); DBG-001 for extra symbols/crash logs | NoSpoilers |
| Build caches/compiler metadata | Built: CACHE-001 for turbo/parcel/nyc/eslint/next/node_modules caches; DBG-001 for symbols | NoSpoilers |
| Internal documentation and roadmaps | Built: ROADMAP/HANDOFF/TODO/PRD plus architecture/design/rfc/spec/product/month1/feature-inventory/electron, `docs/internal/`, `adr/NNNN-*.md` | NoSpoilers |
| AI prompts, memory, transcripts and MCP policy pack | Built: AI-001 for agent dirs, MCP configs, prompts, memory, transcripts | NoSpoilers |
| Signed scan receipt with artifact SHA-256 | Built: HMAC-SHA256 JSON, SHA-256 and SHA-512 | NoSpoilers |
| Explicit inconclusive status for limits, malformed/encrypted/partial scans | Built: never clean, never a passing receipt | NoSpoilers |
| External scanning API | Built: hashed per-install `nsp_` tokens; `POST /api/v1/scan` mints a receipt and deletes bytes | NoSpoilers |

## Release Ledger module

| Feature | Status | Home |
| --- | --- | --- |
| SHA-256/SHA-512 artifact identity | Built: packed-file SHA-256/SHA-512 on receipts | NoSpoilers |
| Append-only sealed release revisions | Built: append-only `release_revisions`; digest mismatch appends, never rewrites | NoSpoilers |
| Build/source revision and CI provenance link | Built: git SHA/tag/version and HTTPS CI URL stored, never fetched; Sigstore still Planned | NoSpoilers |
| CycloneDX/SPDX SBOM attachment | Planned | NoSpoilers Team |
| SLSA/in-toto provenance validation | Planned | NoSpoilers Team |
| Sigstore/cosign signature verification | Planned | NoSpoilers Team |
| npm/GitHub attestation adapters | Planned | NoSpoilers |
| Stable/beta/canary release channels | Built: `stable` / `beta` / `canary` on each revision | NoSpoilers |
| Scheduled registry/CDN delivery verification | Planned | NoSpoilers Team |
| Replacement/disappearance/redirect/content-type drift incidents | Planned | NoSpoilers Team |
| Offline signed-receipt verification | Built: `nospoilers verify <file> --receipt` HMAC check | NoSpoilers |
| Public verification page controlled by customer | Planned, later | NoSpoilers |

## Package Identity module

| Feature | Status | Home |
| --- | --- | --- |
| Verified protected package/scope ownership | Built: protect only if npm scope or GitHub repository field matches the install | NoSpoilers |
| Bounded typo/edit-distance candidate generation | Planned | NoSpoilers Team |
| Separator, keyboard, token-order, homoglyph and scope confusion | Planned | NoSpoilers Team |
| Maintainer addition/removal history | Built: append-only identity snapshots; emails never stored | NoSpoilers |
| Package ownership continuity/transfer alert | Built: maintainer add/remove facts, not a malware verdict | NoSpoilers |
| Repository/homepage/domain mismatch | Built: explainable npm repository/homepage change alerts | NoSpoilers |
| Dormant-package resurrection | Planned | NoSpoilers Team |
| Suspicious release burst/version jump | Planned | NoSpoilers Team |
| Artifact hash/shape anomaly | Built: new `bin` or install lifecycle scripts vs last snapshot | NoSpoilers |
| Human-reviewed advisory/takedown evidence | Planned, later | NoSpoilers Team |
| Automatic malware verdict/takedown | Do not build | None |

## Distribution surfaces and formats

| Surface | Status | Home |
| --- | --- | --- |
| GitHub Release assets | Built/partial real proof | NoSpoilers |
| npm registry packages | Partial: customer watch of public `latest` tarball | NoSpoilers |
| Production website JS/CSS/assets | Planned | NoSpoilers |
| Sentry source-map custody | Planned | NoSpoilers |
| Bugsnag source-map custody | Planned | NoSpoilers |
| VS Code `.vsix` | Planned | NoSpoilers |
| Chrome `.crx` and Firefox `.xpi`/extension ZIPs | Planned | NoSpoilers |
| Python wheel and source distribution | Planned | NoSpoilers |
| Java JAR/WAR | Planned | NoSpoilers |
| NuGet `.nupkg` and `.snupkg` | Planned | NoSpoilers |
| Ruby gems | Planned | NoSpoilers |
| Docker/OCI image layers | Planned, later | NoSpoilers |
| Serverless deployment bundles | Planned | NoSpoilers |
| Android APK/AAB | Planned, later | NoSpoilers |
| iOS IPA | Planned, later | NoSpoilers |
| Electron DMG | Deferred isolated worker | NoSpoilers |
| Electron EXE/NSIS | Deferred isolated worker | NoSpoilers |
| Electron AppImage | Deferred isolated worker | NoSpoilers |
| Electron MSI | Deferred isolated worker | NoSpoilers |

## GitHub visibility and incident response

| Feature | Status | Home |
| --- | --- | --- |
| Private → public alert | Built/needs real proof | NoSpoilers |
| Repository created public | Built/needs real proof | NoSpoilers |
| Repository transfer | Built/needs real proof | NoSpoilers |
| Collaborator added | Built/needs real proof | NoSpoilers |
| Fork event | Built/needs real proof | NoSpoilers |
| Cheap sensitive-path push event | Built/needs real proof | NoSpoilers |
| App permission, suspension, repository-add/remove and uninstall health | Built: Watch alerts while the install remains; uninstall drops the tenant | NoSpoilers |
| Hourly missed-webhook visibility check | Built | NoSpoilers |
| Event acknowledgement and assignment | Built: ack/assign to install members; append-only `alert_events` | NoSpoilers |
| Resolution notes/evidence | Built: resolve requires a note; files are not stored | NoSpoilers |
| Exposure-duration timer | Built: open until resolved, shown on Watch | NoSpoilers |
| Credential-rotation checklist | Built: SEC/MAP rules; secret values are not copied | NoSpoilers |
| One-click make repository private | Planned, high permission | NoSpoilers |
| Remove/suspend bad GitHub Release asset | Planned, high permission | NoSpoilers |
| Disable unsafe release workflow | Planned, high permission | NoSpoilers |
| Automatic remediation PR | Planned | NoSpoilers |
| Multiple GitHub organizations | Planned | NoSpoilers |
| Live installation/permission test | Built: GitHub install + optional repo probe; never invents an incident | NoSpoilers |

## Alerts, team and trust

| Feature | Status | Home |
| --- | --- | --- |
| Dashboard alerts | Built | NoSpoilers |
| Email alerts | Planned | NoSpoilers |
| Slack alerts | Planned | NoSpoilers Team |
| Jira tickets | Planned | NoSpoilers Team |
| SIEM/custom webhooks | Planned | NoSpoilers Team |
| PagerDuty/incident routing | Planned, later | NoSpoilers Team |
| Severity and repository routing rules | Planned | NoSpoilers Team |
| 90-day timeline | Planned | NoSpoilers Team |
| Configurable data retention | Planned | NoSpoilers |
| Team members and roles | Planned | NoSpoilers Team |
| SSO/SAML | Deferred until requested | NoSpoilers |
| Audit-log export | Planned | NoSpoilers Team |
| Queue and usage health | Partial: tenant-scoped job list and counts; global queues stay owner-only | NoSpoilers |
| Public status page | Planned | Operations |
| Scan concurrency/fair-use controls without credits | Planned | NoSpoilers |
| Multiple notification destinations | Planned | NoSpoilers Team |

## Internal acquisition and responsible disclosure

| Feature | Status | Home |
| --- | --- | --- |
| Public GitHub/npm Artifact Leads desk | Built | Internal NoSpoilers |
| Manual repository inspection | Built | Internal NoSpoilers |
| Search campaign discovery | Built/manual | Internal NoSpoilers |
| One-at-a-time prospect scans behind customer jobs | Built | Internal NoSpoilers |
| Scheduled discovery | Planned | Internal NoSpoilers |
| Continuous npm version feed | Planned | Internal NoSpoilers |
| Nested workspace package discovery | Planned | Internal NoSpoilers |
| Critical-only internal notifications | Planned | Internal NoSpoilers |
| Human finding verification | Planned | Internal NoSpoilers |
| Responsible-disclosure draft generation | Planned | Internal NoSpoilers |
| Duplicate company/finding detection | Planned | Internal NoSpoilers |
| Contact history and disclosure deadlines | Planned | Internal NoSpoilers |
| Fixed-version automatic rescan | Planned | Internal NoSpoilers |
| Trial/paid conversion attribution | Planned | Internal NoSpoilers |
| Aggregate anonymized research | Planned | Internal NoSpoilers |
| Automated outreach/public naming | Do not build | None |
| Retention of public source/credential values | Do not build | None |

## Platform modules and separate software

| Product/module | Status | Boundary |
| --- | --- | --- |
| Employee Public Footprint | Separate product | Different privacy, permissions and security buyer |
| Release Ledger | NoSpoilers module | Same release artifact, customer, manifest, receipt and billing |
| Package Identity/Impersonation | NoSpoilers module | Same watched package, registry adapter, incident and billing |
| Disclosure Desk | Internal NoSpoilers module | Extends Artifact Leads; commercial split only after review |

Electron Inspector is **not** a separate product decision. Installer scanning appears inside
NoSpoilers but executes in a separate isolated worker service.

## Explicit exclusions

- Generic SAST/code review.
- General dependency CVE scanning.
- Antivirus/malware platform.
- Secret manager/vault.
- Generic AI chatbot.
- Scan-credit pricing.
- Public Enterprise plan before a real request.
