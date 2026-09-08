# Website content evidence map

Internal implementation record, not a public customer guide. Baseline: `eb46118030643a8f27847302784867df4e84c6da` from `codex/v20-homepage-auth-mock3`. No historical plan is treated as proof that a feature operates on a deployed host.

## Contracts read

`WEB-APP-ARCHITECTURE.md`, `PRODUCT-DIRECTION.md`, `ENTERPRISE-READINESS-PLAN.md`, `MOCKUP-PRODUCTION-CONTRACT.md`, `DATA-LIFECYCLE-POLICY.md`, the current `GATE-B-COMPLETION-AUDIT.md`, and the relevant Gate B website, alert, credential, exception, identity and implementation records informed the boundaries. The current audit, rather than earlier checkpoint paragraphs, supplies remaining acceptance status. This task does not edit or close Gate B.

## Customer documentation grounded in code

| Guide | Inspected implementation / reference | Important limitation retained |
| --- | --- | --- |
| Your first scan | `src/pages/ScanPage.tsx`, `src/server/upload-store.ts`, `src/server/upload-worker.ts`; acquisition contract | Anonymous staging is not anonymous scanning or a permanent free report. |
| Workspaces and roles | `src/server/workspace-membership.ts`, `src/server/workspaces.ts` | Existing-account invitations; source authority and organisation billing are separate. |
| Supported inputs | `src/scanner/types.ts`, `src/scanner/index.ts`, `src/scanner/formats.ts`, ScanPage fixture families | Default 80 MiB input, 500 MiB expanded, 25,000 files, 25 MiB/file, 90 s; runtime/ingress can be stricter. |
| GitHub | `src/components/watch/GithubWorkspaceConnection.tsx`, connection coordinator / current audit | Same-session verified binding, signed webhook coordination; live provider readiness unproven here. |
| Artefact scanning | `src/pages/ScanPage.tsx`, `src/cli.ts`, upload workflow | Upload transfer, queue completion and scan verdict are separate. |
| Website scanning | `src/server/domain-verification.ts`, `src/components/watch/WorkspaceWebsites.tsx` | Exact current DNS/HTTPS challenge, same-origin bounded inspection, explicit schedules. |
| Coverage and Releases | `src/server/source-monitoring.ts`, `src/watch/view-models.ts`, WorkspaceWebsites | Cadence is intent; unknown dispatch is not a guaranteed next execution. |
| Release findings | `src/scanner/types.ts`, `src/components/watch/UploadedReleaseBrief.tsx`, current audit | `done` job status is not `passed`; missing historical full evidence stays unavailable. |
| Alerts | `src/components/watch/WorkspaceAlerts.tsx`, workspace alert implementation / current audit | Stable assignee; response history is not remediation or edited scan evidence. |
| Policies and exceptions | `src/server/workspace-exceptions.ts`, workspace/hosted policy snapshots | Exact saved-finding scope, live approval authority, expiry; no retroactive report edits. |
| Proof | `src/receipt.ts`, `src/server/upload-proof-sharing.ts`, public proof implementation | HMAC signature verification, redacted summaries and new scans are different operations. |
| Tokens and CI | `src/server/workspace-tokens.ts`, `src/cli.ts`, `action.yml` | One-time secrets, binary bearer admission, UUID idempotency, 202 and status polling; approved distribution must be confirmed. |
| Notifications | `src/components/watch/WorkspaceNotifications.tsx`, outbox/transport implementation records | Saved is not tested; provider acceptance is not reading; connected settings remain separate. |
| Retention and deletion | `DATA-LIFECYCLE-POLICY.md`, `src/server/deletion-requests.ts` | Owner-authorised review request, not purge, closure or universal erasure. |
| Troubleshooting | Above implementation and current completion audit | No unsupported access bypass, fictitious service health or promised enterprise identity. |

## Commercial and contact evidence

`src/pages/PricingPage.tsx` supplies the existing USD 29/99 monthly and USD 290/990 yearly prices and the existing checkout request. Its state/effect/checkout/open-app handlers remain unchanged in this task; only public presentation changes. `src/legal.ts` supplies the existing `emotiveimpact@gmail.com` contact. The website content constant deliberately matches that existing address; an owner-approved contact change must update both.

Provider configuration, final checkout terms/tax, operational enterprise features, published workspace/seat packaging, certifications, SLA/RTO/RPO, DPA/subprocessors and hosting-region commitments are not established by these files. Public copy excludes unsupported commitments and internal buyer documents remain review drafts.

## Design references and inspection limits

The approved homepage and `public/mockup-review/homepage-d/index.html` supplied the restrained dark/red typography, spacing and visual direction. They remain unchanged. Linear's documentation home, start guide and GitHub article were inspected through public page content for grouped navigation, article hierarchy, quick starts and reading structure. Browser network policy prevented viewport-specific desktop/mobile inspection of those external pages; no visual inspection is claimed from text extraction. No Linear assets, branding or text were reused.
