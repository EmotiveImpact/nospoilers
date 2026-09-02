import { SUPPORT_EMAIL } from "./legal.ts";

export type DocsSection = {
  heading: string;
  paragraphs: string[];
};

export const DOCS_PATH = "/docs";

export const DOCS_TITLE = "Docs";

export const DOCS_KICKER = "How NoSpoilers works";

export const DOCS_SECTIONS: DocsSection[] = [
  {
    heading: "What it is",
    paragraphs: [
      "NoSpoilers is a GitHub App. It watches repository visibility and scans the packed bytes customers actually download: npm tarballs, zip, Electron asar, extensions, wheels, jars, gems, images, mobile packages, and serverless zips. Secret scanners that only read git miss maps and .env files added at pack time.",
      "You pay for coverage on our servers, not a scan-credit meter. The CLI and GitHub Action on your machine keep working when hosted coverage ends. We never execute customer packages, installers, DEX, Mach-O, or lifecycle scripts. We never retain source after a scan. Findings name a path and a rule. They do not quote secrets.",
    ],
  },
  {
    heading: "Sign in and install",
    paragraphs: [
      "Sign in with GitHub OAuth, then install the App on a user or organization. Setup only links installs GitHub says you own for this App. Contents, Members, and Metadata read are enough for Watch. Optional Contents write, Pull requests write, and Checks write open setup/remediation PRs and hosted Checks. Do not grant Administration. The App never merges a PR and never changes branch protection.",
      "Revoking the GitHub App authorization on GitHub drops every NoSpoilers session for that user and discards the stored OAuth token. Uninstalling the App is separate and stops hosted watching for that installation. Sign out deletes only this browser’s session.",
    ],
  },
  {
    heading: "GitHub Watch",
    paragraphs: [
      "Webhooks acknowledge HTTP 200 without unpacking. Work is queued and the worker wakes immediately. Light jobs cover private→public, born-public, transfer, collaborator added, fork, and cheap push hits on *.map / .env. Heavy jobs unpack GitHub Release packs when a release is published, and again when pack assets change. Unpublishing or deleting a release is an alert only; gone assets are not downloaded. If the user or org the App is installed on is renamed, Watch updates that account login in place. No extra job.",
      "An hourly poller re-checks visibility if a webhook was missed. It does not download every latest release every hour. Scan latest release unpacks that repository’s current Release pack, not the git tree. Watch Setup PR adds CI that scans each existing package.tgz and dist/ pack (cap 8) and fails closed if none exist. Source pushes are not unpacked. After you merge, mark the NoSpoilers check required if you want CI to block.",
    ],
  },
  {
    heading: "Packed scans",
    paragraphs: [
      "Drop a pack on Scan, publish a GitHub Release asset, watch an npm package, crawl an HTTPS origin, or POST /api/v1/scan with a hashed token. Classification uses magic bytes, not the extension alone. Nested archives unpack for inspection up to three levels. Encrypted zip, CRX without a ZIP payload, and encrypted image layers are inconclusive, never a passing receipt.",
      "Check a signed receipt JSON on Scan without unpacking. The optional pack is hashed in the browser; those bytes are not uploaded. Watch lists the linked receipt status on Releases and downloads the signed JSON. An authentic failed-policy or inconclusive receipt is not a clean bill of health and is not allowed to ship. The CLI is `npx nospoilers verify ./package.tgz --receipt receipt.json`. Coverage ended still allows this check.",
      "Hard defaults: 80 MiB input, 500 MiB unpacked, 25,000 files, 25 MiB per file, 90 seconds. Hitting a limit is inconclusive. Bytes are deleted when the job finishes. Hosted scans from one address are rate-limited. Sign-in and internal discovery are rate-limited too. GitHub webhooks are not; they must stay 200 so deliveries retry.",
    ],
  },
  {
    heading: "Coverage",
    paragraphs: [
      "New installations start a 14-day full trial. Solo is $29 per month. Team is $99 per month. Yearly is 10 months for the price of 12. When the trial ends unpaid, GitHub still gets HTTP 200, but we do not enqueue hosted work, scan, poll, or alert for that installation.",
      "Card checkout through Stripe is the intended billing path. It is not live yet. Email alerts wait on Resend. Slack, SIEM, and Jira Cloud destinations are live on trial and Team. Electron DMG/EXE/AppImage/MSI scanning stays on ice until an isolated worker exists. Formats are not advertised on Pricing until hostile fixtures and resource limits exist.",
    ],
  },
  {
    heading: "Help",
    paragraphs: [
      `Public status is /status (liveness only, no tenant data). Privacy, Terms, Retention, Disclosure, Support, and Refunds are linked in the footer. Contact ${SUPPORT_EMAIL}.`,
    ],
  },
];

export function docsText(): string {
  return DOCS_SECTIONS.flatMap((section) => section.paragraphs).join("\n");
}
