# Roadmap

What is left. What is already in the repo is [`docs/STATUS.md`](STATUS.md). Pricing and invariants stay in [`docs/PRODUCT.md`](PRODUCT.md). Every discussed row is in [`docs/expansion/FEATURE-INVENTORY.md`](expansion/FEATURE-INVENTORY.md).

There is no large unbuilt customer module sitting in the inventory. Remaining work is provider
activation and hosted acceptance, not another redesign.

## Now — activate ordinary customer login

1. Verify the owner email for the fresh Neon Marketplace account.
2. Enable Neon Managed Better Auth and record its Auth base URL.
3. Configure production and local trusted domains/callbacks.
4. Pin and mount the Neon server adapter behind the NoSpoilers origin.
5. Add and prove sign-up, sign-in, sign-out, recovery and session handling.
6. Preserve GitHub as a separate workspace connector; never merge users by email.

The database and authorization foundation for this is complete. See
[AUTH-ENTERPRISE-AND-WORKERS.md](AUTH-ENTERPRISE-AND-WORKERS.md).

## Next — prove the hosted customer loop

1. New customer creates a product account.
2. Customer creates or selects a workspace.
3. Customer authorises the correct GitHub account and installation for that workspace.
4. A release scan queues on the shared Neon database.
5. Railway dispatches it into a fresh Vercel Sandbox.
6. The signed result, findings and evidence appear in Releases without cross-tenant leakage.

## Then — close launch acceptance

- Live hostile-input, denied-egress, timeout and interruption-cleanup tests for the sandbox.
- One real, private notification delivery and retry/failure check.
- GitHub Actions CI after the account payment/spending-limit block is resolved.
- Native 200% zoom and audible screen-reader checks.
- Stripe sandbox prices, keys, webhooks and entitlement lifecycle when the owner resumes billing.

## Then — optional proofs

Do these only when a human can click GitHub. Do not invent repositories.

- Collaborator / fork on a disposable repo with a second account.
- Transfer only on a disposable repo. Never the product repository.
- An npm package this GitHub login owns, for a live Package Identity protect.
- Optional Checks write on the throwaway install. Do not grant Administration. Do not request Workflows write.
- Leave https://github.com/EmotiveImpact/nospoilers-throwaway/pull/1 open.

## Later — on ice

Build only after paying demand or an explicit ask.

| Item | Note |
| --- | --- |
| Isolated Electron worker | DMG/EXE/MSI/AppImage. Normal worker already skips. [`docs/ELECTRON.md`](ELECTRON.md) |
| SBOM attach | CycloneDX / SPDX |
| Sigstore / SLSA verify | Adapters already store presence |
| Scheduled CDN verify | On-demand verify is built |
| WorkOS SSO / SCIM | Provider-neutral foundation is ready; add only after an explicit enterprise requirement or priority |
| Native Vercel / Netlify / Cloudflare OAuth | Generic `/api/v1/deploy` is built |
| GitHub Marketplace listing | After ~100 installs; Stripe remains checkout |
| Aggregate Artifact Leads research | After review |
| Employee Public Footprint | Separate repository. Not this app |

## Never

- Automatic malware verdict or takedown
- Automated outreach or public naming
- Scan-credit pricing
- Public Enterprise tile before a real request
- CLI DRM as the business
- Storing customer source or credential values
- Granting the GitHub App Administration
