# Public website and documentation handoff

## Local integration review — 8 September 2026

PR #42 is integrated into the working branch, not main. The original handoff below is historical, not a recurring request to rebuild these pages. Supporting pages and fifteen guides now exist; subsequent tasks should change them only for specific new requirements or verified defects.

Real-project review found and corrected browser-test placement in the server-only TypeScript project and two accessible-name test mismatches. Browser-facing tests now follow the repository's `.test.tsx` convention. All 27 website tests and the production build (including project typecheck) pass. The build was run with the capture-review variable enabled; no development capture instruction strings were emitted. Live local documentation navigation and content were inspected in the application shell. This is not full responsive visual acceptance or Gate B completion. Fresh images, owner-approved legal/commercial copy and production operational verification remain separately outstanding.

## Status and starting point

Implemented public website/documents in a separate branch. **Review pending, not a production launch or Gate B completion.**

- Repository: `EmotiveImpact/nospoilers`
- Starting branch: `codex/v20-homepage-auth-mock3`
- Starting commit: `eb46118030643a8f27847302784867df4e84c6da`
- Starting tree: `75fc10bf23e4ee7880ca19ef8fa6a498bcdc5fe9`
- Work branch: `codex/website-docs-completion`
- PR target: `codex/v20-homepage-auth-mock3`, not `main`

The terminal cannot resolve GitHub/npm hosts and has no complete checkout or locked dependency installation. Chromium navigation to the loopback review server was blocked by the environment's network policy. These limitations were reported before implementation/verification claims. GitHub connector reads and writes are available, so the code can still be committed for normal local/CI review.

## Completed pages

| Route | Work |
| --- | --- |
| `/product` | Product scope, evidence surfaces, review loop and limitations. |
| `/use-cases` | Package publication, CI, website checks, investigations and technical evaluation. |
| `/integrations` | Implemented paths, configuration/operational prerequisites and explicitly planned/unavailable capabilities. |
| `/pricing` | Confirmed USD monthly/annual prices, five-day trial, entitlement limits and honest availability copy. Existing state/effect/open-app/checkout handlers are preserved. |
| `/security` | Inspection, data, access, proof and operational boundaries; existing private contact path. |
| `/enterprise` | Proposed measurable evaluation approach, required buyer information and an actual email link. |
| `/support` | Replaces the old support-route presentation with getting-started, troubleshooting and safe contact guidance. |
| `/docs` | Grouped documentation landing page, quick starts and local content search. |
| Existing `/privacy`, `/terms`, `/retention`, `/disclosure`, `/refunds` | Existing text is retained in a clearly labelled review-draft disclosure. An unverified effective-date claim is no longer presented as approved policy. |

## Fifteen direct documentation URLs

1. `/docs/getting-started`
2. `/docs/workspaces-and-roles`
3. `/docs/supported-inputs`
4. `/docs/github`
5. `/docs/artifact-scanning`
6. `/docs/website-scanning`
7. `/docs/coverage-and-releases`
8. `/docs/release-results`
9. `/docs/alerts`
10. `/docs/policies-and-exceptions`
11. `/docs/proof`
12. `/docs/api-tokens-and-ci`
13. `/docs/notifications`
14. `/docs/retention-and-deletion`
15. `/docs/troubleshooting`

Explicit short aliases are defined in `src/website/docs-content.ts`; unknown/malformed/nested article URLs show an unavailable guide with search recovery instead of another article. Grouped left navigation, current article, breadcrumbs, section anchors, desktop/mobile contents and previous/next guides use the same structured content.

## Implementation and preservation

The existing React/Vite router remains. `src/App.tsx` adds only a public-route early return through the existing `V20PublicShell` and passes the actual docs path into `DocsPage`. `/watch`, `/scan`, authentication and existing API routing remain unchanged. `/support` is resolved to the new public page before the retained legal presentation is rendered.

Public content is lazy-loaded through a small React adapter. Reusable escaped HTML templates and a scoped native-DOM controller provide search, dialogs, focus wrapping, headings and copy controls. This is not a new application router or deployment framework. No runtime dependencies or package-lock changes were added. Public chunk/render failures have an explicit reload/support state.

All new styles are scoped beneath `.nsw`. The existing homepage component, its stylesheet and assets, every mockup, authenticated screens, scanner, authentication/billing logic, server APIs, database schemas, workers and Gate B records are not edited. Pricing presentation changes do not change its existing API request, permission/selection logic or redirects.

Existing MarketingNav/MarketingFooter and homepage destinations are intentionally preserved. Their Docs and Support links reach the new surfaces; a consistent public navigation strip links every supporting page from the new docs, supporting, pricing and policy surfaces. No homepage redesign or layout change is part of this work.

`vercel.json` adds only a branch-specific `git.deploymentEnabled` false entry for `codex/website-docs-completion`, included in its first published commit. Other branches and all existing build/function/cron/rewrites remain unchanged. No deployment, merge, production migration or provider activation is authorised or performed.

## Contact, commercial and content boundaries

Enterprise/support/security use the existing repository contact `emotiveimpact@gmail.com`. No submission backend was found or created for website enquiries. Email links open the user's email application and never claim a ticket or submission success. Mailbox deliverability/support coverage was not independently verified.

The content uses the five-day trial, no permanent free scanner, authenticated/entitled work, existing public intake and scoped proof-verification boundaries. It does not invent customers, testimonials, certifications, prices, service guarantees or operational SSO/SCIM/custom-role/private-hosting capabilities. Provisional workspace/seat defaults are not advertised as confirmed packaging.

[WEBSITE-CONTENT-EVIDENCE.md](WEBSITE-CONTENT-EVIDENCE.md) maps each guide to implementation and separates code evidence from readiness claims. Customer articles do not import the internal plans or procurement drafts. The old `src/docs.ts` is left unchanged but is no longer consumed by the public DocsPage.

## Future product images

No product screenshots were generated, captured or embedded, including verification deliverables. Twelve capture locations are registered in [WEBSITE-IMAGE-CAPTURE-PLAN.md](WEBSITE-IMAGE-CAPTURE-PLAN.md), with exact content locations, app routes, required QA states, viewport/framing, captions, purpose and redaction requirements.

`VITE_WEBSITE_CAPTURE_REVIEW=1` plus Vite development mode enables annotations. Both conditions are required; a query string is not a production switch. Normal rendering emits no image block, internal instructions or empty reserved gap. Capture metadata is imported only in the development condition. A branch-scoped CI production build deliberately sets the review variable to verify that the development instruction strings are not emitted into production JavaScript.

## Buyer materials, all separate internal review drafts

- [Product overview](enterprise-review/PRODUCT-OVERVIEW.md)
- [Pilot evaluation plan](enterprise-review/PILOT-EVALUATION-PLAN.md)
- [Security questionnaire](enterprise-review/SECURITY-QUESTIONNAIRE.md)
- [Procurement FAQ](enterprise-review/PROCUREMENT-FAQ.md)

These distinguish implemented code, operational verification and planned features. They are not published customer documentation, approved contracts or security attestations.

## Verification actually completed

| Check | Result and exact scope |
| --- | --- |
| New content regression | **23/23 passed** against the actual website modules using Node 22.16.0 TypeScript stripping and `node:test`. Only the test-runner import was substituted from Vitest; assertions/cases were unchanged. This is not a full Vitest run. |
| Native module semantic typecheck | **Passed** with available TypeScript 5.8.3, strict/no-unused/erasable syntax and the project's ES2023/DOM library boundary. The repository pins TypeScript 6; full project typechecking remains separate. |
| TS/TSX syntax | **9 files, no transpilation syntax errors**, including the public React adapters, App, pricing/legal and test files. Not a semantic React/project typecheck. |
| Offline browser layout | **66/66 combinations passed**: docs landing + 15 articles + 6 supporting templates at 390, 768 and 1440 CSS pixels. One main/H1, no document overflow, controlled heading sizes, no unfinished images. Existing React shell, pricing and legal rendering were not included in this offline harness. |
| Offline browser interactions | **28 checks passed**: local search, no-results escaping/clear, shortcut/arrow/Escape focus, mobile dialog wrapping at 390/768, contents disclosure, exact-code clipboard success/failure contracts, cleanup, native heading hash/focus, review-only notes, reduced motion and scoped-style isolation. Clipboard permissions were mocked; actual host clipboard permission is not claimed. |
| Browser console | No page/console errors in the final offline template/controller run. No screenshots were taken. |
| Protected-source inspection | Changes are confined to public files, additive public routing, review docs/tests and the review-branch deployment guard. Starting App bytes were checked against the original Git blob; the new diff must also be reviewed on the PR. |

The final native/content/offline browser runs used unchanged source. Earlier dialog focus wrapping and copy-status recovery issues were fixed before that final run.

### Commands and test scope

The repository's new tests are `tests/website-docs.test.ts` and `tests/website-docs-ui.test.ts`. The latter adds four real React adapter/jsdom integration cases but could not be run locally without the repository dependencies. Its dialog/clipboard adapters test contracts, not browser permissions or real native inert rendering.

The isolated native typecheck used the available compiler with:

```sh
tsc --noEmit --strict --noUnusedLocals --noUnusedParameters \
  --target ES2023 --module ESNext --moduleResolution bundler \
  --allowImportingTsExtensions --lib ES2023,DOM --skipLibCheck \
  --verbatimModuleSyntax --erasableSyntaxOnly --noFallthroughCasesInSwitch \
  src/website/model.ts src/website/search.ts src/website/page-paths.ts \
  src/website/docs-content.ts src/website/site-content.ts src/website/render.ts \
  src/website/controller.ts src/website/capture-review.ts
```

The offline browser harness transpiled these exact modules, mounted their actual markup/controller in Chromium without network navigation and collected DOM/computed-style/interaction assertions. It did not emulate a successful API/backend or replace application behaviour. It is not delivered as another framework or deployment.

## Outstanding verification and decisions

1. Run the real locked project install, both website test files, full project typecheck, production build and lint. `.github/workflows/website-docs-check.yml` adds these checks for this PR branch; inspect actual CI results rather than assuming success. Existing Gate B regression remains separate.
2. Verify the full React/Vite application at 390/768/1440: public direct refresh, normal/back/forward navigation, footer/header destinations, search result navigation, loading/chunk failure, real clipboard permission, pricing availability/error display, policy drafts and the absence of review notes in a production build.
3. Compare the original homepage and representative authenticated routes against the unchanged baseline in the actual shell. Scoped CSS and unchanged files are not a substitute for final integrated visual/behavioural acceptance. Do not capture screenshot deliverables for this handoff.
4. Reconcile terminology and availability with Codex's completed Gate B before publishing. No Gate B acceptance row is closed here.
5. Confirm final public contact use/support operations, live price IDs/tax/contract details, workspace/seat packaging, legal/privacy/DPA/subprocessor/region statements and any enterprise commitments. Existing legal drafts must be approved or replaced before being treated as effective terms.
6. Complete desktop/mobile viewport inspection of the Linear documentation references if still required for design sign-off. Text structure was inspected, but browser network policy blocked external viewport inspection.
7. Codex should capture and review the twelve planned product images only after the required QA states exist. No image is approved by its placeholder or capture note.

No permanent deletion, customer notification, live provider operation, paid resource, deployment, merge, force-push, `backup89` update or push to `main` is part of this task.

## Changed files

The explicit file inventory follows; generated local harnesses, temporary logs and any credentials are excluded from the repository commit.

- `.github/workflows/website-docs-check.yml`
- `docs/WEBSITE-COMPLETION-HANDOFF.md`
- `docs/WEBSITE-CONTENT-EVIDENCE.md`
- `docs/WEBSITE-IMAGE-CAPTURE-PLAN.md`
- `docs/enterprise-review/PILOT-EVALUATION-PLAN.md`
- `docs/enterprise-review/PROCUREMENT-FAQ.md`
- `docs/enterprise-review/PRODUCT-OVERVIEW.md`
- `docs/enterprise-review/SECURITY-QUESTIONNAIRE.md`
- `src/App.tsx`
- `src/pages/DocsPage.tsx`
- `src/pages/LegalPage.tsx`
- `src/pages/PricingPage.tsx`
- `src/pages/WebsitePage.tsx`
- `src/website/PublicContent.tsx`
- `src/website/PublicPageBoundary.tsx`
- `src/website/README.md`
- `src/website/capture-review.ts`
- `src/website/controller.ts`
- `src/website/docs-content.ts`
- `src/website/docs-manage.ts`
- `src/website/docs-review.ts`
- `src/website/docs-scan.ts`
- `src/website/docs-start.ts`
- `src/website/model.ts`
- `src/website/page-paths.ts`
- `src/website/render.ts`
- `src/website/search.ts`
- `src/website/site-content.ts`
- `src/website/website.css`
- `tests/website-docs-ui.test.ts`
- `tests/website-docs.test.ts`
- `vercel.json`
