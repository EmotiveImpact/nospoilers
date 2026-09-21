# Strategy context audit and decision provenance

Audit date: 9 September 2026.
Reviewed branch head: `889c41d5e10901786b9e3099736a4c9de7e4c161` on `codex/release-assurance-spine-v1`, draft PR #44.

## Purpose and honest scope

This audit maps the substantive discussion to durable repository context. It is not a verbatim transcript, a new security audit, a passing test report or evidence of customer demand. The main strategy was already preserved. This addition makes the commercial assumptions, unresolved decisions, corrections and validation work explicit so another agent can continue without reopening the chat.

The audit read the complete BUSINESS-NORTH-STAR and RESEARCH-SNAPSHOT, the agent entry point and documentation index, and the current PR description. Existing handoffs and acceptance records supply implementation boundaries. Application tests were not run for this documentation update. The public behavioural sources linked in BEHAVIOURAL-EXPERIMENTS were checked separately; competitor prices and contact details were not refreshed in this audit.

## Where the discussion is preserved

Paths below are relative to this directory unless stated otherwise.

| Discussion | Durable home | Interpretation |
| --- | --- | --- |
| £500,000 MRR ambition, not personal income | BUSINESS-NORTH-STAR sections 1 and 2; COMMERCIAL-VALIDATION-PLAN | Owner target. No achieved revenue, timeline or probability is established. |
| $99 Team / $29 Solo customer counts and mixed plans | BUSINESS-NORTH-STAR section 2; COMMERCIAL-VALIDATION-PLAN section 2 | Arithmetic only; USD plans and GBP target must not be conflated. |
| Higher-value £500/£2,000/£5,000 offers and agency contracts | BUSINESS-NORTH-STAR sections 2, 15 and 16; COMMERCIAL-VALIDATION-PLAN section 2 | Alternative pricing hypotheses, not approved billing changes. |
| Meaning of paid pilot; later preference not to lead with one | BUSINESS-NORTH-STAR section 14; ../growth/OUTREACH-LIBRARY-v2.md | A paid pilot means the customer pays NoSpoilers. Default outreach does not require one. Free/no-card exceptions need explicit approval and a real implementation. |
| What the existing scanner, Watch, policies, receipts and integrations do | ../PRODUCT.md; ../STATUS.md; ../PRODUCT-DIRECTION.md; ACCEPTANCE.md | Distinguish implemented, verified and live. Older status text is not a substitute for the current evidence. |
| Release as central object, not separate scanner products | BUSINESS-NORTH-STAR sections 3 to 5 and 20; ../PRODUCT-DIRECTION.md | Product direction; preserve the approved website and app direction. |
| Five release questions: shipped content, unintended content, change, delivery, proof | BUSINESS-NORTH-STAR section 5 | The full vision includes work still unbuilt. |
| Continuous checks, policy, team workflow and evidence as retention | BUSINESS-NORTH-STAR sections 6 and 19; BEHAVIOURAL-DESIGN.md | Retention thesis, not measured retention. |
| Streams, snapshots, approved baselines, deduplication, exclusions, cold start | BUSINESS-NORTH-STAR section 7; INTELLIGENCE-HANDOFF.md | Implementation is documented on the branch; full integrated verification remains separate. |
| PostgreSQL, TypeScript, existing jobs; optional later ML and pgvector | BUSINESS-NORTH-STAR section 7; INTELLIGENCE-HANDOFF.md | No requirement to add a vector database, Python service or model training now. |
| Before-deploy decision versus after-deploy observation | BUSINESS-NORTH-STAR sections 5 and 8; ARCHITECTURE.md; ACCEPTANCE.md | Do not make post-deployment evidence a circular prerequisite for deployment. |
| Single authority and advisory/warn/enforce release gate | BUSINESS-NORTH-STAR section 8; ACCEPTANCE.md RA-01 and RA-05 | New authority cutover and enforcement remain implementation tasks. |
| Approved artefact versus actual deployed asset set | BUSINESS-NORTH-STAR section 5; ACCEPTANCE.md RA-04 | Bounded multi-asset parity is not equivalent to one saved delivery hash. |
| Finding to reviewed PR to rebuilt receipt to verified resolution | BUSINESS-NORTH-STAR section 9; ACCEPTANCE.md RA-06 | Durable lifecycle remains to be completed; existing guidance/PR controls are not the full loop. |
| Investigation, remediation, verification, evidence agents and MCP | BUSINESS-NORTH-STAR section 10; ACCEPTANCE.md RA-07 | Proposed tools and provider-backed agents are not implemented merely because read APIs exist. |
| Release Passport, private/public evidence and customer exports | BUSINESS-NORTH-STAR section 5; ARCHITECTURE.md; ACCEPTANCE.md | Current new passport is an unsigned summary referring to the original signed evidence. |
| Behavioural economics, emotional experience and ethical boundaries | BUSINESS-NORTH-STAR sections 11 and 12; BEHAVIOURAL-DESIGN.md; BEHAVIOURAL-EXPERIMENTS.md | Mechanisms are design hypotheses; experiments and guardrails now have explicit definitions. |
| Lead-generator discovery, qualification, conversion and disclosure | BUSINESS-NORTH-STAR sections 13 and 14; ../growth/OUTREACH-LIBRARY-v2.md | Internal only. Ordinary sales and security disclosure are separate processes. |
| Buyers, agencies, partners and named candidate organisations | BUSINESS-NORTH-STAR sections 15 to 18; RESEARCH-SNAPSHOT.md | Candidate research, not customer relationships, qualified budgets or vulnerability allegations. |
| Acquisition channels and early commercial milestones | ../MONTH1.md; BUSINESS-NORTH-STAR section 16; COMMERCIAL-VALIDATION-PLAN | Historical estimates and proposed experiments, not forecasts. |
| Metrics, moat and reasons the business might fail | BUSINESS-NORTH-STAR sections 19, 23 and 24; COMMERCIAL-VALIDATION-PLAN | Collect evidence before treating strategic conclusions as facts. |
| Branch-only work, what is unfinished, agent reading order | AGENTS.md at repository root; README.md; ACCEPTANCE.md; INTELLIGENCE-HANDOFF.md; PR #44 | These documents must remain synchronised. Documentation does not close engineering gates. |
| Deferred SSO/SBOM/Sigstore/installer/native-cloud work | BUSINESS-NORTH-STAR section 22; ../ROADMAP.md | Preserve explicit scope boundaries rather than quietly adding them to launch requirements. |

## Corrections that future agents must preserve

| Earlier simplification or example | Durable correction |
| --- | --- |
| 5,051 customers at $99 reaches £500k monthly | It reaches $500,049 monthly before discounts. GBP depends on a dated conversion policy; only a hypothetical £99 price gives the same numeric GBP result. |
| 5,000 Team accounts equals $500k | 5,000 × $99 = $495,000. At least 5,051 are required for $500k at the undiscounted monthly price. |
| Advertised competitor prices validate willingness to pay for NoSpoilers | They establish advertised market context only. NoSpoilers demand needs customer evidence, payment and retention. |
| A recurring product must find a vulnerability to be useful | A clean, properly scoped recurring check can be useful. Never create noise to demonstrate value. |
| Nothing ships until NoSpoilers says it is safe | The intended gate checks the exact artefact against an adopted, scoped policy. It is not a universal software-safety guarantee and is not enforced by the present advisory layer. |
| Hidden source maps fix public map exposure | webpack hidden-source-map removes the reference comment but still generates maps. Verify published bytes after a reviewed fix; do not treat a toggle as proof. See BEHAVIOURAL-DESIGN and the webpack source in BEHAVIOURAL-EXPERIMENTS. |
| A map file or a new executable-like extension means a vulnerability | Presence/novelty is an observation. Intent, scope, actual content and adopted policy determine significance. |
| A valid signature, a digest or an attestation marked present means verified safety | Signature validity, provenance verification, scan outcome and production observation are distinct claims. |
| Passed once means continuously verified | Observations have times, scope and freshness limits. Unknown, stale, unreachable and unsupported remain explicit. |
| An approved baseline means the whole application is known safe | It is a human-adopted reference within an eligible evidence scope, not a certification. |
| More history always improves the model | Repeated identical artefacts, wrong stream assignment, poisoned references and stale/unavailable evidence can make history misleading. Record effective eligible sample counts and exclusions. |
| An accepted exception or closed alert is a fixed vulnerability | Only the appropriate subsequent evidence can establish resolution. Historical receipts are not rewritten. |
| Customers should remain because cancelling removes their history | Honour actual export, retention and deletion terms. Do not add cancellation friction or threaten data loss. |
| A behavioural principle guarantees years of retention | Evidence from another context is not a NoSpoilers result. No dopamine, addiction or guaranteed uplift claims. |
| 101 tests and 55 browser checks mean the present branch passes | Those are historical companion-checkpoint counts. They are not a full regression result for the later history implementation. |
| A code module, mock port or written test is production proof | Separate implementation, focused tests, integrated acceptance and deployment validation. |
| The lead generator sends disclosures when email credentials are set | Disclosure Desk deliberately does not auto-send. Drafting and conversion tracking are not sending authority. |

## Decision provenance and change authority

**Owner direction already expressed:** build the Release Assurance vision on the existing feature branch; preserve all durable context; pursue a £500k-MRR business; design retention through real usefulness; keep the existing product foundation rather than starting again.

**Existing product contract:** Solo $29 and Team $99 per month, USD; five-day trial; coverage rather than scan credits. PRODUCT.md and the actual billing implementation remain authoritative. This audit changes none of them.

**Proposals, not owner-approved contracts:** larger plan prices; a 36-month illustrative growth model; free assisted evaluation exceptions; paid onboarding amounts; agency revenue shares; particular hiring triggers; business target margins; new telemetry; third-party AI providers or private deployment arrangements.

**Unknowns that need evidence:** current paying customers and recognised recurring revenue, measured conversion/churn, production readiness, fully loaded cost to serve, buyer willingness to pay, partner interest, security acceptance by procurement, useful anomaly thresholds and behavioural-treatment effects. Do not fill these fields with plausible invented values.

An agent may implement within the authorised branch task but may not infer permission to charge customers, change pricing, contact prospects, publish findings, buy infrastructure, enable providers, merge or deploy from the revenue ambition.

## The next-agent completion contract

For each future increment, record scope, exact changed files, commit, tests actually executed, results and limitations. Preserve a three-way distinction: implemented but unverified; verified in a stated environment; not implemented. Record the next step without relabelling unbuilt work as a credentials issue.

Before changing the release authority, inspect the current implementation and prove the old and new views cannot contradict one another. Required review includes authentic receipts, real authorisation, revoked access, tenant boundaries, policy concurrency, migration/retention behaviour and the integrated interface. Existing ACCEPTANCE is the source for the engineering sequence; this audit does not invent another feature backlog.

Before each push, read the current branch head. Use non-forced, fast-forward writes; preserve other work. Keep the branch deployment guard. Update relevant handoff and acceptance rows in the same increment, then make the PR description match the repository. A final response should name the remote commit and state precisely what was verified.

## Research hygiene

For any new external claim, retain source title, primary URL, accessed date, what was inspected, what the source actually supports and the limits of the NoSpoilers inference. A listed price is not customer validation; a theory is not an effect size; a design mock-up is not app evidence. Date-sensitive legal, provider and pricing claims require a fresh check before use in customer-facing material.

References already preserved in RESEARCH-SNAPSHOT remain a dated bibliography. This audit does not certify every older external assertion. The new behavioural evidence register explicitly distinguishes publisher abstracts from official implementation guidance. Do not put customer source, credentials, private research targets or unnecessary personal information into this repository as context.

## Maintenance

README is the navigation index, BUSINESS-NORTH-STAR explains why, ACCEPTANCE reports implementation state, and the most recent applicable handoff reports how to continue. COMMERCIAL-VALIDATION-PLAN defines how to test business hypotheses. BEHAVIOURAL-EXPERIMENTS defines how to test interaction hypotheses. Add substantive decisions and evidence, not repeated motivational prose.

No material product/business theme in the available discussion was identified as wholly missing from the saved strategy. The practical gaps addressed by this update are execution definitions, correction provenance and measurable experiments. This is a structured coverage audit, not a promise that every sentence of every prior conversation has been archived.
