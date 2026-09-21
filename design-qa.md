# Design QA — connected customer journey

## 21 September 2026 — release-candidate Overview and Alerts

- Actual signed-in local app reviewed on the preserved workspace at port 4347 after the production bundle was rebuilt.
- Overview shows the real primary review, a **Release reviews** section with two saved records, explanatory routing to Releases and **0 alerts need response**. The wording no longer implies that every release finding is an alert.
- Alerts uses the shared dark queue switcher for Open, In progress and Resolved. All three current counts are zero. The empty state explains that saved release evidence remains in Releases and missing-release coverage remains in Coverage/history, with an explicit Open Releases action.
- Browser console review returned no warnings or errors on either page. No record, response, scan, subscription or provider state was mutated.
- Native 200% zoom and audible screen-reader execution remain external acceptance items. The app compositor may clip capture edges, so this entry records inspected UI and browser state rather than a full-frame pixel certificate.

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

## 19 September — Mock 43 release-workspace implementation

Reference: `public/mockup-review/2b/43-complete-release-workspace.html`. Implemented in the product components for both uploaded and connected releases, not in another design study.

Actual signed-in upload: workspace `71a701c7-7d7a-9705-3426-4710762104d1`, upload `70fb03ba-071a-4a78-92a2-f059e3abe0ba`, on port4347. Verified all four tabs, the three real findings, manifest inspector, file-to-finding navigation, complete saved-review dialog, Proof preview/confirmation and Cancel. Dialog close returned focus to Inspect review. No live publishing or entitlement mutation. Current coverage is ended and this upload has no stream: no populated history or active scan is fabricated.

Connected actual components were exercised in the existing isolated test harness on4351, including review/incomplete state, History failure with independent controls retained, and receipt verification navigation. Fixtures are internal QA only; the customer app retains real authentication and data. Five populated History groups, comparison paths, scopes and controls are additionally covered by rendered tests.

Narrow-screen measurement earlier in this pass reported433px actual CSS viewport and433px document width, with release/Proof bounds20–413.33px; the requested390px override must not be represented as an actual390px result. Final desktop reported1440x1000 and document width1440, release bounds272–1392px. Browser compositor captures clip right/bottom regions, so full-frame pixel-perfect acceptance is not claimed. Normal viewport is restored at completion. No audible screen-reader or native200% zoom acceptance is claimed.


## 19 September — settings and Coverage refinement
Actual application changes: separated settings-route navigation from content tabs; contextual Workspace headings; removed expandable organisation wrapper/nested tabs; visible roles with compact aligned controls; Activity/Deletion review dialogs; scoped billing and recovery; one organisation at a time. Current workspace controls the default, and owner-managed billing does not show a different organisation without explicit selection.

Actual signed-in review covered organisation/activity/billing, notification/policy/team layouts and scan/alert/release navigation. Coverage websites now use full width and labelled DNS/HTTP setup. At actual433CSSpx after a390px viewport override, document width433; organisation actions end413.33px, website verification ends388.23px and long codes wrap. Wide organisation content ends1382.22px within1422px viewport. Scope controls, no-hover fills and existing scan/release actions are retained. Normal viewport reset. Existing compositor clipping limits full-frame screenshot comparison. No live scan, purchase, permission or lifecycle mutation. This is not whole-product WCAG or hosted-operational acceptance.


## 19 September — tablet/mobile sidebar correction
The mobile navigation Dialog is portalled outside .watch-desk and was missing the desktop rail rules. Shared the rail/theme/workspace-switcher rules with its explicit watch-navigation-dialog scope. The logo now has a dedicated brand row and stable140x38 sizing with top/side spacing; the old generic header-div selector no longer offsets the workspace picker. Added44px close control, touch targets, safe-area padding, min-height0 navigation scrolling and nonshrinking account/billing/help footer. Help navigation closes the drawer. Resizing into the desktop breakpoint closes the hidden dialog so it cannot retain modal focus. Neutral icons and no row hover-fill remain.

Final TypeScript/Vite build passed (WatchWorkspace-LPbG3xWm.js; existing chunk advisory). Eleven tests across artifact-shell-navigation and journey-settings-shell passed in2.07s, covering explicit close, Help close and desktop resize dismissal. Scoped lint0errors/two existing static-component warnings; diff check passed. Actual browser checked tablet853x1000 and phone433x666 CSS viewport (host zoom maps requested768x900/390x600): logo x19.98/y15,width140,height38; mobile rail width320, footer within viewport, phone nav scrollHeight383 inside306.79px. Account menu exposes sign out without mutation; Escape returns, desktop resize removes dialog, collapsed desktop rail remains60px. Original expanded state and normal viewport restored. Existing screenshot compositor clipping remains. No full-suite repeat or deployment for this bounded sidebar change.


## 20 September — real local scan and settings acceptance
Rebuilt actual app on4347: upload→worker→blocked result, corrected upload→passed result, receipt download→authentic verification, mismatched archive→explicit rejection. Recorded releases remain after graceful restart. Upload a new attempt opens Package or build with the same workspace. Four scan selection cards and release43 composition remain.

Reviewed Retention, Audit, Scan API tokens, billing and mobile navigation. Billing explicitly shows active trial and unavailable payment-provider state, rather than a false payment success. At actual433CSSpx (requested390, host zoom), billing document width433 and measured controls did not overflow. Logo140x38 atapproximately20,15; neutral sidebar icons and quiet rows retained. Final browser warnings/errors empty. Normal viewport restored. Compositor clips capture right/bottom; whole-frame pixel-perfect and audible AT/native200% zoom are not claimed. Hosted provider paths remain separate acceptance work.
