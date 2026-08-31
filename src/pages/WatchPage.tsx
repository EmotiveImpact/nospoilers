import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      return "Release pack";
    case "push_sensitive_path":
      return "Path watch";
    case "scan_latest_release":
      return "Release pack";
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
      <main className="mx-auto flex min-h-[50svh] max-w-5xl items-center justify-center px-5">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#e8dfc8]" aria-hidden />
          <p className="text-sm text-[#c4b79a]">Checking GitHub session…</p>
        </div>
      </main>
    );
  }

  if (me.status === "error") {
    return (
      <main className="mx-auto max-w-5xl px-5 py-10">
        <Card className="border-[#c23b22]/40">
          <CardHeader>
            <CardTitle>Could not load the watch desk</CardTitle>
            <CardDescription>{me.message}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const { user, githubApp, installUrl, installations } = me.data;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-10 md:py-14">
      <section className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.22em] text-[#c23b22]">GitHub watch</p>
        <h1 className="mt-3 font-[Fraunces] text-4xl leading-[1.1] tracking-tight text-[#f4ecda] md:text-5xl">
          Catch the public flip. Catch the pack.
        </h1>
        <p className="mt-4 max-w-xl text-base text-[#c4b79a] md:text-lg">
          Install the GitHub App on a throwaway private repo, then make that repo public. An alert
          should appear here within a minute. Releases with a tarball, zip, or asar get the same
          scanner as the drop zone — we do not keep the bytes.
        </p>
      </section>

      {!githubApp && (
        <Card className="border-[#c9a227]/30">
          <CardHeader>
            <CardTitle>GitHub App env vars are empty</CardTitle>
            <CardDescription>
              Create the app in GitHub Developer settings using the README checklist, then put the
              id, PEM, webhook secret, and OAuth client values in <code>.env</code> and restart.
              The pack drop zone still works without that.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!user && (
        <Card>
          <CardHeader>
            <CardTitle>Sign in to watch GitHub</CardTitle>
            <CardDescription>
              This uses the GitHub App’s user login, not a personal access token you paste. After
              sign-in, install the app on one junk repo you can flip public.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/api/auth/github">Sign in with GitHub</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {user && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#a39882]">
              Signed in as <span className="text-[#f4ecda]">{user.login}</span>
              {installations.length > 0
                ? ` · watching ${installations.map((row) => row.account_login).join(", ")}`
                : " · no installs linked yet"}
            </p>
            {installUrl && githubApp && (
              <Button asChild variant="outline">
                <a href={installUrl}>Install on GitHub</a>
              </Button>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Repositories</CardTitle>
                <CardDescription>Name, visibility, last check. Not the git tree.</CardDescription>
              </CardHeader>
              <CardContent>
                {repos.status === "loading" && (
                  <div className="flex items-center gap-2 text-sm text-[#c4b79a]">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Loading repositories…
                  </div>
                )}
                {repos.status === "error" && (
                  <p className="text-sm text-[#f0b4a8]">{repos.message}</p>
                )}
                {repos.status === "ready" && repos.data.repos.length === 0 && (
                  <p className="text-sm text-[#a39882]">
                    No repositories on this install yet. On GitHub, install NoSpoilers on a private
                    throwaway repo.
                  </p>
                )}
                {repos.status === "ready" && repos.data.repos.length > 0 && (
                  <ul className="flex flex-col gap-3">
                    {repos.data.repos.map((repo) => (
                      <li
                        key={repo.id}
                        className="rounded-lg border border-[#2c281f] bg-[#100e0b] p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <a
                            href={repo.html_url}
                            className="font-mono text-sm text-[#f4ecda] underline-offset-2 hover:underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {repo.full_name}
                          </a>
                          <Badge variant={repo.private ? "muted" : "critical"}>
                            {repo.private ? "private" : "public"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-[#8a7f6c]">
                          Last check{" "}
                          {repo.last_checked_at
                            ? new Date(repo.last_checked_at).toLocaleString()
                            : "not yet"}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-3"
                          disabled={scanningId === repo.id}
                          onClick={() => {
                            setScanError(null);
                            setScanningId(repo.id);
                            void (async () => {
                              try {
                                const response = await fetch(
                                  `/api/repos/${repo.id}/scan-latest-release`,
                                  { method: "POST", credentials: "include" },
                                );
                                const body = (await response.json()) as { error?: string };
                                if (!response.ok) {
                                  throw new Error(body.error ?? "Could not queue scan.");
                                }
                                await refreshSignedIn();
                              } catch (error) {
                                setScanError(
                                  error instanceof Error ? error.message : "Could not queue scan.",
                                );
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
                {scanError && <p className="mt-3 text-sm text-[#f0b4a8]">{scanError}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alerts</CardTitle>
                <CardDescription>Visibility changes, collaborators, forks, pack scans.</CardDescription>
              </CardHeader>
              <CardContent>
                {alerts.status === "loading" && (
                  <div className="flex items-center gap-2 text-sm text-[#c4b79a]">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Loading alerts…
                  </div>
                )}
                {alerts.status === "error" && (
                  <p className="text-sm text-[#f0b4a8]">{alerts.message}</p>
                )}
                {alerts.status === "ready" && alerts.data.alerts.length === 0 && (
                  <p className="text-sm text-[#a39882]">
                    Quiet so far. That is the good state — until a repo goes public or a release
                    ships a map.
                  </p>
                )}
                {alerts.status === "ready" && alerts.data.alerts.length > 0 && (
                  <ul className="flex max-h-[28rem] flex-col gap-3 overflow-auto pr-1">
                    {alerts.data.alerts.map((alert) => (
                      <li key={alert.id} className="rounded-lg border border-[#2c281f] bg-[#100e0b] p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-[#c23b22]" aria-hidden />
                          <Badge>{kindLabel(alert.kind)}</Badge>
                          <span className="text-xs text-[#8a7f6c]">
                            {new Date(alert.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[#f4ecda]">{alert.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-[#8a7f6c]">{alert.body}</p>
                        {Array.isArray(alert.findings) && alert.findings.length > 0 && (
                          <ul className="mt-2 flex flex-col gap-1">
                            {alert.findings.map((finding) => (
                              <li
                                key={`${alert.id}-${finding.rule}-${finding.path}`}
                                className="font-mono text-[11px] text-[#c4b79a]"
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
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </main>
  );
}
