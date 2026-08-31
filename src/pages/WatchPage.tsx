import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { navigate } from "@/nav.ts";
import type { Finding } from "@/report-types";

type Me = {
  user: { id: string; login: string; avatarUrl: string | null } | null;
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
    default:
      return kind;
  }
}

export function WatchPage() {
  const [me, setMe] = useState<LoadState<Me>>({ status: "loading" });
  const [repos, setRepos] = useState<LoadState<{ repos: Repo[] }>>({ status: "loading" });
  const [alerts, setAlerts] = useState<LoadState<{ alerts: Alert[] }>>({ status: "loading" });
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanningId, setScanningId] = useState<number | null>(null);

  const refreshSignedIn = useCallback(async () => {
    setRepos({ status: "loading" });
    setAlerts({ status: "loading" });
    try {
      const [repoBody, alertBody] = await Promise.all([
        loadJson<{ repos: Repo[] }>("/api/repos"),
        loadJson<{ alerts: Alert[] }>("/api/alerts"),
      ]);
      setRepos({ status: "ready", data: repoBody });
      setAlerts({ status: "ready", data: alertBody });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load.";
      setRepos({ status: "error", message });
      setAlerts({ status: "error", message });
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

  const { user, githubApp, installUrl, installations } = me.data;

  if (!user) {
    return (
      <main className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-5xl flex-col justify-center px-5 py-16 md:py-24">
        <p className="text-[11px] uppercase tracking-[0.28em] text-dim">No spoilers in production</p>
        <h1 className="mt-5 max-w-3xl font-display text-[2.6rem] leading-[1.05] tracking-tight text-snow sm:text-6xl md:text-7xl">
          Catch the public flip.
          <br />
          Catch the pack.
        </h1>
        <p className="mt-6 max-w-lg text-base leading-relaxed text-mute md:text-lg">
          NoSpoilers watches GitHub when a private repo goes public, then reads the installer
          customers actually download — not the git tree. Source maps and <code className="text-snow">.env</code> files
          do not belong in the cut you ship.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
          {githubApp ? (
            <Button asChild size="lg">
              <a href="/api/auth/github">Sign in with GitHub</a>
            </Button>
          ) : (
            <Button type="button" size="lg" disabled>
              Sign in with GitHub
            </Button>
          )}
          <Button type="button" size="lg" variant="ghost" onClick={() => navigate("/scan")}>
            Scan a pack instead
          </Button>
        </div>
        {!githubApp && (
          <p className="mt-6 max-w-lg text-sm leading-relaxed text-dim">
            Sign-in stays off until you create the GitHub App and put the keys in{" "}
            <code className="text-mute">.env</code>. The pack scanner on Scan does not need that.
          </p>
        )}
        <ul className="mt-20 grid gap-10 border-t border-white/5 pt-10 sm:grid-cols-3">
          <li>
            <p className="font-display text-sm text-snow">Watch GitHub</p>
            <p className="mt-2 text-sm leading-relaxed text-dim">
              Publicize, transfer, collaborator, fork. The doorbell answers in under a second.
            </p>
          </li>
          <li>
            <p className="font-display text-sm text-snow">Read the pack</p>
            <p className="mt-2 text-sm leading-relaxed text-dim">
              npm tarball, zip, Electron asar. Same scanner as CI. We do not keep the bytes.
            </p>
          </li>
          <li>
            <p className="font-display text-sm text-snow">Fail closed</p>
            <p className="mt-2 text-sm leading-relaxed text-dim">
              A CLI and GitHub Action for the build. The hosted bot is for everything you forget to wire.
            </p>
          </li>
        </ul>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-12 md:py-16">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-dim">{user.login}</p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-snow md:text-4xl">Watch desk</h1>
          <p className="mt-2 text-sm text-mute">
            {installations.length > 0
              ? `Watching ${installations.map((row) => row.account_login).join(", ")}`
              : "No installs linked yet"}
          </p>
        </div>
        {installUrl && githubApp && (
          <Button asChild>
            <a href={installUrl}>Install on GitHub</a>
          </Button>
        )}
      </div>

      <div className="mt-14 grid gap-16 lg:grid-cols-[0.95fr_1.05fr]">
        <section>
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Repositories</h2>
          {repos.status === "loading" && <p className="mt-6 text-sm text-dim">Loading…</p>}
          {repos.status === "error" && <p className="mt-6 text-sm text-danger">{repos.message}</p>}
          {repos.status === "ready" && repos.data.repos.length === 0 && (
            <p className="mt-6 text-sm leading-relaxed text-mute">
              Nothing on this install yet. Install NoSpoilers on a private throwaway repo.
            </p>
          )}
          {repos.status === "ready" && repos.data.repos.length > 0 && (
            <ul className="mt-4 divide-y divide-white/5">
              {repos.data.repos.map((repo) => (
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
                  <button
                    type="button"
                    className="mt-3 text-xs text-mute underline-offset-4 hover:text-snow hover:underline disabled:opacity-40"
                    disabled={scanningId === repo.id}
                    onClick={() => {
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
                  </button>
                </li>
              ))}
            </ul>
          )}
          {scanError && <p className="mt-4 text-sm text-danger">{scanError}</p>}
        </section>

        <section>
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-dim">Alerts</h2>
          {alerts.status === "loading" && <p className="mt-6 text-sm text-dim">Loading…</p>}
          {alerts.status === "error" && <p className="mt-6 text-sm text-danger">{alerts.message}</p>}
          {alerts.status === "ready" && alerts.data.alerts.length === 0 && (
            <p className="mt-6 text-sm leading-relaxed text-mute">
              Quiet so far. That is the good state — until a repo goes public or a release ships a map.
            </p>
          )}
          {alerts.status === "ready" && alerts.data.alerts.length > 0 && (
            <ul className="mt-4 max-h-[32rem] divide-y divide-white/5 overflow-auto">
              {alerts.data.alerts.map((alert) => (
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
    </main>
  );
}
