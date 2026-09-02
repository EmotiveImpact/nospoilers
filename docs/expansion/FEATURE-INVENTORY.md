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
| Real throwaway-repository proof | Built: created-public + cheap `.env`/`.map` push + `release.published` → `release_scan` done → Watch “Spoilers in … phase1-fixture” + `failed-policy` receipt (MAP-001/002/003) on `EmotiveImpact/nospoilers-throwaway`. Contents write on this install only; Workflows write not requested; Administration not granted | NoSpoilers |
| Installation-scoped billing account | Built: 14-day trial per GitHub install | NoSpoilers |
| Complete unpaid webhook/worker/poller/scan enforcement | Built: webhook 200, work skipped | NoSpoilers |
| Stripe monthly/yearly checkout | Planned, benched | NoSpoilers |
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
| Cloud usage warnings and hard budget controls | Built: daily hosted heavy-unpack cap (Solo 8 / Team and trial 24 per UTC day); Watch warning and pause copy; owner aggregate counts; webhooks stay HTTP 200; customer APIs 429 + Retry-After; not a scan-credit meter; not a Pricing change | Infrastructure |

## Scanner and release automation

| Feature | Status | Home |
| --- | --- | --- |
| Directory, `.tar`, tgz/tar.gz, ZIP, asar, VSIX, CRX, XPI, Chrome extension ZIP, wheel, Python sdist, JAR/WAR, nupkg, gem, Docker/OCI image, APK/AAB/IPA, serverless zip and single-file scanning | Built | NoSpoilers |
| Source maps, embedded source and map URL rules | Built | NoSpoilers |
| Environment, private key and high-confidence token rules | Built | NoSpoilers |
| Credential config, AI context, internal location, debug rules | Built | NoSpoilers |
| Git/source/size rules | Built | NoSpoilers |
| Hard input/unpacked/file/time budgets | Built | NoSpoilers |
| JSON and SARIF reports | Built | NoSpoilers |
| Automatic npm package watching | Built: public registry.npmjs.org and private HTTPS registries per GitHub install; public packuments (including 404s) cached 1h per process; private-registry tokens bypass the cache | NoSpoilers |
| New npm version detection | Built: hourly check + Watch “Check now”; Check now / connect / protect / import fetch the watched name fresh | NoSpoilers |
| Watched package unpublished / missing from registry | Built: registry 404 after a recorded version writes `package_unpublished` without download; 5xx/network errors do not; unpaid skips; tenant-scoped; not a malware verdict | NoSpoilers |
| npm dist-tag and prerelease-channel changes | Built: next/beta/canary/rc/alpha/preview tarballs scanned (cap 3 extras); other tags stay a tag-only light alert | NoSpoilers |
| Changed tarball bytes under the same package coordinate | Built: latest shasum change enqueues a rescan | NoSpoilers |
| Private npm registry support | Built: encrypted per-install token, same-host HTTPS tarballs, SSRF blocked | NoSpoilers |
| npm/pnpm/Yarn/Bun monorepo discovery | Built: packed artifacts list roots and members; never executed; not auto-watched | NoSpoilers |
| Pre-publish CI gate | Partial: this repo’s GitHub Actions rebuilds fixtures, fail-closes every dirty pack, treats `inconclusive.*` as CLI exit 2 (not a passing receipt), and passes every clean pack plus workspace.tgz; dogfoods `uses: ./` on clean.tgz (pass) and sourcemap.tgz (fail closed); generated customer workflow vendors `.github/actions/nospoilers` and POSTs each existing `package.tgz` and `dist/` pack (cap 8) to hosted `/api/v1/scan`; fails closed if none; source pushes are not unpacked; Watch shows the current HTTPS origin for `NOSPOILERS_API_URL` when GitHub-hosted runners can reach it; Contents write can commit the Action; workflow YAML stays copy-paste; live PRs wait on Pull requests write and a Watch token | NoSpoilers |
| App-generated setup PR | Partial: reviewable PR, never merged; Contents write commits the vendored Action (proven on `EmotiveImpact/nospoilers-throwaway` `nospoilers/setup`); `.github/workflows/nospoilers.yml` stays copy-paste (Workflows write is not requested; 404 on that path); 409 names the committed branch/paths until Pull requests write | NoSpoilers |
| GitHub Checks and annotations | Partial: hosted release scans post Checks with rule/path annotations; skipped on 403/404; a missing tag commit (GitHub 422) skips the Check and does not fail the scan | NoSpoilers |
| Required-check setup guidance | Partial: setup PR body and Watch copy tell maintainers to mark NoSpoilers required; Watch Setup status probes Action/workflow presence and whether a NoSpoilers check ran (never invents an alert; required-check visibility stays unknown; App does not set branch protection). Live-probed `EmotiveImpact/nospoilers-throwaway`: Action on `nospoilers/setup`, workflow missing, no check | NoSpoilers |
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
| Explicit inconclusive status for limits, malformed/encrypted/partial scans | Built: never clean, never a passing receipt; Scan lists encrypted zip, CRX-without-ZIP, and encrypted OCI fixtures; CLI exit 2 | NoSpoilers |
| External scanning API | Built: hashed per-install `nsp_` tokens; `POST /api/v1/scan` mints a receipt and deletes bytes | NoSpoilers |

## Release Ledger module

| Feature | Status | Home |
| --- | --- | --- |
| SHA-256/SHA-512 artifact identity | Built: packed-file SHA-256/SHA-512 on receipts | NoSpoilers |
| Append-only sealed release revisions | Built: append-only `release_revisions`; digest mismatch appends, never rewrites; each new row stores packed size and inferred media type (`application/gzip` for `.tgz` / npm, `application/zip` for zip-family packs); Watch lists size, media type, and linked receipt status (`passed` / `failed-policy` / `inconclusive`) and downloads the signed receipt JSON; live-sealed throwaway `phase1-fixture` as 401 bytes / `application/gzip`; failed-policy and inconclusive are not clean | NoSpoilers |
| Build/source revision and CI provenance link | Built: git SHA/tag/version and HTTPS CI URL stored, never fetched; Sigstore still Planned | NoSpoilers |
| CycloneDX/SPDX SBOM attachment | Planned | NoSpoilers Team |
| SLSA/in-toto provenance validation | Planned | NoSpoilers Team |
| Sigstore/cosign signature verification | Planned | NoSpoilers Team |
| npm/GitHub attestation adapters | Planned | NoSpoilers |
| Stable/beta/canary release channels | Built: `stable` / `beta` / `canary` on each revision | NoSpoilers |
| Scheduled registry/CDN delivery verification | Planned | NoSpoilers Team |
| Replacement/disappearance/redirect/content-type drift incidents | Built: on-demand Watch attach + Verify now stream-hashes a customer HTTPS URL against the sealed revision; public GitHub Release download URLs and public npm tarball URLs attach when the revision is sealed (no verify job; private repos/registries skipped); mismatch / missing / unexpected cross-host redirect / content-type change write one fact alert; expected hops (not incidents): `github.com` → GitHub asset CDN, same-bucket S3 path-style ↔ virtual-hosted, same-account R2 path-style ↔ virtual-hosted; other hosts / buckets / CloudFront / `r2.dev` are not fetched; each verify stores hop hosts, a short cache token, and a host-derived region (not raw cache headers); live-matched `EmotiveImpact/nospoilers-throwaway` `phase1-fixture` `sourcemap.tgz` (`c74219d2…`) with hop `github.com` → `release-assets.githubusercontent.com`, `x-cache:hit`, region `github`; query strings redacted; bytes not stored; not the hourly poller. Scheduled CDN verification stays Planned | NoSpoilers |
| Offline signed-receipt verification | Built: `nospoilers verify [file] --receipt` HMAC check; `--url` stream-hashes a delivery URL against the receipt (same hop/SSRF rules as Watch; bytes not stored; query strings not printed; live-matched throwaway `phase1-fixture` and still failed-policy); Scan page checks JSON you already have (optional pack hashed in-browser, never uploaded); Watch lists receipt status and downloads the signed JSON for a sealed release; authentic failed-policy/inconclusive is not clean | NoSpoilers |
| Approval workflows and separation of duties | Built: trial/Team install admins approve a passing sealed revision to ship or reject it; typed coordinate; reason required; failed-policy / inconclusive / digest-changed cannot be approved; the admin who attached a delivery URL cannot approve that revision; members 403; Solo 403; unpaid 402; append-only `release_approvals`; audit records the coordinate only | NoSpoilers Team |
| Retention, legal hold and ledger export | Built: legal hold keeps a revision on the Watch list after the query-time retention window; another admin must release the hold; members export ledger JSON (digests, size, media type, receipt status, approvals, holds, redacted delivery URLs; no query strings or pack bytes); Solo 403; unpaid 402; append-only hold events. Scheduled CDN and SBOM/Sigstore stay Planned | NoSpoilers Team |
| Public verification page controlled by customer | Built: install admin publishes `/verify/:token` for a sealed revision; visitors see digests, receipt status, and last delivery host match; query strings, pack bytes, CI URLs, and signed URLs omitted; failed-policy is not clean; Solo allowed; unpaid 402 to publish (existing page still reads); members 403; another tenant 404; unguessable token; audit records the coordinate only; public GET does not enqueue verify. Live throwaway `phase1-fixture` (`c74219d2…`) published: unauth 401, public GET 200 `passingReceipt: false`, host `github.com` matched, tunnel matched, no new verify job. Scheduled CDN stays Planned | NoSpoilers |

## Package Identity module

| Feature | Status | Home |
| --- | --- | --- |
| Verified protected package/scope ownership | Built: protect only if npm scope or GitHub repository field matches the install | NoSpoilers |
| Namespace watchlists | Built: trial/Team admin watches `@${install login}` on public npm search (cap 20); first snapshot baseline; later new names write `identity_namespace_new` without download or `npm_scan` or auto-watch; one scope per install; members may read/check; Solo 403; unpaid 402; typed confirm; other registries stay out. Live on `158159401`: unauth 401, `@prettier` 403, `@emotiveimpact` POST 201 → `namespace_check` done empty baseline, no alert/`npm_scan`, typed DELETE left 0 rows; tunnel matched | NoSpoilers Team |
| API and batch protected-package import | Built: `POST /api/protections/import` (cap 20) protects owned npm names from a list or Watch textarea; metadata only (`getPack`); never downloads or enqueues `npm_scan`; unowned / missing / invalid names are not watched; already protected stays in place; watch cap 25; Solo allowed; unpaid 402; another tenant 403. Live on `158159401`: prettier / left-pad / missing / invalid → `not_owned` / `not_owned` / `not_found` / `invalid`, `queued: false`, watch list still empty, unauth 401; tunnel matched. No EmotiveImpact-owned npm pack to protect | NoSpoilers |
| Bounded typo/edit-distance candidate generation | Built: deterministic cap of 40 candidates; first transformation wins; hourly poller skips lookalikes checked within 1h (8 per pass); Watch Check now re-checks immediately; public lookalike packuments cached 1h; private tokens bypass; no extra fetch on risk GET. Live Neon gates on install `158159401`: unauth GET 401, unknown package 404, watch list empty, no open jobs, tunnel matched. No EmotiveImpact-owned npm pack to poll | NoSpoilers Team |
| Separator, keyboard, token-order, homoglyph and scope confusion | Built: ASCII confusables, adjacent-key, separator, token-order, scope confusion | NoSpoilers Team |
| Maintainer addition/removal history | Built: append-only identity snapshots; emails never stored | NoSpoilers |
| Package ownership continuity/transfer alert | Built: maintainer add/remove facts, not a malware verdict | NoSpoilers |
| Publishing identity / trusted publisher change | Built: snapshot `_npmUser.name` and `trustedPublisher.id`; alert on later change; first snapshot / empty previous is baseline; never store email or oidcConfigId; Solo allowed; unpaid skips; not a malware verdict | NoSpoilers |
| Repository/homepage/domain mismatch | Built: explainable npm repository/homepage change alerts | NoSpoilers |
| Dormant-package resurrection | Built: explainable alert after 180 days without a recorded publish | NoSpoilers Team |
| Suspicious release burst/version jump | Built: ≥5 versions in 7 days or major +3; facts, not a malware verdict | NoSpoilers Team |
| Dependency graph toward newly created packages | Built: new `dependencies` / `optionalDependencies` vs last snapshot; alert only if the added name’s npm `time.created` is within 14 days; metadata only, not a malware verdict | NoSpoilers Team |
| Packument unpacked-size jump | Built: `identity_size_jump` when latest `dist.unpackedSize` is 2× or ≥5 MiB versus the last identity snapshot; first snapshot / missing size is baseline; metadata only, no download; trial/Team; not SIZE-003 (that stays on hosted receipts) | NoSpoilers Team |
| npm provenance / signature presence | Built: snapshot `dist.attestations` presence + predicateType and `dist.signatures` keyids; alert on loss, predicate change, or keyid change; first snapshot baseline; never fetch attestation URL; never verify or store signature values; trial/Team; not a Sigstore/attestation adapter | NoSpoilers Team |
| Deterministic identity risk score | Built: trial/Team Watch total (0–100) for a protected npm name; decomposed into current snapshot facts, registered non-allowlisted lookalikes, and open event alerts (burst / lookalike version / new dependency / unpublished); same facts always produce the same total; Solo and unpaid omit the score; another tenant 404; never a malware verdict; no extra registry fetch. Live Neon gates on install `158159401`: unauth GET 401, unknown package 404, watch list empty, no new jobs, tunnel matched. No EmotiveImpact-owned npm pack to score | NoSpoilers Team |
| Artifact hash/shape anomaly | Built: new `bin` or install lifecycle scripts vs last snapshot | NoSpoilers |
| Human-reviewed advisory/takedown evidence | Built: trial/Team install admin assembles a frozen evidence pack for a protected npm name (`POST /api/packages/:id/evidence`) and may publish `/advisory/:token`; members may read/download; Solo 403; unpaid 402 to change (published page still reads); other tenant 404; typed package-name confirm; public page is package name, repository/homepage host, and registered lookalike name+transformation only; takedown JSON adds maintainer names, publisher/trusted-publisher, lookalike versions, and identity alert titles; never sends to npm/GitHub; never downloads tarballs; never a malware verdict. Live Neon gates on install `158159401`: unauth GET/POST 401, missing package 404, unknown advisory 404, watch list empty, evidence packs 0; Cloudflare tunnel matched. No EmotiveImpact-owned npm pack to assemble. Other registries and auto-send stay out | NoSpoilers Team |
| Automatic malware verdict/takedown | Do not build | None |

## Distribution surfaces and formats

| Surface | Status | Home |
| --- | --- | --- |
| GitHub Release assets | Built: published plus edited/prereleased/released when pack assets change; unpublished/deleted are light alerts with no download. Watch Scan latest release queues a heavy unpack of the current Release pack (not git) and is not the hourly poller. Throwaway `phase1-fixture` `sourcemap.tgz` produced `release_scan` + `failed-policy` MAP-001/002/003 | NoSpoilers |
| npm registry packages | Built: customer watch of public `latest` plus prerelease-channel tarballs | NoSpoilers |
| Production website JS/CSS/assets | Built: HTTPS origin, same-origin JS/CSS/maps plus bounded probes for exposed files, credentials, and linked internal paths, SSRF blocked, never executed | NoSpoilers |
| Sentry source-map custody | Built: debug ID lookup, encrypted token, public map MAP-012, missing private MAP-011 | NoSpoilers |
| Bugsnag source-map custody | Built: release-version match; debug ID lookup is not available on this API | NoSpoilers |
| VS Code `.vsix` | Built: ZIP magic, clean and dirty fixtures, GitHub Release asset, Scan example | NoSpoilers |
| Chrome `.crx` and Firefox `.xpi`/extension ZIPs | Built: CRX header stripped; CRX without ZIP inconclusive (`fixtures/inconclusive.crx` Scan example); XPI as ZIP; Chrome ZIP WebExtension layout (root manifest.json, not a CRX header) classified as xpi; clean and dirty Scan examples | NoSpoilers |
| Python wheel and source distribution | Built: `.whl` as ZIP; sdist tar.gz PKG-INFO layout sniff (not a generic npm tarball); Python is not executed; clean and dirty Scan examples | NoSpoilers |
| Java JAR/WAR | Built: ZIP magic; clean and dirty JAR and WAR Scan examples | NoSpoilers |
| NuGet `.nupkg` and `.snupkg` | Built: ZIP magic; clean and dirty nupkg and snupkg Scan examples | NoSpoilers |
| Ruby gems | Built: tar + nested `data.tar.gz`, never executed; clean and dirty Scan examples | NoSpoilers |
| Docker/OCI image layers | Built: docker save + OCI layout sniff, layer tars and gzip blobs, overlay whiteouts not applied, encrypted layers inconclusive (`fixtures/inconclusive.encrypted.oci.tar` Scan example); clean and dirty docker-save and OCI examples | NoSpoilers |
| Serverless deployment bundles | Built: ZIP magic plus host.json / serverless.yml / .aws-sam / netlify/functions / .vercel/output layout, or `.lambda.zip` name; handlers never executed; encrypted zip inconclusive | NoSpoilers |
| Android APK/AAB | Built: ZIP magic, AndroidManifest/BundleConfig layout, DEX never executed, signatures not verified; clean and dirty Scan APK/AAB examples; XAPK is a nested APK zip | NoSpoilers |
| iOS IPA | Built: ZIP magic, Payload/*.app layout, Mach-O never executed, FairPlay not decrypted, signatures not verified; clean and dirty Scan IPA examples | NoSpoilers |
| Electron DMG | Deferred isolated worker | NoSpoilers |
| Electron EXE/NSIS | Deferred isolated worker | NoSpoilers |
| Electron AppImage | Deferred isolated worker | NoSpoilers |
| Electron MSI | Deferred isolated worker | NoSpoilers |

## GitHub visibility and incident response

| Feature | Status | Home |
| --- | --- | --- |
| Private → public alert | Built/needs real proof: `repository.publicized` and the GitHub `public` event enqueue the same light job | NoSpoilers |
| Repository created public | Built: `EmotiveImpact/nospoilers-throwaway` `repository.created` → `repo_created_public` | NoSpoilers |
| Repository renamed | Built: Watch updates name/URL in place; no extra job | NoSpoilers |
| Repository made private | Built: Watch updates the private flag in place; no extra job | NoSpoilers |
| Repository deleted | Built: row is removed; deleted webhooks do not resurrect it | NoSpoilers |
| Repository transfer | Built/needs real proof | NoSpoilers |
| Collaborator added | Built: `member` / `added` enqueues a light `member_added` job and the worker writes a Watch alert; other member actions do not; HMAC required; unpaid is HTTP 200 with no job. Still needs real GitHub proof | NoSpoilers |
| Fork event | Built: `fork` enqueues a light job with the forkee full name and the worker writes a Watch alert; HMAC required; unpaid is HTTP 200 with no job. Still needs real GitHub proof | NoSpoilers |
| Cheap sensitive-path push event | Built: `push` cheap-checks `*.map` / `.env` / `.env.*` only, enqueues a light job on hits, and the worker writes a Watch alert without unpacking the git tree; HMAC required; unpaid is HTTP 200 with no job. Proven on `EmotiveImpact/nospoilers-throwaway` (`.env` and `*.map`) | NoSpoilers |
| GitHub Release unpublished or deleted | Built: light Watch alert; gone assets are not downloaded | NoSpoilers |
| App permission, suspension, repository-add/remove and uninstall health | Built: Watch alerts while the install remains; uninstall drops the tenant | NoSpoilers |
| GitHub App authorization revoke | Built: HMAC webhook drops that user’s sessions and stored OAuth token; the installation stays; coverage does not gate this | NoSpoilers |
| Hourly missed-webhook visibility check | Built | NoSpoilers |
| Event acknowledgement and assignment | Built: ack/assign to install members; append-only `alert_events` | NoSpoilers |
| Resolution notes/evidence | Built: resolve requires a note; files are not stored | NoSpoilers |
| Exposure-duration timer | Built: open until resolved, shown on Watch | NoSpoilers |
| Credential-rotation checklist | Built: SEC/MAP rules; secret values are not copied | NoSpoilers |
| One-click make repository private | Built: install admin, typed `owner/repo`, unpaid 402, GitHub suspend 409, members 403. 409 until GitHub App **Administration** (not granted). Contents write is not enough. Success writes audit plus a Watch alert that is a confirmed response, not a discovered incident | NoSpoilers |
| Remove/suspend bad GitHub Release asset | Built: deletes packed assets on the latest Release only (`isPackAssetName`); source trees are not touched. Same Administration 409/typed-confirm gates as make-private | NoSpoilers |
| Disable unsafe release workflow | Built: path under `.github/workflows/`; cannot disable `.github/workflows/nospoilers.yml`. Same Administration 409/typed-confirm gates as make-private | NoSpoilers |
| Automatic remediation PR | Built: reviewable PR for ignore rules, empty `.nospoilers.yml`, bundler hints, `files` snippet, and packed-artifact CI; never merged; Contents write commits non-workflow files; workflow YAML stays copy-paste; 409 until Pull requests write; customer files are not overwritten | NoSpoilers |
| Multiple GitHub organizations | Built: Watch install switcher; list APIs take `installationId`; writes require an id when two+ installs exist; coverage and GitHub suspend are per install | NoSpoilers |
| Live installation/permission test | Built: GitHub install + optional repo probe + last customer job; reports Members read and optional Contents/PR/Checks write; names App-requested permissions the install has not accepted and links to GitHub Accept; Administration granted is a warning (never asked); never invents an incident | NoSpoilers |

## Alerts, team and trust

| Feature | Status | Home |
| --- | --- | --- |
| Dashboard alerts | Built | NoSpoilers |
| Email alerts | Planned | NoSpoilers |
| Slack alerts | Built: encrypted incoming webhook on trial/Team; test delivery never invents an incident | NoSpoilers Team |
| Jira tickets | Built: Jira Cloud only (`*.atlassian.net`); encrypted email+token; project key listed; trial/Team; test GETs myself+project and never creates a ticket or Watch alert | NoSpoilers Team |
| SIEM/custom webhooks | Built: encrypted HTTPS webhook on trial/Team; private/local/metadata/Slack hosts blocked; DNS-resolved SSRF check; test never invents an incident | NoSpoilers Team |
| PagerDuty/incident routing | Built: encrypted Events API routing key on trial/Team; host locked to events.pagerduty.com; test POSTs a change event and never creates an incident or Watch alert; real alerts trigger Events API | NoSpoilers Team |
| Severity and repository routing rules | Built: trial/Team routes by min severity, repository, package, teammate assign, and destination; empty destination still gets every alert; routed test never invents an incident | NoSpoilers Team |
| 90-day timeline | Built: Watch feed of this install’s alerts, acknowledgement activity, and notification deliveries for the install list window (default 90 days); trial/Team; Solo 403; unpaid 402; no invented rows | NoSpoilers Team |
| Configurable data retention | Built: query-time list window (90 default; 180/365/keep while this install exists); append-only evidence is never deleted; typed confirm; Solo allowed; unpaid 402; members may read | NoSpoilers |
| Team members and roles | Built: first GitHub user on an install is admin; later users are members; trial/Team role changes and GitHub-login invites (no email; Resend is benched); Solo 403; unpaid 402; last admin stays; GitHub suspend does not block; members keep Watch/ack/test; admins save Slack/SIEM/Jira/PagerDuty, map custody, routes, registries, tokens, allowlists, baselines, PRs, and confirmed GitHub responses | NoSpoilers Team |
| SSO/SAML | Deferred until requested | NoSpoilers |
| Audit-log export | Built: trial/Team append-only `audit_events` plus titles-only alerts/deliveries; typed confirmation on destructive writes; Solo 403; unpaid 402; never stores URLs, emails, tokens, or secret values | NoSpoilers Team |
| Queue and usage health | Built: tenant-scoped job list with fairUse warning/exhausted/resetsAt; owner `GET /api/internal/queue` counts (customer vs prospect, stale locks, daily unpack aggregates); public `/status` liveness; no scan credits; job bodies stay off the owner page | NoSpoilers |
| Public status page | Built: `/status` from `/api/health` (no tenant data, no URL) | Operations |
| Scan concurrency/fair-use controls without credits | Built: Solo 1 concurrent heavy unpack and 8 per UTC day per install, Team/trial 3 concurrent and 24/day; global heavy cap still applies; job list is counts not credits | NoSpoilers |
| Multiple notification destinations | Built: one Slack, one SIEM, one Jira Cloud, and one PagerDuty destination per install | NoSpoilers Team |

## Internal acquisition and responsible disclosure

| Feature | Status | Home |
| --- | --- | --- |
| Public GitHub/npm Artifact Leads desk | Built | Internal NoSpoilers |
| Manual repository inspection | Built | Internal NoSpoilers |
| Search campaign discovery | Built: owner saves GitHub search queries (cap 8); hourly poller rotates one enabled campaign for three public repos after customer work, or uses the default search; typed confirm; customer 401; no seeded companies. Live: `049` applied, unauth/non-admin 401, save 201, typed DELETE left 0 rows, prospect count unchanged, tunnel matched | Internal NoSpoilers |
| One-at-a-time prospect scans behind customer jobs | Built | Internal NoSpoilers |
| Scheduled discovery | Built: hourly poller, after customer visibility/npm/web/map work, runs a 3-repo GitHub search when `GITHUB_DISCOVERY_TOKEN` is set; skips if customer jobs are queued/running or 3+ prospect jobs are already out; owner-only; no seeded companies | Internal NoSpoilers |
| Continuous npm version feed | Built: hourly poller plus owner `POST /api/internal/prospects/feed`; metadata `getPack` on up to 8 known npm leads (`new`/`contacted`); new latest tarball becomes a new prospect row and queues behind customer jobs; 404/network is not an unpublish; ignored/fixed skipped; owner-only | Internal NoSpoilers |
| Nested workspace package discovery | Built: Artifact Leads inspect lists public npm names from package.json / pnpm-workspace globs (`packages/*` or a literal path, cap 8 queued packs); scanned packs store member names (cap 40); never auto-watched; never executed; owner-only | Internal NoSpoilers |
| Critical-only internal notifications | Built: owner-only `internal_notifications` when a Disclosure Desk case becomes `verified` and has critical fingerprints; unverified scans and warn-only cases do not notify; one row per case; mark-read; never mailed; no finding values | Internal NoSpoilers |
| Deadline-missed internal reminders | Built: owner-only `deadline_missed` notification when a case deadline passes without acknowledgement; lazy on desk read, not a poller; one row per case; never mailed | Internal NoSpoilers |
| Human finding verification | Built: owner-only case on Artifact Leads (`signal` / `verifying` / `verified` / `false_positive` / `duplicate`); checklist required before verified; a new verified state also requires a repeatable SHA-256 of the scanned artifact and operator-written reproducibility steps; finding category derived from fingerprints (operator can override); append-only `disclosure_findings` persist `rule\|severity\|path\|title` without values; no seeded companies. Live Neon: `058` applied; prettier/left-pad hashes and steps stay null (no rescan/rewrite); prettier stays `fixed`/`verified`; unauth/`not-admin` 401; leftover extra findings 0; leftover grants 0; no open jobs; tunnel matched | Internal NoSpoilers |
| Responsible-disclosure draft generation | Built: preview subject/body from fingerprints or a human-edited template (`{{coordinate}}` `{{package}}` `{{fingerprints}}` `{{channel}}`); recipients and channel shown; `sent` is always false; Resend still benched | Internal NoSpoilers |
| Preferred vendor channel | Built: `security_email` / `form` / `security_txt` / `platform` on the case | Internal NoSpoilers |
| Do-not-contact | Built: owner/repo, package name, contact, or vendor domain from a contact email/host; blocks case create unless `researchOnly`; always blocks `contacted` | Internal NoSpoilers |
| Disclosure outcomes | Built: credit / CVE / notes on the case; no bounty processor | Internal NoSpoilers |
| Duplicate company/finding detection | Built: owner/repo, same GitHub owner (organization), vendor domain from policy URL or contact email, package name, or overlapping `rule\|severity\|path\|title` fingerprints; 409 on case create and on `contacted` unless `confirmDuplicate`; a confirmed pair is stored once on append-only `disclosure_duplicate_links` (both cases see owner/repo and reasons); a 409 without confirm writes no row; first-class `disclosure_organizations` / append-only `disclosure_domains` persist the GitHub owner and vendor hosts so a cleared contact/policy still matches; forge/registry hosts are not vendor domains. Live Neon: `056` applied; prettier org + `prettier.io`; stevemao org, no vendor domain; prettier vs left-pad still no match; unauth/`not-admin` 401; leftover extra orgs 0; leftover links 0; leftover grants 0; no open jobs; tunnel matched | Internal NoSpoilers |
| Contact history and disclosure deadlines | Built: stored security contact / https policy URL (never fetched); first-class append-only `disclosure_security_contacts` and `disclosure_policies` on the GitHub-owner organization (policy URL is the contact source when both are saved); vendor domains persist on the organization; simulated acknowledgement; internal `deadlineMissed` flag only; no mail. Live Neon: `057` applied; prettier contact + policy recorded; stevemao none; unauth/`not-admin` 401; leftover extra records 0; leftover grants 0; no open jobs; tunnel matched | Internal NoSpoilers |
| Vendor replies and attachments | Built: owner-only append-only vendor replies; encrypted expiring attachments (text/PDF/PNG/JPEG, 64 KiB, archives rejected); bytes never appear on reports; expired ciphertext is zeroed on desk read and the hourly poller (row stays); expired notes ciphertext is nulled; customer 401; nothing mailed. Live on prettier: reply + `vendor-note.txt`; `.tgz` and zip magic 400. Live expiry gates: `048` applied, unauth/non-admin 401, owner sweep ran, unexpired ciphertext kept, tunnel matched | Internal NoSpoilers |
| Disclosure assignment and review | Built: owner-only assignee + approve/reject review; `contacted` requires review approval after verification and do-not-contact; SLA timestamps on the case and redacted report. Live prettier assigned to EmotiveImpact and approved | Internal NoSpoilers |
| Researcher roles | Built: owner grants a GitHub login operator access to Artifact Leads / Disclosure Desk (`/api/internal/operators`, cap 8, typed confirm); queue and further grants stay owner-only; owner login cannot be granted; customer 401; no worker wake; nothing mailed. Live Neon: `051` applied; unauth/`not-admin` 401; owner list empty; owner self-grant 400; missing confirm 400; grant `desk-researcher` 201; typed DELETE leftover grants 0; leftover destinations 0; no open jobs; campaigns 0; watches 0; tunnel matched | Internal NoSpoilers |
| Researcher workload | Built: owner-only case counts per assignee and unassigned (`GET /api/internal/disclosure/workload`); states, pending review, missed deadlines; no minutes, last-active, ranking, or billing; customer 401; no worker wake; nothing mailed. Live Neon: unauth/`not-admin` 401; owner 200 counted EmotiveImpact verified prettier + unassigned left-pad signal; no open jobs; tunnel matched | Internal NoSpoilers |
| Disclosure Jira/webhook destinations | Built: owner-only one HTTPS webhook and one Jira Cloud project; encrypted secrets never returned; test never invents an incident or creates a Jira issue; filing a verified case posts a redacted report after typed coordinate confirm; unverified 409; customer 401; no worker wake; nothing mailed. Live Neon: `050` applied; unauth/`not-admin` 401; owner list empty; localhost webhook 400; evil Jira host 400; leftover destinations 0; no open jobs; tunnel matched | Internal NoSpoilers |
| Redacted disclosure reports | Built: owner-only JSON/HTML/PDF; fingerprints, structured `disclosure_findings` (rule/severity/path/title, never values), SLA, replies, attachment metadata, events, artifact name/version/hash, reproducibility steps, confirmed duplicate owner/repo and reasons, organization policy URLs; notes and attachment bytes omitted; nothing sent. Live prettier report has two SEC-003 rows, omitted notes/bytes, and has no duplicate links; customer 401 | Internal NoSpoilers |
| Fixed-version automatic rescan | Built: operator records a fix version and queues a prospect rescan; not a scheduled worker | Internal NoSpoilers |
| Trial/paid conversion attribution | Built: `none` / `trial` / `paid` / `declined` on the case | Internal NoSpoilers |
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
