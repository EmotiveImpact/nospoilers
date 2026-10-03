# Watch typography

Watch's chosen interface family remains Inter. It previously named Inter without loading it,
so appearance could depend on the customer's installed fonts. Inter 4.1 is now served with the
app as content-hashed WOFF2 assets, including upright and italic variable weights 100–900.
`font-display: swap` keeps text visible while downloading.

`src/ui-fonts.css` defines the private CSS family alias `NoSpoilers UI` and the shared `--font-ui`
stack. Watch headings, text, forms, mobile navigation, account/repository menus and shared dropdown
surfaces use it. The alias avoids changing marketing selectors which name Inter; marketing's
existing Manrope/Outfit and system-fallback choices remain separate. Evidence paths, hashes and
code retain their existing monospace styles. No font preference or additional customer setting
is introduced.

The unmodified official Inter release files and SHA-256 provenance are documented in
`src/assets/fonts/README.md`. Copyright and SIL Open Font License 1.1 are shipped at
`/assets/fonts/OFL-Inter.txt` from `public/assets/fonts/OFL-Inter.txt`. No third-party font package
or external font request is added for Watch.

## Cal Sans comparison

Cal Sans Text UI is an optional design candidate, not the selected production font. Its verified,
licensed asset lives under the prototype gallery in `public/mockup-review/fonts`; that gallery
is excluded from production builds. The original font and licence remain unmodified.

A local comparison at `http://127.0.0.1:4351/` provides Inter/Cal Sans, side-by-side and phone
views for Alerts, Coverage and Team settings. It uses redacted layout snapshots with app actions
inactive, no customer API access and names, scope identifiers, dates and counts removed. Coverage
retains the access notice; it does not bypass entitlements. The temporary server and redacted
layouts are under `/tmp/nospoilers-font-study`, outside the repository. Original authenticated
snapshots were deleted after automatic approval review rejected serving private customer content.
The comparison is a typography specimen, not a synthetic customer workspace or functional journey.

The current design decision is to keep Inter as the app default while the owner evaluates Cal Sans.
Native browser/deployment evidence is in the latest release-assurance build log.
