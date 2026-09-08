# Security questionnaire answers

**Internal review draft. Answers describe repository evidence, not a signed attestation.**

Baseline: `eb46118030643a8f27847302784867df4e84c6da`. Complete operational review and legal approval before sharing externally. “Not evidenced” must not be replaced with an unqualified “yes”.

| Question | Draft answer | Evidence / follow-up |
| --- | --- | --- |
| What does the service inspect? | Supported packed releases and bounded public website assets after required ownership checks. It is not a complete security assessment. | `src/scanner/index.ts`, `src/scanner/formats.ts`, `src/server/web-origin.ts`. Confirm the exact pilot formats. |
| Does it execute submitted software? | Archive inspection does not install packages or execute their application/lifecycle entry points. This statement is not proof of completed production parser isolation. | Scanner implementation; separate worker/isolation readiness review. |
| What happens to submitted bytes? | Staging and worker cleanup paths exist. Retained reports contain metadata and evidence needed to investigate results. Do not promise immediate universal deletion across backups and third parties. | `src/server/upload-store.ts`, `src/server/upload-worker.ts`, [lifecycle policy](../DATA-LIFECYCLE-POLICY.md). Verify deployed cleanup/recovery. |
| Are credentials protected? | Integration credential encryption and hashed scan tokens are implemented. Token creation reveals plaintext once; list endpoints return metadata. | `src/server/secret-box.ts`, `src/server/workspace-tokens.ts`. Confirm deployed secret management, rotation and backup controls. |
| How is tenant access enforced? | Workspace membership and server-side resource scope govern product access. GitHub source authority and organisation billing authority remain separate. | `src/server/workspace-source-access.ts`, `src/server/workspace-membership.ts`. Complete mixed-source and concurrency acceptance. |
| Is SSO/SCIM available? | Not an operational feature represented by this release. Auth provider/enterprise identity selection remains separate work. | [Identity design](../IDENTITY-WORKSPACES.md), readiness plan. |
| Is independent approval supported? | Saved-finding exception requests can require a different administrator, based on request-time and current policy. | `src/server/workspace-exceptions.ts`. Verify the customer's scoped journey before promising its operation. |
| Can evidence be edited after a response? | Saved reports/receipts and append-only histories have protected paths. A human response or exception decision must not rewrite the original result. | Workspace exception/alert guards and associated tests; verify retained history and migration acceptance. |
| Can anyone verify a signature independently? | The current receipt model is HMAC-SHA256. Public summaries are not public-key certificate verification. A valid signature also does not establish a passing scan. | `src/receipt.ts`, `src/server/upload-proof-sharing.ts`. Do not claim asymmetric/KMS/Sigstore readiness. |
| What does revocation do? | A revoked shared link becomes unavailable. It cannot retract already downloaded copies. | Proof-sharing implementation and customer proof documentation. |
| Where is data hosted? | The code supports configured hosting/database choices. This draft does not establish a contracted processing region or residency guarantee. | Owner must confirm actual deployment, subprocessors and contract. |
| Are SOC 2, ISO 27001 or independent test reports available? | No such certification or attestation is established by the inspected repository. Request documentary evidence before answering affirmatively. | Owner/security review. Do not invent certification badges. |
| What are the SLA, RTO and RPO? | No contractual values are approved by this draft. Agree and validate these operational targets separately. | Restore drill, incident process, monitoring and contract review required. |
| Are notification messages guaranteed? | Configuration, queued tests, provider acceptance and recipient reading are distinct. Retry/crash semantics do not justify exactly-once delivery claims. | Workspace notification outbox/worker; provider-specific acceptance exercise. |
| Does an account closure request erase shared history? | No. The current flow records an owner-authorised deletion review request, not an executed purge or personal closure. | [Lifecycle policy](../DATA-LIFECYCLE-POLICY.md), `src/server/deletion-requests.ts`. Legal-hold/backup-aware execution remains separate. |

## Review sign-off still required

Product owner: reconcile with completed Gate B. Operations: verify hosting, secrets, worker controls, monitoring, restoration and incident handling. Legal: approve terms, privacy, DPA, subprocessors and retention obligations. Do not convert this draft into a public trust certificate.
