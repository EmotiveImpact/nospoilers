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
      "An hourly poller re-checks visibility if a webhook was missed. It does not download every latest release every hour. Scan latest release unpacks that repository’s current Release pack, not the git tree. Watch Setup PR adds CI that lists each existing package.tgz and dist/ pack (cap 8), vendors a composite Action, and POSTs packed bytes to hosted /api/v1/scan. It fails closed if none exist. Source pushes are not unpacked. Contents write can commit the Action; the workflow YAML is copy-paste because the App does not request Workflows write. Watch Setup status probes whether that Action and workflow exist and whether a NoSpoilers check ran. It never invents an alert and cannot see or set branch protection. After you merge, mint a Watch token, set NOSPOILERS_API_URL from the origin Watch shows (GitHub-hosted runners cannot reach localhost) and NOSPOILERS_API_TOKEN, and mark the NoSpoilers check required if you want CI to block.",
    ],
  },
  {
    heading: "Packed scans",
    paragraphs: [
      "Drop a pack on Scan, publish a GitHub Release asset, watch an npm package, crawl an HTTPS origin, or POST /api/v1/scan with a hashed token. These are different evidence sources for the same bounded scanner. Classification uses magic bytes, not the extension alone. Nested archives unpack for inspection up to three levels. A source map with sourcesContent is reconstructed as in-memory virtual source files so secret, private-key, credential, AI-context, internal-document, internal-route, and internal-location findings name the original path. Reconstructed source and matched values are never stored or logged. Website/map scans use the heavy queue, so bursts wait instead of reconstructing every customer map concurrently. Encrypted zip, CRX without a ZIP payload, and encrypted image layers are inconclusive, never a passing receipt. Scan lists those three as fixtures. Python and extension workers are never executed. This repository’s GitHub Actions rebuilds fixtures, fail-closes every advertised dirty pack, treats inconclusive packs as not passing, and lets every clean pack pass. The GitHub Action itself is run on a clean pack (must pass) and a dirty pack (must fail closed). Customer Setup CI vendors a hosted-scan Action because this product repository is private.",
      "Before automatic Production Web scans, an install admin proves hostname control with a generated DNS TXT record or exact HTTPS well-known file. Verified admins can mint a one-time deployment token, stored only as a hash, for POST /api/v1/deploy. Any deployment pipeline can send a provider name and unique deployment ID; duplicate deliveries do not create duplicate scans. Native Vercel, Netlify, and Cloudflare account connections are later convenience adapters over this same endpoint.",
      "Check a signed receipt JSON on Scan without unpacking. The optional pack is hashed in the browser; those bytes are not uploaded. Watch lists the linked receipt status, sealed size, and media type on Releases and downloads the signed JSON. Public GitHub Release download URLs and public npm tarball URLs are attached when we seal a revision. An install admin can attach another HTTPS delivery URL and verify it now: we stream-hash the bytes against the sealed digest and delete the download. The CLI can do the same from CI: `npx nospoilers verify --receipt receipt.json --url https://example.com/app.tgz`. Cross-host redirects are not followed, except the GitHub Release download hop onto GitHub’s asset CDN, a same-bucket S3 hop, or a same-account R2 hop (then DNS is checked again). Verify records hop hosts, a cache token, and a region when the host names one. Query strings never appear on Watch. This is not the hourly poller and not scheduled CDN verification. An authentic failed-policy or inconclusive receipt is not a clean bill of health and is not allowed to ship. Trial and Team admins can approve a passing revision to ship or reject it. The admin who attached a delivery URL cannot approve that revision. Legal hold keeps a revision listed after the retention window; another admin must release the hold. Members can export the ledger. Solo is 403. Unpaid is 402. An install admin can publish a verification page for a sealed revision. Visitors see digests, receipt status, and last delivery host match. Query strings, pack bytes, CI URLs, and signed URLs are omitted. Failed-policy is not clean. Solo may publish. Unpaid is 402. Unpublish hides the page. Trial and Team can refresh GitHub and npm attestation documents for a sealed digest. The adapter records presence, subject digest, and builder id. It does not verify Sigstore signatures and is not a malware verdict. Solo is 403. Unpaid is 402. A Team signing policy can require a present GitHub or npm document, or a builder prefix, before approve-to-ship. Expired policies do not block. This is not Sigstore verification. A local file is `npx nospoilers verify ./package.tgz --receipt receipt.json`. Coverage ended still allows the receipt check; attaching or verifying a remote URL on Watch needs coverage. The CLI does not.",
      "Hard defaults: 80 MiB input, 500 MiB unpacked, 25,000 files, 25 MiB per file, 90 seconds. Hitting a limit is inconclusive. Bytes are deleted when the job finishes. Hosted scans from one address are rate-limited. Sign-in and internal discovery are rate-limited too. GitHub webhooks are not; they must stay 200 so deliveries retry.",
    ],
  },
  {
    heading: "Coverage",
    paragraphs: [
      "New installations start a 14-day full trial. Solo is $29 per month. Team is $99 per month. Yearly is 10 months for the price of 12. When the trial ends unpaid, GitHub still gets HTTP 200, but we do not enqueue hosted work, scan, poll, or alert for that installation.",
      "Trial and Team installs can invite a teammate by GitHub login. They get that role when they sign in, if GitHub already lists them on this App install. That does not send email. Invites stay GitHub-login only. It does not grant GitHub Administration. Hosted unpacks pause at a daily fair-use cap until 00:00 UTC. That is not a scan-credit purchase. The CLI and GitHub Action on your machine still work, and visibility alerts still run. Card checkout through Stripe is wired: an install admin starts Checkout or the billing portal. It is live only when Stripe keys and Solo/Team price IDs are set. This host does not take cards until those keys exist. Failed payment or cancellation stops hosted work. Covered installs can save one Watch email destination (encrypted). Delivery is live only when Resend keys and a from address are set. This host does not send mail until those keys exist. Email alerts are not live yet. Slack, SIEM, Jira Cloud, and PagerDuty destinations are live on trial and Team. Electron DMG/EXE/AppImage/MSI scanning stays on ice until an isolated worker exists. The normal worker classifies those installer names and skips them. Formats are not advertised on Pricing until hostile fixtures and resource limits exist.",
    ],
  },
  {
    heading: "Package identity",
    paragraphs: [
      "Protect a watched npm package only after the npm scope or GitHub repository field matches this install. Naming an arbitrary pack is not ownership. Trial and Team installs can watch the npm scope that matches this GitHub login. New names on the public search are a Watch fact. The tarball is not downloaded and the name is not auto-watched. Watch shows a deterministic signal total for a protected pack, decomposed into those identity facts. It is not a malware verdict. Trial and Team admins can assemble a human-reviewed identity evidence pack and publish a consumer advisory page. Members may download the pack. The public page shows the package name, repository host, and registered lookalike names. It is not a malware verdict. NoSpoilers does not send the pack to npm or GitHub. Other registries stay out.",
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
