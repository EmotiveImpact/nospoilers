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
  last_version: string | null;
  last_checked_at: string | null;
  last_scanned_at: string | null;
  last_scan_status: string | null;
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

export function WatchPage({ search }: { search: string }) {
  const [me, setMe] = useState<LoadState<Me>>({ status: "loading" });
  const [repos, setRepos] = useState<LoadState<{ repos: Repo[] }>>({ status: "loading" });
  const [alerts, setAlerts] = useState<LoadState<{ alerts: Alert[] }>>({ status: "loading" });
  const [packages, setPackages] = useState<LoadState<{ packages: WatchedPackage[] }>>({
    status: "loading",
  });
  const [scanError, setScanError] = useState<string | null>(null);
  const [packageError, setPackageError] = useState<string | null>(null);
  const [scanningId, setScanningId] = useState<number | null>(null);
  const [packageName, setPackageName] = useState("");
  const [watchingPackage, setWatchingPackage] = useState(false);
  const [checkingId, setCheckingId] = useState<number | null>(null);

  const refreshSignedIn = useCallback(async () => {
    setRepos({ status: "loading" });
    setAlerts({ status: "loading" });
    setPackages({ status: "loading" });
    try {
      const [repoBody, alertBody, packageBody] = await Promise.all([
        loadJson<{ repos: Repo[] }>("/api/repos"),
        loadJson<{ alerts: Alert[] }>("/api/alerts"),
        loadJson<{ packages: WatchedPackage[] }>("/api/packages"),
      ]);
      setRepos({ status: "ready", data: repoBody });
      setAlerts({ status: "ready", data: alertBody });
      setPackages({ status: "ready", data: packageBody });
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
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3"
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
          We fetch the tarball registry.npmjs.org serves for <code className="text-snow">latest</code>
          . New versions, mutated bytes under the same version, and dist-tag moves enqueue a job.
          Source is not kept.
        </p>
        {!previewing && packages.status === "loading" && <p className="mt-6 text-sm text-dim">Loading…</p>}
        {!previewing && packages.status === "error" && (
          <p className="mt-6 text-sm text-danger">{packages.message}</p>
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
            <Button type="submit" disabled={ended || watchingPackage || !packageName.trim()}>
              {watchingPackage ? "Connecting…" : "Watch package"}
            </Button>
          </form>
        )}
        {packageError && <p className="mt-4 text-sm text-danger">{packageError}</p>}
        {deskPackages.length === 0 && (previewing || packages.status === "ready") && (
          <p className="mt-6 text-sm leading-relaxed text-mute">
            No packages yet. Connect a public package you ship. Private registries are not in this
            slice.
          </p>
        )}
        {deskPackages.length > 0 && (
          <ul className="mt-4 divide-y divide-white/5">
            {deskPackages.map((pkg) => (
              <li key={pkg.id} className="flex flex-wrap items-baseline justify-between gap-3 py-5">
                <div>
                  <p className="font-mono text-sm text-snow">{pkg.package_name}</p>
                  <p className="mt-1 text-xs text-dim">
                    {pkg.last_version ? `@${pkg.last_version}` : "not scanned yet"}
                    {pkg.last_scan_status ? ` · ${pkg.last_scan_status}` : ""}
                    {pkg.last_checked_at
                      ? ` · checked ${new Date(pkg.last_checked_at).toLocaleString()}`
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
                          if (!response.ok) throw new Error(body.error ?? "Could not remove package.");
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
