# Watch design language

Owner direction, 3 October 2026: carry the typography comparison's compact, quiet interface through
the actual app, using the successful existing Overview, Alerts, Coverage, Releases, Scan, Timeline
and Settings compositions. Cal Sans Text UI is the selected app family. This is the shared design
contract for implementation; it does not change product evidence, roles, prices or provider status.

## Source and boundaries

- `src/ui-fonts.css` loads the original licensed Cal Sans Text UI WOFF2 under the private
  `NoSpoilers UI` alias and exposes `--font-ui`.
- `src/components/watch/design/app-system.css` owns the shared visual tokens and type/control rules.
- Page styles own their composition and consume the tokens; avoid repeating competing title or
  control definitions with different values.
- `.watch-desk`, `.watch-rail` and `.watch-design-surface` establish the app scope. Every Watch-owned
  portalled dialog needs its own `.watch-design-surface` because it cannot inherit from its opener.
- `src/components/motion/dropdown.css` supplies the shared picker treatment. AppSelect, repository
  and account/workspace menus retain their accessible interaction primitives.
- Public marketing and standalone `/scan` keep their existing identity. Embedded `/watch/scan`
  belongs to Watch. Do not turn the whole document into an app surface to repair a portal.
- Evidence paths, digests, code, typed confirmation values and copyable AI briefs retain monospace.
  Shared form rules must not override an explicit `.font-mono` field.

## Palette and hierarchy

| Role | Value | Use |
| --- | --- | --- |
| Canvas | Existing near-black Watch canvas | Page and navigation background |
| Panel | `#121416` | Group related controls or evidence |
| Inset | `#0c0d0f` | Nested inputs or code context |
| Quiet separator | `#ffffff10` | Sections and rows |
| Strong separator | `#ffffff20` | Focused boundaries and popups |
| Primary text | Existing off-white `--color-snow` | Titles, content and controls |
| Supporting text | Existing `--color-mute`; dim `#898c96` | Explanations and metadata |
| Status | Existing danger/warning/passed tokens | Localized evidence or action state, with a text label |

Preserve the existing black/off-white/red identity. Colour describes status and action; it must not
imply safety or supply the only distinction. Sidebar links and broad cards stay quiet on hover.
Use a local button, text or border response rather than filling an entire section background.
Selected evidence rows and tabs retain an explicit selected state and keyboard focus.

## Type and geometry

| Role | Shared value |
| --- | --- |
| App family | Cal Sans Text UI, local WOFF2; system fallback for unsupported glyphs |
| Page title | `--watch-page-title-size`: 34px desktop, 28px at 640px and below; 550 weight, 1.2 line height |
| Section title | `--watch-section-title-size`: 16px; primary Scan headings may use 20px |
| Reading text | `--watch-body-size`: 13px; introductions may use 14px; `--watch-body-line`: 1.6 |
| Supporting metadata | 11–12px, with legible contrast; evidence code retains monospace |
| Reading width | About 68 characters; page introductions at most 680px |
| Standard control | `--watch-control-height`: 40px |
| Compact action/pagination control | `--watch-compact-control-height`: 32px; sufficient internal space for its label |
| Control radius | `--watch-control-radius`: 6px |
| Panel radius | `--watch-panel-radius`: 8px |
| Popup radius | `--watch-dialog-radius`: 10px where the shared popup composition owns it |
| Compact row radius | `--watch-row-radius`: 4px |
| Spacing steps | `--watch-space-1` through 7: 4, 8, 12, 16, 20, 24, 32px |

Use the scale to connect related text, fields and actions. Keep deliberate separation between
unrelated sections. Do not shrink evidence tables, task queues or explanatory text just to use
one value everywhere. Mobile page gutters follow the shell tokens; heading starts and field edges
should line up when moving between routes. Standard fields and adjacent submit actions align;
role help and validation belong below the field row, with an accessible association.

## Component contracts

- **Page header:** one title, a short scope/intent explanation and contextual actions. Do not repeat
  the explanation in several strips. Small mobile actions may share a row; wrap gracefully when
  long labels need it.
- **Tabs and filters:** use the existing dark segmented control or quiet underline according to
  hierarchy. Lifecycle tabs and ownership filters remain independent; selection is not just colour.
- **Buttons:** one dominant next action when available, quiet secondary actions, clear disabled
  reasons. Standard/compact sizes describe intent; icon and sidebar navigation targets keep their
  existing accessible geography.
- **Dropdowns:** shared dark surface, visible current choice, searchable long inventories, keyboard
  navigation, focus recovery and readable option labels. Nested dialog and picker focus remains trapped
  correctly. Compact menus must leave room for their selection indicator.
- **Panels and evidence:** group by task/scope rather than boxing every sentence. Preserve original
  records, truthful unknown/incomplete/expired states and the separate Findings/Files/History/Proof lanes.
- **Dialogs:** same family and controls as the opener, named heading, bounded width, mobile reflow,
  scrollable content, close/Escape and focus return. Private fields are cleared by their existing
  lifecycle; visual consistency must never change that lifecycle.
- **Lists:** existing 10/30/60 paging, search/filter-before-paging and explicit retained-window limits.
  Empty/error responses do not leave stale actions visible.
- **States:** loading has the existing quiet accessible status; confirmed empty states explain the
  next useful action; retry/error, insufficient role, expired coverage and stale evidence remain distinct.
  An alert response never becomes proof of a technical fix.
- **Motion:** retain the short stationary search fade, reduced-motion behavior and restrained control
  feedback. Owner direction, 5 October 2026, adds one brand motion and nothing else, as vanilla
  canvas code in `src/components/motion`: while Watch stages load, particles draw a lighthouse whose
  beam sweeps; when ready, each particle arcs out through a loose swarm and settles into the
  NoSpoilers mark in its own colours, then the overlay fades. It carries no product state, pauses
  when the tab is hidden and shows static frames under reduced motion. No particle flights,
  zooming panels or other decorative entrance motion.

## Verification and limits

Existing real component/state tests cover the functional contracts; new portal regressions protect
embedded/public separation, expired admission, close/reopen/Escape focus and retained metadata code.
The current release-assurance BUILD-LOG records exact cumulative checks, desktop/mobile screenshots,
production font hashes and browser findings for this increment.

The typography comparison at `http://127.0.0.1:4351/` uses redacted actual layouts and inactive actions. It is
useful for visual comparison, not a customer workspace, scan or provider acceptance. Native browser
checks on the real app remain separate from rendered tests and static specimens. Populated source
or release states blocked by the owner's expired coverage are reported as test-backed rather than
claimed live accepted. Native 200% zoom and audible screen-reader acceptance remain explicit until run.

Use this document, `UI-TYPOGRAPHY.md`, current `STATUS.md` and the latest BUILD-LOG when continuing;
do not infer whole-product or public-production readiness from this design increment.
