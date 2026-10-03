# Watch typography

Owner-selected direction, 3 October 2026: **Cal Sans Text UI** is the Watch interface family.
The approved comparison's rounded, compact type now applies to headings, text, forms, mobile
navigation and app-owned menus/dialogs. `UI-DESIGN-LANGUAGE.md` defines its shared geometry and roles.

`src/ui-fonts.css` defines the private `NoSpoilers UI` alias and `--font-ui` stack. The original
154,200-byte variable WOFF2 is self-hosted as a content-hashed build asset. The verified wght axis
supports 400–700; italic uses the same file's ital axis. Default GEOM 25, YTAS 1520 and SHRP 0 match the
comparison. `font-display:swap` keeps text visible while downloading. No external font service or
customer font preference is introduced.

The alias keeps marketing's existing Manrope/Outfit choices separate. Standalone public `/scan`
retains that boundary; embedded `/watch/scan` and its own portal receive Watch scope. Evidence paths,
hashes, code and the AI fix brief retain their monospace type. Portal roots own
`.watch-design-surface`; inheriting the body alone would use the marketing family.

Official pinned source, SHA-256, axes and copyright are documented in `src/assets/fonts/README.md`.
The unmodified font's original SIL Open Font License 1.1 ships at `/assets/fonts/OFL-CalSans.txt`.
The earlier Inter 4.1 assets/provenance remain available for comparison; the app no longer imports them.

## Redacted comparison

The temporary comparison at `http://127.0.0.1:4351/` provides Inter/Cal Sans, side-by-side and phone
views for Alerts, Coverage and Team settings. It uses redacted actual layout snapshots with app actions
inactive, no customer API access and names, scope identifiers, dates and counts removed. Coverage
retains the access notice; it does not bypass entitlements. The server and redacted layouts live under
`/tmp/nospoilers-font-study`, outside the repository. Original authenticated snapshots were deleted
after automatic approval review rejected serving private customer content.

The prototype gallery's licensed font copy remains local and excluded from production. The app
imports its independently placed original font under `src/assets/fonts`. The comparison is a type
specimen, not a synthetic customer workspace or functional journey.

Actual source checks, deployment and native browser evidence are recorded in the latest BUILD-LOG.
