import { paragraph as p, note, warning, steps, list, table, link, section as s, capture, type Article } from "./model.ts";

export const START_ARTICLES: Article[] = [
  {
    slug: "getting-started", title: "Your first scan", group: "Start here",
    description: "Take a release from an upload to a saved result, without confusing a connection with a completed check.",
    keywords: ["quick start", "quickstart", "onboarding", "First Proof", "trial", "login", "package"],
    sections: [
      s("before-you-start", "Before you start",
        p("Use an artefact you own or are authorised to inspect. For a first evaluation, choose a small, representative release package with no live credentials. You need a signed-in NoSpoilers account, a workspace you can scan in and an active trial or subscription."),
        note("Five days to evaluate", "The trial lasts five days. There is no permanent free scanner. Public intake can stage a file before sign-in, but it does not run an anonymous scan or reveal findings. Workspace creation does not create another allowance or restart the trial."),
        p("The running service must have scanning enabled and a working worker. A configured screen is not proof of operational readiness; confirm evaluation access before uploading sensitive material.")),
      s("scan-a-package", "Scan a package",
        steps(
          ["Open ", link("Start a scan", "/scan"), ". Sign in when asked. Already signed in? Use ", link("New scan", "/watch/scan"), " in the application."],
          ["Check the selected workspace. Choose the package/build path and select the packed file that customers receive, rather than a source checkout."],
          ["Review the supported input and upload limit shown by the service. Submit once and follow the real transfer and queued/running states."],
          ["Open the saved attempt in ", link("Releases", "/watch/releases"), ". A finished upload is not a completed scan: wait for a saved result before making a release decision."],
          ["Read the decision, findings, scope, digest and recorded policy. Keep the result URL so you can reopen the same attempt."]),
        capture("CAPTURE-DOCS-FIRST-SCAN-01")),
      s("read-the-result", "Read the result before shipping",
        table(["What you see", "What to do"], [
          ["Policy passed", "Read the scope and any limitations. This is a decision about the inspected bytes under the recorded policy, not a security guarantee."],
          ["Hold / Review findings", "Open the relevant findings. Correct the package or follow the scoped exception process when accepting risk is appropriate."],
          ["Inconclusive", "Do not treat this as a pass. Read the reason, address the input or service limitation, then submit a new attempt."],
          ["Queued / Running", "Wait or reopen the same saved attempt. Refreshing a result is not a request to scan again."],
          ["Failed", "Read the failure guidance. Check the existing attempt before retrying an uncertain submission."]
        ]),
        p("A corrected upload creates new evidence. Resolving an Alert or approving an exception does not rewrite the original scan.")),
      s("choose-the-next-step", "Choose the next step",
        list(
          [link("Connect GitHub", "/docs/github"), " for authorised repository and release monitoring."],
          [link("Verify a website", "/docs/website-scanning"), " before inspecting its supported public assets."],
          [link("Use a scan token in CI", "/docs/api-tokens-and-ci"), " to submit the same packed bytes from your build pipeline."],
          [link("Understand Coverage and Releases", "/docs/coverage-and-releases"), " before enabling ongoing monitoring."]),
        warning("Something unavailable?", "Use ", link("Troubleshooting", "/docs/troubleshooting"), " for sign-in, permission, entitlement and worker checks. Do not keep submitting the same file to work around an unavailable service."))
    ]
  },
  {
    slug: "workspaces-and-roles", title: "Workspaces, membership and roles", group: "Start here",
    description: "Understand where evidence belongs, who can act on it and why GitHub access is a separate permission.",
    keywords: ["organisation", "organization", "team", "invite", "viewer", "administrator", "owner", "switch", "archive"],
    sections: [
      s("ownership", "A workspace is an evidence boundary",
        p("Your account belongs to workspaces through membership. A billing organisation owns the subscription and shared allowance; its workspaces contain sources, scans, Releases and Alerts. A workspace is not the same thing as a GitHub account or repository."),
        p("Use the workspace selector before starting work. Workspace links carry the selected identity so that a saved result can be reopened in its proper scope. An unavailable workspace is not permission to substitute another workspace."),
        note("One allowance, not one trial per workspace", "Additional workspaces share their organisation's entitlement and usage. Published workspace and seat limits should be confirmed for your evaluation; do not infer plan allowances from a creation control."),
        capture("CAPTURE-DOCS-WORKSPACE-01")),
      s("roles", "Choose the least authority needed",
        table(["Role", "Typical authority and important limits"], [
          ["Viewer", "Read authorised workspace evidence. Cannot start scans, respond to Alerts or manage settings."],
          ["Member", "Start permitted work and respond to Alerts in an active workspace. Not an administrator."],
          ["Administrator", "Manage supported workspace configuration, scan tokens and response workflows. Cannot manage owners or other administrators unless the owner rules allow it."],
          ["Owner", "Manage workspace administration and ownership. The last owner is protected against removal or demotion without another owner."]
        ]),
        p("Individual operations still check current membership, workspace state and any required entitlement. Organisation billing administration is separate from workspace administration. GitHub-side management or remediation requires the relevant GitHub authority as well.")),
      s("invite-a-teammate", "Invite a teammate",
        steps(
          ["Ask the person to sign in to NoSpoilers first. The current invitation flow looks up an existing account name, not an arbitrary email address."],
          ["Open ", link("Team & access", "/watch/team"), " in the intended workspace. Choose the account and role. Inviting teammates requires an active trial or Team subscription."],
          ["The recipient accepts the pending invitation while signed in as the intended account. Expired or revoked invitations cannot be accepted."],
          ["Check the resulting membership. Only a workspace owner can invite administrators or manage owner/administrator roles."]),
        p("Assignments and invitation ownership use stable internal account identities. Changing a display name is not an account transfer. Removing membership removes product access without erasing earlier actor attribution.")),
      s("connections-and-archive", "Connections and archived workspaces",
        p("Connecting GitHub grants source access through the GitHub App. It does not give every GitHub collaborator membership of the NoSpoilers workspace. Do not move a populated connection between organisations to work around an access problem."),
        p("Archiving preserves evidence and restricts new work. Some connected or legacy workspaces cannot be archived through the current transition path; follow the application's rejection rather than treating this as a deletion operation."),
        warning("Identity features are not interchangeable", "The current sign-in path is GitHub-based. Google/Microsoft sign-in, enterprise SSO, SCIM and custom-role programmes are not presented here as available. Confirm any enterprise identity requirement before an evaluation."))
    ]
  },
  {
    slug: "supported-inputs", title: "Supported inputs and limits", group: "Start here",
    description: "Choose a supported packed input and understand why a recognised extension is not proof that every byte was inspected.",
    keywords: ["formats", "size", "MiB", "80", "25", "zip", "tar", "Docker", "OCI", "APK", "limits", "unsupported"],
    sections: [
      s("input-families", "Supported packed input families",
        table(["Family", "Examples", "Inspection boundary"], [
          ["Archives and application bundles", "Tarballs, ZIP, Electron asar", "Packed content, with bounded extraction and per-file inspection."],
          ["Extensions", "VSIX, Chrome CRX/extension ZIP, Firefox XPI", "Archive contents. Extensions are not installed or executed."],
          ["Language packages", "Python wheel/sdist, JAR/WAR, NuGet nupkg/snupkg, Ruby gem", "Supported archive layouts, not a runtime or semantic audit of every language."],
          ["Container images", "Docker save tar, OCI archive", "Supported image layers and metadata. No container is started."],
          ["Mobile and serverless", "APK/XAPK/AAB, IPA, Lambda ZIP", "Packaged assets. No app installation, emulation or handler execution."]
        ]),
        p("Format recognition uses the content and supported layout, not only a filename extension. A renamed, encrypted, malformed or unsupported package may be rejected or inconclusive. Hosted scanning accepts a packed file, not a directory.")),
      s("upload-and-parser-budgets", "Upload and parser budgets",
        p("The authenticated hosted CLI accepts a file up to 80 MiB. Public staging has a separate, smaller limit. Read the current upload guidance from the running service: hosting ingress and configuration can impose a smaller limit than the scanner accepts."),
        table(["Scanner budget", "Current default"], [
          ["Packed input", "80 MiB"], ["Total unpacked bytes", "500 MiB"],
          ["Files", "25,000"], ["Single unpacked file", "25 MiB"], ["Inspection time budget", "90 seconds"]
        ]),
        p("Inspection also has separate unpacked-byte, file-count, individual-file and time budgets. Increasing compression or nesting archives does not remove these limits. A transfer accepted by the web server is not a promise that the entire archive can be analysed."),
        warning("A limit is not a clean result", "When inspection is partial or unsupported, review the inconclusive or failure reason. Never convert the absence of visible findings from an incomplete attempt into a release approval.")),
      s("what-is-inspected", "What a result can establish",
        p("The scanner looks for supported release-exposure patterns such as source maps, high-confidence credential material, internal files and related package content. Results record paths, rules, severity and available manifest/digest information."),
        p("This is not a malware execution service, penetration test, complete vulnerability assessment or guarantee that an artefact contains no sensitive information. A supported wrapper does not imply complete decompilation or inspection of all proprietary binary formats.")),
      s("prepare-the-input", "Prepare the input",
        steps(
          ["Build the release with your normal tooling. Choose the exact package you plan to distribute."],
          ["Check its compressed size and layout. Avoid including caches or unrelated build products just for convenience."],
          ["Submit through ", link("New scan", "/watch/scan"), " or the ", link("authenticated API", "/docs/api-tokens-and-ci"), ". Keep the original bytes locally for later digest verification."],
          ["Review any excluded, incomplete or unsupported scope before relying on the result."]),
        note("Website scans use another boundary", "A website check fetches supported same-origin assets within crawl limits. It is not an upload of your whole website and does not inspect every route. See ", link("Website ownership and scanning", "/docs/website-scanning"), "."))
    ]
  }
];
