import { capture, link, list, note, paragraph as p, section as s, steps, table, warning, type Section } from './model.ts';
import type { WebsitePath } from './page-paths.ts';

export type WebsitePageContent = {
  path: WebsitePath; eyebrow: string; title: string; description: string;
  primary: { text: string; href: string }; secondary: { text: string; href: string };
  sections: Section[];
};
// This is the existing repository contact, not a newly invented sales/support mailbox.
export const WEBSITE_CONTACT = 'emotiveimpact@gmail.com';
export function contactHref(subject: string): string {
  return `mailto:${WEBSITE_CONTACT}?subject=${encodeURIComponent(subject)}`;
}

export const WEBSITE_PAGES: WebsitePageContent[] = [
  {
    path: '/product', eyebrow: 'The release boundary',
    title: 'Know what you actually shipped.',
    description: 'Inspect the package and supported public assets your customers receive. Keep the result, the scope and the response together.',
    primary: { text: 'Start a scan', href: '/scan' }, secondary: { text: 'Read the quick start', href: '/docs/getting-started' },
    sections: [
      s('inspect', 'Start with the delivered bytes',
        p('Builds can include files that a repository review never saw. NoSpoilers inspects supported archives for source maps, credential patterns, internal files and other release exposure. Findings identify the rule and affected path so a team can review the actual package.'),
        p('A file upload is an individual check. It does not silently enable a monitor, execute your software or certify the whole application. ', link('See supported inputs and limits.', '/docs/supported-inputs')),
        capture('CAPTURE-WEB-PRODUCT-01')),
      s('evidence', 'A result you can return to',
        table(['Surface', 'What it tells you'], [
          ['Coverage', 'Connected sources, their configuration and recorded monitoring state.'],
          ['Releases', 'Saved attempts, findings, digests and the policy decision for particular bytes or a website check.'],
          ['Alerts', 'Persisted exposure-response work, with an assignee and response history.'],
          ['Proof', 'A signed record or explicitly shared summary of a scoped, dated result.'],
        ]),
        p('A later scan creates new evidence. Resolving an alert records a response; it does not edit an earlier report. A valid signature can authenticate an inconclusive or failed-policy record, not just a passing one.')),
      s('workflow', 'One practical review loop',
        steps(['Choose an authorised release surface and select the right workspace.'], ['Start a check, then inspect the saved result and its limitations.'], ['Remove unintended content, or request a justified, scoped exception where appropriate.'], ['Run a new check and compare its evidence. Enable supported monitoring deliberately.']),
        p(link('Explore use cases', '/use-cases'), ' or ', link('read how Coverage differs from Releases.', '/docs/coverage-and-releases'))),
      s('boundaries', 'Useful evidence, not an all-clear',
        warning('Keep the scope visible', 'A pass means the recorded checks satisfied the captured policy. It is not a penetration test, malware verdict, licence audit or guarantee that no sensitive information remains.'),
        p('Scanning requires sign-in and an active five-day trial or subscription, subject to limits. Anonymous intake stages an intent, not a free report. Deployment and live-provider readiness must be confirmed before an external evaluation. ', link('Read security and trust.', '/security'))),
    ],
  },
  {
    path: '/use-cases', eyebrow: 'Where NoSpoilers fits', title: 'Check the surface that leaves your control.',
    description: 'Use a bounded release check where packaging, publishing or deployment can expose something that should have stayed private.',
    primary: { text: 'Choose your first scan', href: '/scan' }, secondary: { text: 'Integration guide', href: '/integrations' },
    sections: [
      s('packages', 'Before publishing a package', p('Scan the built archive rather than assuming the repository tree matches the deliverable. Review source maps, environment files and unexpected internal artefacts, then rebuild and scan the new bytes.'), p(link('Package and artefact scanning', '/docs/artifact-scanning'), ' explains preparation, upload states and retained attempts.')),
      s('ci', 'At a release checkpoint in CI', p('Submit a packed file with a workspace scan token and wait for the saved outcome. A queued response is not a passing build check. Keep credentials in CI secrets and inspect inconclusive results rather than treating partial inspection as success.'), p(link('Use the API and CI guide.', '/docs/api-tokens-and-ci'))),
      s('websites', 'After a website deployment', p('Verify control of an HTTPS origin before scanning its supported same-origin assets. The configured URL and crawl limits define the scope. Manual checks and opt-in website schedules share the workspace allowance.'), p('This is not authenticated crawling, a whole-domain vulnerability assessment or native Vercel, Netlify or Cloudflare OAuth. ', link('Connect a website.', '/docs/website-scanning'))),
      s('response', 'During a release investigation', p('Open the exact saved result, assign supported alert response work and retain the explanation. An exception is acceptance of a bounded risk, not proof of remediation. A new passing result must come from a new qualifying check.'), p(link('Review results', '/docs/release-results'), ' and ', link('understand response history.', '/docs/alerts'))),
      s('evaluation', 'For a technical evaluation', p('Agree a small set of authorised release surfaces and observable success criteria. Measure time to the first saved result, explainability of findings, remediation/recheck and role isolation. Agree any contractual or operational requirements separately.'), p(link('Plan an enterprise evaluation.', '/enterprise'))),
    ],
  },
  {
    path: '/integrations', eyebrow: 'Connect deliberately', title: 'Integrations with clear boundaries.',
    description: 'These are implemented application paths, not a claim that every provider is configured or operationally verified on the host you use.',
    primary: { text: 'Read setup documentation', href: '/docs/github' }, secondary: { text: 'Discuss an evaluation', href: '/enterprise' },
    sections: [
      s('scan-inputs', 'Release and monitoring connections',
        table(['Connection', 'Implemented scope', 'Before relying on it'], [
          ['GitHub App', 'Workspace-bound installation, selected repository inventory and supported exposure/release events.', 'Organisation/workspace authority, GitHub approval, configured App and signed webhook completion.'],
          ['Package uploads and CI', 'Supported packed files through browser or bearer-token API; queued saved results.', 'Active entitlement, input limits, correct workspace and an operational worker.'],
          ['npm registry', 'Connected package metadata checks and supported registry tarball scanning.', 'Use the actual registry controls; this is separate from an uploaded package.'],
          ['Production websites', 'DNS/HTTPS ownership verification, bounded public-asset checks and independent website schedules.', 'Verify the exact origin; enable schedules explicitly and inspect due/failed states.'],
          ['Sentry / Bugsnag custody', 'Configured private-destination checks against recorded debug IDs or release-version evidence.', 'Credentials and matching identifiers; private custody does not remove a publicly served map.'],
        ]),
        p(link('GitHub setup', '/docs/github'), ' · ', link('Website setup', '/docs/website-scanning'), ' · ', link('CI reference', '/docs/api-tokens-and-ci'))),
      s('notifications', 'Response and notification connections',
        p('Independent website alerts have workspace email and Slack destinations, explicit test admission and retained delivery history. Slack requires an active trial or Team. Saving a destination does not send a test or prove delivery.'),
        p('Connection-backed notification settings also contain Jira, PagerDuty and SIEM paths. They remain separate from the independent website destination flow. Confirm plan, configuration, scope and a real delivery before using them in an evaluation.'),
        note('Configuration is not availability', 'A provider-enabled flag is configuration evidence, not proof of provider reachability, worker health or delivery. Provider acceptance is not proof that a recipient read a message.'),
        p(link('Configure notifications and interpret delivery states.', '/docs/notifications'))),
      s('planned', 'Not operational features of this offer',
        table(['Direction', 'Status'], [
          ['Google/Microsoft sign-in, enterprise SSO and SCIM', 'Provider/enterprise identity work remains deferred. Do not assume these login or provisioning methods.'],
          ['Native Vercel / Netlify / Cloudflare OAuth', 'Not an available native connection in this release. Verified website scanning is a different path.'],
          ['Public-key / Sigstore-style proof verification', 'Not the current HMAC receipt model.'],
          ['Dedicated workers, private networking and regional commitments', 'Evaluation requirements to agree, not included service guarantees.'],
        ]),
        p('Need a specific integration? ', link('Email the existing NoSpoilers contact', contactHref('NoSpoilers integration enquiry')), ' with the provider, required event and intended destination. Do not include credentials.')),
    ],
  },
  {
    path: '/security', eyebrow: 'Security and trust', title: 'Evidence with its limits attached.',
    description: 'Understand what NoSpoilers inspects, how evidence is separated from actions, and what still needs operational verification.',
    primary: { text: 'Read the proof guide', href: '/docs/proof' }, secondary: { text: 'Request an evaluation', href: '/enterprise' },
    sections: [
      s('scope', 'What a check establishes', p('A saved check records the inspected scope, engine and policy, time, digest where available, findings and outcome. Inconclusive inspection is not a pass. NoSpoilers does not execute customer package entry points or installation scripts as part of an archive check.'), warning('Not a security certification', 'A result is not a penetration test, complete vulnerability assessment, malware guarantee or certification. We do not claim SOC 2, ISO 27001, an independent penetration-test certificate or a contractual uptime target here.')),
      s('data', 'Bytes, credentials and retained evidence', p('Uploads use staging and worker processing; reports retain metadata needed to investigate results. Integration credentials are encrypted by the application, while scan tokens are stored as hashes and revealed only when minted. These controls do not, by themselves, establish encryption or deletion guarantees for every backup, host or third party.'), p('Do not include secrets in support requests or public shares. Review the actual redacted projection before publication. A downloaded full record can contain paths and manifest information even when matched credential values are omitted.'), p(link('Read proof sharing', '/docs/proof'), ' and ', link('retention and deletion requests.', '/docs/retention-and-deletion'))),
      s('access', 'Scope and authority', p('Workspace membership controls product access. GitHub installation approval is a separate boundary, and organisation billing authority is not the same as a workspace response role. Archived workspaces retain history while blocking new work according to the application rules.'), p('Exception requests derive their rule, path and source or digest from retained findings. A different administrator is required when the approval policy demands it. Decisions do not rewrite old evidence. ', link('Read roles and membership.', '/docs/workspaces-and-roles'))),
      s('verification', 'Operational evidence still matters', p('Implementation and local tests are not production acceptance. Worker isolation, deployment configuration, restoration, concurrency, provider integration and the remaining customer-flow checks require explicit verification before an external pilot. This website does not close those readiness gates.'), p('Hosting locations, subprocessors, support response times, a DPA and service objectives must be confirmed through reviewed procurement material. No residency or emergency-response commitment is implied.')),
      s('report', 'Report a security concern privately', p('Use ', link(WEBSITE_CONTACT, contactHref('NoSpoilers private security report')), '. Include the affected route or component, a non-sensitive reproduction and potential impact. Do not send live credentials or customer artefact contents. Ask for an agreed private transfer method when more evidence is necessary.'), p('This is an email link, not a monitored emergency channel or a guaranteed response-time service. Existing ', link('disclosure material', '/disclosure'), ' is labelled for review.')),
    ],
  },
  {
    path: '/enterprise', eyebrow: 'Enterprise evaluation', title: 'Evaluate the evidence. Agree the operating model.',
    description: 'Start with a focused technical evaluation rather than a promise of unverified enterprise controls.',
    primary: { text: 'Email an evaluation enquiry', href: contactHref('NoSpoilers enterprise evaluation') }, secondary: { text: 'Read security boundaries', href: '/security' },
    sections: [
      s('pilot', 'A measurable pilot',
        steps(['Choose two or three authorised release surfaces and identify a technical champion.'], ['Agree a baseline, expected outcomes and evidence to retain before any customer data is uploaded.'], ['Measure first saved result, finding explainability, remediation and recheck, CI adoption and workspace access boundaries.'], ['Review results and gaps with the decision-maker. Agree conversion criteria and any commercial terms separately.']),
        p('Example acceptance measures to agree: every submitted test artefact has a traceable saved outcome; no inconclusive run is reported as passed; a corrected build produces a new result without changing its predecessor; unauthorised users cannot read another workspace’s evidence.'),
        note('A proposal, not a guarantee', 'Pilot duration, response targets, environment, data handling and success thresholds must be agreed with the buyer. No standard service-level agreement or enterprise price is published here.')),
      s('requirements', 'Bring the requirements that matter',
        list(['Which formats, registries or website origins need inspection?'], ['Which team members need to read, respond, administer or approve exceptions?'], ['What retention, evidence-export, residency and procurement conditions are mandatory?'], ['Does the evaluation depend on SSO, SCIM or another feature not currently available?']),
        p('State mandatory requirements early. SSO, SCIM, custom-role systems and dedicated or regional infrastructure are not represented as operational features of the current application.')),
      s('contact', 'An available contact path',
        p('Email ', link(WEBSITE_CONTACT, contactHref('NoSpoilers enterprise evaluation')), ' with your organisation, use case, intended scope and evaluation requirements. Share only non-sensitive information.'),
        p('There is no website submission backend for evaluation requests in the inspected project. This page opens your email application and does not display a simulated confirmation, create a ticket or send anything automatically.')),
    ],
  },
  {
    path: '/support', eyebrow: 'Support', title: 'Find the next useful step.',
    description: 'Start with the state you can see: an upload, a connection, a saved result or a permission boundary.',
    primary: { text: 'Troubleshoot a problem', href: '/docs/troubleshooting' }, secondary: { text: 'Email support', href: contactHref('NoSpoilers support request') },
    sections: [
      s('start', 'New to NoSpoilers?', p(link('Your first scan', '/docs/getting-started'), ' walks through the existing public intake, sign-in, workspace selection and saved result. There is a five-day trial, not a permanent free scanner.'), p(link('Supported inputs and limits', '/docs/supported-inputs'), ' explains how to prepare a packed file. ', link('Connecting GitHub', '/docs/github'), ' and ', link('website verification', '/docs/website-scanning'), ' cover the two source-connection paths.')),
      s('common', 'When something does not complete',
        table(['What you see', 'What to do next'], [
          ['Queued or running', 'Reopen the existing attempt in Releases. Avoid submitting the same bytes again merely because the page was refreshed.'],
          ['Inconclusive', 'Read the reason and input limits. A timeout or partial inspection is not a passing result.'],
          ['Permission denied / unavailable', 'Check the selected workspace and your live role. Ask an authorised administrator; do not change IDs to bypass the boundary.'],
          ['Website verification failed', 'Use the exact current challenge on the exact hostname. Check TXT propagation or a direct HTTPS file response.'],
          ['Notification saved but not sent', 'Inspect provider configuration and use the explicit test action. Saved settings do not prove delivery.'],
          ['Trial ended', 'New scans require active coverage. Creating another workspace does not create another trial.'],
        ]),
        p(link('Open the troubleshooting guide', '/docs/troubleshooting'), ' or ', link('inspect the existing status page.', '/status'), ' A status response is not an uptime guarantee.')),
      s('contact', 'Send a useful, safe support request',
        p('The available contact is ', link(WEBSITE_CONTACT, contactHref('NoSpoilers support request')), '. Include the route, approximate time and time zone, non-sensitive error text, browser and whether you can reproduce the issue.'),
        p('Share an attempt or workspace reference only through a private support exchange. Do not email API tokens, verification challenges, signed-session cookies, full customer archives or sensitive findings.'),
        note('Email, not a simulated form', 'This link opens your email application. Nothing is submitted by the website, and no ticket, response time or resolution is promised.')),
      s('trust', 'Data and account questions', p('Disconnection, subscription cancellation and deletion review are different actions. A submitted review request is not a completed purge or account closure. ', link('Read the current lifecycle behaviour.', '/docs/retention-and-deletion')), p(link('Security and trust', '/security'), ' explains the scope of existing controls. Contract and policy pages remain review drafts until approved.')),
    ],
  },
];
export function findWebsitePage(path: string): WebsitePageContent | undefined {
  return WEBSITE_PAGES.find(page => page.path === path.replace(/\/+$/, ''));
}
