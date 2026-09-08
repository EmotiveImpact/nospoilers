export const SUPPORT_EMAIL = "emotiveimpact@gmail.com";
export const OPERATOR_NAME = "Emotive Impact";
export const LEGAL_EFFECTIVE = "1 September 2026";

export type LegalSlug =
  | "privacy"
  | "terms"
  | "retention"
  | "disclosure"
  | "support"
  | "refunds";

export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

export type LegalDoc = {
  slug: LegalSlug;
  path: string;
  title: string;
  kicker: string;
  sections: LegalSection[];
};

export const LEGAL_NAV: { href: string; label: string; slug: LegalSlug }[] = [
  { href: "/privacy", label: "Privacy", slug: "privacy" },
  { href: "/terms", label: "Terms", slug: "terms" },
  { href: "/retention", label: "Retention", slug: "retention" },
  { href: "/disclosure", label: "Disclosure", slug: "disclosure" },
  { href: "/support", label: "Support", slug: "support" },
  { href: "/refunds", label: "Refunds", slug: "refunds" },
];

const PRIVACY: LegalDoc = {
  slug: "privacy",
  path: "/privacy",
  title: "Privacy",
  kicker: "What we hold",
  sections: [
    {
      heading: "Who we are",
      paragraphs: [
        `${OPERATOR_NAME} operates NoSpoilers. Contact ${SUPPORT_EMAIL}. GitHub login EmotiveImpact.`,
        "NoSpoilers is a GitHub App that watches repository visibility and scans packed release artifacts (npm tarballs, zip, Electron asar) for source maps, secrets, and related spoilers. This notice covers the hosted product at the application origin you signed in on.",
      ],
    },
    {
      heading: "What we collect",
      paragraphs: [
        "GitHub account identifiers needed to sign you in: user id, login, and avatar URL. Installation id, account login, account type, and repository metadata (id, owner, name, visibility, HTML URL).",
        "Job and alert metadata: kind, title, body, finding path/rule/fingerprint counts, GitHub delivery id, timestamps. Coverage fields on the installation billing account (trial end, plan name). Session cookies that keep you signed in.",
        "If you upload a pack through Scan, we process the file in memory or on temporary worker disk for that request. Anonymous Scan is size-limited and rate-limited. Checking a signed receipt on Scan posts the JSON (and an optional pack SHA-256 hashed in your browser). Pack bytes are not uploaded for that check. Sign-in and owner discovery are rate-limited per address. GitHub webhooks are not rate-limited. Hosted latest-release scans download the release asset the same way.",
        "If you connect map custody, we store an encrypted Sentry or Bugsnag token, the public host, and org/project slugs. After a website or npm scan we keep debug IDs and release names only. We look up whether the private service has that identifier. We do not download map files or store sourcesContent.",
      ],
    },
    {
      heading: "What we never keep",
      paragraphs: [
        "We never retain customer source after a scan. Packed bytes are deleted when the job finishes, including on error. We never store credential values in reports, alerts, or the database. Findings name a path and a rule. They do not quote the secret.",
        "We do not sell personal data. We do not use your repositories to train a public model. Employee monitoring is not part of this product.",
      ],
    },
    {
      heading: "Cookies",
      paragraphs: [
        "A signed session cookie (`ns_session`) identifies your browser after GitHub OAuth. On https origins the cookie is marked Secure. We do not set advertising cookies.",
      ],
    },
    {
      heading: "Processors",
      paragraphs: [
        "GitHub is the identity provider and the source of webhook and API events. Application data lives in Neon Postgres (AWS us-east-2) when the hosted runtime is on Neon. When card billing ships, Stripe will process payments. We do not put artifact source in those systems.",
      ],
    },
    {
      heading: "Your choices",
      paragraphs: [
        `Uninstall the GitHub App to stop hosted watching for that installation. Sign out to drop this browser’s session. Revoking the GitHub App authorization on GitHub drops every NoSpoilers session for that user and discards the stored GitHub OAuth token; the installation stays until you uninstall it. Email ${SUPPORT_EMAIL} to ask what we hold for your login or to request deletion of account rows we can lawfully remove.`,
      ],
    },
  ],
};

const TERMS: LegalDoc = {
  slug: "terms",
  path: "/terms",
  title: "Terms",
  kicker: "The contract",
  sections: [
    {
      heading: "The service",
      paragraphs: [
        "NoSpoilers provides hosted GitHub visibility alerts and hosted scans of packed artifacts, plus a CLI and GitHub Action you can run on your own machines. You pay for coverage on our servers, not a scan-credit meter.",
        "The CLI on your laptop is a bonus with a paid plan. We do not pretend we can DRM a file on your disk. When hosted coverage ends, hosted jobs and alerts stop. The CLI you already downloaded keeps running.",
      ],
    },
    {
      heading: "Accounts and GitHub",
      paragraphs: [
        "You sign in with GitHub OAuth and install the NoSpoilers GitHub App on repositories you are allowed to grant. You must not link an installation you do not own. Setup checks that the signed-in user actually owns that install on this App.",
        "You are responsible for the GitHub permissions you grant. Least privilege is contents, members, and metadata read unless you later opt into a higher-permission action and confirm it.",
      ],
    },
    {
      heading: "Coverage, trial, and unpaid installs",
      paragraphs: [
        "New installations start a 5-day full trial. Solo is $29 per month. Team is $99 per month. Yearly is 10 months for the price of 12. Fair use lives in these terms: we cap concurrent unpacks, not a visible scan counter. Abuse may be queued or moved to Team.",
        "When the trial ends unpaid, or a paid plan lapses, we still acknowledge GitHub webhooks with HTTP 200 so deliveries stay healthy, but we do not enqueue hosted work, scan, poll, or alert for that installation. Watch will tell you to subscribe to keep watching.",
        "Card checkout through Stripe on our site is the billing path. An install admin starts Checkout or the billing portal. Checkout is live only when Stripe keys are configured. GitHub Marketplace is optional later; it is not the only way we will charge.",
      ],
    },
    {
      heading: "Acceptable use",
      paragraphs: [
        "Scan artifacts you own or are authorized to inspect. Do not use the hosted product to attack systems, exfiltrate other people's source, or bypass GitHub access controls. Do not upload malware for execution; we do not execute customer packages, installers, or lifecycle scripts.",
        "Hard scanner defaults apply: 80 MiB input, 500 MiB unpacked, 25,000 files, 25 MiB per file, 90 seconds. Hitting a limit is a failed or incomplete scan, not a clean bill of health.",
      ],
    },
    {
      heading: "No warranty",
      paragraphs: [
        "We try to catch source maps, high-confidence secrets, and visibility changes. We do not promise every leak is found. A passing scan is not insurance, a penetration test, or legal advice.",
      ],
    },
    {
      heading: "Liability",
      paragraphs: [
        `To the extent law allows, ${OPERATOR_NAME}'s liability for the hosted service is limited to the fees you paid us for coverage in the three months before the claim. We are not liable for lost profits, lost source, or incidental damages. Some places do not allow those limits; then they apply only as far as local law permits.`,
      ],
    },
  ],
};

const RETENTION: LegalDoc = {
  slug: "retention",
  path: "/retention",
  title: "Retention",
  kicker: "How long data lives",
  sections: [
    {
      heading: "Packed bytes",
      paragraphs: [
        "Release assets and uploads exist on temporary worker disk only for the scan. They are deleted in a finally path. The database is not an archive of customer source. Packed formats include npm tarballs, zip, VSIX, Python wheels, JAR/WAR, NuGet packages, Chrome/Firefox extensions, Ruby gems, Docker/OCI image archives, Android APK/AAB, iOS IPA, serverless Lambda/Azure Functions/Netlify/Vercel zips, and Electron asar. Encrypted zip, CRX wrappers without a ZIP payload, and encrypted image layers are inconclusive, never a passing receipt. Overlay whiteouts are not applied; lower-layer files stay inspected. Image signatures, APK Signature Scheme v1–v4, Play App Signing, and Apple code signatures are not verified or executed. FairPlay-encrypted Mach-O is not decrypted. DEX, native libraries, Mach-O, and serverless handlers are never executed. Installers (DMG/EXE/MSI/AppImage) are not scanned in this worker. Watched production websites fetch HTML plus same-origin JavaScript, CSS, maps, and a bounded probe of exposed files, credentials, and internal paths linked from the page; those bytes are deleted after the scan. Local, private, and metadata hosts are blocked. Map custody stores encrypted Sentry/Bugsnag tokens plus debug IDs and release names from watched scans. It never downloads or keeps map source.",
      ],
    },
    {
      heading: "Findings and alerts",
      paragraphs: [
        "Saved findings, alerts and release evidence remain available to authorised workspace members after GitHub is disconnected. Each install can set a list window of 90 days (default), 180 days, 365 days, or all retained history. Lists hide older rows at query time; shortening this window does not delete evidence. Append-only evidence cannot be rewritten through ordinary workspace actions. Disconnecting stops monitoring and revokes scan-token access. It does not delete history or cancel the organisation subscription.",
      ],
    },
    {
      heading: "Account, GitHub, and billing rows",
      paragraphs: [
        "GitHub connection state, workspace evidence and organisation billing are separate. Uninstall marks the connection inactive while retaining its history and billing records. Closing a personal account must not silently delete a shared organisation’s evidence. Encrypted GitHub OAuth tokens and integration credentials are governed separately from saved scan findings.",
      ],
    },
    {
      heading: "Public research scans",
      paragraphs: [
        "Internal public-artifact research, when it runs, keeps metadata only. It does not clone source, keep bytes, or store secret values. That desk is not a customer feature.",
      ],
    },
    {
      heading: "Deletion",
      paragraphs: [
        `Permanent history deletion requires a separate, explicit authorisation from the organisation owner, including when account closure is requested. The affected scope must be identified and confirmed in writing; signing out, disconnecting GitHub or cancelling a subscription is not deletion authorisation. Contact ${SUPPORT_EMAIL} to request account closure or deletion review. A request is not confirmation that deletion has completed. We must check shared ownership, applicable retention obligations and legal holds before processing it. GitHub controls its own retained copies.`,
      ],
    },
  ],
};

const DISCLOSURE: LegalDoc = {
  slug: "disclosure",
  path: "/disclosure",
  title: "Responsible disclosure",
  kicker: "How to tell us",
  sections: [
    {
      heading: "Vulnerabilities in NoSpoilers",
      paragraphs: [
        `If you find a security issue in this product, email ${SUPPORT_EMAIL} before filing a public issue. Include enough to reproduce. Do not include customer source or live credential values. Do not run destructive tests against the production database or other tenants.`,
        "There is no public bug-bounty program yet. We will acknowledge mail we can act on. We do not offer payment unless we write that down later.",
      ],
    },
    {
      heading: "Leaks in other people's packages",
      paragraphs: [
        "NoSpoilers exists because packed maps and secrets ship. If we find a critical issue in a public artifact, contact is private and human. We do not automatically email maintainers, publish a prospect list, or dump source.",
        "Do not use Watch or Scan as a public shaming feed. Responsible disclosure stays private until the maintainer has a chance to fix.",
      ],
    },
  ],
};

const SUPPORT: LegalDoc = {
  slug: "support",
  path: "/support",
  title: "Support",
  kicker: "How to reach us",
  sections: [
    {
      heading: "Contact",
      paragraphs: [
        `Email ${SUPPORT_EMAIL}. The operator GitHub login is EmotiveImpact. There is no 24/7 on-call and no public Enterprise SLA.`,
      ],
    },
    {
      heading: "What we can help with",
      paragraphs: [
        "GitHub App install, Watch alerts that should have fired, hosted scan failures, trial and coverage state, and deletion requests. CLI and Action issues on your machine are in scope when you can share a pack you are allowed to send — never paste secrets.",
        "Custom domains are not live yet. Email delivery is live only when Resend keys are set. Stripe checkout is live only when keys are configured. If you write about a host that cannot charge or send mail, you will get an honest “not live” rather than a fake ticket number.",
      ],
    },
    {
      heading: "Coverage vs the CLI",
      paragraphs: [
        "Hosted scanning and monitoring stop when coverage ends. Existing receipts remain verifiable. If Watch says subscribe, that is enforcement, not an outage.",
      ],
    },
  ],
};

const REFUNDS: LegalDoc = {
  slug: "refunds",
  path: "/refunds",
  title: "Refunds",
  kicker: "Money back",
  sections: [
    {
      heading: "Trial",
      paragraphs: [
        "The 5-day trial is full coverage. Card-on-file checkout is not live yet, so there is nothing to refund for a trial that never charged a card.",
      ],
    },
    {
      heading: "When card billing is live",
      paragraphs: [
        "Monthly Solo and Team subscriptions can be cancelled at any time. Cancellation stops later renewals. The current paid month is not pro-rated except where law requires it.",
        "Yearly plans (10 months for the price of 12) may be refunded in full if you ask within 14 days of the first charge and have not used hosted scanning in a way that makes a refund unreasonable. After that, unused yearly time is not refunded except where law requires it.",
        "Failed payments and cancellations stop hosted work for that GitHub installation the same way an unpaid trial does. Chargebacks may end coverage immediately.",
      ],
    },
  ],
};

export const LEGAL_PAGES: Record<LegalSlug, LegalDoc> = {
  privacy: PRIVACY,
  terms: TERMS,
  retention: RETENTION,
  disclosure: DISCLOSURE,
  support: SUPPORT,
  refunds: REFUNDS,
};

export function legalSlugFromPath(path: string): LegalSlug | null {
  const clean = path.replace(/\/$/, "") || "/";
  const hit = LEGAL_NAV.find((item) => item.href === clean);
  return hit?.slug ?? null;
}
