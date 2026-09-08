import { paragraph as p, note, warning, steps, table, code, link, section as s, capture, type Article } from "./model.ts";

export const SCAN_ARTICLES: Article[] = [
  {
    slug: "github", title: "Connect GitHub", group: "Connect and scan",
    description: "Authorise a GitHub App installation, select its repositories and finish the connection in the intended workspace.",
    keywords: ["repository", "repositories", "installation", "webhook", "permissions", "sync", "connection"],
    sections: [
      s("requirements", "Before authorising GitHub",
        p("Choose the NoSpoilers workspace first. Starting a new connection requires organisation and workspace administration, plus the authority to authorise the GitHub App installation. Being able to read a GitHub repository is not necessarily installation-management authority."),
        p("The GitHub App, callback and signed webhook delivery must be configured on your NoSpoilers service. If connection is unavailable, check with the service operator rather than supplying a personal token in a support message.")),
      s("connect", "Connect and select repositories",
        steps(
          ["In ", link("New scan", "/watch/scan?mode=github"), " or ", link("Coverage", "/watch/sources"), ", select the intended workspace and choose Connect GitHub to this workspace."],
          ["On GitHub, authorise the correct account or organisation and choose the repositories the App may access. Grant only the intended scope."],
          ["Return to NoSpoilers in the same browser session and choose Finish connection. This verifies the installation approval and synchronises repository access."],
          ["If the page says the signed notification has not arrived, use Check again after delivery. Do not assume the source has been attached while it is waiting."],
          ["Review Coverage. Initial checks are queued within the existing allowance. A connected repository does not mean a release has already passed inspection."]),
        capture("CAPTURE-DOCS-GITHUB-01")),
      s("change-repositories", "Change repository access",
        p("Repository selection is controlled by the GitHub App installation. An authorised GitHub administrator changes that selection on GitHub. NoSpoilers processes repository-access events and retains disconnected repository history rather than silently deleting the old evidence."),
        p("Existing connections keep their workspace and history. Do not use a fresh-installation flow to relocate populated sources across organisations. NoSpoilers workspace membership and GitHub source authority remain separate.")),
      s("diagnose", "Diagnose an incomplete connection",
        table(["Symptom", "Check"], [
          ["Connection control unavailable", "Current organisation/workspace role, archived state and service GitHub configuration."],
          ["Waiting for signed notification", "Webhook delivery and callback ordering. Use the existing Check again control."],
          ["Wrong or missing repositories", "Selected GitHub account, installation repository selection and current App access."],
          ["Repositories visible, no result", "Queue/worker state, entitlement and whether the relevant release asset exists."],
          ["Expired or rejected handoff", "Restart the connection deliberately from the correct workspace in the same signed-in browser."]
        ]),
        warning("No automatic entitlement from GitHub", "A repository appearing in GitHub does not grant membership of a NoSpoilers organisation. Ask the correct workspace owner to grant access; do not attempt to switch tenant identifiers."))
    ]
  },
  {
    slug: "artifact-scanning", title: "Scan a package or build", group: "Connect and scan",
    description: "Inspect the distributed artefact, preserve its result and recheck corrected bytes as a new attempt.",
    keywords: ["package", "artifact", "artefact", "upload", "tarball", "npm", "build", "release", "progress", "cancel"],
    sections: [
      s("choose-the-bytes", "Choose the bytes that leave your build",
        p("Repository scans and packaged artefact scans answer different questions. A packaging step can add source maps, configuration or internal files after review. Select the exact supported file that will be distributed."),
        p("For an npm package, inspect the tarball produced by your normal package workflow. For other builds, use the supported archive that reaches customers. See ", link("Supported inputs and limits", "/docs/supported-inputs"), " before submitting.")),
      s("submit", "Upload and follow the attempt",
        steps(
          ["Open ", link("New scan", "/watch/scan?mode=package"), " and check the workspace. Choose the package/build input."],
          ["Select the file and submit once. Transfer progress describes bytes sent, not the percentage of security checks completed."],
          ["After admission, follow the saved queued or running attempt. Processing can continue after the upload finishes."],
          ["Open the completed result in Releases and review its scope, digest, findings and policy outcome."]),
        note("Stopping transfer is not cancelling a job", "The browser's stop-transfer action stops the upload. It cannot promise cancellation of work already accepted by the server. Check Releases before submitting again after a network interruption.")),
      s("repeat", "Recheck without rewriting history",
        p("Correct the release process, produce a new packed file and start a new scan. The earlier attempt remains evidence of the bytes and policy evaluated at that time. A passing replacement does not retroactively change the earlier result."),
        p("Store the saved result URL and original package in your own release process. The digest lets you compare an artefact with its recorded proof; matching a digest does not inspect those bytes again.")),
      s("one-off-versus-registry", "One-off upload or monitored registry?",
        p("A one-off upload creates a Release attempt. It does not enrol a registry package in ongoing Coverage. The current connected package controls can watch published npm packages; their metadata checks and actual tarball scans are separate events."),
        p("Registry checks depend on the source connection, configured access, allowance and worker. Other registry-related controls do not imply a universal package manager or a separate website OAuth integration."),
        p("For a build pipeline, use the ", link("token and CI guide", "/docs/api-tokens-and-ci"), ". Hosted clients submit the packed file to the authenticated scan API rather than obtaining an unrestricted local scanner."))
    ]
  },
  {
    slug: "website-scanning", title: "Verify and scan a website", group: "Connect and scan",
    description: "Prove control of an HTTPS origin, inspect supported public assets and opt into monitoring separately.",
    keywords: ["website", "domain", "DNS", "TXT", "HTTP", "verification", "origin", "daily", "schedule", "pause", "reconnect"],
    sections: [
      s("connect-origin", "Connect the exact origin",
        p("Open ", link("Coverage", "/watch/sources?configure=website"), " in the intended workspace. Under Production websites, enter the HTTPS website and choose Connect website. A website-only workspace does not need a fabricated GitHub installation."),
        p("The configured URL defines the scan target. Checks fetch supported same-origin assets within crawl limits; they are not whole-domain penetration tests and do not imply that every application route was visited.")),
      s("ownership", "Complete the ownership challenge",
        p("Use the challenge value generated for your source. The following uses a placeholder only; copy the exact live value from Coverage."),
        code("bash", "DNS TXT challenge shape", "# Name, for the example host app.example.com\n_nospoilers.app.example.com\n\n# Value: replace PLACEHOLDER with the challenge from Coverage\nnospoilers-verification=PLACEHOLDER"),
        p("Alternatively, serve that exact value as the body of the HTTPS verification file:"),
        code("bash", "HTTP verification location", "https://app.example.com/.well-known/nospoilers-verification.txt"),
        steps(
          ["Publish either the DNS TXT record or the HTTPS file for the exact host."],
          ["Choose Verify DNS or Verify HTTP file in Coverage."],
          ["Resolve any mismatch, private/reserved-host rejection, redirect or HTTP error. The HTTP challenge does not accept a redirect to a different location."],
          ["Confirm that the source is verified. Ownership verification is not a scan and does not create a clean release verdict."]),
        capture("CAPTURE-DOCS-WEBSITE-01")),
      s("run-check", "Start the check explicitly",
        p("Choose Scan website once verification succeeds. Follow View latest attempt to the persisted Release result. The result describes the assets retrieved for that attempt and its recorded outcome."),
        warning("Use only authorised targets", "Do not use the public intake to investigate someone else's site. Ownership and access are rechecked around the verification and scan lifecycle. A disconnected, paused, archived or otherwise ineligible source cannot be treated as authorised work.")),
      s("monitoring", "Opt into a schedule",
        p("In the independent website controls, Check schedule offers Manual only, Every 6 hours and Daily. Choose the cadence and Save schedule. Scheduling is off until you enable it and shares the workspace's scan allowance."),
        p("Next check due is a scheduling target, not a guaranteed start time or worker heartbeat. Due work runs on an eligible scheduler cycle. Delays, allowance limits and unavailable workers need investigation rather than a claim of healthy current coverage.")),
      s("lifecycle", "Pause, disconnect and reconnect",
        table(["Action", "Effect"], [
          ["Pause website", "Blocks new checks without deleting the source or saved evidence."],
          ["Resume website", "Restores eligible checking; still subject to verification, entitlement and scheduler state."],
          ["Disconnect website", "Requires the exact URL confirmation, stops monitoring and revokes deployment triggers. Saved results remain."],
          ["Reconnect website", "Retains source identity and history, but requires fresh ownership verification before scanning."]
        ]),
        p("Use Recent source activity to inspect supported lifecycle events. A source action does not resolve old exposure Alerts or alter a prior report."))
    ]
  }
];
