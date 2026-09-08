# Website and product shell review

Reviewed: 5 September 2026
Viewport: desktop local review at `127.0.0.1:4347`

## Journey health

1. **Public discovery — healthy.** Public routes use the V20 website navigation, footer, and restrained red ambient gradient.
2. **Scan intake — healthy at the shell level.** `/scan` remains the anonymous acquisition doorway; signed-in visitors are redirected into the product.
3. **Authenticated New Scan — healthy.** `/watch/scan` renders inside the Watch shell and offers GitHub repository, package/build, production website, and proof verification.
4. **Post-login claim — structurally fixed, external verification pending.** A pending scan now returns to `/watch/scan?reveal=1`; live OAuth still requires the GitHub App environment configuration.
5. **Destination workflows — partial.** Package and website submission APIs exist; GitHub installation and proof verification still depend on their external services and must be exercised on a configured preview deployment.

## What is working visually

- The product keeps the mockup's soft enterprise character: black surfaces, off-white hierarchy, thin borders, and a restrained centre-weighted spotlight.
- Red is localized to selection and primary action instead of becoming a decorative warning rail.
- New Scan is clearly an action in the top bar while Coverage remains the persistent monitored inventory.
- The website and product now feel related without pretending they are the same interface.

## Risks and next checks

- The four scan-type cards overflow horizontally at narrower desktop widths; responsive behavior should switch cleanly to two columns and then one.
- The current empty Overview still contains dense instructional copy. Once real evidence exists, it must switch completely to the live Overview instead of mixing onboarding and operational data.
- Keyboard focus, selected-tab semantics, error announcements, reduced motion, and colour contrast need a dedicated accessibility pass after the destination workflows are wired.
- Visual review used the local seeded session. It does not prove live GitHub OAuth, billing, worker execution, or production cross-subdomain cookies.

## Evidence

- `01-product-scan.png` — authenticated New Scan in the Watch shell.
- `02-product-overview.png` — centred spotlight on the main product stage.
- `03-public-pricing.png` — V20 website shell applied beyond the homepage.
