# Complete feature inventory

Nothing in this file is implied or silently discarded. It is the exhaustive inventory discussed
through 2026-09-01. `docs/expansion/NO-SPOILERS-ULTIMATE-PRD.md` assigns it to phases.

Legend: **Built**, **Partial**, **Planned**, **Deferred**, **Separate product**, **Do not build**.

## Commercial and platform foundation

| Feature | Status | Home |
| --- | --- | --- |
| Neon application runtime | Built: app boots on Neon `neondb` | NoSpoilers |
| GitHub OAuth login | Built: real GitHub user session on Neon; `github_app_authorization` revoked drops that user’s sessions and stored OAuth token | NoSpoilers |
| GitHub App installation | Built: live App install and HMAC webhooks; `installation_target` renamed updates the stored account login in place | NoSpoilers |
| Installation ownership verification | Built | NoSpoilers |
| Real throwaway-repository proof | Partial: created-public webhook → job → Watch alert. Git content authored in `throwaway/`. Live seed/release still needs Contents write (not Administration); the GitHub repo is still empty | NoSpoilers |
| Installation-scoped billing account | Built: 14-day trial per GitHub install | NoSpoilers |
| Complete unpaid webhook/worker/poller/scan enforcement | Built: webhook 200, work skipped | NoSpoilers |
| Stripe monthly/yearly checkout | Planned, benched until throwaway Release scan is live | NoSpoilers |
| Card-on-file 14-day trial | Planned, benched | NoSpoilers |
| Stripe lifecycle webhooks | Planned, benched | NoSpoilers |
| Billing portal | Planned, benched | NoSpoilers |
| Railway web/API and worker deployment | Planned | NoSpoilers |
| Cloudflare DNS/custom domain | Planned | NoSpoilers |
| Resend email delivery | Planned, benched | NoSpoilers |
| Job retry/backoff | Built: 5 attempts, exponential backoff | NoSpoilers |
| Stale-lock recovery/dead-letter visibility | Built: stale running jobs requeued; tenant failed jobs listed on Watch; owner queue counts include failed and stale locks; job bodies stay off the owner page | NoSpoilers |
| Upload/API rate limiting | Built: hosted scan, GitHub OAuth, and owner discovery per address; GitHub webhooks are not limited | NoSpoilers |
| Readiness/health checks and structured logs | Built: `/api/health` liveness, `/api/ready` DB ping, JSON logs | NoSpoilers |
| Secure cookies and strong secret validation | Built: Secure cookies on https; Neon/https refuse weak secrets | NoSpoilers |
| Encryption for GitHub OAuth/integration tokens | Built: AES-GCM at rest, plaintext rows migrated on read | NoSpoilers |
| Privacy, Terms, retention, refund and support pages | Built | NoSpoilers |
| Public documentation | Built: `/docs` (Watch, packed scans, coverage, what we never do; Stripe/Electron not claimed live) | NoSpoilers |
| Cloud usage warnings and hard budget controls | Planned | Infrastructure |

## Scanner and release automation

| Feature | Status | Home |
| --- | --- | --- |
| Directory, `.tar`, tgz/tar.gz, ZIP, asar, VSIX, CRX, XPI, wheel, JAR/WAR, nupkg, gem, Docker/OCI image, APK/AAB/IPA, serverless zip and single-file scanning | Built | NoSpoilers |
| Source maps, embedded source and map URL rules | Built | NoSpoilers |
| Environment, private key and high-confidence token rules | Built | NoSpoilers |
| Credential config, AI context, internal location, debug rules | Built | NoSpoilers |
| Git/source/size rules | Built | NoSpoilers |
| Hard input/unpacked/file/time budgets | Built | NoSpoilers |
| JSON and SARIF reports | Built | NoSpoilers |
| Automatic npm package watching | Built: public registry.npmjs.org and private HTTPS registries per GitHub install | NoSpoilers |
| New npm version detection | Built: hourly check + Watch “Check now” | NoSpoilers |
| npm dist-tag and prerelease-channel changes | Built: next/beta/canary/rc/alpha/preview tarballs scanned (cap 3 extras); other tags stay a tag-only light alert | NoSpoilers |
| Changed tarball bytes under the same package coordinate | Built: latest shasum change enqueues a rescan | NoSpoilers |
| Private npm registry support | Built: encrypted per-install token, same-host HTTPS tarballs, SSRF blocked | NoSpoilers |
| npm/pnpm/Yarn/Bun monorepo discovery | Built: packed artifacts list roots and members; never executed; not auto-watched | NoSpoilers |
| Pre-publish CI gate | Partial: Action exists; generated workflow lists existing `package.tgz` and `dist/` packs (cap 8), scans each, fails closed if none; source pushes are not unpacked | NoSpoilers |
| App-generated setup PR | Partial: reviewable PR, never merged; generated CI scans each existing pack under package.tgz and dist/; 409 YAML copy-paste until Contents+PR write | NoSpoilers |
| GitHub Checks and annotations | Partial: hosted release scans post Checks with rule/path annotations; skipped on 403/404 | NoSpoilers |
| Required-check setup guidance | Partial: setup PR body and Watch copy tell maintainers to mark NoSpoilers required; App does not set branch protection | NoSpoilers |
| Release manifest: path, size, hash | Built: per-file path/size/SHA-256 on every scan | NoSpoilers |
| Release Diff between approved versions | Built: approved baseline receipt if present, else last two | NoSpoilers |
| Baseline approval | Built: attributable `scan_baselines`, supersedes the previous | NoSpoilers |
| Path/rule allowlist with expiry and reason | Built: exact-rule, expiring, never silent DELETE | NoSpoilers |
| `.nospoilers.yml` policy file | Built: CLI/Action + hosted DB exceptions | NoSpoilers |
| Unexpected package-size increase | Built: SIZE-003 on hosted receipts vs previous or approved baseline (2× or ≥5 MiB unpacked); Watch Diff; Checks warning; allowlist | NoSpoilers |
| Files newly absent/present vs approved release | Built: added/removed/changed paths only | NoSpoilers |
| Nested archive scanning | Built: unpack nested tgz/zip/asar/vsix/crx/xpi/whl/jar/nupkg/gem, image layers, apk/aab/ipa, and serverless zips up to 3 levels, never execute | NoSpoilers |
| Escaping/suspicious symlink detection | Built: absolute and `..` targets, not followed | NoSpoilers |
| Escaping archive entry paths | Built: ARC-002 on zip/tar `..` and absolute names; zip-slip entries are not unpacked for content | NoSpoilers |
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
| Append-only sealed release revisions | Built: append-only `release_revisions`; digest mismatch appends, never rewrites; Watch lists linked receipt status (`passed` / `failed-policy` / `inconclusive`) and downloads the signed receipt JSON; failed-policy and inconclusive are not clean | NoSpoilers |
| Build/source revision and CI provenance link | Built: git SHA/tag/version and HTTPS CI URL stored, never fetched; Sigstore still Planned | NoSpoilers |
| CycloneDX/SPDX SBOM attachment | Planned | NoSpoilers Team |
| SLSA/in-toto provenance validation | Planned | NoSpoilers Team |
| Sigstore/cosign signature verification | Planned | NoSpoilers Team |
| npm/GitHub attestation adapters | Planned | NoSpoilers |
| Stable/beta/canary release channels | Built: `stable` / `beta` / `canary` on each revision | NoSpoilers |
| Scheduled registry/CDN delivery verification | Planned | NoSpoilers Team |
| Replacement/disappearance/redirect/content-type drift incidents | Planned | NoSpoilers Team |
| Offline signed-receipt verification | Built: `nospoilers verify <file> --receipt` HMAC check; Scan page checks JSON you already have (optional pack hashed in-browser, never uploaded); Watch lists receipt status and downloads the signed JSON for a sealed release; authentic failed-policy/inconclusive is not clean | NoSpoilers |
| Public verification page controlled by customer | Planned, later | NoSpoilers |

## Package Identity module

| Feature | Status | Home |
| --- | --- | --- |
| Verified protected package/scope ownership | Built: protect only if npm scope or GitHub repository field matches the install | NoSpoilers |
| Bounded typo/edit-distance candidate generation | Built: deterministic cap of 40 candidates; first transformation wins | NoSpoilers Team |
| Separator, keyboard, token-order, homoglyph and scope confusion | Built: ASCII confusables, adjacent-key, separator, token-order, scope confusion | NoSpoilers Team |
| Maintainer addition/removal history | Built: append-only identity snapshots; emails never stored | NoSpoilers |
| Package ownership continuity/transfer alert | Built: maintainer add/remove facts, not a malware verdict | NoSpoilers |
| Repository/homepage/domain mismatch | Built: explainable npm repository/homepage change alerts | NoSpoilers |
| Dormant-package resurrection | Built: explainable alert after 180 days without a recorded publish | NoSpoilers Team |
| Suspicious release burst/version jump | Built: ≥5 versions in 7 days or major +3; facts, not a malware verdict | NoSpoilers Team |
| Artifact hash/shape anomaly | Built: new `bin` or install lifecycle scripts vs last snapshot | NoSpoilers |
| Human-reviewed advisory/takedown evidence | Planned, later | NoSpoilers Team |
| Automatic malware verdict/takedown | Do not build | None |

## Distribution surfaces and formats

| Surface | Status | Home |
| --- | --- | --- |
| GitHub Release assets | Built: published plus edited/prereleased/released when pack assets change; unpublished/deleted are light alerts with no download. Watch Scan latest release queues a heavy unpack of the current Release pack (not git) and is not the hourly poller. Real throwaway fixture scan is still unproven | NoSpoilers |
| npm registry packages | Built: customer watch of public `latest` plus prerelease-channel tarballs | NoSpoilers |
| Production website JS/CSS/assets | Built: HTTPS origin, same-origin JS/CSS/maps plus bounded probes for exposed files, credentials, and linked internal paths, SSRF blocked, never executed | NoSpoilers |
| Sentry source-map custody | Built: debug ID lookup, encrypted token, public map MAP-012, missing private MAP-011 | NoSpoilers |
| Bugsnag source-map custody | Built: release-version match; debug ID lookup is not available on this API | NoSpoilers |
| VS Code `.vsix` | Built: ZIP magic, clean and dirty fixtures, GitHub Release asset, Scan example | NoSpoilers |
| Chrome `.crx` and Firefox `.xpi`/extension ZIPs | Built: CRX header stripped; CRX without ZIP inconclusive; XPI as ZIP; clean and dirty Scan examples | NoSpoilers |
| Python wheel and source distribution | Built: `.whl` as ZIP; sdist is the existing tarball path; clean and dirty Scan examples | NoSpoilers |
| Java JAR/WAR | Built: ZIP magic; clean and dirty Scan examples | NoSpoilers |
| NuGet `.nupkg` and `.snupkg` | Built: ZIP magic; clean and dirty Scan examples | NoSpoilers |
| Ruby gems | Built: tar + nested `data.tar.gz`, never executed; clean and dirty Scan examples | NoSpoilers |
| Docker/OCI image layers | Built: docker save + OCI layout sniff, layer tars and gzip blobs, overlay whiteouts not applied, encrypted layers inconclusive; clean and dirty docker-save and OCI examples | NoSpoilers |
| Serverless deployment bundles | Built: ZIP magic plus host.json / serverless.yml / .aws-sam / netlify/functions / .vercel/output layout, or `.lambda.zip` name; handlers never executed; encrypted zip inconclusive | NoSpoilers |
| Android APK/AAB | Built: ZIP magic, AndroidManifest/BundleConfig layout, DEX never executed, signatures not verified; clean and dirty Scan APK/AAB examples | NoSpoilers |
| iOS IPA | Built: ZIP magic, Payload/*.app layout, Mach-O never executed, FairPlay not decrypted, signatures not verified; clean and dirty Scan IPA examples | NoSpoilers |
| Electron DMG | Deferred isolated worker | NoSpoilers |
| Electron EXE/NSIS | Deferred isolated worker | NoSpoilers |
| Electron AppImage | Deferred isolated worker | NoSpoilers |
| Electron MSI | Deferred isolated worker | NoSpoilers |

## GitHub visibility and incident response

| Feature | Status | Home |
| --- | --- | --- |
| Private → public alert | Built/needs real proof: `repository.publicized` and the GitHub `public` event enqueue the same light job | NoSpoilers |
| Repository created public | Built/needs real proof | NoSpoilers |
| Repository renamed | Built: Watch updates name/URL in place; no extra job | NoSpoilers |
| Repository made private | Built: Watch updates the private flag in place; no extra job | NoSpoilers |
| Repository deleted | Built: row is removed; deleted webhooks do not resurrect it | NoSpoilers |
| Repository transfer | Built/needs real proof | NoSpoilers |
| Collaborator added | Built: `member` / `added` enqueues a light `member_added` job and the worker writes a Watch alert; other member actions do not; HMAC required; unpaid is HTTP 200 with no job. Still needs real GitHub proof | NoSpoilers |
| Fork event | Built: `fork` enqueues a light job with the forkee full name and the worker writes a Watch alert; HMAC required; unpaid is HTTP 200 with no job. Still needs real GitHub proof | NoSpoilers |
| Cheap sensitive-path push event | Built: `push` cheap-checks `*.map` / `.env` / `.env.*` only, enqueues a light job on hits, and the worker writes a Watch alert without unpacking the git tree; HMAC required; unpaid is HTTP 200 with no job. Still needs real GitHub proof | NoSpoilers |
| GitHub Release unpublished or deleted | Built: light Watch alert; gone assets are not downloaded | NoSpoilers |
| App permission, suspension, repository-add/remove and uninstall health | Built: Watch alerts while the install remains; uninstall drops the tenant | NoSpoilers |
| GitHub App authorization revoke | Built: HMAC webhook drops that user’s sessions and stored OAuth token; the installation stays; coverage does not gate this | NoSpoilers |
| Hourly missed-webhook visibility check | Built | NoSpoilers |
| Event acknowledgement and assignment | Built: ack/assign to install members; append-only `alert_events` | NoSpoilers |
| Resolution notes/evidence | Built: resolve requires a note; files are not stored | NoSpoilers |
| Exposure-duration timer | Built: open until resolved, shown on Watch | NoSpoilers |
| Credential-rotation checklist | Built: SEC/MAP rules; secret values are not copied | NoSpoilers |
| One-click make repository private | Planned: needs GitHub App **Administration** (repo-admin). Not granted. Not required for Phase 1 | NoSpoilers |
| Remove/suspend bad GitHub Release asset | Planned: needs GitHub App **Administration**. Not granted | NoSpoilers |
| Disable unsafe release workflow | Planned: needs GitHub App **Administration**. Not granted | NoSpoilers |
| Automatic remediation PR | Built: reviewable PR for ignore rules, empty `.nospoilers.yml`, bundler hints, `files` snippet, and packed-artifact CI; never merged; 409 copy-paste until Contents+PR write; customer files are not overwritten | NoSpoilers |
| Multiple GitHub organizations | Built: Watch install switcher; list APIs take `installationId`; writes require an id when two+ installs exist; coverage and GitHub suspend are per install | NoSpoilers |
| Live installation/permission test | Built: GitHub install + optional repo probe + last customer job; never invents an incident | NoSpoilers |

## Alerts, team and trust

| Feature | Status | Home |
| --- | --- | --- |
| Dashboard alerts | Built | NoSpoilers |
| Email alerts | Planned | NoSpoilers |
| Slack alerts | Built: encrypted incoming webhook on trial/Team; test delivery never invents an incident | NoSpoilers Team |
| Jira tickets | Built: Jira Cloud only (`*.atlassian.net`); encrypted email+token; project key listed; trial/Team; test GETs myself+project and never creates a ticket or Watch alert | NoSpoilers Team |
| SIEM/custom webhooks | Built: encrypted HTTPS webhook on trial/Team; private/local/metadata/Slack hosts blocked; DNS-resolved SSRF check; test never invents an incident | NoSpoilers Team |
| PagerDuty/incident routing | Planned, later | NoSpoilers Team |
| Severity and repository routing rules | Built: trial/Team routes by min severity, repository, package, teammate assign, and destination; empty destination still gets every alert; routed test never invents an incident | NoSpoilers Team |
| 90-day timeline | Built: Watch feed of this install’s alerts, acknowledgement activity, and notification deliveries for the install list window (default 90 days); trial/Team; Solo 403; unpaid 402; no invented rows | NoSpoilers Team |
| Configurable data retention | Built: query-time list window (90 default; 180/365/keep while this install exists); append-only evidence is never deleted; typed confirm; Solo allowed; unpaid 402; members may read | NoSpoilers |
| Team members and roles | Built: first GitHub user on an install is admin; later users are members; trial/Team role changes; Solo 403; unpaid 402; last admin stays; GitHub suspend does not block; members keep Watch/ack/test; admins save Slack/SIEM/Jira, map custody, routes, registries, tokens, allowlists, baselines, and PRs | NoSpoilers Team |
| SSO/SAML | Deferred until requested | NoSpoilers |
| Audit-log export | Built: trial/Team append-only `audit_events` plus titles-only alerts/deliveries; typed confirmation on destructive writes; Solo 403; unpaid 402; never stores URLs, emails, tokens, or secret values | NoSpoilers Team |
| Queue and usage health | Built: tenant-scoped job list and counts; owner `GET /api/internal/queue` counts (customer vs prospect, stale locks); public `/status` liveness; no scan credits; job bodies stay off the owner page | NoSpoilers |
| Public status page | Built: `/status` from `/api/health` (no tenant data, no URL) | Operations |
| Scan concurrency/fair-use controls without credits | Built: Solo 1 concurrent heavy unpack per install, Team/trial 3; global heavy cap still applies; job list is counts not credits | NoSpoilers |
| Multiple notification destinations | Built: one Slack, one SIEM, and one Jira Cloud destination per install | NoSpoilers Team |

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
