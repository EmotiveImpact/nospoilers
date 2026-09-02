# nospoilers-throwaway

Disposable Phase 1 proof for [NoSpoilers](https://github.com/EmotiveImpact/nospoilers).

This repository is **safe to publicize**. It is not a product, not a customer, and not a real
secret store. It exists so the GitHub App can prove:

1. A public repository produces a Watch visibility alert.
2. A GitHub Release pack with a source map produces a failed-policy scan (not allowed to ship).
3. Cheap push hits on `*.map` / `.env` produce a light Watch alert without unpacking git.

## What ships in the fixture pack

`pack/` is packed as `sourcemap.tgz` on the `phase1-fixture` GitHub Release:

- minified `index.js` plus `index.js.map` with embedded source (`this-is-the-plot-twist`)
- `package.json` name `spoiler-pack`

DEX, installers, and customer packages are not in this repo. Nothing here is executed.

## Recreate the release

Push to `main`, or run the workflow. It creates tag `phase1-fixture` and uploads
`sourcemap.tgz` with `contents: write` on `GITHUB_TOKEN`. That is not GitHub App
**Administration** (make-private, delete assets, disable workflows, change settings).
