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
      "NoSpoilers is a GitHub App. It watches repository visibility and scans the packed bytes customers actually download: npm tarballs, zip, Electron asar, extensions (CRX, XPI, Chrome ZIP), Python wheels and sdists, jars, gems, images, mobile packages, and serverless zips. Secret scanners that only read git miss maps and .env files added at pack time.",
      "You pay for coverage on our servers, not a scan-credit meter. The CLI and GitHub Action on your machine keep working when hosted coverage ends. We never execute customer packages, installers, DEX, Mach-O, or lifecycle scripts. We never retain source after a scan. Findings name a path and a rule. They do not quote secrets.",
    ],
  },
  {
    heading: "Sign in and install",
    paragraphs: [
      "Sign in with GitHub OAuth, then install the App on a user or organization. Setup only links installs GitHub says you own for this App. Contents, Members, and Metadata read are enough for Watch. If GitHub shows Accept on the install page, the App already requested a permission that install has not taken. Watch Test install names that gap and links there. It does not ask for Administration or Workflows write. Optional Contents write, Pull requests write, and Checks write seed the throwaway fixture, commit a vendored Action, open setup/remediation PRs, and post hosted Checks. GitHub Actions workflow YAML stays copy-paste. Do not grant Administration. Administration is GitHub repo-admin (make-private, delete assets, disable workflows). Watch can confirm those three from the desk; they 409 with GitHub UI steps until Administration is granted. Contents write is not that permission. The App never merges a PR and never changes branch protection.",
      "Revoking the GitHub App authorization on GitHub drops every NoSpoilers session for that user and discards the stored OAuth token. Uninstalling the App is separate and stops hosted watching for that installation. Sign out deletes only this browser’s session.",
    ],
  },
  {
    heading: "GitHub Watch",
    paragraphs: [
      "Webhooks acknowledge HTTP 200 without unpacking. Work is queued and the worker wakes immediately. Light jobs cover private→public, born-public, transfer, collaborator added, fork, and cheap push hits on *.map / .env. Heavy jobs unpack GitHub Release packs when a release is published, and again when pack assets change. Unpublishing or deleting a release is an alert only; gone assets are not downloaded. If the user or org the App is installed on is renamed, Watch updates that account login in place. No extra job.",
      "An hourly poller re-checks visibility if a webhook was missed. It does not download every latest release every hour. Scan latest release unpacks that repository’s current Release pack, not the git tree. Watch Setup PR adds CI that lists each existing package.tgz and dist/ pack (cap 8), vendors a composite Action, and POSTs packed bytes to hosted /api/v1/scan. It fails closed if none exist. Source pushes are not unpacked. Contents write can commit the Action; the workflow YAML is copy-paste because the App does not request Workflows write. After you merge, mint a Watch token, set NOSPOILERS_API_URL from the origin Watch shows (GitHub-hosted runners cannot reach localhost) and NOSPOILERS_API_TOKEN, and mark the NoSpoilers check required if you want CI to block.",
    ],
  },
  {
    heading: "Packed scans",
    paragraphs: [
      "Drop a pack on Scan, publish a GitHub Release asset, watch an npm package, crawl an HTTPS origin, or POST /api/v1/scan with a hashed token. Classification uses magic bytes, not the extension alone. Nested archives unpack for inspection up to three levels. Encrypted zip, CRX without a ZIP payload, and encrypted image layers are inconclusive, never a passing receipt. Scan lists those three as fixtures. Python and extension workers are never executed. This repository’s GitHub Actions rebuilds fixtures, fail-closes every advertised dirty pack, treats inconclusive packs as not passing, and lets every clean pack pass. The GitHub Action itself is run on a clean pack (must pass) and a dirty pack (must fail closed). Customer Setup CI vendors a hosted-scan Action because this product repository is private.",
      "Check a signed receipt JSON on Scan without unpacking. The optional pack is hashed in the browser; those bytes are not uploaded. Watch lists the linked receipt status on Releases and downloads the signed JSON. An install admin can attach an HTTPS delivery URL and verify it now: we stream-hash the bytes against the sealed digest and delete the download. Cross-host redirects are not followed, except the GitHub Release download hop onto GitHub’s asset CDN (then DNS is checked again). Query strings never appear on Watch. This is not the hourly poller and not scheduled CDN verification. An authentic failed-policy or inconclusive receipt is not a clean bill of health and is not allowed to ship. The CLI is `npx nospoilers verify ./package.tgz --receipt receipt.json`. Coverage ended still allows the receipt check; attaching or verifying a remote URL needs coverage.",
      "Hard defaults: 80 MiB input, 500 MiB unpacked, 25,000 files, 25 MiB per file, 90 seconds. Hitting a limit is inconclusive. Bytes are deleted when the job finishes. Hosted scans from one address are rate-limited. Sign-in and internal discovery are rate-limited too. GitHub webhooks are not; they must stay 200 so deliveries retry.",
    ],
  },
  {
    heading: "Coverage",
    paragraphs: [
      "New installations start a 14-day full trial. Solo is $29 per month. Team is $99 per month. Yearly is 10 months for the price of 12. When the trial ends unpaid, GitHub still gets HTTP 200, but we do not enqueue hosted work, scan, poll, or alert for that installation.",
      "Trial and Team installs can invite a teammate by GitHub login. They get that role when they sign in, if GitHub already lists them on this App install. That does not send email. Email waits on Resend. It does not grant GitHub Administration. Hosted unpacks pause at a daily fair-use cap until 00:00 UTC. That is not a scan-credit purchase. The CLI and GitHub Action on your machine still work, and visibility alerts still run. Card checkout through Stripe is the intended billing path. It is not live yet. Email alerts wait on Resend. Slack, SIEM, and Jira Cloud destinations are live on trial and Team. Electron DMG/EXE/AppImage/MSI scanning stays on ice until an isolated worker exists. Formats are not advertised on Pricing until hostile fixtures and resource limits exist.",
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
