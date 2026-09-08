import { paragraph as p, note, warning, steps, table, link, mono, section as s, capture, type Article } from "./model.ts";

export const REVIEW_ARTICLES: Article[] = [
  {
    slug: "coverage-and-releases", title: "Coverage and individual Releases", group: "Review and respond",
    description: "Separate what is monitored now from what a particular check established at a recorded time.",
    keywords: ["monitoring", "cadence", "freshness", "source", "next check", "stale", "overview", "history"],
    sections: [
      s("two-questions", "Two surfaces, two different questions",
        table(["Surface", "Question it answers"], [
          ["Coverage", "Which sources are connected, what is their scope and what is the state of checking?"],
          ["Releases", "What happened in this particular attempt, against these bytes and this policy?"],
          ["Alerts", "What exposure-response work is open, in progress or resolved?"],
          ["Overview", "What workspace activity and next actions should I inspect?"]
        ]),
        p("A one-off package upload is a Release, not automatic monitoring. A connection without a result is not proof of a successful scan. Resolving response work changes neither of those facts.")),
      s("read-coverage", "Read source health carefully",
        p("Open ", link("Coverage", "/watch/sources"), " to inspect the exact source and connection, recorded check times, cadence and available next action. GitHub repository visibility, npm metadata, website assets and private map custody have different scopes."),
        p("For packages and connected websites, a metadata/check timestamp may differ from the last artefact-scan timestamp. A recent metadata check must not be read as a new passing artefact result."),
        capture("CAPTURE-DOCS-COVERAGE-01")),
      s("cadence", "Cadence is not a delivery guarantee",
        p("Connected-source cadence expresses configured polling intent. An unknown next-dispatch time is intentionally unknown; do not calculate a guaranteed next scan from an old result. Independent website schedules separately record their next due time."),
        warning("Old passing evidence can coexist with delayed monitoring", "If checking is delayed, unavailable or unknown, inspect the connection and service state. A previously passing Release is a historical result, not proof of healthy current monitoring."),
        p("Pause, reconnect and scheduling controls differ by source type. Follow the controls and explanations available for that source. Do not assume independent-website lifecycle controls also exist for every registry or custody connection.")),
      s("follow-evidence", "Follow evidence without creating work",
        p("Use the saved attempt or Release link to inspect a result. A read, refresh, filter change or proof-verification action does not itself request a new scan. Choose a scan or recheck action explicitly to create new evidence."),
        p("The ", link("Release results guide", "/docs/release-results"), " explains outcomes and immutable history. The ", link("website guide", "/docs/website-scanning#monitoring"), " explains opt-in website schedules."))
    ]
  },
  {
    slug: "release-results", title: "Release results and findings", group: "Review and respond",
    description: "Interpret the decision, investigate findings and keep incomplete work distinct from a passing policy result.",
    keywords: ["Hold", "policy passed", "failed-policy", "inconclusive", "findings", "digest", "manifest", "release detail", "receipt"],
    sections: [
      s("open-a-result", "Open the exact saved result",
        p("Open ", link("Releases", "/watch/releases"), ", select an attempt to inspect its preview and open full detail deliberately. Keep the result URL: uploaded and website attempts carry their stable saved ID and workspace scope."),
        p("A result that is unavailable, outside your workspace or outside retained visibility must not be replaced with a different result. Ask an administrator to check access and retention rather than changing identifiers in the URL."),
        capture("CAPTURE-DOCS-RELEASE-01")),
      s("outcomes", "Interpret the decision",
        table(["Outcome", "Meaning"], [
          ["Queued / Running", "Work is not complete. There is not yet a final release decision."],
          ["Failed", "The attempt could not complete successfully. Inspect the failure and retry guidance."],
          ["Inconclusive", "The engine could not establish a complete answer for the requested scope. This is not a pass."],
          ["Hold / Review findings", "The recorded findings do not satisfy the evaluated policy."],
          ["Policy passed", "The inspected scope satisfied the policy captured for that attempt."],
          ["Policy passed with exceptions", "The recorded policy suppressed matching findings. Read the exception evidence and accepted risk."]
        ]),
        note("Job status and scan verdict differ", "For API consumers, ", mono("done"), " means processing completed. Inspect the report's ", mono("status"), " and ", mono("ok"), " fields as well. Engine outcomes include ", mono("passed"), ", ", mono("failed-policy"), " and ", mono("inconclusive"), ".")),
      s("findings", "Investigate a finding",
        steps(
          ["Read the rule, severity, exact path and explanation. Use the finding categories as filters, not separate scan modes."],
          ["Check whether the finding is part of the recorded inspected scope and whether the report is incomplete."],
          ["Fix the release or begin a justified, scoped exception request when accepting the risk is appropriate."],
          ["Build and scan again to obtain new evidence. Do not edit a saved report to make a release pass."]),
        p("Findings are evidence, not executable remediation instructions. Treat file paths and retained metadata as potentially sensitive even when matched credential values are not displayed.")),
      s("provenance", "Read the provenance and limitations",
        p("Review the available digest, engine version, scan time, policy hash, manifest and suppression snapshot. These describe the recorded attempt, not today's mutable settings. Some historical hosted records do not retain full private finding details; missing evidence is explicitly unavailable, not reconstructed."),
        warning("A pass has a boundary", "No result establishes complete application security. Unsupported formats, excluded assets, crawl limits and incomplete inspection must remain visible in your release decision."),
        p("For signed records and shared links, read ", link("Proof and verification", "/docs/proof"), "."))
    ]
  },
  {
    slug: "alerts", title: "Alerts, assignment and response history", group: "Review and respond",
    description: "Record a human response to exposure without rewriting the evidence that produced it.",
    keywords: ["triage", "resolve", "reopen", "acknowledge", "Open", "In progress", "Resolved", "assignee", "history"],
    sections: [
      s("queues", "Use the three response queues",
        p("Open ", link("Alerts", "/watch/alerts"), " in the selected workspace. Open, In progress and Resolved are separate queues. Assignment is a separate filter, so an assigned item can still be open or in progress."),
        p("Independent website checks with findings can create persisted Alerts linked to the exact saved attempt. Ordinary uploaded packages produce scan evidence, not automatic ongoing exposure Alerts."),
        capture("CAPTURE-DOCS-ALERTS-01")),
      s("respond", "Acknowledge, assign and resolve",
        steps(
          ["Select an Alert and wait for its detail to load. Do not act from stale list text when the selected detail is unavailable."],
          ["Acknowledge it to move response work into In progress. Assign an eligible workspace member or explicitly clear assignment."],
          ["Investigate the linked evidence. Record a meaningful resolution note when resolving the Alert."],
          ["Reopen when further response work is needed. Inspect the response history to see recorded actor and action details."]),
        p("The current picker uses stable member identities and excludes viewers as assignees. Viewers can read authorised history but cannot respond. Archived workspaces retain readable evidence while blocking response mutations.")),
      s("recheck", "Recheck is a separate action",
        p("A supported website recheck creates a new attempt for the stored source. Repository-backed release Alerts use the existing latest-release recheck where supported. Other kinds may direct you to Coverage rather than offering an invented operation."),
        warning("Resolved does not mean technically remediated", "Resolving an Alert records your response decision. It does not remove a public file, rewrite the original report, approve an exception or turn the original package clean. A later scan also does not silently resolve the earlier Alert.")),
      s("history", "Review and export the right scope",
        p("Alert lists and long activity histories are paginated. Older/Newest list controls and Older/Latest activity controls refer to different histories. Keep the selected URL when sharing with an authorised teammate."),
        p("Export this page exports the current page and its scope/filter information, not every Alert in the organisation. It does not make private evidence public. Check access and redact sensitive paths before sharing outside your workspace."))
    ]
  },
  {
    slug: "policies-and-exceptions", title: "Policies and scoped exceptions", group: "Review and respond",
    description: "Understand which policy governs an attempt and how an approved exception affects future checks, not old evidence.",
    keywords: ["strict", "allowlist", "approval", "separation of duties", "expiry", "revoke", "suppression", "risk"],
    sections: [
      s("policy-scope", "Choose the correct policy scope",
        p("Open ", link("Policy", "/watch/policy"), " in the intended workspace. Independent artefact and website attempts use workspace policy. Connected GitHub/source work retains separately labelled connected policy controls. Do not assume one setting automatically governs every source type."),
        p("Strict policy can make warning findings fail policy. The policy and eligible exceptions are captured for a new scan; changes made while inspection runs should be evaluated by subsequent attempts rather than rewriting the in-flight snapshot.")),
      s("request", "Request from saved evidence",
        steps(
          ["Open the saved Release finding and use its exception-request entry point. Supported uploads and retained hosted evidence provide the exact parent reference."],
          ["Enter a meaningful justification and a future expiry. Read the displayed time zone; date-only requests use the interface's end-of-day UTC guidance."],
          ["Submit the request and follow its Policy review link. Requested is not approved."],
          ["An eligible administrator reviews the immutable rule/path and artefact-digest or website-source scope before deciding."]),
        note("Scope comes from the finding", "A request is bound to saved evidence. It is not an unbounded instruction to ignore a rule across all assets. Missing historical finding detail cannot be replaced with a guessed scope."),
        capture("CAPTURE-DOCS-EXCEPTION-01")),
      s("independent-approval", "Respect independent approval",
        p("When different-administrator approval is required, the requester cannot approve their own request. Request-time and current policy requirements are checked. A missing eligible approver is a blocked review workflow, not permission to bypass it."),
        p("Pending, rejected, revoked or expired requests are not active suppression. Current membership, authority and workspace state are rechecked for decisions. Existing legacy allowlists and their revocation history remain distinct from new evidence-bound requests.")),
      s("effect", "Understand the effect on a scan",
        p("An approved, unexpired, matching exception can suppress its finding during a future scan under the relevant policy. The result retains suppressed-finding evidence and can show Policy passed with exceptions."),
        warning("Accepting risk is not fixing exposure", "Approval does not remove the file, resolve its Alert or alter any saved receipt. Revocation and expiry likewise do not rewrite older results. Recheck corrected bytes explicitly."),
        p("Use the request history to inspect requester, decision, justification, scope and expiry. Do not assume custom roles, policy inheritance or enterprise provisioning are available because basic approvals exist."))
    ]
  },
  {
    slug: "proof", title: "Signed proof, sharing and verification", group: "Review and respond",
    description: "Keep private signed records, redacted public summaries and artefact matching clearly separate.",
    keywords: ["receipt", "signature", "HMAC", "sharing", "public", "revoke", "revocation", "verify", "digest", "issuer"],
    sections: [
      s("three-things", "Three things that are easy to confuse",
        table(["Item", "What it establishes"], [
          ["Private signed receipt JSON", "A recorded outcome, scope, digest and policy/engine provenance signed using the issuing service's HMAC model."],
          ["Public shared summary", "An explicitly published, redacted snapshot. Reading the summary is not independent signature verification."],
          ["Artefact digest comparison", "Whether selected bytes match the digest in a verified record. This does not scan those bytes again."]
        ]),
        warning("Not a public-key certificate", "The current receipt algorithm is HMAC-SHA256. Verification depends on the issuing instance or trusted compatible signing material; do not describe it as universally independent issuer verification, a certification or a guarantee of complete security.")),
      s("private-and-shared", "Keep evidence private unless you deliberately share",
        p("Download the private signed record from the saved Release when available. Full reports and private evidence remain governed by workspace access. Inspect their contents before forwarding them."),
        p("Where the saved result offers proof sharing, an administrator previews and explicitly publishes an allowlisted summary. Publishing a link is separate from downloading the private record. Only use the sharing controls present for that evidence type."),
        capture("CAPTURE-DOCS-PROOF-01")),
      s("revocation", "Revoke a public link",
        p("Use the result's sharing controls to revoke or replace a published link. Revocation prevents future access through that link; it cannot retract copies someone already downloaded. It does not delete or rewrite the private signed evidence."),
        p("Unknown and revoked/private public links can intentionally look the same to an anonymous visitor. An unavailable link does not reveal whether private evidence previously existed.")),
      s("verify", "Verify a downloaded record",
        steps(
          ["Use the existing release-proof path in ", link("New scan", "/watch/scan?mode=receipt"), " or the receipt-verification mode of the public ", link("scan entry", "/scan?mode=receipt"), "."],
          ["Select the signed JSON. Optionally choose the original packed file to compute its SHA-256 locally in the browser."],
          ["Read the verification outcome. The JSON and optional digest are checked; selecting a pack for this comparison does not upload its bytes as a new scan."],
          ["Read the scan verdict inside a valid record. A correctly signed failed-policy or inconclusive result remains failed-policy or inconclusive."]),
        note("Verification is not new work", "Proof verification does not consume a scan job. Receipt verification remains distinct from paid scanning and from the availability of a public sharing link.")),
      s("outcome-codes", "Understand verification failures",
        table(["Code / outcome", "Interpretation"], [
          ["malformed / missing-signature", "The input is not usable signed receipt JSON."],
          ["unsupported-version", "This verifier does not support that receipt version."],
          ["unrecognized-signature", "The signature could not be validated here. HMAC alone cannot distinguish another issuer from tampering."],
          ["inconsistent", "The signed record contains an internally inconsistent result."],
          ["artifact-mismatch", "The verified record does not describe the selected package digest."],
          ["Unavailable public link", "A redacted sharing link cannot be read. This is not the same as a cryptographic verdict."]
        ]),
        p("Do not share an instance signing secret to make someone else's verification work. Ask support for the correct verification path."))
    ]
  }
];
