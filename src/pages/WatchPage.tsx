import { CoverageLock } from "@/components/CoverageLock.tsx";
import { LoggedInLook } from "@/components/LoggedInLook.tsx";
import { Button } from "@/components/ui/button";
import { coverageFromQuery, type Coverage } from "@/coverage.ts";
import { navigate } from "@/nav.ts";
import { PREVIEW_INSTALLATIONS, PREVIEW_LOGIN, previewAlerts, previewRepos } from "@/preview.ts";
import type { Finding } from "@/report-types";
import { useCallback, useEffect, useState } from "react";

type Me = {
  user: { id: string; login: string; avatarUrl: string | null } | null;
  coverage?: Coverage;
  installations: { id: number; account_login: string; account_type: string }[];
  githubApp: boolean;
  installUrl?: string;
};

type Repo = {
  id: number;
  full_name: string;
  private: boolean;
  html_url: string;
  last_checked_at: string | null;
};

type Alert = {
  id: number;
  kind: string;
  title: string;
  body: string;
  findings: Finding[] | null;
  created_at: string;
  full_name?: string | null;
};

type WatchedPackage = {
  id: number;
  installation_id: number;
  package_name: string;
  registry_origin?: string;
  last_version: string | null;
  last_sha256: string | null;
  last_checked_at: string | null;
  last_scanned_at: string | null;
  last_scan_status: string | null;
};

type NpmRegistry = {
  id: number;
  installation_id: number;
  origin: string;
  host: string;
  updated_at: string;
};

type ScanApiToken = {
  id: number;
  installation_id: number;
  name: string;
  token_prefix: string;
  created_by_login: string;
  last_used_at: string | null;
  created_at: string;
};

type ReleaseDiffView = {
  versus?: "baseline" | "previous" | null;
  baseline?: {
    id: number;
    receiptId: number;
    reason: string;
    actorLogin: string;
    createdAt: string;
  } | null;
  current: { id: number; coordinate: string; status: string; artifactSha256: string } | null;
  previous: { id: number; coordinate: string; status: string; artifactSha256: string } | null;
  diff: {
    added: { path: string }[];
    removed: { path: string }[];
    changed: { path: string }[];
    sizeDelta: number;
    unexpectedSizeJump: boolean;
    newFindings: string[];
    resolvedFindings: string[];
  } | null;
};

type PolicyExceptionView = {
  id: number;
  installationId: number;
  packageId: number | null;
  rule: string;
  pathPattern: string | null;
  reason: string;
  actorLogin: string;
  expiresAt: string;
  createdAt: string;
  active: boolean;
};

type BaselineView = {
  id: number;
  receiptId: number;
  reason: string;
  actorLogin: string;
  createdAt: string;
};

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return body;
}

function kindLabel(kind: string): string {
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
    case "push_sensitive_path":
      return "Path watch";
    case "npm_scan":
      return "npm pack";
    case "npm_dist_tag":
      return "npm dist-tag";
    default:
      return kind;
  }
}

function defaultExpiryDate(): string {
  const when = new Date();
  when.setUTCDate(when.getUTCDate() + 90);
  return when.toISOString().slice(0, 10);
}

type SetupPrView =
  | { status: "opened"; htmlUrl: string; number: number; existing: boolean }
  | { status: "copy"; reason: string; workflow: string }
  | { status: "error"; message: string };

function SetupPrResult({ view }: { view: SetupPrView }) {
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
      <div className="mt-3">
        <p className="text-sm leading-relaxed text-mute">{view.reason}</p>
        <p className="mt-2 text-xs leading-relaxed text-dim">
          Paste this workflow yourself. It scans packed artifacts only and is never merged automatically.
        </p>
        <pre className="mt-3 max-h-64 overflow-auto border border-white/10 bg-inset p-4 font-mono text-[11px] leading-relaxed text-mute">
          {view.workflow}
        </pre>
      </div>
    );
  }
  return <p className="mt-3 text-sm text-danger">{view.message}</p>;
}

export function WatchPage({ search }: { search: string }) {
  const [me, setMe] = useState<LoadState<Me>>({ status: "loading" });
  const [repos, setRepos] = useState<LoadState<{ repos: Repo[] }>>({ status: "loading" });
  const [alerts, setAlerts] = useState<LoadState<{ alerts: Alert[] }>>({ status: "loading" });
  const [packages, setPackages] = useState<LoadState<{ packages: WatchedPackage[] }>>({
    status: "loading",
  });
  const [registries, setRegistries] = useState<NpmRegistry[]>([]);
  const [scanTokens, setScanTokens] = useState<ScanApiToken[]>([]);
  const [scanTokenName, setScanTokenName] = useState("CI");
  const [revealedScanToken, setRevealedScanToken] = useState<string | null>(null);
  const [mintingScanToken, setMintingScanToken] = useState(false);
  const [scanTokenError, setScanTokenError] = useState<string | null>(null);
  const [revokingScanTokenId, setRevokingScanTokenId] = useState<number | null>(null);
  const [registryOriginInput, setRegistryOriginInput] = useState("");
  const [registryToken, setRegistryToken] = useState("");
  const [savingRegistry, setSavingRegistry] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [removingRegistryId, setRemovingRegistryId] = useState<number | null>(null);
  const [watchRegistryOrigin, setWatchRegistryOrigin] = useState("https://registry.npmjs.org");
  const [scanError, setScanError] = useState<string | null>(null);
  const [packageError, setPackageError] = useState<string | null>(null);
  const [scanningId, setScanningId] = useState<number | null>(null);
  const [setuppingId, setSetuppingId] = useState<number | null>(null);
  const [setupByRepo, setSetupByRepo] = useState<Record<number, SetupPrView>>({});
  const [packageName, setPackageName] = useState("");
  const [watchingPackage, setWatchingPackage] = useState(false);
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [diffingId, setDiffingId] = useState<number | null>(null);
  const [diffByPackage, setDiffByPackage] = useState<Record<number, ReleaseDiffView | { error: string }>>(
    {},
  );
  const [exceptions, setExceptions] = useState<PolicyExceptionView[]>([]);
  const [baselineByPackage, setBaselineByPackage] = useState<Record<number, BaselineView | null>>({});
  const [allowRule, setAllowRule] = useState("");
  const [allowPath, setAllowPath] = useState("");
  const [allowReason, setAllowReason] = useState("");
  const [allowExpires, setAllowExpires] = useState(defaultExpiryDate);
  const [savingAllow, setSavingAllow] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [baselineReason, setBaselineReason] = useState("Approved current packed artifact as the shipping baseline.");

  const refreshSignedIn = useCallback(async () => {
    setRepos({ status: "loading" });
    setAlerts({ status: "loading" });
    setPackages({ status: "loading" });
    try {
      const [repoBody, alertBody, packageBody, exceptionBody, registryBody, tokenBody] = await Promise.all([
        loadJson<{ repos: Repo[] }>("/api/repos"),
        loadJson<{ alerts: Alert[] }>("/api/alerts"),
        loadJson<{ packages: WatchedPackage[] }>("/api/packages"),
        loadJson<{ exceptions: PolicyExceptionView[] }>("/api/exceptions"),
        loadJson<{ registries: NpmRegistry[] }>("/api/registries"),
        loadJson<{ tokens: ScanApiToken[] }>("/api/scan-tokens"),
      ]);
      setRepos({ status: "ready", data: repoBody });
      setAlerts({ status: "ready", data: alertBody });
      setPackages({ status: "ready", data: packageBody });
      setExceptions(exceptionBody.exceptions);
      setRegistries(registryBody.registries);
      setScanTokens(tokenBody.tokens);
      const baselines = await Promise.all(
        packageBody.packages.map(async (pkg) => {
          const body = await loadJson<{ baseline: BaselineView | null }>(
            `/api/packages/${pkg.id}/baseline`,
          );
          return [pkg.id, body.baseline] as const;
        }),
      );
      setBaselineByPackage(Object.fromEntries(baselines));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load.";
      setRepos({ status: "error", message });
      setAlerts({ status: "error", message });
      setPackages({ status: "error", message });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const body = await loadJson<Me>("/api/me");
        if (cancelled) return;
        setMe({ status: "ready", data: body });
        if (body.user) await refreshSignedIn();
        else {
          setRepos({ status: "ready", data: { repos: [] } });
          setAlerts({ status: "ready", data: { alerts: [] } });
          setPackages({ status: "ready", data: { packages: [] } });
          setExceptions([]);
          setBaselineByPackage({});
          setRegistries([]);
          setScanTokens([]);
          setRevealedScanToken(null);
        }
      } catch (error) {
        if (cancelled) return;
        setMe({
          status: "error",
          message: error instanceof Error ? error.message : "Could not reach NoSpoilers.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSignedIn]);

  if (me.status === "loading") {
    return (
      <main className="flex min-h-[70svh] items-center justify-center px-5">
        <p className="text-sm text-dim">Checking GitHub session…</p>
      </main>
    );
  }

  if (me.status === "error") {
    return (
      <main className="mx-auto max-w-2xl px-5 py-24">
        <p className="font-display text-3xl text-snow">Could not load the watch desk</p>
        <p className="mt-3 text-mute">{me.message}</p>
      </main>
    );
  }

  const { user, githubApp, installUrl, installations, coverage: sessionCoverage } = me.data;
  const queryCoverage = coverageFromQuery(search);
  const previewing = !user;
  const coverage: Coverage | undefined = user
    ? sessionCoverage
    : (queryCoverage ?? coverageFromQuery("?as=trial") ?? undefined);

  if (!user && githubApp && !queryCoverage) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-16 md:py-24">
        <p className="text-[11px] uppercase tracking-[0.28em] text-dim">Watch desk</p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.08] tracking-tight text-snow md:text-6xl">
          Sign in to keep the bot thinking.
        </h1>
        <p className="mt-5 max-w-lg text-base leading-relaxed text-mute md:text-lg">
          This is the hosted GitHub App. Install, then we watch publicize / transfer / collaborator /
          fork and we unpack release packs. Coverage is Solo $29 or Team $99 after a 14-day trial.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button as="a" href="/api/auth/github" size="lg">
            Sign in with GitHub
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={() => navigate("/watch?as=trial")}>
            Preview the desk
          </Button>
        </div>
        <p className="mt-10 text-sm text-dim">
          Two logged-in looks:{" "}
          <button type="button" className="text-snow underline-offset-4 hover:underline" onClick={() => navigate("/watch?as=trial")}>
            trial desk
          </button>
          {" · "}
          <button type="button" className="text-snow underline-offset-4 hover:underline" onClick={() => navigate("/scan?as=ended")}>
            unpaid locked scan
          </button>
        </p>
      </main>
    );
  }

  const ended = coverage?.status === "ended";
  const login = user?.login ?? PREVIEW_LOGIN;
  const watching = user
    ? installations.map((row) => row.account_login)
    : PREVIEW_INSTALLATIONS.map((row) => row.account_login);
  const deskRepos = previewing ? previewRepos() : repos.status === "ready" ? repos.data.repos : [];
  const deskAlerts = previewing ? previewAlerts() : alerts.status === "ready" ? alerts.data.alerts : [];
  const deskPackages = previewing
    ? []
    : packages.status === "ready"
      ? packages.data.packages
      : [];

  return (
    <main className="fade-up mx-auto max-w-5xl px-5 py-12 md:py-16">
      {previewing ? <LoggedInLook current={ended ? "ended" : "trial"} /> : null}

      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-dim">{login}</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-snow md:text-4xl">Watch desk</h1>
          <p className="mt-2 max-w-xl text-sm text-mute">
            {ended
              ? "Coverage ended. The bot is quiet until you subscribe."
              : watching.length > 0
                ? `Watching ${watching.join(", ")}. Hosted pack scans are on${coverage?.status === "trial" ? " for this trial" : ""}.`
                : "No installs linked yet"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {coverage && (
            <span
              className={
                ended
                  ? "text-[11px] uppercase tracking-[0.16em] text-danger"
                  : "text-[11px] uppercase tracking-[0.16em] text-dim"
              }
            >
              {coverage.label}
            </span>
          )}
          {installUrl && githubApp && user && (
            <Button as="a" href={installUrl}>
              Install on GitHub
            </Button>
          )}
          {ended && (
            <Button type="button" onClick={() => navigate("/pricing")}>
              Subscribe
            </Button>
          )}
        </div>
      </div>

      <div className="relative mt-14 grid min-h-72 gap-16 lg:grid-cols-[0.95fr_1.05fr]">
        {ended ? (
          <CoverageLock variant="watch" title="Subscribe to keep watching." />
        ) : null}
        <section className={ended ? "pointer-events-none select-none opacity-25" : undefined}>
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Repositories</h2>
          {!previewing && repos.status === "loading" && <p className="mt-6 text-sm text-dim">Loading…</p>}
          {!previewing && repos.status === "error" && <p className="mt-6 text-sm text-danger">{repos.message}</p>}
          {deskRepos.length === 0 && (previewing || repos.status === "ready") && (
            <p className="mt-6 text-sm leading-relaxed text-mute">
              Nothing on this install yet. Install NoSpoilers on a private throwaway repo.
            </p>
          )}
          {deskRepos.length > 0 && (
            <ul className="mt-4 divide-y divide-white/5">
              {deskRepos.map((repo) => (
                <li key={repo.id} className="py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <a
                      href={repo.html_url}
                      className="font-mono text-sm text-snow underline-offset-4 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {repo.full_name}
                    </a>
                    <span className="text-[11px] uppercase tracking-[0.16em] text-dim">
                      {repo.private ? "private" : "public"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-dim">
                    Last check{" "}
                    {repo.last_checked_at ? new Date(repo.last_checked_at).toLocaleString() : "not yet"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={previewing || scanningId === repo.id || ended}
                      onClick={() => {
                        if (previewing) return;
                        setScanError(null);
                        setScanningId(repo.id);
                        void (async () => {
                          try {
                            const response = await fetch(`/api/repos/${repo.id}/scan-latest-release`, {
                              method: "POST",
                              credentials: "include",
                            });
                            const body = (await response.json()) as { error?: string };
                            if (!response.ok) throw new Error(body.error ?? "Could not queue scan.");
                            await refreshSignedIn();
                          } catch (error) {
                            setScanError(error instanceof Error ? error.message : "Could not queue scan.");
                          } finally {
                            setScanningId(null);
                          }
                        })();
                      }}
                    >
                      {scanningId === repo.id ? "Queuing…" : "Scan latest release"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={previewing || setuppingId === repo.id || ended}
                      onClick={() => {
                        if (previewing) return;
                        setSetuppingId(repo.id);
                        void (async () => {
                          try {
                            const response = await fetch(`/api/repos/${repo.id}/setup-pr`, {
                              method: "POST",
                              credentials: "include",
                            });
                            const body = (await response.json()) as {
                              error?: string;
                              reason?: string;
                              workflow?: string;
                              htmlUrl?: string;
                              number?: number;
                              existing?: boolean;
                              skipped?: string;
                            };
                            if (response.status === 409 && body.workflow) {
                              setSetupByRepo((current) => ({
                                ...current,
                                [repo.id]: {
                                  status: "copy",
                                  reason: body.reason ?? "GitHub App cannot open a pull request.",
                                  workflow: body.workflow ?? "",
                                },
                              }));
                              return;
                            }
                            if (!response.ok || !body.htmlUrl || typeof body.number !== "number") {
                              throw new Error(body.error ?? body.reason ?? "Could not open a setup PR.");
                            }
                            const htmlUrl = body.htmlUrl;
                            const number = body.number;
                            setSetupByRepo((current) => ({
                              ...current,
                              [repo.id]: {
                                status: "opened",
                                htmlUrl,
                                number,
                                existing: Boolean(body.existing),
                              },
                            }));
                          } catch (error) {
                            setSetupByRepo((current) => ({
                              ...current,
                              [repo.id]: {
                                status: "error",
                                message:
                                  error instanceof Error ? error.message : "Could not open a setup PR.",
                              },
                            }));
                          } finally {
                            setSetuppingId(null);
                          }
                        })();
                      }}
                    >
                      {setuppingId === repo.id ? "Opening…" : "Setup PR"}
                    </Button>
                  </div>
                  {setupByRepo[repo.id] ? <SetupPrResult view={setupByRepo[repo.id]!} /> : null}
                </li>
              ))}
            </ul>
          )}
          {scanError && <p className="mt-4 text-sm text-danger">{scanError}</p>}
        </section>

        <section className={ended ? "pointer-events-none select-none opacity-25" : undefined}>
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Alerts</h2>
          {!previewing && alerts.status === "loading" && <p className="mt-6 text-sm text-dim">Loading…</p>}
          {!previewing && alerts.status === "error" && <p className="mt-6 text-sm text-danger">{alerts.message}</p>}
          {deskAlerts.length === 0 && (previewing || alerts.status === "ready") && (
            <p className="mt-6 text-sm leading-relaxed text-mute">
              Quiet so far. That is the good state — until a repo goes public or a release ships a map.
            </p>
          )}
          {deskAlerts.length > 0 && (
            <ul className="mt-4 max-h-[32rem] divide-y divide-white/5 overflow-auto">
              {deskAlerts.map((alert) => (
                <li key={alert.id} className="py-5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-dim">
                    {kindLabel(alert.kind)} · {new Date(alert.created_at).toLocaleString()}
                  </p>
                  <p className="mt-2 text-sm text-snow">{alert.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-dim">{alert.body}</p>
                  {Array.isArray(alert.findings) && alert.findings.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1">
                      {alert.findings.map((finding) => (
                        <li
                          key={`${alert.id}-${finding.rule}-${finding.path}`}
                          className="font-mono text-[11px] text-mute"
                        >
                          {finding.rule} · {finding.path}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={`mt-16 ${ended ? "pointer-events-none select-none opacity-25" : ""}`}>
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">npm packages</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
          We fetch the tarball a registry serves for <code className="text-snow">latest</code>. Public
          packs use registry.npmjs.org. Private registries need an encrypted token (never shown
          again). Tarball hosts must match the saved registry. Source is not kept.
        </p>
        {!previewing && packages.status === "loading" && <p className="mt-6 text-sm text-dim">Loading…</p>}
        {!previewing && packages.status === "error" && (
          <p className="mt-6 text-sm text-danger">{packages.message}</p>
        )}
        {!previewing && user && installations.length > 0 && (
          <form
            className="mt-6 flex max-w-xl flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (ended || savingRegistry) return;
              setRegistryError(null);
              setSavingRegistry(true);
              void (async () => {
                try {
                  const response = await fetch("/api/registries", {
                    method: "POST",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      origin: registryOriginInput,
                      token: registryToken,
                      installationId: installations[0]?.id,
                    }),
                  });
                  const body = (await response.json()) as { error?: string };
                  if (!response.ok) throw new Error(body.error ?? "Could not save registry.");
                  setRegistryToken("");
                  setRegistryOriginInput("");
                  await refreshSignedIn();
                } catch (error) {
                  setRegistryError(error instanceof Error ? error.message : "Could not save registry.");
                } finally {
                  setSavingRegistry(false);
                }
              })();
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Private registry</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1">
                <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Origin</span>
                <input
                  value={registryOriginInput}
                  onChange={(event) => setRegistryOriginInput(event.target.value)}
                  placeholder="https://npm.pkg.github.com"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={ended}
                  className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                />
              </label>
              <label className="min-w-0 flex-1">
                <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Token</span>
                <input
                  type="password"
                  value={registryToken}
                  onChange={(event) => setRegistryToken(event.target.value)}
                  placeholder="read-only token"
                  autoComplete="new-password"
                  disabled={ended}
                  className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                />
              </label>
              <Button type="submit" disabled={ended || savingRegistry || !registryOriginInput.trim() || !registryToken.trim()}>
                {savingRegistry ? "Saving…" : "Save token"}
              </Button>
            </div>
          </form>
        )}
        {registryError && <p className="mt-4 text-sm text-danger">{registryError}</p>}
        {!previewing && registries.length > 0 && (
          <ul className="mt-4 max-w-xl divide-y divide-white/5">
            {registries.map((registry) => (
              <li key={registry.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <p className="font-mono text-xs text-mute">{registry.origin}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={ended || removingRegistryId === registry.id}
                  onClick={() => {
                    setRemovingRegistryId(registry.id);
                    void (async () => {
                      try {
                        const response = await fetch(`/api/registries/${registry.id}`, {
                          method: "DELETE",
                          credentials: "include",
                        });
                        const body = (await response.json()) as { error?: string };
                        if (!response.ok) throw new Error(body.error ?? "Could not remove registry.");
                        await refreshSignedIn();
                      } catch (error) {
                        setRegistryError(
                          error instanceof Error ? error.message : "Could not remove registry.",
                        );
                      } finally {
                        setRemovingRegistryId(null);
                      }
                    })();
                  }}
                >
                  {removingRegistryId === registry.id ? "Removing…" : "Remove"}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {!previewing && user && installations.length > 0 && (
          <form
            className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (ended || watchingPackage) return;
              setPackageError(null);
              setWatchingPackage(true);
              void (async () => {
                try {
                  const response = await fetch("/api/packages", {
                    method: "POST",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      packageName,
                      installationId: installations[0]?.id,
                      registryOrigin: watchRegistryOrigin,
                    }),
                  });
                  const body = (await response.json()) as { error?: string };
                  if (!response.ok) throw new Error(body.error ?? "Could not watch package.");
                  setPackageName("");
                  await refreshSignedIn();
                } catch (error) {
                  setPackageError(error instanceof Error ? error.message : "Could not watch package.");
                } finally {
                  setWatchingPackage(false);
                }
              })();
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Package name</span>
              <input
                value={packageName}
                onChange={(event) => setPackageName(event.target.value)}
                placeholder="@scope/name"
                autoComplete="off"
                spellCheck={false}
                disabled={ended}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
              />
            </label>
            <label className="min-w-0 sm:w-56">
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Registry</span>
              <select
                value={watchRegistryOrigin}
                onChange={(event) => setWatchRegistryOrigin(event.target.value)}
                disabled={ended}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
              >
                <option value="https://registry.npmjs.org">registry.npmjs.org</option>
                {registries.map((registry) => (
                  <option key={registry.id} value={registry.origin}>
                    {registry.host}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={ended || watchingPackage || !packageName.trim()}>
              {watchingPackage ? "Connecting…" : "Watch package"}
            </Button>
          </form>
        )}
        {packageError && <p className="mt-4 text-sm text-danger">{packageError}</p>}
        {deskPackages.length === 0 && (previewing || packages.status === "ready") && (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            No packages yet. Connect a public pack, or save a private registry token and watch from
            that host.
          </p>
        )}
        {deskPackages.length > 0 && (
          <ul className="mt-4 divide-y divide-white/5">
            {deskPackages.map((pkg) => {
              const diffState = diffByPackage[pkg.id];
              return (
                <li key={pkg.id} className="py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm text-snow">{pkg.package_name}</p>
                      <p className="mt-1 text-xs text-dim">
                        {pkg.registry_origin && pkg.registry_origin !== "https://registry.npmjs.org"
                          ? `${pkg.registry_origin} · `
                          : ""}
                        {pkg.last_version ? `@${pkg.last_version}` : "not scanned yet"}
                        {pkg.last_scan_status ? ` · ${pkg.last_scan_status}` : ""}
                        {pkg.last_sha256 ? ` · ${pkg.last_sha256.slice(0, 12)}` : ""}
                        {pkg.last_checked_at
                          ? ` · checked ${new Date(pkg.last_checked_at).toLocaleString()}`
                          : ""}
                        {baselineByPackage[pkg.id]
                          ? ` · baseline ${baselineByPackage[pkg.id]?.actorLogin} ${new Date(baselineByPackage[pkg.id]?.createdAt ?? "").toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={previewing || ended || checkingId === pkg.id}
                        onClick={() => {
                          setPackageError(null);
                          setCheckingId(pkg.id);
                          void (async () => {
                            try {
                              const response = await fetch(`/api/packages/${pkg.id}/check`, {
                                method: "POST",
                                credentials: "include",
                              });
                              const body = (await response.json()) as { error?: string };
                              if (!response.ok) throw new Error(body.error ?? "Could not check package.");
                              await refreshSignedIn();
                            } catch (error) {
                              setPackageError(
                                error instanceof Error ? error.message : "Could not check package.",
                              );
                            } finally {
                              setCheckingId(null);
                            }
                          })();
                        }}
                      >
                        {checkingId === pkg.id ? "Checking…" : "Check now"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={previewing || ended || diffingId === pkg.id}
                        onClick={() => {
                          setPackageError(null);
                          setDiffingId(pkg.id);
                          void (async () => {
                            try {
                              const body = await loadJson<ReleaseDiffView>(
                                `/api/packages/${pkg.id}/diff`,
                              );
                              setDiffByPackage((current) => ({ ...current, [pkg.id]: body }));
                            } catch (error) {
                              setDiffByPackage((current) => ({
                                ...current,
                                [pkg.id]: {
                                  error:
                                    error instanceof Error ? error.message : "Could not load diff.",
                                },
                              }));
                            } finally {
                              setDiffingId(null);
                            }
                          })();
                        }}
                      >
                        {diffingId === pkg.id ? "Diffing…" : "Diff"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={previewing || ended || approvingId === pkg.id}
                        onClick={() => {
                          setPackageError(null);
                          setApprovingId(pkg.id);
                          void (async () => {
                            try {
                              const response = await fetch(`/api/packages/${pkg.id}/baseline`, {
                                method: "POST",
                                credentials: "include",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ reason: baselineReason }),
                              });
                              const body = (await response.json()) as { error?: string };
                              if (!response.ok) {
                                throw new Error(body.error ?? "Could not approve baseline.");
                              }
                              await refreshSignedIn();
                            } catch (error) {
                              setPackageError(
                                error instanceof Error ? error.message : "Could not approve baseline.",
                              );
                            } finally {
                              setApprovingId(null);
                            }
                          })();
                        }}
                      >
                        {approvingId === pkg.id ? "Approving…" : "Approve baseline"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={previewing || ended}
                        onClick={() => {
                          setPackageError(null);
                          void (async () => {
                            try {
                              const response = await fetch(`/api/packages/${pkg.id}`, {
                                method: "DELETE",
                                credentials: "include",
                              });
                              const body = (await response.json()) as { error?: string };
                              if (!response.ok) {
                                throw new Error(body.error ?? "Could not remove package.");
                              }
                              await refreshSignedIn();
                            } catch (error) {
                              setPackageError(
                                error instanceof Error ? error.message : "Could not remove package.",
                              );
                            }
                          })();
                        }}
                      >
                        Stop
                      </Button>
                    </div>
                  </div>
                  {diffState && "error" in diffState ? (
                    <p className="mt-3 text-sm text-danger">{diffState.error}</p>
                  ) : null}
                  {diffState && "diff" in diffState ? (
                    <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
                      {!diffState.previous || !diffState.current || !diffState.diff ? (
                        <p className="text-sm text-mute">
                          {diffState.baseline
                            ? "Current receipt is the approved baseline."
                            : "Need two receipts, or an approved baseline, before a release diff exists."}
                        </p>
                      ) : (
                        <>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-dim">
                            {diffState.versus === "baseline" ? "vs baseline · " : ""}
                            {diffState.previous.coordinate} → {diffState.current.coordinate}
                            {diffState.diff.unexpectedSizeJump ? " · unexpected size jump" : ""}
                          </p>
                          <p className="mt-2 text-xs text-dim">
                            +{diffState.diff.added.length} −{diffState.diff.removed.length} ~
                            {diffState.diff.changed.length} · {diffState.diff.sizeDelta >= 0 ? "+" : ""}
                            {diffState.diff.sizeDelta} bytes
                          </p>
                          <ul className="mt-3 flex flex-col gap-1 font-mono text-[11px] text-mute">
                            {diffState.diff.added.map((entry) => (
                              <li key={`a-${entry.path}`}>+ {entry.path}</li>
                            ))}
                            {diffState.diff.removed.map((entry) => (
                              <li key={`r-${entry.path}`}>− {entry.path}</li>
                            ))}
                            {diffState.diff.changed.map((entry) => (
                              <li key={`c-${entry.path}`}>~ {entry.path}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={`mt-16 ${ended ? "pointer-events-none select-none opacity-25" : ""}`}>
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Scan API</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
          Mint a token to <code className="text-snow">POST</code> a packed artifact to{" "}
          <code className="text-snow">/api/v1/scan</code>. We hash the secret, show it once, and
          delete the bytes after the scan. Local CI can keep using the Action without a token.
        </p>
        {previewing ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">No scan tokens yet.</p>
        ) : (
          <>
            {user && installations.length > 0 && (
              <form
                className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (ended || mintingScanToken) return;
                  setScanTokenError(null);
                  setRevealedScanToken(null);
                  setMintingScanToken(true);
                  void (async () => {
                    try {
                      const response = await fetch("/api/scan-tokens", {
                        method: "POST",
                        credentials: "include",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          name: scanTokenName,
                          installationId: installations[0]?.id,
                        }),
                      });
                      const body = (await response.json()) as { error?: string; token?: string };
                      if (!response.ok) throw new Error(body.error ?? "Could not mint token.");
                      if (body.token) setRevealedScanToken(body.token);
                      await refreshSignedIn();
                    } catch (error) {
                      setScanTokenError(
                        error instanceof Error ? error.message : "Could not mint token.",
                      );
                    } finally {
                      setMintingScanToken(false);
                    }
                  })();
                }}
              >
                <label className="min-w-0 flex-1">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Name</span>
                  <input
                    value={scanTokenName}
                    onChange={(event) => setScanTokenName(event.target.value)}
                    placeholder="CI"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={ended}
                    className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
                  />
                </label>
                <Button type="submit" disabled={ended || mintingScanToken}>
                  {mintingScanToken ? "Minting…" : "Mint token"}
                </Button>
              </form>
            )}
            {scanTokenError && <p className="mt-4 text-sm text-danger">{scanTokenError}</p>}
            {revealedScanToken ? (
              <div className="mt-6 max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-dim">
                  Copy now. We will not show this again.
                </p>
                <pre className="mt-3 overflow-auto font-mono text-[11px] leading-relaxed text-snow">
                  {revealedScanToken}
                </pre>
              </div>
            ) : null}
            {scanTokens.length === 0 ? (
              <p className="mt-6 text-sm leading-relaxed text-mute">No scan tokens yet.</p>
            ) : (
              <ul className="mt-4 max-w-xl divide-y divide-white/5">
                {scanTokens.map((token) => (
                  <li key={token.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-snow">{token.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-dim">{token.token_prefix}…</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={ended || revokingScanTokenId === token.id}
                      onClick={() => {
                        setRevokingScanTokenId(token.id);
                        void (async () => {
                          try {
                            const response = await fetch(`/api/scan-tokens/${token.id}`, {
                              method: "DELETE",
                              credentials: "include",
                            });
                            const body = (await response.json()) as { error?: string };
                            if (!response.ok) throw new Error(body.error ?? "Could not revoke token.");
                            if (revealedScanToken?.startsWith(token.token_prefix)) {
                              setRevealedScanToken(null);
                            }
                            await refreshSignedIn();
                          } catch (error) {
                            setScanTokenError(
                              error instanceof Error ? error.message : "Could not revoke token.",
                            );
                          } finally {
                            setRevokingScanTokenId(null);
                          }
                        })();
                      }}
                    >
                      {revokingScanTokenId === token.id ? "Revoking…" : "Revoke"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="mt-16">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Allowlist and baseline</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute">
          Exceptions are exact-rule, attributable, and they expire. They never suppress a different
          rule. Approve a packed receipt as the shipping baseline; later diffs use that receipt
          instead of whichever scan happened last.
        </p>
        {!previewing && (
          <label className="mt-6 block max-w-xl">
            <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Baseline reason</span>
            <input
              value={baselineReason}
              onChange={(event) => setBaselineReason(event.target.value)}
              disabled={ended}
              className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
            />
          </label>
        )}
        {!previewing && (
          <form
            className="mt-6 grid gap-4 md:grid-cols-[7rem_1fr_1fr_8rem_auto] md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (ended || savingAllow) return;
              setPackageError(null);
              setSavingAllow(true);
              void (async () => {
                try {
                  const response = await fetch("/api/exceptions", {
                    method: "POST",
                    credentials: "include",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      installationId: installations[0]?.id,
                      rule: allowRule,
                      path: allowPath,
                      reason: allowReason,
                      expires: allowExpires,
                    }),
                  });
                  const body = (await response.json()) as { error?: string };
                  if (!response.ok) throw new Error(body.error ?? "Could not save allowlist entry.");
                  setAllowRule("");
                  setAllowPath("");
                  setAllowReason("");
                  await refreshSignedIn();
                } catch (error) {
                  setPackageError(
                    error instanceof Error ? error.message : "Could not save allowlist entry.",
                  );
                } finally {
                  setSavingAllow(false);
                }
              })();
            }}
          >
            <label>
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Rule</span>
              <input
                value={allowRule}
                onChange={(event) => setAllowRule(event.target.value)}
                placeholder="SRC-001"
                disabled={ended}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 font-mono text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
              />
            </label>
            <label>
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Path glob</span>
              <input
                value={allowPath}
                onChange={(event) => setAllowPath(event.target.value)}
                placeholder="**/*.d.ts"
                disabled={ended}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 font-mono text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
              />
            </label>
            <label>
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Reason</span>
              <input
                value={allowReason}
                onChange={(event) => setAllowReason(event.target.value)}
                placeholder="Published TypeScript types"
                disabled={ended}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none placeholder:text-dim focus:border-white/40"
              />
            </label>
            <label>
              <span className="text-[11px] uppercase tracking-[0.16em] text-dim">Expires</span>
              <input
                type="date"
                value={allowExpires}
                onChange={(event) => setAllowExpires(event.target.value)}
                disabled={ended}
                className="mt-2 h-11 w-full rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow outline-none focus:border-white/40"
              />
            </label>
            <Button type="submit" disabled={ended || savingAllow || !allowRule.trim() || !allowReason.trim()}>
              {savingAllow ? "Saving…" : "Allow"}
            </Button>
          </form>
        )}
        {previewing ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            Sign in to manage allowlist entries on your installations. Preview does not invent
            packages or exceptions.
          </p>
        ) : exceptions.length === 0 ? (
          <p className="mt-6 text-sm leading-relaxed text-mute">No active allowlist entries.</p>
        ) : (
          <ul className="mt-6 divide-y divide-white/5">
            {exceptions.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-3 py-4">
                <div>
                  <p className="font-mono text-sm text-snow">
                    {entry.rule}
                    {entry.pathPattern ? `  ${entry.pathPattern}` : "  *"}
                  </p>
                  <p className="mt-1 text-xs text-dim">
                    {entry.reason} · {entry.actorLogin} · expires{" "}
                    {entry.expiresAt.slice(0, 10)}
                    {entry.active ? "" : " · expired"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={ended || revokingId === entry.id}
                  onClick={() => {
                    setPackageError(null);
                    setRevokingId(entry.id);
                    void (async () => {
                      try {
                        const response = await fetch(`/api/exceptions/${entry.id}/revoke`, {
                          method: "POST",
                          credentials: "include",
                        });
                        const body = (await response.json()) as { error?: string };
                        if (!response.ok) throw new Error(body.error ?? "Could not revoke.");
                        await refreshSignedIn();
                      } catch (error) {
                        setPackageError(error instanceof Error ? error.message : "Could not revoke.");
                      } finally {
                        setRevokingId(null);
                      }
                    })();
                  }}
                >
                  {revokingId === entry.id ? "Revoking…" : "Revoke"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
