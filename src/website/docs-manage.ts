import { paragraph as p, note, warning, steps, list, table, code, link, mono, section as s, capture, type Article } from "./model.ts";

export const MANAGE_ARTICLES: Article[] = [
  {
    slug: "api-tokens-and-ci", title: "API tokens and CI integration", group: "Manage your workspace",
    description: "Submit a packed release with a workspace credential and poll its saved attempt instead of assuming an immediate result.",
    keywords: ["API", "CI", "CLI", "curl", "bearer", "token", "GitHub Action", "202", "idempotency", "automation"],
    sections: [
      s("create-token", "Create and protect a scan token",
        steps(
          ["Select the intended workspace and open ", link("Scan API tokens", "/watch/tokens"), ". An owner or administrator of an active, entitled workspace can create a token."],
          ["Give the token a clear name, such as Release CI. Save the returned secret immediately in your CI secret store."],
          ["The secret is shown once. Later token history contains metadata, not a recoverable secret. A workspace token can be used without a GitHub installation."],
          ["To revoke a token, type its exact name in the confirmation. Keep its historical metadata for audit; do not attempt to recover the old secret."]),
        warning("Use secrets, not committed values", "Do not put tokens in a repository, URL, screenshot or build log. A workspace token authenticates scan admission and access to scan status within its scope; it is not a substitute for a person's sign-in or unrestricted administration."),
        capture("CAPTURE-DOCS-TOKEN-01")),
      s("submit-api", "Submit a packed file",
        p("Set the actual HTTPS origin supplied for your NoSpoilers service. The hostname below is a placeholder, not a deployed service. Configure ", mono("NOSPOILERS_API_TOKEN"), " through the CI secret store before running this example."),
        code("bash", "Submit to the existing v1 scan API", "export NOSPOILERS_API_URL=\"https://your-nospoilers-host.example\"\n: \"${NOSPOILERS_API_TOKEN:?Set this in your CI secret store}\"\nREQUEST_ID=\"$(node -p 'crypto.randomUUID()')\"\n\ncurl --fail-with-body --max-time 120 \\\n  --request POST \\\n  --header \"Authorization: Bearer ${NOSPOILERS_API_TOKEN}\" \\\n  --header \"Content-Type: application/octet-stream\" \\\n  --header \"X-Filename: release.tgz\" \\\n  --header \"Idempotency-Key: ${REQUEST_ID}\" \\\n  --data-binary @./dist/release.tgz \\\n  \"${NOSPOILERS_API_URL}/api/v1/scan\""),
        p("Keep the same request identifier when retrying the same uncertain submission. Do not automatically generate a fresh identifier and resubmit after a timeout. Entitlement, size, usage and credential checks still apply.")),
      s("poll-api", "Poll the admitted attempt",
        p("An accepted asynchronous submission returns HTTP 202 and an ", mono("uploadId"), ". Copy that exact ID into ", mono("UPLOAD_ID"), " below. A 202 response is admission, not a passing release."),
        code("bash", "Read the saved scan status", "UPLOAD_ID=\"replace-with-the-returned-uploadId\"\n\ncurl --fail-with-body --max-time 15 \\\n  --header \"Authorization: Bearer ${NOSPOILERS_API_TOKEN}\" \\\n  \"${NOSPOILERS_API_URL}/api/v1/scans/${UPLOAD_ID}\""),
        p("Poll at a bounded interval and stop at a deliberate overall deadline. The existing CLI polls once per second for up to ten minutes. On a timeout, inspect the existing attempt in Releases instead of assuming no work was accepted."),
        p("For ", mono("status: done"), ", inspect ", mono("report.status"), " and ", mono("report.ok"), ". A done attempt may still be failed-policy or inconclusive. A rejected or revoked credential, wrong workspace or unavailable attempt must fail closed in your pipeline.")),
      s("cli-action", "Use the CLI or Action with approved distribution access",
        p("Use the CLI/Action revision supplied for your evaluation. This guide does not establish that a public npm package or Marketplace listing is available. Confirm access before adding a dependency with a similar name."),
        code("bash", "CLI, once the supplied executable is installed", "# NOSPOILERS_API_URL and NOSPOILERS_API_TOKEN come from CI configuration.\nnospoilers scan ./dist/release.tgz \\\n  --source-revision \"${GITHUB_SHA}\" \\\n  --sarif nospoilers.sarif"),
        p("The CLI sends the artefact to your authenticated hosted service. Local policy files do not replace the hosted workspace/connection policy. The customer path is not a permanently free local scan mode."),
        code("yaml", "Action inputs, after confirming repository access and pinning a revision", "- name: Inspect the release package\n  uses: EmotiveImpact/nospoilers@REPLACE_WITH_APPROVED_COMMIT_SHA\n  with:\n    path: dist/release.tgz\n    api-url: ${{ vars.NOSPOILERS_API_URL }}\n    api-token: ${{ secrets.NOSPOILERS_API_TOKEN }}\n    sarif: nospoilers.sarif"),
        note("Replace the revision placeholder", "Pin a reviewed commit that your workflow can read. Build the artefact in an earlier step. Neither this example nor the Action installs an enterprise identity provider or grants repository access automatically.")),
      s("errors", "Recover from common errors",
        table(["Problem", "Response"], [
          ["Authentication rejected", "Check the secret, token revocation and the service origin. Do not print the token while debugging."],
          ["Entitlement or capacity rejected", "Check the workspace subscription and current allowance. Another workspace does not create a new free quota."],
          ["Input too large or unsupported", "Use the documented packed input and service limits; do not disguise its extension."],
          ["Uncertain admission or long-running job", "Retain the request identifier and inspect the existing saved attempt before retrying."],
          ["Secret lost after token creation", "Check token history, revoke the unusable token when appropriate and create a replacement deliberately."]
        ]))
    ]
  },
  {
    slug: "notifications", title: "Notifications and delivery status", group: "Manage your workspace",
    description: "Configure a destination, test it deliberately and distinguish saved settings from actual provider acceptance.",
    keywords: ["email", "Slack", "Jira", "PagerDuty", "SIEM", "destination", "test", "delivery", "retry"],
    sections: [
      s("scope", "Know which Alerts a destination receives",
        p("Open ", link("Notifications", "/watch/notifications"), " in the intended workspace. Independent workspace Email and Slack destinations receive independent website Alerts. A one-off uploaded package produces scan evidence, not an automatic ongoing Alert."),
        p("Connected GitHub-source destinations are managed separately in the connected settings. Existing connected workflows include additional integrations, but their presence does not mean all workspace/source routing has been unified. See ", link("Integrations", "/integrations"), " for boundaries.")),
      s("configure", "Save, then test",
        steps(
          ["An administrator of an active workspace selects Email or Slack and enters the destination. Slack requires an active trial or Team subscription."],
          ["Choose Save destination. This replaces the independent workspace destination of the same type."],
          ["Read the provider-configuration message. Saving alone does not configure the email provider or prove that sending works."],
          ["Use Send test explicitly when the provider is configured. Check Latest test and Delivery history for the recorded result."]),
        capture("CAPTURE-DOCS-NOTIFICATIONS-01")),
      s("delivery", "Interpret delivery evidence",
        table(["State", "What it means"], [
          ["Saved / not tested", "Configuration was saved. No successful delivery has been established."],
          ["Queued / Running", "A test or notification is waiting or being processed. It is not yet provider-accepted."],
          ["Sent / provider accepted", "The provider accepted the request. This does not confirm that a person received or read it."],
          ["Failed / Stopped", "Read the sanitised configuration, permission or retry guidance; do not assume the exposure was resolved."]
        ]),
        p("Delivery work uses bounded retries. At-least-once processing can duplicate a notification around a crash or uncertain provider response; this is not an exactly-once delivery guarantee. An uncertain test retry should use the existing retry path rather than repeatedly creating new tests.")),
      s("disconnect", "Disconnect without erasing history",
        p("Use Disconnect and type the exact displayed host. This removes credentials and pending notifications while retaining recorded delivery history. Viewing history or saving a destination does not create an exposure Alert or resolve one."),
        warning("Keep private details inside the app", "Do not paste webhook URLs or credentials into support requests. Notification messages are not a substitute for the private Release evidence; investigate in the authorised workspace."))
    ]
  },
  {
    slug: "retention-and-deletion", title: "Retention, disconnection and deletion requests", group: "Manage your workspace",
    description: "Understand which actions stop work, which preserve evidence and which only request a deletion review.",
    keywords: ["retention", "disconnect", "delete", "purge", "archive", "closure", "privacy", "backup", "history"],
    sections: [
      s("distinct-actions", "Treat lifecycle actions separately",
        table(["Action", "Boundary"], [
          ["Disconnect a source", "Stop monitoring and revoke relevant trigger/scan access. Retain authorised access to historical evidence."],
          ["Cancel a subscription", "Change billing. This does not authorise deletion of evidence."],
          ["Archive a workspace", "Preserve evidence and restrict new work under the supported archive rules."],
          ["Request deletion review", "Record an owner-authorised request for a specific scope. This is not an executed purge."],
          ["Close a person's account", "Does not implicitly authorise deletion of shared organisation history."]
        ]),
        p("Consult ", link("Retention", "/watch/retention"), " for the workspace's enforced evidence settings. Connected and independent workspace controls differ; read the explanation rather than assuming the same retention controls exist everywhere.")),
      s("request-review", "Submit a scoped review request",
        p("Where the workspace-management screen offers history review, the owner reads the current impact inventory, acknowledges the scope and types the required confirmation. The request and any supported withdrawal are persisted."),
        warning("Requested is not deleted", "The current form records a deletion review request. It does not execute permanent erasure, close a personal account, cancel a subscription or establish that a support notification was delivered."),
        p("Organisation closure with history loss is a separate authorisation from an individual's account closure. One member cannot erase shared history by closing their own account.")),
      s("limits", "Understand inventory and backup limits",
        p("The impact inventory describes current records, connections, active work and shared links in the authorised scope. It is not a guarantee of the exact future deletion set and does not establish legal-hold clearance or backup erasure."),
        p("Permanent execution needs separate recent-authentication, authority, hold, retention and backup/third-party checks. Do not assume instantaneous universal deletion or a contractual deletion deadline from a submitted form.")),
      s("sharing-and-support", "Handle public links and sensitive requests",
        p("Public uploaded-proof links can be revoked independently of history deletion. Revocation stops future reads through the link but cannot retract saved copies."),
        p("For a data request, use ", link("Support", "/support"), " and identify the intended account/workspace without sending credentials or raw customer findings. Legal and procurement material remains subject to review; this guide describes product behaviour, not a new contractual promise."))
    ]
  },
  {
    slug: "troubleshooting", title: "Troubleshooting and known limitations", group: "Manage your workspace",
    description: "Diagnose the state you actually have, keep uncertain retries safe and collect useful, non-sensitive evidence for support.",
    keywords: ["error", "failed", "stuck", "unavailable", "limits", "timeout", "403", "401", "404", "support", "known limitations"],
    sections: [
      s("start-with-state", "Start with the current state",
        table(["Symptom", "First checks"], [
          ["Cannot start a scan", "Sign-in, correct workspace, role, archive/suspension state, active entitlement and service configuration."],
          ["Upload interrupted", "Whether the attempt was admitted. Stopping the transfer does not guarantee cancellation of an accepted job."],
          ["Queued for longer than expected", "The existing saved attempt and worker/scheduler availability. Avoid duplicate submissions."],
          ["Inconclusive", "The recorded reason: unsupported/encrypted input, malformed layout, limit, timeout or unavailable evidence."],
          ["Missing result or unavailable link", "Exact ID, workspace membership, retained visibility and whether the link is private or revoked."],
          ["Website challenge fails", "Exact host/value, DNS propagation, HTTPS location, redirects and public address requirements."],
          ["Notification saved but not sent", "Provider configuration, explicit test, queued work and delivery status, not merely the saved form."]
        ])),
      s("safe-retry", "Retry without losing evidence",
        steps(
          ["Reopen the existing result URL and refresh its state. A read does not create new work."],
          ["Record the displayed error and time. For API admission, keep the original idempotency identifier."],
          ["Resolve the cause: input, permission, configuration, allowance or service availability."],
          ["Start a new attempt only when the relevant retry/new-scan action is appropriate. Preserve the older result for comparison."]),
        note("An unavailable result is not an empty workspace", "Do not change workspace or source identifiers to make an error disappear. Ask the relevant administrator to verify the intended membership and evidence scope.")),
      s("known-boundaries", "Known boundaries to plan around",
        list(
          ["Current sign-in is GitHub-based. Google/Microsoft login, enterprise SSO, SCIM and custom roles are not operational commitments."],
          ["Existing-account invitations, connection placement and some archive/lifecycle controls have scope-specific restrictions."],
          ["Source types do not yet have identical scheduling, lifecycle, notification and settings controls."],
          ["HMAC receipts require the correct issuing verification context; public summaries are not independent cryptographic verification."],
          ["A supported package format is not a malware verdict, full decompilation or proof that every vulnerability was checked."],
          ["Service isolation, provider reachability, restoration, load behaviour and enterprise assurance need operational evidence for the deployment being evaluated."],
          ["Deletion review is implemented separately from permanent execution. No universal backup-erasure promise follows from it."]),
        p("A polished page or a successful local test is not confirmation that your deployment has completed those operational checks. Agree the environment and limits before an enterprise pilot.")),
      s("contact-support", "Prepare a useful support request",
        p("Include the page/route, approximate time and time zone, non-sensitive workspace/attempt identifier, expected behaviour, actual behaviour and safe reproduction steps. Remove query-string sharing tokens, credentials, private paths, raw artefacts and matched secret values."),
        p("Use ", link("Support", "/support"), " for the existing email contact and ", link("Service status", "/status"), " for the current application's health view. A health response is not a historical uptime report or an SLA."))
    ]
  }
];
