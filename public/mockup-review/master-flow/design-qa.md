# NoSpoilers master flow prototype · design QA

## Comparison target

- Source visual truth: `first-proof-source.png` (copied from the user-approved First Proof image, 1487 × 1058 pixels).
- Implementation: `index.html?view=first&stage=1`, rendered in the Codex in-app browser.
- Combined comparison: `qa-compare.html`, showing the source and live implementation together in one browser view.
- Browser evidence: in-app browser tab 29 at a 1254 × 905 desktop viewport; a separate 835 × 805 responsive pass was also inspected.
- State: honest new workspace, no connected source, step 1 of 4. Prototype-only examples are explicitly labelled `Sample data · not production`.
- Density normalization: both source and implementation were fit proportionally into equal-width browser columns for the combined comparison. No density-only findings were filed.

## Findings

- No actionable P0, P1, or P2 issue remains.
- The implementation preserves the approved visual hierarchy: restrained black shell, left navigation, prominent first-release promise, four-step proof journey, direct source action, and evidence-led product language.
- The prototype intentionally replaces the source image's large sample finding card with an honest empty activation state. The sample evidence remains available only after explicitly previewing the flow.
- The initial wide scan layout allowed its help column to pressure the main grid at narrower desktop widths. The grid tracks and children were updated to shrink correctly; the responsive pass now stacks the launcher without horizontal overflow.

## Required fidelity surfaces

- Fonts and typography: Outfit is used for decisive headings and Manrope for product UI. Weight, line height, and wrapping remain legible at desktop and mobile widths.
- Spacing and layout rhythm: the established rail, topbar, content gutters, subtle borders, and dense evidence rows are retained. The four-step journey changes to a two-column and then single-column layout at smaller widths.
- Colors and visual tokens: the production red accent is used for primary actions and danger states. Green and amber remain semantic and are always accompanied by labels.
- Image and asset quality: the prototype uses the Iconify library for product icons. The only raster asset is the source image used by the internal QA comparison page; no fake product imagery or handcrafted SVGs were introduced.
- Copy and content: customer-facing states avoid invented workspace data. The prototype review rail and safe-example drawer clearly identify simulated content.

## Interaction verification

- Screen switcher and matching left-rail destinations change the active view and URL.
- All four First Proof circles select their corresponding state; `Preview the flow` advances the state machine.

## Alerts filter refinement · 5 September 2026

- The initial Alerts pass treated `Mine` as a peer of `Triage`, `Waiting`, and `Resolved`. This mixed ownership with lifecycle state and made the four controls appear structurally equivalent.
- Fix: lifecycle is now one compact status control (`Open`, `Waiting`, `Resolved`). `Assigned to me` is an independent toggle with its own count and icon, so a responder can combine ownership with any status.
- The legacy `alertTab=mine` URL is migrated in place to `alertTab=open&mine=1`; existing prototype links do not break.
- The filter bar collapses into two stacked controls on narrow screens, preserving practical tap targets and leaving the queue/detail hierarchy intact.
- Verification: JavaScript syntax, URL persistence, count updates, empty combinations, and repository diff checks pass. No P0, P1, or P2 issue remains in this refinement.
- Package, production website, and receipt modes update the launcher independently.
- Safe examples resolve to a clean or blocked First Proof state without implying they are customer data.
- Release category tabs filter findings; selecting a row updates the evidence and remediation panel.
- Query parameters preserve view, stage, scan mode, filter, and selected finding.
- Browser console checked: no errors or warnings.

## Alerts extension · 5 September 2026

- Source visual truth: the approved master-flow prototype plus the production `WatchAlertsWorkspace` information model and queue semantics.
- Implementation: `index.html?view=alerts&alertTab=open&alert=source-map`, rendered in the Codex in-app browser.
- The desktop render preserves the master-flow rail, topbar, typography, red danger accent, compact evidence cards, and quiet enterprise density.
- Sample incident data is labelled both globally and in the Alerts page heading; no simulated incident is presented as customer data.
- Queue tabs correctly expose Triage, Waiting, Mine, and Resolved counts and update URL state. Resolving an alert removes it from the Waiting queue and updates the counts.
- The selected alert includes verified evidence, owner, exposure duration, opening time, response checklist, remediation next action, activity, and resolution note.
- Assignment, acknowledgement, reopen, and resolution controls are interactive. Resolution remains disabled until the note contains at least eight characters.
- J/K and arrow-key queue navigation updates the selected alert and URL. Escape closes the assignment panel or returns from mobile detail.
- Responsive CSS switches the workspace to queue-or-detail navigation below 700px, retains touch-sized actions, and stacks evidence/ownership facts without horizontal content overflow.
- Node syntax validation and `git diff --check` pass.

## Comparison history

- Initial pass: P2 horizontal pressure in the three-card scan launcher at a narrower desktop viewport.
- Fix: changed the choice grid to `minmax(0, 1fr)`, allowed grid children to shrink, and retained the single-column mobile override.
- Post-fix evidence: the in-app browser desktop and 835-pixel responsive passes show contained cards and readable content without hidden persistent controls.

## Follow-up polish

- P3: production integration should use the app's bundled icon package rather than the CDN used by this standalone review artifact.
- P3: final API integration should replace simulated progress timing with job events and preserve each genuine scan state in the URL or server model.

final result: passed
