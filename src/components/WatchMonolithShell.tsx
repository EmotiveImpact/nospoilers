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
import { useState, type MouseEvent, type ReactNode } from "react";

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
  onNavigate,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <a
      href={href}
      onClick={(event) => {
        go(event, href);
        onNavigate?.();
      }}
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
  billing,
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
  billing?: ReactNode;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const hrefFor = (view: WatchView, tab?: AlertTab) =>
    watchHref(watchPath(view), search, tab ? { tab } : {});
  const alertActive = (tab: AlertTab) => route.view === "alerts" && route.tab === tab;
  const closeNav = () => setNavOpen(false);

  const nav = (
    <>
      <div className="border-b border-white/8 px-4 py-4">
        <a
          href="/"
          onClick={(event) => go(event, "/")}
          className="font-display text-sm text-snow hover:text-snow"
        >
          NoSpoilers
        </a>
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

      <nav className="flex flex-1 flex-col gap-5 overflow-auto px-3 py-4" aria-label="Watch desk">
        <div className="flex flex-col gap-0.5">
          <NavLink href={hrefFor("overview")} active={route.view === "overview"} onNavigate={closeNav}>
            Overview
          </NavLink>
          <NavLink href={hrefFor("alerts")} active={alertActive("open")} onNavigate={closeNav}>
            Alerts
            {openAlertCount > 0 ? (
              <span className="ml-auto rounded-full bg-danger/20 px-1.5 text-[10px] text-danger">
                {openAlertCount}
              </span>
            ) : null}
          </NavLink>
          <NavLink href={hrefFor("sources")} active={route.view === "sources"} onNavigate={closeNav}>
            Sources
            {sourceCount > 0 ? (
              <span className="ml-auto text-[10px] text-dim">{sourceCount}</span>
            ) : null}
          </NavLink>
          <NavLink href={hrefFor("releases")} active={route.view === "releases"} onNavigate={closeNav}>
            Releases
          </NavLink>
          {teamOnly ? (
            <NavLink href={hrefFor("timeline")} active={route.view === "timeline"} onNavigate={closeNav}>
              Timeline
            </NavLink>
          ) : null}
          <NavLink href={hrefFor("setup")} active={route.view === "setup"} onNavigate={closeNav}>
            Finish setup
          </NavLink>
        </div>

        <div>
          <p className="px-2.5 pb-1 text-[10px] uppercase tracking-[0.16em] text-dim">Alert views</p>
          <div className="flex flex-col gap-0.5">
            <NavLink href={hrefFor("alerts", "open")} active={alertActive("open")} onNavigate={closeNav}>
              Needs triage
              {openAlertCount > 0 ? (
                <span className="ml-auto text-[10px] text-danger">{openAlertCount}</span>
              ) : null}
            </NavLink>
            <NavLink
              href={hrefFor("alerts", "waiting")}
              active={alertActive("waiting")}
              onNavigate={closeNav}
            >
              Waiting on rotation
              {waitingCount > 0 ? (
                <span className="ml-auto text-[10px] text-dim">{waitingCount}</span>
              ) : null}
            </NavLink>
            {teamOnly ? (
              <NavLink href={hrefFor("alerts", "mine")} active={alertActive("mine")} onNavigate={closeNav}>
                Assigned to me
                {mineCount > 0 ? (
                  <span className="ml-auto text-[10px] text-dim">{mineCount}</span>
                ) : null}
              </NavLink>
            ) : null}
            <NavLink href={hrefFor("alerts", "done")} active={alertActive("done")} onNavigate={closeNav}>
              Resolved
              {resolvedCount > 0 ? (
                <span className="ml-auto text-[10px] text-dim">{resolvedCount}</span>
              ) : null}
            </NavLink>
          </div>
        </div>

        <div>
          <p className="px-2.5 pb-1 text-[10px] uppercase tracking-[0.16em] text-dim">Settings</p>
          <div className="flex flex-col gap-0.5">
            <NavLink
              href={hrefFor("notifications")}
              active={route.view === "notifications"}
              onNavigate={closeNav}
            >
              Notifications
            </NavLink>
            <NavLink href={hrefFor("policy")} active={route.view === "policy"} onNavigate={closeNav}>
              Policy &amp; allowlist
            </NavLink>
            <NavLink href={hrefFor("team")} active={route.view === "team"} onNavigate={closeNav}>
              Team &amp; roles
            </NavLink>
            <NavLink href={hrefFor("retention")} active={route.view === "retention"} onNavigate={closeNav}>
              Retention
            </NavLink>
            {teamOnly ? (
              <NavLink href={hrefFor("audit")} active={route.view === "audit"} onNavigate={closeNav}>
                Audit log
              </NavLink>
            ) : null}
            <NavLink href={hrefFor("health")} active={route.view === "health"} onNavigate={closeNav}>
              Install health
            </NavLink>
            {adminOnly ? (
              <>
                <NavLink href={hrefFor("tokens")} active={route.view === "tokens"} onNavigate={closeNav}>
                  Scan API tokens
                </NavLink>
                <NavLink
                  href={hrefFor("registries")}
                  active={route.view === "registries"}
                  onNavigate={closeNav}
                >
                  Private registries
                </NavLink>
              </>
            ) : null}
          </div>
        </div>
      </nav>

      <a
        href={hrefFor("setup")}
        onClick={(event) => {
          go(event, hrefFor("setup"));
          closeNav();
        }}
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
    </>
  );

  return (
    <div className="flex min-h-svh bg-ink">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/8 bg-[#0c0c0e] md:flex">
        {nav}
      </aside>

      {navOpen ? (
        <div className="fixed inset-0 z-30 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close watch navigation"
            onClick={closeNav}
          />
          <aside className="relative z-10 flex h-full w-60 flex-col border-r border-white/8 bg-[#0c0c0e]">
            {nav}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-white/8 px-5">
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-md text-snow hover:bg-white/5 md:hidden"
            onClick={() => setNavOpen(true)}
          >
            <span className="sr-only">Open watch navigation</span>
            <span aria-hidden className="text-lg leading-none">
              ☰
            </span>
          </button>
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
          {billing}
          <Button type="button" size="sm" variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-8 md:px-8">{children}</div>
      </div>
    </div>
  );
}
