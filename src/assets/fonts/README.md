# Watch UI fonts

Unmodified Inter 4.1 variable WOFF2 files from the official `rsms/inter` release:
https://github.com/rsms/inter/tree/v4.1/docs/font-files

- Upright SHA-256: `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3`
- Italic SHA-256: `e564f652916db6c139570fefb9524a77c4d48f30c92928de9db19b6b5c7a262a`

Copyright The Inter Project Authors. SIL Open Font License 1.1 is distributed
at `public/assets/fonts/OFL-Inter.txt`. Source downloads were checked against the
official release's Git blob hashes. Vite emits content-hashed font URLs.

The CSS family alias `NoSpoilers UI` prevents loading these files from changing
marketing selectors that already name Inter. Watch text, forms, mobile navigation
and portalled menus share `--font-ui`; code, paths and hashes retain monospace.

Cal Sans is a separate local design comparison, not the production UI font.
