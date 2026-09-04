# Roadmap

What is left. What is already in the repo is [`docs/STATUS.md`](STATUS.md). Pricing and invariants stay in [`docs/PRODUCT.md`](PRODUCT.md). Every discussed row is in [`docs/expansion/FEATURE-INVENTORY.md`](expansion/FEATURE-INVENTORY.md).

There is no large unbuilt customer module sitting in the inventory. Remaining work is go-live, a few GitHub proofs, Watch chrome, and ice.

## Now — Watch chrome

Live Watch is the 2B desk. Keep the canvas near-black (`#09090b`). Meaningful open/triage counts stay coral (`#ff8a80`). Do not invent tenant data.

Shot C (glow and rim on `.watch-stage` only) is the current visual spec: `/mockup-review/2b/21-stage-linear.html?shot=c`. That is presentation, not a missing API.

## Next — human-gated launch

None of this is “implement Stripe.” The adapters exist.

1. Stripe Dashboard prices + runtime keys. Checkout stays 503 until they are set.
2. Resend keys + from address. Do not mail Disclosure Desk or invites.
3. Railway service from `railway.toml` (`npm run worker`) with the same Neon and GitHub secrets.
4. Registrar DNS for `nospoilers.dev` → Vercel. Cloudflare is optional.
5. Point the GitHub App webhook at the production origin.

Exit: a stranger can install, trial, pay, and get an email alert. `/api/health` reports `stripe: true` and `resend: true`.

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
| SSO / SAML | When a customer asks |
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
