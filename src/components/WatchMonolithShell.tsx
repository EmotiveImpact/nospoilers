import { signOut } from "@/auth.ts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { navigate } from "@/nav.ts";
import type { Coverage } from "@/coverage.ts";
import {
  VIEW_TITLE,
  type AlertTab,
  type WatchRoute,
  type WatchView,
  watchHref,
  watchPath,
} from "@/watch/routes.ts";
import type { MouseEvent, ReactNode } from "react";

type InstallRow = {
  id: number;
  account_login: string;
  suspended?: boolean;
};

function go(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  navigate(href);
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={(event) => go(event, href)}
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px]",
        active ? "bg-white/8 text-snow" : "text-mute hover:bg-white/5 hover:text-snow",
      )}
    >
      {children}
    </a>
  );
}

export function WatchMonolithShell({
  route,
  search,
  coverage,
  ended,
  role,
  teamOnly,
  adminOnly,
  login,
  sourceCount,
  openAlertCount,
  waitingCount,
  mineCount,
  resolvedCount,
  setupDone,
  setupTotal,
  installations,
  activeInstallId,
  onInstall,
  installUrl,
  onOpenPalette,
  children,
}: {
  route: WatchRoute;
  search: string;
  coverage?: Coverage;
  ended: boolean;
  role?: "admin" | "member" | null;
  teamOnly: boolean;
  adminOnly: boolean;
  login: string;
  sourceCount: number;
  openAlertCount: number;
  waitingCount: number;
  mineCount: number;
  resolvedCount: number;
  setupDone: number;
  setupTotal: number;
  installations: InstallRow[];
  activeInstallId: number | null;
  onInstall: (id: number) => void;
  installUrl?: string;
  onOpenPalette: () => void;
  children: ReactNode;
}) {
  const hrefFor = (view: WatchView, tab?: AlertTab) =>
    watchHref(watchPath(view), search, tab ? { tab } : {});
  const alertActive = (tab: AlertTab) => route.view === "alerts" && route.tab === tab;

  return (
    <div className="flex min-h-svh bg-ink">
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/8 bg-[#0c0c0e]">
        <div className="border-b border-white/8 px-4 py-4">
          <p className="font-display text-sm text-snow">NoSpoilers</p>
          {installations.length > 1 ? (
            <label className="mt-3 block">
              <span className="text-[10px] uppercase tracking-[0.16em] text-dim">Install</span>
              <select
                value={activeInstallId ?? ""}
                onChange={(event) => {
                  const id = Number(event.target.value);
                  if (Number.isFinite(id) && id > 0) onInstall(id);
                }}
                className="mt-1 h-9 w-full rounded-md border border-white/15 bg-ink px-2 text-sm text-snow outline-none focus:border-white/40"
              >
                {installations.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.account_login}
                    {row.suspended ? " (suspended)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="mt-2 truncate text-xs text-mute">{login}</p>
          )}
          <p className="mt-1 text-[11px] text-dim">
            {sourceCount > 0 ? `${sourceCount} sources` : "nothing connected"}
          </p>
        </div>

        <nav className="flex-1 space-y-5 overflow-auto px-3 py-4" aria-label="Watch desk">
          <div className="space-y-0.5">
            <NavLink href={hrefFor("overview")} active={route.view === "overview"}>
              Overview
            </NavLink>
            <NavLink href={hrefFor("alerts")} active={alertActive("open") && route.view === "alerts" && route.tab === "open"}>
              Alerts
              {openAlertCount > 0 ? (
                <span className="ml-auto rounded-full bg-danger/20 px-1.5 text-[10px] text-danger">
                  {openAlertCount}
                </span>
              ) : null}
            </NavLink>
            <NavLink href={hrefFor("sources")} active={route.view === "sources"}>
              Sources
              {sourceCount > 0 ? (
                <span className="ml-auto text-[10px] text-dim">{sourceCount}</span>
              ) : null}
            </NavLink>
            <NavLink href={hrefFor("releases")} active={route.view === "releases"}>
              Releases
            </NavLink>
            {teamOnly ? (
              <NavLink href={hrefFor("timeline")} active={route.view === "timeline"}>
                Timeline
              </NavLink>
            ) : null}
            <NavLink href={hrefFor("setup")} active={route.view === "setup"}>
              Finish setup
            </NavLink>
          </div>

          <div>
            <p className="px-2.5 pb-1 text-[10px] uppercase tracking-[0.16em] text-dim">Alert views</p>
            <div className="space-y-0.5">
              <NavLink href={hrefFor("alerts", "open")} active={alertActive("open")}>
                Needs triage
                {openAlertCount > 0 ? (
                  <span className="ml-auto text-[10px] text-danger">{openAlertCount}</span>
                ) : null}
              </NavLink>
              <NavLink href={hrefFor("alerts", "waiting")} active={alertActive("waiting")}>
                Waiting on rotation
                {waitingCount > 0 ? (
                  <span className="ml-auto text-[10px] text-dim">{waitingCount}</span>
                ) : null}
              </NavLink>
              {teamOnly ? (
                <NavLink href={hrefFor("alerts", "mine")} active={alertActive("mine")}>
                  Assigned to me
                  {mineCount > 0 ? (
                    <span className="ml-auto text-[10px] text-dim">{mineCount}</span>
                  ) : null}
                </NavLink>
              ) : null}
              <NavLink href={hrefFor("alerts", "done")} active={alertActive("done")}>
                Resolved
                {resolvedCount > 0 ? (
                  <span className="ml-auto text-[10px] text-dim">{resolvedCount}</span>
                ) : null}
              </NavLink>
            </div>
          </div>

          <div>
            <p className="px-2.5 pb-1 text-[10px] uppercase tracking-[0.16em] text-dim">Settings</p>
            <div className="space-y-0.5">
              <NavLink href={hrefFor("notifications")} active={route.view === "notifications"}>
                Notifications
              </NavLink>
              <NavLink href={hrefFor("policy")} active={route.view === "policy"}>
                Policy &amp; allowlist
              </NavLink>
              <NavLink href={hrefFor("team")} active={route.view === "team"}>
                Team &amp; roles
              </NavLink>
              <NavLink href={hrefFor("retention")} active={route.view === "retention"}>
                Retention
              </NavLink>
              {teamOnly ? (
                <NavLink href={hrefFor("audit")} active={route.view === "audit"}>
                  Audit log
                </NavLink>
              ) : null}
              <NavLink href={hrefFor("health")} active={route.view === "health"}>
                Install health
              </NavLink>
              {adminOnly ? (
                <>
                  <NavLink href={hrefFor("tokens")} active={route.view === "tokens"}>
                    Scan API tokens
                  </NavLink>
                  <NavLink href={hrefFor("registries")} active={route.view === "registries"}>
                    Private registries
                  </NavLink>
                </>
              ) : null}
            </div>
          </div>
        </nav>

        <a
          href={hrefFor("setup")}
          onClick={(event) => go(event, hrefFor("setup"))}
          className="border-t border-white/8 px-4 py-3 text-left hover:bg-white/3"
        >
          <p className="text-xs text-snow">
            {setupDone} of {setupTotal} leak paths covered
          </p>
          <p className={cn("mt-0.5 text-[11px]", ended ? "text-danger" : "text-dim")}>
            {coverage?.label ?? "Coverage"}
            {role ? ` · ${role}` : ""}
          </p>
        </a>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-white/8 px-5">
          <button
            type="button"
            onClick={onOpenPalette}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-white/10 bg-white/3 px-3 text-left text-sm text-dim hover:border-white/20"
          >
            <span className="truncate">Search or run a command…</span>
            <span className="ml-auto hidden rounded border border-white/10 px-1.5 text-[10px] text-dim sm:inline">
              ⌘K
            </span>
          </button>
          <strong className="hidden shrink-0 text-sm text-snow md:inline">{VIEW_TITLE[route.view]}</strong>
          {ended ? (
            <Button type="button" size="sm" onClick={() => navigate("/pricing")}>
              See plans
            </Button>
          ) : null}
          {installUrl ? (
            <Button as="a" href={installUrl} size="sm" variant="outline">
              Install on GitHub
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-8 md:px-8">{children}</div>
      </div>
    </div>
  );
}
