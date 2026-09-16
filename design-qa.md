# Design QA — connected customer journey

> Correction, 16 September: the earlier review below did not establish faithful implementation of the approved journey. The owner rejected its Overview/Releases differences. Preserve these captures as historical evidence only; the current composition corrections and limits are recorded in BUILD-LOG. Do not treat the earlier “matches” wording as acceptance.

Date: 2026-09-16

## Reference and implementation captures

- Reference Overview: `public/mockup-review/2b/36-journey/screens/overview.png`
- Implemented Overview: `output/design-qa/overview-live.png`
- Reference Alerts: `public/mockup-review/2b/36-journey/screens/alerts.png`
- Implemented Alerts: `output/design-qa/alerts-live.png`
- Implemented Scan: `output/design-qa/scan-live.png`
- Implemented responsive Overview: `output/design-qa/overview-mobile-live.png`

The implementation captures are local QA artifacts and are intentionally kept out of the product bundle.

## Viewports and scope

- Desktop: the signed-in Codex in-app browser reported a 1422 × 800 CSS viewport.
- Responsive: a 390 × 844 override was requested; the in-app browser reported a 433 × 800 minimum CSS viewport.
- Real local app: `http://127.0.0.1:4347`, workspace `ccd3c6b7-1349-4b3b-1bfb-95298f23cd7e`, installation `160267630`.
- Full-view checks: Overview, Alerts, Scan, Timeline, Notifications, Policy, and the saved release detail.
- Region checks: release decision hero, evidence totals, recent release list, alert queues/detail, scan type tabs and repository picker, settings tabs, Timeline filters/feed, and the three visible remediation steps.

## Comparison

- Shell geometry matches the approved direction: 224px desktop rail, 64px top bar, dark stage, fine dividers, restrained corners, Inter typography, and quiet selected states.
- Overview preserves the reference hierarchy while rendering real saved scans, real connected-source counts, and honest alert/monitoring language. The main decision surface uses the approved restrained red glow.
- Alerts use the reference split inbox/detail composition. Queue rows now show the repository and human-readable outcome; the technical check identifier remains in the detail only.
- Scan keeps one evidence-type choice at the top, one primary form, and visible secondary GitHub/result actions. The prior hidden connection block is gone.
- Notifications and Policy use underline tabs and visible explanatory sections rather than nesting primary guidance in disclosures.
- Timeline uses the same quiet list hierarchy and semantic filters; future-dated rows are excluded from retained evidence.
- The saved release detail keeps existing evidence contracts and exposes Original finding, Reviewed change, and Rebuilt evidence as one visible workflow.

## Interaction and accessibility checks

- Alert queue selection opens the exact alert; mobile returns to the inbox with an explicit control.
- Timeline tabs support click, Arrow Left/Right, Home, and End, with tab-to-panel relationships.
- Notification tabs expose semantic tablist/tab behavior and keyboard navigation.
- Scan and settings controls retain their existing labels, roles, disabled states, and scoped navigation.
- Desktop and responsive document widths matched the reported viewport; no document-level horizontal overflow was present.
- Browser console: no errors or warnings on the final Overview check.

## Intentional differences and limits

- The reference contains illustrative records. Production UI renders only real signed-in workspace data.
- Exact record counts and titles therefore differ from the reference.
- The optional GitHub-install top-bar action is deferred to the 2xl breakpoint so ordinary desktop widths keep search, scan, guidance, and account controls readable.
- Native 200% zoom and audible screen-reader execution remain external manual acceptance items.
- Railway worker connection, deployment, and provider-backed production verification are outside this visual implementation pass.

## Result

Passed for this implementation milestone. The approved journey structure is present in the real signed-in app, primary flows remain functional, responsive layouts avoid document overflow, and no browser errors were observed in the final check.

---

# Retained homepage D production verification — 8 September 2026

This report superseded the earlier premature homepage pass. That implementation added sections to the old V20 body and did not reproduce the approved homepage.

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

Final result: passed.
