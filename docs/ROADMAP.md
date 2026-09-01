# NoSpoilers roadmap

Source of truth for *why* and pricing: [PRODUCT.md](PRODUCT.md). This file is the sequence.

## Phase A — hosted loop (current)

Prove on a throwaway GitHub repo, in this environment, without buying a domain, Fly, Railway, Resend, or Stripe.

- [x] Scanner kernel, CLI, Action, local pack drop-zone
- [x] Hosted GitHub App loop in-repo (sign-in, install, webhook → Postgres queue → worker)
- [x] Event-driven queue pickup (wake on enqueue; 15-minute recovery; hourly visibility poller)
- [x] Neon project **NoSpoilers**, branch **production**, database **neondb** (Neon Auth off)
- [ ] Real GitHub App registered (human click; see README) and env secrets pasted
- [ ] Throwaway-repo proof: private → public alert on `/watch`, then a release pack scan

Out of scope here: Stripe, Slack, make-private, Marketplace, npm publish, GCP, Electron/DMG worker.

## Phase B — go live

Only after the throwaway-repo proof.

- Domain `nospoilers.dev`, Fly (or Railway), Neon (already), Resend, Stripe
- 14-day trial, Solo $29, Team $99; kill unpaid hosted installs
- Production GitHub App webhook URL on the real domain

## Phase C — later

Slack, make-private from alert, Marketplace listing, CLI license bump, isolated `.dmg`/`.exe`/`.AppImage` worker. See [ELECTRON.md](ELECTRON.md).
