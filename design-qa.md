# NoSpoilers release readiness detail QA

## Comparison target

- Source visual truth: `audit/release-brief-source.png`
- Browser-rendered implementation: `audit/release-brief-implementation.png`
- Clean-state browser capture: `audit/release-brief-clean.png`
- Combined full-view comparison: `audit/release-brief-comparison.png`
- Source pixels: 1487 × 1058.
- Implementation pixels: 2000 × 1125 JPEG from the Codex in-app browser.
- Comparison normalization: each capture was fit within a 1200 × 900 black canvas and joined side by side at 2400 × 900. This preserves aspect ratio; no density-based visual findings were filed.
- State: authenticated Team workspace, selected package release, failed-policy receipt, matching GitHub attestation, mismatched delivery, no governance decision.

## Findings

- No P0, P1, or P2 mismatch remains.
- The implementation preserves the source hierarchy: release identity, decisive hold/ready verdict, evidence summary, four selectable proof checks, contextual evidence, controls, and release history.
- The implementation intentionally uses the product's red danger token rather than the orange prototype accent, per the selected NoSpoilers visual direction.
- The implementation intentionally remains inside the existing Watch shell and leaves the workspace Overview unchanged.
- Optional evidence is labelled `Not recorded`, `Not attached`, or `No decision`; it is not falsely counted as clean. The clean and blocked states remain internally consistent.

## Required fidelity surfaces

- Fonts and typography: the established Watch display, body, and mono fonts are retained. The long real package coordinate is allowed to wrap rather than truncate. Small metadata maintains the existing app scale and hierarchy.
- Spacing and layout rhythm: major source regions and ordering are preserved. The production layout uses the existing Watch rail and slightly more vertical separation so controls can be included without crowding the verdict.
- Colors and visual tokens: black/inset surfaces and subtle borders match the Watch system. Red, green, warning, and muted states use existing semantic tokens and always include text labels.
- Image and asset quality: the source contains UI icons rather than raster imagery. The implementation reuses the product's installed Lucide icon system; no placeholder imagery or handcrafted SVG assets were added.
- Copy and content: prototype sample claims were replaced by receipt, digest, attestation, delivery, approval, and legal-hold values from the real release model.

## Interaction and route verification

- A selected package opened its source detail and `Open latest release brief` resolved to the matching release ID.
- A direct `/watch/releases?release=…` deep link remained on the selected release after installation selection; the previous forced redirect to `/watch` was corrected.
- Selecting `Delivery integrity` replaced the evidence panel with the real delivery mismatch and exposed the existing Verify action.
- A passing receipt rendered `Ready to release`, `Sealed`, and a matching selected history row; a failed-policy/mismatched release rendered `Hold this release` and `Blocked`.
- Receipt download, delivery attachment and verification, attestation refresh, public verification, approval, rejection, and legal-hold controls remain connected to their existing APIs and confirmation flow.

## Comparison history

- Initial rendered pass exposed a P1 deep-link failure: automatic installation selection redirected `/watch/releases?release=3` to `/watch`.
- Fix: preserve the current Watch path and authenticated query while adding the selected installation ID.
- Post-fix evidence: `audit/release-brief-implementation.png`; direct release detail and package-to-release navigation both remained on the correct release.

## Follow-up polish

- The Releases index now uses a master-detail interaction: the ledger remains visible, selecting a revision replaces the compact preview, and the full readiness brief opens only from an explicit action.
- Selected revision state is addressable with `preview=…`; opening and returning from a full brief preserves that selection.
- Before/after captures: `audit/releases-index-before.png` and `audit/releases-index-after.png`; combined review: `audit/releases-index-comparison.png`.
- The comparison exposed no P0, P1, or P2 layout issues. The new view removes the operational form from the comparison surface, adds clear blocked/ready totals, keeps semantic status labels alongside color, and makes the primary next step unambiguous.
- Follow-up caution pass removed the tall red selection and preview rails. Selection now uses a neutral inset outline; blocked state is localized to the status icon, label, and a restrained tinted verdict panel (`audit/releases-index-no-rails.png`).
- The long release heading clamp was reduced from 48px to 42px to keep real scoped package names proportional at desktop widths.

## Production product-spine integration · 5 September 2026

- Source visual truth: `public/mockup-review/master-flow/index.html?view=scan&mode=package` and `public/mockup-review/master-flow/first-proof-source.png`.
- Browser-rendered implementation: `/scan`, inspected in Codex in-app browser tab 29.
- Combined full-view comparison: `public/mockup-review/master-flow/qa-production-scan.html`; an in-app browser capture of this side-by-side view is attached to the implementation turn.
- Viewport: 1253 × 907 CSS pixels, with each comparison iframe measuring approximately 626 × 867 CSS pixels. Production was also inspected directly at 1253 × 907.
- State: signed-out package launcher, authenticated website path unavailable because the local GitHub App is intentionally not configured; receipt verification remains usable without authentication.
- Density normalization: both live frames render at the same browser density inside equal-width columns. No density-only findings were filed.

### Findings

- No actionable P0, P1, or P2 mismatch remains.
- The production Scan page preserves the prototype's three-choice hierarchy, selected red treatment, plain-language explanation, and progressive disclosure of secondary examples.
- Production intentionally uses the public site chrome rather than the authenticated prototype rail because `/scan` remains a public package and receipt utility. Authenticated website setup continues into the genuine Watch Sources workflow.
- The First Proof production screen keeps only the genuine empty-workspace state. Its four stages explain the lifecycle but do not simulate progress; real evidence transitions the customer to the live Overview.

### Required fidelity surfaces

- Fonts and typography: existing product display/body families, optical hierarchy, and responsive wrapping are preserved. Direct DOM measurements confirmed the 36px mobile/half-frame heading fits its 586px content width without horizontal overflow.
- Spacing and layout rhythm: the 3-up evidence selector becomes a single-column selector below 680px; the launcher and results split stack below 900px. Browser measurements confirmed `body.scrollWidth === body.clientWidth` at the responsive comparison width.
- Colors and visual tokens: the implementation uses the existing canvas, panel, inset, border, danger, snow, mute, and dim tokens. Red remains localized to selection and the primary action.
- Image and asset quality: there is no raster product imagery in this flow. Production uses the repository's installed Lucide icon library and introduces no handcrafted SVG or placeholder assets.
- Copy and content: the production UI says exactly what each route proves, explicitly states that categories are selected automatically, and does not insert sample workspace data.

### Interaction and console verification

- Package, production website, and receipt tabs were selected in the in-app browser; each updated the visible panel and addressable `mode` query.
- Package upload and fixture actions retain the existing `/api/scan` behavior.
- The collapsed safe-example library was opened and `Clean npm pack` completed through the real API with an `Allowed to ship` result and two inspected files.
- Website setup routes authenticated customers to `/watch/sources?configure=website` and signed-out visitors to genuine GitHub authentication.
- Receipt JSON and optional local artifact hashing retain the existing `/api/receipts/verify` behavior.
- Browser console checked after all three modes: no errors or warnings.

### Comparison history

- First comparison showed the intended visual correspondence. A focused DOM measurement was then run because the split comparison visually appeared to crop the large heading.
- Measurement confirmed no overflow: 626px body width, 626px scroll width, and a 586px heading/content width. The perceived crop was the comparison capture boundary rather than an implementation defect, so no design change was made.

### Follow-up polish

- P3: when GitHub authentication is configured locally, capture and verify the authenticated website handoff and the real First Proof empty workspace in the same browser session.

final result: passed
