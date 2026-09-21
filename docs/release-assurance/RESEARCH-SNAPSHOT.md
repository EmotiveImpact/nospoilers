# NoSpoilers research snapshot

Snapshot date: 9 September 2026.

This file preserves the external research and commercial context used in the Release Assurance strategy. It is a dated snapshot, not a claim that competitor pricing, laws, partner programmes or product capabilities will never change. Re-check before making a major pricing, legal, partnership or competitive decision.

---

## 1. Why this file exists

The strategic work behind NoSpoilers combined repository evidence with current market research. The durable conclusions were:

- the secret-scanning market is already validated and crowded
- final artefact / release assurance is a credible category with higher-value precedent
- source-map exposure is a real issue, but “we find source maps” alone is not enough recurring value
- continuous release evidence, policy, production parity and remediation are stronger retention drivers
- self-service pricing can scale, but £500k MRR at $29/$99 requires thousands of paying accounts
- agency and platform ecosystems can become distribution channels after customer value is proven
- responsible disclosure must remain separate from sales automation
- AI/agents are useful for investigation/remediation, not for inventing security truth

---

## 2. GitHub security pricing and interpretation

### Snapshot

GitHub publicly lists:

- GitHub Secret Protection: **$19 USD per active committer/month**
- GitHub Code Security: **$30 USD per active committer/month**

Source:

- https://github.com/security/plans
- https://docs.github.com/en/code-security/how-tos/secure-at-scale/configure-organization-security/configure-specific-tools/estimate-price

### Implication for NoSpoilers

Do not position NoSpoilers as “cheaper GitHub secret scanning”. GitHub already owns repository-native push protection and secret scanning in its ecosystem.

The stronger distinction is:

> repository scanners inspect what developers wrote; NoSpoilers inspects what actually escaped into the release and production surface, then keeps a release evidence trail.

Current NoSpoilers Team pricing at $99/month can be attractive to smaller teams compared with per-active-committer security add-ons, but do not make a misleading direct feature-equivalence claim.

---

## 3. Socket pricing and interpretation

### Snapshot

Socket publicly lists:

- Free: $0/developer/month
- Team: **$25/developer/month**, minimum five developers
- Business: **$50/developer/month**, minimum twenty developers
- Enterprise: custom

Its positioning includes dependency risk, malicious packages, reachability, compliance integrations, SBOM, SSO/SAML, webhook automation and AI-related scanning.

Source:

- https://socket.dev/pricing

### Implication for NoSpoilers

Socket demonstrates willingness to pay for developer security tooling beyond repository secret scanning.

NoSpoilers should not attempt to become an all-purpose dependency-security platform. The differentiated wedge remains release artefact, release history, policy, production parity and proof.

---

## 4. GitGuardian pricing and interpretation

### Snapshot

GitGuardian currently has:

- Starter/free
- Growth / Teams via contact sales
- Enterprise / custom

Capabilities include internal secrets monitoring, public secrets monitoring, remediation playbooks, SSO/SCIM, developer endpoint protection, NHI governance and enterprise data-source coverage.

Source:

- https://www.gitguardian.com/pricing

### Implication for NoSpoilers

GitGuardian further validates the market for secrets exposure and remediation but also reinforces why NoSpoilers should not lead with a generic “secret scanner” pitch.

NoSpoilers should own a narrower, more operational question:

> what did this release actually expose and can this team prove what happened?

---

## 5. ReversingLabs and final-build assurance

### Snapshot

ReversingLabs continues to market software-supply-chain security and final-artifact security. Its 2026 supply-chain research argues for continuous validation across the software supply chain and highlights malicious package/toolchain activity and AI-related development risk.

Sources:

- https://www.reversinglabs.com/software-supply-chain-security-report
- https://www.reversinglabs.com/blog/sscs-report-2026-takeaways

### Implication for NoSpoilers

This validates that final-build / artefact assurance is not a frivolous category.

NoSpoilers should not copy a large enterprise suite. The opportunity is a more developer-native, easier-to-adopt, release-workflow product with a low-friction $29/$99 entry point and a path to larger contracts.

---

## 6. Sentry source-map custody

### Snapshot

Sentry documentation recommends uploading source maps and provides bundler options to delete maps after upload. Its documentation warns that generated source maps can expose source if made public and notes that upload-to-Sentry can allow the deployed site to omit them.

Sources:

- https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/sourcemaps/uploading/esbuild
- https://docs.sentry.io/platforms/javascript/guides/deno/sourcemaps/uploading/hosting-publicly/

### Implication for NoSpoilers

Finding a publicly served source map can be useful, but it is often remediable by existing build/debugging workflows.

Therefore:

> “we find source maps” is an acquisition hook, not a sufficient retention thesis.

The recurring product must be the release-assurance loop around future builds and production state.

Sentry can be viewed as a complementary ecosystem target around source-map custody/debugging rather than necessarily a head-on competitor.

---

## 7. UK B2B outreach constraints

### Snapshot

The UK ICO’s current B2B direct-marketing guidance says:

- PECR rules differ between corporate and individual subscribers
- the electronic-mail rule does not apply to corporate subscribers in the same way it applies to individual subscribers
- sole traders and some partnerships are treated as individual subscribers
- UK GDPR still applies when personal data is processed for direct marketing
- publicly available personal data is not exempt from UK GDPR
- business contacts may object to direct marketing
- guidance is under review following the Data (Use and Access) Act

Source:

- https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/

### Implication for NoSpoilers

Commercial outbound must not be treated as a licence to scrape and spam.

Operational guidance:

- prefer clearly relevant corporate contacts
- keep identity and purpose clear
- provide/observe opt-out and objection handling
- record do-not-contact
- take extra care with sole traders and individual subscribers
- establish the appropriate UK GDPR lawful basis and transparency process before scaling personal-data-driven outbound
- re-check ICO guidance before automating a large campaign

This is operational context, not legal advice.

Responsible disclosure remains a separate security process and should not be used as a sales pretext.

---

## 8. Vercel ecosystem and partner strategy

### Snapshot

Vercel operates:

- Solution Partner programme for agencies/consultancies/system integrators
- Technology Partner programme for software companies integrating with Vercel
- partner directory
- Marketplace programme with integrated discovery/billing/onboarding opportunities

Sources:

- https://vercel.com/partners
- https://vercel.com/partners/solution-partners
- https://vercel.com/marketplace/program

### Implication for NoSpoilers

Vercel is a logical later ecosystem target because NoSpoilers has a production-web/release-assurance story.

Do not wait for partnership approval before proving customer demand.

Potential sequence:

1. prove customer value independently
2. implement a technically useful Vercel workflow
3. collect adoption/customer evidence
4. explore Technology Partner / Marketplace routes

The Vercel partner directory is also a useful source of agencies that maintain modern production applications and may be suitable for authorised portfolio pilots.

---

## 9. Agency targets researched

These are examples for business-development research only. Their presence here does not imply vulnerability, active interest or a commercial relationship.

### Blazity

Research snapshot:

- Vercel Gold Partner
- Next.js / AI / platform engineering positioning
- public contact: `contact@blazity.com`

Sources:

- https://www.blazity.com/
- https://www.blazity.com/case-studies
- https://www.blazity.com/services

Why potentially relevant:

- operates ongoing engineering engagements
- release/performance/platform responsibility can make release assurance client-visible value

### FocusReactive

Research snapshot:

- Next.js/headless-CMS engineering agency
- appears in Vercel’s Solution Partner directory

Sources:

- https://focusreactive.com/
- https://vercel.com/partners/solution-partners

Why potentially relevant:

- modern web delivery and maintenance can create repeat release surfaces

### Bejamas

Research snapshot:

- listed in Vercel’s Solution Partner directory

Source:

- https://vercel.com/partners/solution-partners

Why potentially relevant:

- a multi-client modern-web agency is a plausible future portfolio-distribution shape

Again: these are candidate conversations, not claims of a problem in their software.

---

## 10. Developer-workflow design-partner targets

### Trigger.dev

Research snapshot:

Trigger.dev is an open-source background-jobs/workflow platform with SDK/CLI integration, queues, retries, observability, AI-agent workflows and human-in-the-loop capabilities.

Sources:

- https://trigger.dev/docs/introduction
- https://trigger.dev/product

Why potentially relevant:

- ships developer-facing software and SDKs
- understands release/developer workflow problems
- could be a design-partner target for release artefact checks or agent-tool integration

No claim is made that Trigger.dev has an exposure.

### Inngest

Research snapshot:

Inngest provides event-driven durable execution and a TypeScript SDK with retries, concurrency, rate limiting, observability and durable workflow primitives.

Sources:

- https://www.inngest.com/docs/reference/typescript/intro
- https://www.inngest.com/docs/learn/inngest-functions

Why potentially relevant:

- developer-tool release model
- sophisticated engineering workflow
- plausible design-partner target for release-assurance integration

No claim is made that Inngest has an exposure.

---

## 11. Lovable as a later ecosystem target

### Snapshot

Lovable publicly documents enterprise controls including SSO, SCIM, RBAC and publishing approvals.

Sources:

- https://lovable.dev/security
- https://docs.lovable.dev/features/business/sso

### Implication for NoSpoilers

Lovable is more interesting later as an ecosystem/integration or generated-software release-safety target than as an immediate first customer dependency.

Do not prioritise a big partnership over proving the core release-assurance loop.

---

## 12. Agent/workflow technology research

NoSpoilers already has its own job/worker system. New external workflow infrastructure is not automatically required.

However, current ecosystem research shows that durable workflow platforms such as Trigger.dev and Inngest support:

- retries
- concurrency control
- scheduled work
- long-running steps
- observability
- human-in-the-loop workflows
- AI-agent orchestration

This is useful design reference for the future NoSpoilers agent/remediation workflow, but replacing the existing worker architecture is not a strategy requirement.

Potential future adoption should be justified by concrete reliability/operations needs rather than novelty.

---

## 13. Behavioural-design research

Primary behavioural/interaction references are already preserved in `BEHAVIOURAL-DESIGN.md`.

Key sources include:

- GOV.UK task list guidance: https://design-system.service.gov.uk/components/task-list/
- W3C status-message accessibility guidance: https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html
- FTC dark-pattern report summary: https://www.ftc.gov/news-events/news/press-releases/2022/09/ftc-report-shows-rise-sophisticated-dark-patterns-designed-trick-trap-consumers
- webpack devtool documentation: https://webpack.js.org/configuration/devtool/

The product interpretation is intentionally ethical:

- reduce cognitive load
- make evidence understandable
- show genuine progress
- make successful resolution feel complete
- preserve user autonomy
- avoid deceptive scarcity, panic, fake scores, streaks and cancellation obstruction

The behavioural objective is customer effectiveness and trust, not addiction.

---

## 14. Market positioning summary

### Crowded territory

- repository secret scanning
- generic dependency vulnerability scanning
- broad AppSec dashboards

### Stronger NoSpoilers wedge

- final artefact exposure
- what actually shipped
- release-to-release history
- approved reference/baseline
- release policy decision
- production parity
- durable remediation linkage
- release proof/passport

### Why this can retain

A one-off scanner is removable after a fix.

A system that participates in every release, knows the authorised history, compares the current build, applies policy, verifies supported production state and preserves the evidence is much harder to replace because it keeps creating legitimate recurring value.

---

## 15. Commercial model research conclusions

### Current self-service model

$29 Solo / $99 Team is intentionally simple and can support high-volume self-service adoption.

The trade-off is distribution scale: thousands of paying accounts are required for very large MRR.

### Larger-contract hypothesis

Potential later higher-value offers may include:

- larger software-team contracts
- agency portfolio agreements
- enterprise/security agreements
- implementation/onboarding services where genuinely necessary

Do not invent these as existing plans or use unvalidated prices in product UI.

### First commercial proof to seek

Before optimising for £500k MRR, prove:

> at least 10 organisations repeatedly keep NoSpoilers in their release process and continue paying because the recurring workflow is valuable.

That is more informative than shipping ten additional disconnected features.

---

## 16. Outreach research conclusions

Preferred buyer roles:

- CTO
- Head of Engineering
- Platform Engineering
- Release Engineering
- Application Security / DevSecOps / Security Engineering

Preferred early organisation characteristics:

- commercial software
- proprietary releases
- regular shipping cadence
- supported artefact/public-web surfaces
- clear engineering/security owner
- recurring reason to keep release evidence

For agencies, prefer those responsible for ongoing software delivery rather than one-off marketing sites.

Use `docs/growth/OUTREACH-LIBRARY-v2.md` for copy.

---

## 17. Lead-generator research conclusions

Artifact Leads already discovers supported public GitHub/npm artefacts and queues bounded scans. The research conclusion is that the lead generator must optimise for **commercial relevance**, not merely finding count.

Maintain separate dimensions:

### Technical confidence

- public supported artefact
- finding reproducible
- evidence sufficient
- uncertainty explicit

### Commercial fit

- business behind the project
- recurring release need
- likely buyer/owner
- proprietary product
- release cadence
- product type fits NoSpoilers

Do not automatically send disclosure or marketing because a scanner emitted a signal.

---

## 18. What should be re-researched before major decisions

Re-check current sources before:

- changing $29/$99 pricing
- introducing a new Enterprise plan
- claiming a competitor price/capability
- scaling UK outbound automation
- entering a Vercel or other marketplace/partner programme
- adding an external workflow/agent provider
- making public claims about supply-chain/security trends

This file should be refreshed with a new date when material research changes the strategy.
