# Complete feature inventory

Nothing in this file is implied or silently discarded. It is the exhaustive inventory discussed
through 2026-09-01. `docs/expansion/NO-SPOILERS-ULTIMATE-PRD.md` assigns it to phases.

Legend: **Built**, **Partial**, **Planned**, **Deferred**, **Separate product**, **Do not build**.

## Commercial and platform foundation

| Feature | Status | Home |
| --- | --- | --- |
| Neon application runtime | Partial: schema applied, runtime unproven | NoSpoilers |
| GitHub OAuth login | Partial: code exists, real credentials unproven | NoSpoilers |
| GitHub App installation | Partial | NoSpoilers |
| Installation ownership verification | Planned | NoSpoilers |
| Real throwaway-repository proof | Planned | NoSpoilers |
| Installation-scoped billing account | Planned | NoSpoilers |
| Complete unpaid webhook/worker/poller/scan enforcement | Planned | NoSpoilers |
| Stripe monthly/yearly checkout | Planned | NoSpoilers |
| Card-on-file 14-day trial | Planned | NoSpoilers |
| Stripe lifecycle webhooks | Planned | NoSpoilers |
| Billing portal | Planned | NoSpoilers |
| Railway web/API and worker deployment | Planned | NoSpoilers |
| Cloudflare DNS/custom domain | Planned | NoSpoilers |
| Resend email delivery | Planned | NoSpoilers |
| Job retry/backoff | Planned | NoSpoilers |
| Stale-lock recovery/dead-letter visibility | Planned | NoSpoilers |
| Upload/API rate limiting | Planned | NoSpoilers |
| Readiness/health checks and structured logs | Planned | NoSpoilers |
| Secure cookies and strong secret validation | Planned | NoSpoilers |
| Encryption for GitHub OAuth/integration tokens | Planned | NoSpoilers |
| Privacy, Terms, retention, refund and support pages | Planned | NoSpoilers |
| Cloud usage warnings and hard budget controls | Planned | Infrastructure |

## Scanner and release automation

| Feature | Status | Home |
| --- | --- | --- |
| Directory, tgz/tar.gz, ZIP, asar scanning | Built | NoSpoilers |
| Source maps, embedded source and map URL rules | Built | NoSpoilers |
| Environment, private key and high-confidence token rules | Built | NoSpoilers |
| Credential config, AI context, internal location, debug rules | Built | NoSpoilers |
| Git/source/size rules | Built | NoSpoilers |
| Hard input/unpacked/file/time budgets | Built | NoSpoilers |
| JSON and SARIF reports | Built | NoSpoilers |
| Automatic npm package watching | Planned | NoSpoilers |
| New npm version detection | Planned | NoSpoilers |
| Private npm registry support | Planned | NoSpoilers |
| npm/pnpm/Yarn/Bun monorepo discovery | Planned | NoSpoilers |
| Pre-publish CI gate | Partial: Action exists | NoSpoilers |
| App-generated setup PR | Planned | NoSpoilers |
| GitHub Checks and annotations | Planned | NoSpoilers |
| Required-check setup guidance | Planned | NoSpoilers |
| Release manifest: path, size, hash | Planned | NoSpoilers |
| Release Diff between approved versions | Planned | NoSpoilers |
| Baseline approval | Planned | NoSpoilers |
| Path/rule allowlist with expiry and reason | Planned | NoSpoilers |
| `.nospoilers.yml` policy file | Planned | NoSpoilers |
| Unexpected package-size increase | Planned | NoSpoilers |
| Files newly absent/present vs approved release | Planned | NoSpoilers |
| Nested archive scanning | Planned | NoSpoilers |
| Escaping/suspicious symlink detection | Planned | NoSpoilers |
| Source archives and backup files | Planned | NoSpoilers |
| Database exports/dumps | Planned | NoSpoilers |
| SSH/cloud/service-account configuration | Planned | NoSpoilers |
| Crash dumps and additional debug symbols | Planned | NoSpoilers |
| Build caches/compiler metadata | Partial | NoSpoilers |
| Internal documentation and roadmaps | Planned | NoSpoilers |
| AI prompts, memory, transcripts and MCP policy pack | Partial | NoSpoilers |
| Signed scan receipt with artifact SHA-256 | Planned | NoSpoilers |
| External scanning API | Planned | NoSpoilers |

## Distribution surfaces and formats

| Surface | Status | Home |
| --- | --- | --- |
| GitHub Release assets | Built/partial real proof | NoSpoilers |
| npm registry packages | Partial: internal public resolver | NoSpoilers |
| Production website JS/CSS/assets | Planned | NoSpoilers |
| Sentry source-map custody | Planned | NoSpoilers |
| Bugsnag source-map custody | Planned | NoSpoilers |
| VS Code `.vsix` | Planned | NoSpoilers |
| Chrome/Firefox extensions | Planned | NoSpoilers |
| Python wheel/sdist | Planned | NoSpoilers |
| Java JAR/WAR | Planned | NoSpoilers |
| NuGet packages | Planned | NoSpoilers |
| Ruby gems | Planned | NoSpoilers |
| Docker/OCI image layers | Planned, later | NoSpoilers |
| Serverless deployment bundles | Planned | NoSpoilers |
| Android APK | Planned, later | NoSpoilers |
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
| Hourly missed-webhook visibility check | Built | NoSpoilers |
| Event acknowledgement and assignment | Planned | NoSpoilers |
| Resolution notes/evidence | Planned | NoSpoilers |
| Exposure-duration timer | Planned | NoSpoilers |
| Credential-rotation checklist | Planned | NoSpoilers |
| One-click make repository private | Planned, high permission | NoSpoilers |
| Remove/suspend bad GitHub Release asset | Planned, high permission | NoSpoilers |
| Disable unsafe release workflow | Planned, high permission | NoSpoilers |
| Automatic remediation PR | Planned | NoSpoilers |
| Multiple GitHub organizations | Planned | NoSpoilers |
| Live installation/permission test | Planned | NoSpoilers |

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
| Queue and usage health | Planned | NoSpoilers |
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

## Standalone products

| Product | Status | Why separate |
| --- | --- | --- |
| Employee Public Footprint | Separate product | Different privacy, permissions and security buyer |
| Release Ledger | Separate product | Integrity/provenance rather than accidental disclosure |
| Package Impersonation Monitor | Separate product | Registry identity and supply-chain threat category |
| Disclosure Desk | Separate product if commercialized | Research/consultancy workflow and legal obligations |

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
