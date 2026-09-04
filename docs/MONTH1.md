# Month 1 — where customers actually come from

Estimates for the first 30 days after a **working** public launch (Stripe, install, first scan, unpaid-install kill all live). Not TAM. Not a promise. Launch leftovers: [`docs/STATUS.md`](STATUS.md).

**Likely: 4–8 paying customers.** Low 0–2. Lucky 15–25 (front-page HN or a real incident with our name on it). 50+ is not a month-1 number without existing distribution.

Mix: mostly Solo ($29). One Team ($99) is a good month. CISOs at 200-person companies do not pay in 30 days.

## Funnel (likely)

~1,000–1,800 visitors → 30–50 GitHub App installs → 25–40 activated trials → **4–8 paid** if the trial requires a card. No card on file: cut paid roughly in half (2–4) even if trials go up.

GitGlow (free, visibility-only) publicly shows around **138 account-level installations**. One
installation can cover an organization and many repositories/users, so this is demand evidence—not
a customer-count ceiling or TAM estimate. Snyk/GitGuardian validate broad security demand but are
not direct product/price comparables.

## Where the 4–8 come from

| Rank | Channel | Paid in 30 days | Notes |
| --- | --- | --- | --- |
| 1 | Private disclosure after you find a real map/.env in *their* pack | **1–3** | Best channel. Do not lead with a buy link. |
| 2 | Warm / “will you install this on a throwaway org” | **0–2** | Ask for an install, not a retweet. |
| 3 | One HN post with original unpack data | **0–2** | Unreliable. One shot. |
| 4 | r/node, r/electronjs, Node/Electron Discord | **0–1** | Findings, not launch copy. |
| 5 | X / Product Hunt / SEO / Marketplace | **usually 0** | GitHub requires ~100 installs for Marketplace-paid plans; Stripe on our site can charge customer one. |

SEO does not matter in month 1 on a new domain. Paid Marketplace discovery is not a month-1 engine.

## First buyers

Solo founders shipping a proprietary npm CLI or Electron app. Release engineer at 10–50 people after a near-miss. Not open-source maintainers who ship maps on purpose.

## Waste

Generic secret-scanning pitch (GitHub already sells Secret Protection). Mass-emailing npm. Public shaming before remediation. Enterprise outbound. Ten AI blog posts. Launch tweet with no evidence.

## Operating target

**40 activated trials, six paying, at least one Team.** If you get 20+ trials and zero paid, it is activation or willingness-to-pay. If you get fewer than 10 trials, it is distribution.
