# Homepage D production verification — 8 September 2026

This report supersedes the earlier premature pass. That implementation added sections to the old V20 body and did not reproduce the approved homepage.

## Reference and evidence

- Source: `public/mockup-review/homepage-d/index.html`.
- Implementation: `/` via `HomepageD.tsx`, bundled presentation markup and scoped styles.
- Desktop images: `output/playwright/homepage-d/homepage-d-reference.png` and `output/playwright/homepage-d/homepage-d-desktop.png`.
- Focused release boundary: `output/playwright/homepage-d/homepage-d-boundary.png`.
- Mobile images: `output/playwright/homepage-d/homepage-d-mobile.png` and `output/playwright/homepage-d/homepage-d-mobile-menu.png`.
- Desktop comparison: both 1440 × 900 CSS pixels, initial state, screenshot scale CSS; viewed together. Mobile: 390 × 844 CSS pixels.

## Findings and corrections

- P1 corrected: old hero, typography, dashboard and approximate illustrations replaced with the actual approved presentation and proportions.
- P2 corrected: horizontal overflow container replaced with clipping so the header can remain sticky.
- P2 corrected: mock scan dialog replaced with real authenticated/public scan routes. Previews remain explicitly labelled as examples.
- Expected difference: production navigation replaces the review bar and mock navigation, moving the body upward. Pricing presents the reference monthly cards; the navigation links to the full pricing page.

## Fidelity surfaces

- Typography: reference Inter/Arial stack, sizes, weights, tracking and heading wraps retained.
- Spacing: reference 1280px content width, split hero, dashboard and section grids retained.
- Colours: near-black surface, red accent, findings glow and original card treatments retained.
- Assets: supplied artwork, company logos, icons and ship-confidence image retained.
- Copy: reference content retained; proposed/illustrative trial wording corrected. Example checks do not run real scans.

## Verification

- Build, typecheck and four focused tests passed.
- Browser: desktop Product menu opens with real destinations; GitHub example updates its evidence; FAQ expands.
- Browser at 390px: page width equals viewport width; no overflowing main sections.
- Mobile menu opens, locks body scrolling, scrolls independently, closes and restores body scrolling.
- Primary CTA navigated successfully to the authenticated workspace scan screen.
- Production console: no errors; React developer-tools information only.
- In-app captures had inconsistent viewport sizing. Evidence above was captured using the available Playwright browser tools.

final result: passed
