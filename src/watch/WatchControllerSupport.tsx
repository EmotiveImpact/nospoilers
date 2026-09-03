import { Button } from "@/components/ui/button";
import type {
  Alert, AlertEvent, Confirming, DeskDataset, GithubResponseView, LoadState, ProtectionImportResult,
  ReceiptScanStatus, RemediationPrView, RetentionDays, SetupPrView, SetupStatusView, SigningPolicyDraft,
} from "@/watch/types";
import type { WatchSectionState } from "@/watch/data-state";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";

export function destinationKindLabel(kind: string): string {
  if (kind === "jira") return "Jira";
  if (kind === "siem") return "SIEM";
  if (kind === "pagerduty") return "PagerDuty";
  if (kind === "email") return "Email";
  return "Slack";
}

export function routeMinSeverityLabel(value: string): string {
  if (value === "critical") return "critical only";
  if (value === "warn") return "warn and critical";
  return "all severities";
}

export const SIGNING_POLICY_CONFIRM = "signing-policy";

export const SIGNING_POLICY_CLEAR_CONFIRM = "clear-signing-policy";

export function emptySigningDraft(): SigningPolicyDraft {
  return { requireGithub: false, requireNpm: false, builderPrefix: "", expiresAt: "" };
}

export function parseSigningPolicy(raw: unknown): SigningPolicyDraft | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as {
    requireGithub?: unknown;
    requireNpm?: unknown;
    builderPrefix?: unknown;
    expiresAt?: unknown;
  };
  return {
    requireGithub: row.requireGithub === true,
    requireNpm: row.requireNpm === true,
    builderPrefix: typeof row.builderPrefix === "string" ? row.builderPrefix : "",
    expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : "",
  };
}

export function parseRetentionDays(raw: unknown): RetentionDays | null {
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (value === 0 || value === 90 || value === 180 || value === 365) return value;
  return null;
}

export function retentionConfirmToken(days: RetentionDays): string {
  return days === 0 ? "keep" : String(days);
}

export function confirmActionLabel(row: Confirming): string {
  switch (row.kind) {
    case "destination":
      return "remove this destination";
    case "route":
      return "remove this route";
    case "registry":
      return "remove this registry";
    case "package":
      return "stop watching this package";
    case "origin":
      return "stop watching this website";
    case "map-destination":
      return "remove this map destination";
    case "token":
      return "revoke this scan token";
    case "exception":
      return "revoke this allowlist entry";
    case "identity-allowlist":
      return "allowlist this lookalike";
    case "identity-revoke":
      return "revoke this lookalike allowlist";
    case "member":
      return "remove this member";
    case "role":
      return row.role === "admin" ? "make this person an admin" : "make this person a member";
    case "invite":
      return "invite this GitHub login";
    case "invite-revoke":
      return "revoke this invite";
    case "retention":
      return "set this retention window";
    case "signing-policy-save":
      return "save this signing policy";
    case "signing-policy-clear":
      return "clear this signing policy";
    case "make-private":
      return "make this repository private";
    case "delete-pack-assets":
      return "delete packed Release assets";
    case "disable-workflow":
      return "disable this workflow";
    case "release-approve":
      return "approve this release to ship";
    case "release-reject":
      return "reject this release";
    case "release-hold":
      return "place a legal hold on this release";
    case "release-hold-release":
      return "release this legal hold";
    case "release-publish":
      return "publish a verification page for this release";
    case "release-unpublish":
      return "unpublish this verification page";
    case "release-attest":
      return "refresh GitHub and npm attestations for this release";
    case "identity-evidence":
      return "assemble identity evidence for this package";
    case "identity-publish-advisory":
      return "publish a consumer advisory for this package";
    case "identity-unpublish-advisory":
      return "unpublish this consumer advisory";
    case "namespace-unprotect":
      return "stop watching this npm scope";
  }
}

export function formatSealedBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kib = bytes / 1024;
    return `${kib < 10 ? kib.toFixed(1) : Math.round(kib)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function receiptStatusMark(status: ReceiptScanStatus | null) {
  if (status === "failed-policy") {
    return (
      <span className="text-xs uppercase tracking-[0.16em] text-danger">failed policy</span>
    );
  }
  if (status === "inconclusive") {
    return (
      <span className="text-xs uppercase tracking-[0.16em] text-danger">inconclusive</span>
    );
  }
  if (status === "passed") {
    return <span className="text-xs uppercase tracking-[0.16em] text-dim">passed</span>;
  }
  return null;
}

export function protectionImportStatusLabel(status: ProtectionImportResult["status"]): string {
  if (status === "already_protected") return "already protected";
  if (status === "not_owned") return "not owned";
  if (status === "not_found") return "not on the registry";
  if (status === "invalid") return "invalid name";
  if (status === "watch_cap") return "watch cap";
  return "protected";
}

export const LOADING_DATASETS: Record<DeskDataset, WatchSectionState> = {
  maps: { status: "loading" },
  releases: { status: "loading" },
  jobs: { status: "loading" },
  notifications: { status: "loading" },
};

export function sectionStateOf<T>(state: LoadState<T>): WatchSectionState {
  return state.status === "error"
    ? { status: "error", message: state.message }
    : { status: state.status };
}

export function TypeToConfirm(props: {
  expected: string;
  action: string;
  busy: boolean;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open onClose={props.busy ? () => undefined : props.onCancel} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/70 transition-opacity duration-150 data-closed:opacity-0 motion-reduce:transition-none" />
      <div className="fixed inset-0 grid place-items-center overflow-y-auto px-4 py-8">
      <DialogPanel
        as="form"
        className="w-full max-w-md rounded-xl border border-white/15 bg-[#0e0e11] p-5 shadow-2xl transition duration-150 data-closed:scale-95 data-closed:opacity-0 motion-reduce:transition-none"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit();
        }}
      >
        <p className="watch-kicker">Confirmation required</p>
        <DialogTitle className="mt-1 font-display text-xl text-snow">
          {props.action}
        </DialogTitle>
        <p className="mt-4 text-xs leading-relaxed text-mute">
          Type <span className="font-mono text-snow">{props.expected}</span> to continue.
        </p>
        <input
          autoFocus
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="mt-3 h-11 w-full rounded-md border border-white/15 bg-panel px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
        />
        {props.error ? <p className="mt-2 text-sm text-danger">{props.error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" disabled={props.busy} onClick={props.onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={props.busy || props.value.trim() !== props.expected}>
            {props.busy ? "Working…" : "Confirm"}
          </Button>
        </div>
      </DialogPanel>
      </div>
    </Dialog>
  );
}

export function installIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("install");
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function formatExposure(ms: number | undefined, createdAt: string, resolvedAt: string | null | undefined): string {
  const start = Date.parse(createdAt);
  const value =
    typeof ms === "number" && Number.isFinite(ms)
      ? ms
      : Number.isFinite(start)
        ? Math.max(0, (resolvedAt ? Date.parse(resolvedAt) : Date.now()) - start)
        : 0;
  if (value < 60_000) return "under a minute";
  const minutes = Math.floor(value / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function kindLabel(kind: string): string {
  switch (kind) {
    case "repo_publicized":
      return "Went public";
    case "repo_created_public":
      return "Created public";
    case "repo_transferred":
      return "Transferred";
    case "member_added":
      return "Collaborator";
    case "fork":
      return "Fork";
    case "release_scan":
    case "scan_latest_release":
      return "Release pack";
    case "release_unpublished":
      return "Release unpublished";
    case "release_deleted":
      return "Release deleted";
    case "push_sensitive_path":
      return "Path watch";
    case "npm_scan":
      return "npm pack";
    case "npm_dist_tag":
      return "npm dist-tag";
    case "web_origin_scan":
      return "Website";
    case "app_suspended":
      return "App suspended";
    case "app_unsuspended":
      return "App unsuspended";
    case "app_permissions_updated":
      return "App permissions";
    case "repos_added":
      return "Repos added";
    case "repos_removed":
      return "Repos removed";
    case "fair_use_budget":
      return "Fair use";
    case "repo_made_private":
      return "Made private";
    case "release_assets_removed":
      return "Pack assets removed";
    case "workflow_disabled":
      return "Workflow disabled";
    default:
      return kind;
  }
}

export function defaultExpiryDate(): string {
  const when = new Date();
  when.setUTCDate(when.getUTCDate() + 90);
  return when.toISOString().slice(0, 10);
}

export function SetupStatusResult({ view }: { view: SetupStatusView }) {
  if (view.status === "error") {
    return <p className="mt-3 text-sm text-danger">{view.message}</p>;
  }
  const facts = view.facts;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm leading-relaxed text-mute">{facts.detail}</p>
      <p className="font-mono text-xs leading-relaxed text-dim">
        Action {facts.actionOnDefault ? "on default" : facts.actionOnSetup ? `on ${facts.setupBranch}` : "missing"}
        {" · "}
        workflow{" "}
        {facts.workflowOnDefault
          ? "on default"
          : facts.workflowOnSetup
            ? `on ${facts.setupBranch}`
            : "missing"}
        {" · "}
        check {facts.check ? facts.check.conclusion ?? "queued" : "none"}
        {" · "}
        required unknown
      </p>
    </div>
  );
}

export function SetupPrResult({ view }: { view: SetupPrView }) {
  if (view.status === "opened") {
    return (
      <p className="mt-3 text-sm leading-relaxed text-mute">
        {view.existing ? "Existing setup PR: " : "Opened setup PR: "}
        <a
          href={view.htmlUrl}
          className="text-snow underline-offset-4 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          #{view.number}
        </a>
        . Review it; NoSpoilers does not merge.
      </p>
    );
  }
  if (view.status === "copy") {
    return (
      <div className="mt-3 space-y-4">
        <p className="text-sm leading-relaxed text-mute">{view.reason}</p>
        {view.written && view.written.length > 0 ? (
          <p className="text-xs leading-relaxed text-dim">
            Committed on{" "}
            {view.compareUrl ? (
              <a
                href={view.compareUrl}
                className="text-snow underline-offset-4 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {view.branch ?? "the setup branch"}
              </a>
            ) : (
              (view.branch ?? "the setup branch")
            )}
            : {view.written.join(", ")}. Paste the workflow YAML. Grant Pull requests write to open
            the PR. NoSpoilers does not merge.
          </p>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-dim">
            Paste these files yourself. They scan packed artifacts only, POST bytes to hosted scan,
            and are never merged automatically.
          </p>
        )}
        {view.files.map((file) => (
          <div key={file.path}>
            <p className="font-mono text-xs text-snow">{file.path}</p>
            <pre className="mt-2 max-h-48 overflow-auto border border-white/10 bg-inset p-4 font-mono text-xs leading-relaxed text-mute">
              {file.content}
            </pre>
          </div>
        ))}
      </div>
    );
  }
  return <p className="mt-3 text-sm text-danger">{view.message}</p>;
}

export function RemediationPrResult({ view }: { view: RemediationPrView }) {
  if (view.status === "opened") {
    return (
      <p className="mt-3 text-sm leading-relaxed text-mute">
        {view.existing ? "Existing remediation PR: " : "Opened remediation PR: "}
        <a
          href={view.htmlUrl}
          className="text-snow underline-offset-4 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          #{view.number}
        </a>
        . Review it; NoSpoilers does not merge.
      </p>
    );
  }
  if (view.status === "copy") {
    return (
      <div className="mt-3 space-y-4">
        <p className="text-sm leading-relaxed text-mute">{view.reason}</p>
        {view.written && view.written.length > 0 ? (
          <p className="text-xs leading-relaxed text-dim">
            Committed on{" "}
            {view.compareUrl ? (
              <a
                href={view.compareUrl}
                className="text-snow underline-offset-4 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {view.branch ?? "the remediation branch"}
              </a>
            ) : (
              (view.branch ?? "the remediation branch")
            )}
            : {view.written.join(", ")}. Paste any missing workflow YAML. Grant Pull requests write
            to open the PR. NoSpoilers does not merge.
          </p>
        ) : (
          <p className="text-xs leading-relaxed text-dim">
            Paste these files yourself. They are additive, reviewable, and never merged automatically.
          </p>
        )}
        {view.files.map((file) => (
          <div key={file.path}>
            <p className="font-mono text-xs text-snow">{file.path}</p>
            <pre className="mt-2 max-h-48 overflow-auto border border-white/10 bg-inset p-4 font-mono text-xs leading-relaxed text-mute">
              {file.content}
            </pre>
          </div>
        ))}
      </div>
    );
  }
  return <p className="mt-3 text-sm text-danger">{view.message}</p>;
}

export function GithubResponseResult({ view }: { view: GithubResponseView }) {
  if (view.status === "ok") {
    return <p className="mt-3 text-sm leading-relaxed text-mute">{view.detail}</p>;
  }
  if (view.status === "copy") {
    return <p className="mt-3 text-sm leading-relaxed text-mute">{view.reason}</p>;
  }
  return <p className="mt-3 text-sm text-danger">{view.message}</p>;
}

export function AlertDeskItem({
  alert,
  previewing,
  events,
  busy,
  note,
  assignee,
  error,
  onNote,
  onAssignee,
  onAction,
}: {
  alert: Alert;
  previewing: boolean;
  events: AlertEvent[];
  busy: boolean;
  note: string;
  assignee: string;
  error: string | null;
  onNote: (value: string) => void;
  onAssignee: (value: string) => void;
  onAction: (action: "acknowledge" | "assign" | "resolve" | "reopen") => void;
}) {
  const resolved = Boolean(alert.resolved_at);
  const checklist = alert.rotation_checklist ?? [];
  return (
    <li className="py-5">
      <p className="text-xs uppercase tracking-[0.16em] text-dim">
        {kindLabel(alert.kind)} · {new Date(alert.created_at).toLocaleString()}
        {resolved ? " · resolved" : alert.acknowledged_at ? " · acknowledged" : " · open"}
      </p>
      <p className="mt-2 text-sm text-snow">{alert.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-dim">{alert.body}</p>
      <p className="mt-2 text-xs text-mute">
        Exposed {formatExposure(alert.exposure_ms, alert.created_at, alert.resolved_at)}
        {alert.assigned_to_login ? ` · assigned to ${alert.assigned_to_login}` : ""}
        {alert.acknowledged_by_login ? ` · ack ${alert.acknowledged_by_login}` : ""}
      </p>
      {Array.isArray(alert.findings) && alert.findings.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {alert.findings.map((finding) => (
            <li
              key={`${alert.id}-${finding.rule}-${finding.path}`}
              className="font-mono text-xs text-mute"
            >
              {finding.rule} · {finding.path}
            </li>
          ))}
        </ul>
      )}
      {checklist.length > 0 && (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-[0.16em] text-dim">Rotation checklist</p>
          <ul className="mt-2 flex flex-col gap-1">
            {checklist.map((item) => (
              <li key={item} className="text-xs leading-relaxed text-mute">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      {alert.resolution_note ? (
        <p className="mt-3 text-xs leading-relaxed text-mute">Note: {alert.resolution_note}</p>
      ) : null}
      {events.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {events.map((event) => (
            <li key={event.id} className="text-xs text-dim">
              {event.action} · {event.actor_login}
              {event.detail ? ` · ${event.detail}` : ""} · {new Date(event.created_at).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {!alert.acknowledged_at && !resolved && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={previewing || busy}
              onClick={() => onAction("acknowledge")}
            >
              Acknowledge
            </Button>
          )}
          {resolved ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={previewing || busy}
              onClick={() => onAction("reopen")}
            >
              Reopen
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={previewing || busy || note.trim().length < 8}
              onClick={() => onAction("resolve")}
            >
              Resolve
            </Button>
          )}
        </div>
        {!resolved && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1">
              <span className="text-xs uppercase tracking-[0.16em] text-dim">Assign GitHub login</span>
              <input
                value={assignee}
                onChange={(event) => onAssignee(event.target.value)}
                placeholder="install member login"
                autoComplete="off"
                spellCheck={false}
                disabled={previewing || busy}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
              />
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={previewing || busy || !assignee.trim()}
              onClick={() => onAction("assign")}
            >
              Assign
            </Button>
          </div>
        )}
        {!resolved && (
          <label>
            <span className="text-xs uppercase tracking-[0.16em] text-dim">Resolution note</span>
            <textarea
              value={note}
              onChange={(event) => onNote(event.target.value)}
              placeholder="What changed. Do not paste secret values."
              disabled={previewing || busy}
              rows={3}
              className="mt-2 w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
            ></textarea>
          </label>
        )}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {previewing ? (
          <p className="text-xs text-dim">Preview does not save acknowledgements.</p>
        ) : null}
      </div>
    </li>
  );
}
