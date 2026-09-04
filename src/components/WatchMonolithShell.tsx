import { signOut } from "@/auth.ts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { navigate } from "@/nav.ts";
import type { Coverage } from "@/coverage.ts";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import {
  Activity,
  Bell,
  BookOpenCheck,
  Boxes,
  CircleGauge,
  Clock3,
  FileCheck2,
  HeartPulse,
  KeyRound,
  Menu,
  PackageSearch,
  PanelLeft,
  PanelLeftClose,
  Scale,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  VIEW_TITLE,
  type AlertTab,
  type WatchRoute,
  type WatchView,
  watchHref,
  watchPath,
} from "@/watch/routes.ts";
import { useState, type MouseEvent, type ReactNode } from "react";

const SIDEBAR_COLLAPSED_KEY = "nospoilers.watch.sidebar-collapsed";

function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSidebarCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // Ignore quota / private-mode failures; the session toggle still works.
  }
}

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
  collapsed,
  children,
  onNavigate,
}: {
  href: string;
  active: boolean;
  collapsed?: boolean;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  const path = href.split("?")[0] ?? href;
  const Icon =
    path === "/watch"
      ? CircleGauge
      : path.endsWith("/alerts")
        ? Bell
        : path.endsWith("/sources")
          ? Boxes
          : path.endsWith("/releases")
            ? FileCheck2
            : path.endsWith("/timeline")
              ? Activity
              : path.endsWith("/setup")
                ? ShieldCheck
                : path.endsWith("/notifications")
                  ? Bell
                  : path.endsWith("/policy")
                    ? Scale
                    : path.endsWith("/team")
                      ? Users
                      : path.endsWith("/retention")
                        ? Clock3
                        : path.endsWith("/audit")
                          ? BookOpenCheck
                          : path.endsWith("/health")
                            ? HeartPulse
                            : path.endsWith("/tokens")
                              ? KeyRound
                              : PackageSearch;
  return (
    <a
      href={href}
      onClick={(event) => {
        go(event, href);
        onNavigate?.();
      }}
      className={cn(
        "flex items-center rounded-[6px] text-[13px] leading-[1.2]",
        collapsed ? "justify-center px-1 py-[7px]" : "gap-2.5 px-[9px] py-[7px]",
        active ? "bg-white/[0.07] text-snow" : "text-mute hover:bg-white/[0.04] hover:text-snow",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-[15px] shrink-0 opacity-75" aria-hidden />
      <span className={cn(collapsed ? "sr-only" : "flex min-w-0 flex-1 items-center")}>{children}</span>
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
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);
  const hrefFor = (view: WatchView, tab?: AlertTab) =>
    watchHref(watchPath(view), search, tab ? { tab } : {});
  const closeNav = () => setNavOpen(false);
  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      writeSidebarCollapsed(next);
      return next;
    });
  };
  const installIdentity =
    installations.find((installation) => installation.id === activeInstallId)?.account_login ??
    installations[0]?.account_login ??
    login;
  const shortcutLabel =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
      ? "⌘K"
      : "Ctrl K";

  const rail = (opts: { collapsed: boolean; showToggle: boolean }) => (
    <>
      <div className={cn("border-b border-line py-[18px]", opts.collapsed ? "px-2" : "px-4")}>
        <div className={cn("flex items-center gap-2", opts.collapsed ? "justify-end" : "justify-between")}>
          <a
            href="/"
            onClick={(event) => go(event, "/")}
            className={cn(
              "font-display text-[15px] text-snow hover:text-snow",
              opts.collapsed && "sr-only",
            )}
          >
            NoSpoilers
          </a>
          {opts.showToggle ? (
            <button
              type="button"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-mute hover:bg-white/[0.06] hover:text-snow"
              aria-label={opts.collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!opts.collapsed}
              onClick={toggleCollapsed}
            >
              {opts.collapsed ? (
                <PanelLeft className="size-4" aria-hidden />
              ) : (
                <PanelLeftClose className="size-4" aria-hidden />
              )}
            </button>
          ) : null}
        </div>
        {opts.collapsed ? null : installations.length > 1 ? (
          <label className="mt-3 block">
            <span className="watch-kicker">Install</span>
            <select
              value={activeInstallId ?? ""}
              onChange={(event) => {
                const id = Number(event.target.value);
                if (Number.isFinite(id) && id > 0) onInstall(id);
              }}
              className="mt-1 h-9 w-full rounded-md border border-line bg-inset px-2 text-[13px] text-snow outline-none focus:border-line-strong"
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
          <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-inset px-2.5 py-2">
            <span className="grid size-[22px] place-items-center rounded-[5px] bg-gradient-to-br from-zinc-600 to-zinc-900 text-[10px] font-semibold text-snow">
              {installIdentity.slice(0, 2).toUpperCase()}
            </span>
            <p className="min-w-0 flex-1 truncate text-[13px] text-snow">{installIdentity}</p>
          </div>
        )}
        {opts.collapsed ? null : (
          <p className="mt-1 text-[11px] text-dim">
            {sourceCount > 0 ? `${sourceCount} sources` : "nothing connected"}
          </p>
        )}
      </div>

      <nav
        className={cn(
          "flex flex-1 flex-col gap-[18px] overflow-auto py-3.5",
          opts.collapsed ? "px-1.5" : "px-2.5",
        )}
        aria-label="Watch desk"
      >
        <div className="flex flex-col gap-0.5">
          {opts.collapsed ? null : <p className="watch-kicker px-2.5 pb-1.5">Work</p>}
          <NavLink
            href={hrefFor("overview")}
            active={route.view === "overview"}
            collapsed={opts.collapsed}
            onNavigate={closeNav}
          >
            Overview
          </NavLink>
          <NavLink
            href={hrefFor("alerts")}
            active={route.view === "alerts"}
            collapsed={opts.collapsed}
            onNavigate={closeNav}
          >
            Alerts
            {openAlertCount > 0 ? (
              <span className="ml-auto font-mono text-[11px] text-[#ff8a80]">{openAlertCount}</span>
            ) : null}
          </NavLink>
        </div>

        <div className={cn("flex flex-col gap-0.5", !opts.collapsed && "border-t border-line pt-[17px]")}>
          {opts.collapsed ? null : <p className="watch-kicker px-2.5 pb-1.5">Evidence</p>}
          <NavLink
            href={hrefFor("sources")}
            active={route.view === "sources"}
            collapsed={opts.collapsed}
            onNavigate={closeNav}
          >
            Sources
            {sourceCount > 0 ? (
              <span className="ml-auto font-mono text-[11px] text-dim">{sourceCount}</span>
            ) : null}
          </NavLink>
          <NavLink
            href={hrefFor("releases")}
            active={route.view === "releases"}
            collapsed={opts.collapsed}
            onNavigate={closeNav}
          >
            Releases
          </NavLink>
          {teamOnly ? (
            <NavLink
              href={hrefFor("timeline")}
              active={route.view === "timeline"}
              collapsed={opts.collapsed}
              onNavigate={closeNav}
            >
              Timeline
            </NavLink>
          ) : null}
        </div>

        <div>
          {opts.collapsed ? null : <p className="watch-kicker px-2.5 pb-1.5">Settings</p>}
          <div className="flex flex-col gap-0.5">
            <NavLink
              href={hrefFor("notifications")}
              active={route.view === "notifications"}
              collapsed={opts.collapsed}
              onNavigate={closeNav}
            >
              Notifications
            </NavLink>
            <NavLink
              href={hrefFor("policy")}
              active={route.view === "policy"}
              collapsed={opts.collapsed}
              onNavigate={closeNav}
            >
              Policy &amp; allowlist
            </NavLink>
            <NavLink
              href={hrefFor("team")}
              active={route.view === "team"}
              collapsed={opts.collapsed}
              onNavigate={closeNav}
            >
              Team &amp; roles
            </NavLink>
            <NavLink
              href={hrefFor("retention")}
              active={route.view === "retention"}
              collapsed={opts.collapsed}
              onNavigate={closeNav}
            >
              Retention
            </NavLink>
            {teamOnly ? (
              <NavLink
                href={hrefFor("audit")}
                active={route.view === "audit"}
                collapsed={opts.collapsed}
                onNavigate={closeNav}
              >
                Audit log
              </NavLink>
            ) : null}
            <NavLink
              href={hrefFor("health")}
              active={route.view === "health"}
              collapsed={opts.collapsed}
              onNavigate={closeNav}
            >
              Install health
            </NavLink>
            {adminOnly ? (
              <>
                <NavLink
                  href={hrefFor("tokens")}
                  active={route.view === "tokens"}
                  collapsed={opts.collapsed}
                  onNavigate={closeNav}
                >
                  Scan API tokens
                </NavLink>
                <NavLink
                  href={hrefFor("registries")}
                  active={route.view === "registries"}
                  collapsed={opts.collapsed}
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
        className={cn(
          "flex items-center border-t border-line text-left hover:bg-white/[0.03]",
          opts.collapsed ? "justify-center px-1.5 py-3" : "gap-3 px-3.5 py-3",
        )}
      >
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(#f4f4f5 ${(setupDone / setupTotal) * 360}deg, #252529 0)` }}
        >
          <span className="grid size-[32px] place-items-center rounded-full bg-rail text-[9px] text-snow">
            {setupDone}/{setupTotal}
          </span>
        </span>
        <span className={cn("min-w-0", opts.collapsed && "sr-only")}>
          <span className="block text-[11px] text-snow">
            {setupDone > 0 ? `${setupDone} of ${setupTotal} leak paths covered` : "Nothing covered yet"}
          </span>
          <span className={cn("mt-0.5 block text-[11px]", ended ? "text-danger" : "text-dim")}>
            {coverage?.label ?? "Coverage"}
            {role ? ` · ${role}` : ""}
          </span>
        </span>
      </a>
    </>
  );

  return (
    <div className="flex h-svh overflow-hidden bg-rail">
      <aside
        className={cn(
          "hidden h-svh shrink-0 flex-col overflow-hidden bg-rail transition-[width] duration-200 ease-out motion-reduce:transition-none md:flex",
          collapsed ? "w-14" : "w-[244px]",
        )}
      >
        {rail({ collapsed, showToggle: true })}
      </aside>

      <Dialog open={navOpen} onClose={setNavOpen} className="relative z-40 md:hidden">
        <DialogBackdrop className="fixed inset-0 bg-black/60 transition-opacity duration-150 data-closed:opacity-0 motion-reduce:transition-none" />
        <div className="fixed inset-0 flex">
          <DialogPanel className="flex h-full w-[min(20rem,88vw)] flex-col border-r border-line bg-rail shadow-2xl transition duration-150 data-closed:-translate-x-full motion-reduce:transition-none">
            <DialogTitle className="sr-only">Watch navigation</DialogTitle>
            {rail({ collapsed: false, showToggle: false })}
          </DialogPanel>
        </div>
      </Dialog>

      <div className="flex min-w-0 flex-1 p-2">
        <div className="watch-stage">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-canvas/90 px-2 backdrop-blur-md sm:gap-3 sm:px-4 md:px-5">
          <button
            type="button"
            className="inline-flex size-12 items-center justify-center rounded-md text-snow hover:bg-white/5 md:hidden"
            onClick={() => setNavOpen(true)}
          >
            <span className="sr-only">Open watch navigation</span>
            <Menu className="size-5" aria-hidden />
          </button>
          <strong className="min-w-0 flex-1 truncate text-sm text-snow sm:flex-none md:hidden">{VIEW_TITLE[route.view]}</strong>
          <button
            type="button"
            onClick={onOpenPalette}
            className="flex size-12 min-w-12 items-center justify-center rounded-md border border-line bg-inset text-[13px] text-dim hover:border-line-strong sm:h-8 sm:w-auto sm:flex-1 sm:justify-start sm:px-3 md:max-w-sm"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="hidden truncate sm:inline">Search or run a command…</span>
            <span className="ml-auto hidden rounded border border-white/10 px-1.5 text-xs text-dim sm:inline">
              {shortcutLabel}
            </span>
          </button>
          <span className="hidden flex-1 md:block" />
          <strong className="hidden shrink-0 text-sm text-snow lg:inline">{VIEW_TITLE[route.view]}</strong>
          {coverage ? (
            <span className={cn("hidden rounded-full border px-2 py-1 text-xs sm:inline", ended ? "border-danger/30 text-danger" : "border-white/10 text-dim")}>
              {coverage.label}
            </span>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="hidden sm:inline-flex"
            onClick={() => setGuidanceOpen((open) => !open)}
          >
            {guidanceOpen ? "Hide guide" : "Guide"}
          </Button>
          {ended ? (
            <Button type="button" size="sm" className="hidden sm:inline-flex" onClick={() => setPlansOpen(true)}>
              See plans
            </Button>
          ) : null}
          {installUrl ? (
            <Button as="a" href={installUrl} size="sm" variant="outline" className="hidden md:inline-flex">
              Install on GitHub
            </Button>
          ) : null}
          {billing}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="size-12 rounded-full border border-white/10 px-0 text-xs text-snow sm:size-8 sm:text-xs"
            onClick={() => void signOut()}
            title="Sign out"
            aria-label={`Sign out ${login}`}
          >
            {login.slice(0, 2).toUpperCase()}
          </Button>
        </header>
        <div
          className={cn(
            "min-h-0 flex-1",
            route.view === "alerts" ? "overflow-hidden" : "overflow-auto px-5 py-8 md:px-8",
            !guidanceOpen && "[&_.watch-guidance]:hidden",
          )}
        >
          {children}
        </div>
        </div>
      </div>
      <Dialog open={plansOpen} onClose={setPlansOpen} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/70 transition-opacity duration-150 data-closed:opacity-0 motion-reduce:transition-none" />
        <div className="fixed inset-0 grid place-items-center overflow-y-auto px-4 py-8">
          <DialogPanel className="w-full max-w-xl rounded-xl border border-white/15 bg-panel p-5 shadow-2xl transition duration-150 data-closed:scale-95 data-closed:opacity-0 motion-reduce:transition-none">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-dim">Hosted coverage</p>
                <DialogTitle className="mt-1 font-display text-xl text-snow">Keep the desk looking.</DialogTitle>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPlansOpen(false)} aria-label="Close plans"><X className="size-4" aria-hidden /></Button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/8 bg-panel p-4">
                <p className="text-sm text-snow">Solo · $29</p>
                <p className="mt-2 text-xs leading-relaxed text-mute">One admin, email destination, and hosted Watch coverage.</p>
              </div>
              <div className="rounded-lg border border-white/8 bg-panel p-4">
                <p className="text-sm text-snow">Team · $99</p>
                <p className="mt-2 text-xs leading-relaxed text-mute">Roles, timeline, audit, routes, release governance, and signing policy.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="button" onClick={() => navigate("/pricing")}>Compare plans</Button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}
