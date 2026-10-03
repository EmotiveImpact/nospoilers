# Watch UI fonts

Cal Sans Text UI is the selected Watch family. The unmodified variable WOFF2 comes
from the official calcom/sans-ui repository at commit
`d9bb322ea125f22fe1e36fe24a21dec3d1d07f4a`:
https://github.com/calcom/sans-ui/blob/d9bb322ea125f22fe1e36fe24a21dec3d1d07f4a/fonts/variable/CalSansTextUI%5BGEOM%2CSHRP%2CYTAS%2Cital%2Cwght%5D.woff2

- SHA-256: `e193c017b481b1b9fe584a08988acb533e83820448086ca0dea6c5ded0e65e7f`
- File size: 154,200 bytes; WOFF2 magic `wOF2`.
- Verified axes: wght 400–700, ital 0–1, GEOM 0–100 (default 25),
  YTAS 1440–1600 (default 1520), SHRP 0–100 (default 0).
- The default upright axes match the approved comparison. Italic uses the same
  original file with its ital axis set to 1; no synthetic font file is generated.
- Original copyright and SIL OFL 1.1 ship in `public/assets/fonts/OFL-CalSans.txt`.

Inter remains available for the redacted local design comparison and historical
provenance. It is no longer imported by the application font stylesheet.

Unmodified Inter 4.1 variable WOFF2 files from the official `rsms/inter` release:
https://github.com/rsms/inter/tree/v4.1/docs/font-files

- Upright SHA-256: `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3`
- Italic SHA-256: `e564f652916db6c139570fefb9524a77c4d48f30c92928de9db19b6b5c7a262a`

Copyright The Inter Project Authors. SIL Open Font License 1.1 is distributed
at `public/assets/fonts/OFL-Inter.txt`. Source downloads were checked against the
official release's Git blob hashes. Vite emits content-hashed font URLs.

The CSS family alias `NoSpoilers UI` prevents loading the app font from changing
marketing selectors that already name Inter. Watch text, forms, mobile navigation
and portalled menus share `--font-ui`; code, paths and hashes retain monospace.

The family uses the local asset and has no external font-service request.
