# Cardinal-inspired public website refinement

Date: 27 September 2026.
Base: `92cbe9d36436ad03bcd5b8c5a274b78ea09e04a1`, also the commit recorded by the latest production Vercel deployment when inspected.

## Scope and source

Owner request: use Cardinal's menu and clean component treatment, keep the current NoSpoilers hero, open a PR and supply a preview rather than changing production.

Reference: the owner-supplied `Cardinal — The calm inbox.html`, saved from https://cardinal-template-forgeuipro.vercel.app/ . Its actual header utility classes establish neutral surfaces, compact centred navigation, chevrons, a red pill CTA and restrained borders. The saved file is rendered HTML, not the original React source; its companion CSS, JavaScript, fonts and images were not uploaded. The open dropdown was not present in the saved DOM, so the expanded layout is a NoSpoilers adaptation, not a claim to reproduce hidden Cardinal component source.

Adapted the existing NoSpoilers React navigation and added a separately scoped CSS layer. No Cardinal branding, email features, testimonials, compiled JavaScript or browser-extension injection was copied into the product. The reference's ad-blocking styles and extension scripts were discarded. No new package dependency or licence claim was introduced.

## What changes

- Centred, compact desktop navigation with chevrons and existing Lucide icons.
- One full-width neutral dropdown surface instead of nested bordered panels.
- Red pill scan action; 72px header footprint retained to avoid moving the hero.
- Quieter lower-page pipeline, feature panels, finding cards, trust dividers, pricing and FAQ treatment.
- Compact native-dialog mobile navigation, a persistent scan action, keyboard focus and reduced-motion styling.
- Shared public navigation and footer styling applies through the existing marketing shell; this is not an authenticated Watch redesign.

## What does not change

`HomepageD.tsx`, `homepage-d-content.html`, `homepage-d.css`, existing brand assets, marketing content, prices, session refresh, sign-in routes, scan destinations, billing, APIs, database, workers and Watch remain unchanged.

Preserved homepage-content blob: `2b215f7fac9123fc45dec5536def1ac8cf6cd036`.
Preserved Homepage D stylesheet blob: `894be8f2335b44e1945b836d3ea52f4da4ef4343`.
Original `V20Homepage.tsx` blob verified before editing: `b66d59d977b1c6f8c303f641b4c285d605e33d93`.

## Verification

`node scripts/check-cardinal-marketing.mjs`: **15/15** scoped checks passed. This checks CSS boundaries, preserved session/footer code, destinations, modal handling, keyboard entry and responsive/reduced-motion rules. It is deliberately a checkpoint-specific check, not a replacement for the application test suite.

TypeScript transpilation reported no syntax diagnostics; PostCSS parsed the added stylesheet without errors. These are syntax checks, not the project's TypeScript 6 build.

An in-process Chromium component/presentation harness passed **50/50** assertions: 320, 390, 768, 980, 981, 1100, 1280 and 1440px layouts; hover menus; ArrowDown entry; Escape/focus return; signed-in/out scan destinations; native modal focus containment, scroll cleanup and desktop resize dismissal; reduced motion. The local hero fixture had identical before/after pixels at 1440px and 390px.

Important limits: the harness used the compiled navigation with local React 16 plus a hook compatibility adapter, selected baseline stylesheet declarations and local brand/icon fallbacks. It is not the locked React 19 application, the entire homepage, or a live-browser capture. The Cardinal header was inspected from the uploaded DOM with rebuilt utility CSS; unavailable image assets were omitted. Do not turn these results into full-app, live visual parity, accessibility certification or customer-journey claims.

Full `npm ci`, `npm run build`, `npm test` and native React 19/browser acceptance were not run locally because this authoring environment cannot retrieve the locked dependencies. The PR's actual CI and Vercel build statuses must be checked separately. No provider credentials, permissions or production configuration were changed.

## Review and rollback

Review the branch's Vercel preview, especially the Product and Resources menus, mobile menu, original hero, lower-page cards and a supporting public page. Check real PNG wordmarks, actual font loading, 200% zoom and native keyboard/screen-reader behaviour before merging. Login and scan remain existing product flows, not newly proven by this design change.

Rollback is the PR revert: remove the new CSS import/file, decorative icon additions and mobile action; restore the original navigation markup. Do not change hero files or the application data plane. Production remains on main until an explicit merge/deployment decision.
