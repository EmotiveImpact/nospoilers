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
        "flex items-center gap-2 rounded-md px-2.5 py-[7px] text-[13px]",
        active ? "bg-white/8 text-snow" : "text-mute hover:bg-white/5 hover:text-snow",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-4 shrink-0 text-dim" aria-hidden />
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
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const hrefFor = (view: WatchView, tab?: AlertTab) =>
    watchHref(watchPath(view), search, tab ? { tab } : {});
  const alertActive = (tab: AlertTab) => route.view === "alerts" && route.tab === tab;
  const closeNav = () => setNavOpen(false);
  const installIdentity =
    installations.find((installation) => installation.id === activeInstallId)?.account_login ??
    installations[0]?.account_login ??
    login;
  const shortcutLabel =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
      ? "⌘K"
      : "Ctrl K";

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
          <div className="mt-3 flex items-center gap-2 rounded-md border border-white/8 bg-white/[0.025] px-2 py-2">
            <span className="grid size-6 place-items-center rounded-md bg-white/10 text-[10px] font-semibold text-snow">
              {installIdentity.slice(0, 2).toUpperCase()}
            </span>
            <p className="min-w-0 flex-1 truncate text-xs text-snow">{installIdentity}</p>
          </div>
        )}
        <p className="mt-1 text-[11px] text-dim">
          {sourceCount > 0 ? `${sourceCount} sources` : "nothing connected"}
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-auto px-3 py-4" aria-label="Watch desk">
        <div className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1 text-[10px] uppercase tracking-[0.16em] text-dim">Work</p>
          <NavLink href={hrefFor("overview")} active={route.view === "overview"} onNavigate={closeNav}>
            Overview
          </NavLink>
        </div>

        <div>
          <p className="px-2.5 pb-1 text-[10px] uppercase tracking-[0.16em] text-dim">Alert views</p>
          <div className="flex flex-col gap-0.5">
            <NavLink href={hrefFor("alerts", "open")} active={alertActive("open")} onNavigate={closeNav}>
              Needs triage
              {openAlertCount > 0 ? <span className="ml-auto text-[10px] text-danger">{openAlertCount}</span> : null}
            </NavLink>
            <NavLink href={hrefFor("alerts", "waiting")} active={alertActive("waiting")} onNavigate={closeNav}>
              Waiting on rotation
              {waitingCount > 0 ? <span className="ml-auto text-[10px] text-dim">{waitingCount}</span> : null}
            </NavLink>
            {teamOnly ? <NavLink href={hrefFor("alerts", "mine")} active={alertActive("mine")} onNavigate={closeNav}>Assigned to me{mineCount > 0 ? <span className="ml-auto text-[10px] text-dim">{mineCount}</span> : null}</NavLink> : null}
            <NavLink href={hrefFor("alerts", "done")} active={alertActive("done")} onNavigate={closeNav}>Resolved{resolvedCount > 0 ? <span className="ml-auto text-[10px] text-dim">{resolvedCount}</span> : null}</NavLink>
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1 text-[10px] uppercase tracking-[0.16em] text-dim">Evidence</p>
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
        </div>

        <div>
          <p className="px-2.5 pb-1 text-[10px] uppercase tracking-[0.16em] text-dim">Configure</p>
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
        className="flex items-center gap-3 border-t border-white/8 px-4 py-3 text-left hover:bg-white/3"
      >
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(#f4f4f5 ${(setupDone / setupTotal) * 360}deg, #252529 0)` }}
        >
          <span className="grid size-[32px] place-items-center rounded-full bg-[#0c0c0e] text-[9px] text-snow">
            {setupDone}/{setupTotal}
          </span>
        </span>
        <span className="min-w-0">
          <span className="block text-xs text-snow">
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
    <div className="flex h-svh overflow-hidden bg-ink">
      <aside className="hidden h-svh w-[244px] shrink-0 flex-col border-r border-white/8 bg-[#0c0c0e] md:flex">
        {nav}
      </aside>

      <Dialog open={navOpen} onClose={setNavOpen} className="relative z-40 md:hidden">
        <DialogBackdrop className="fixed inset-0 bg-black/60 transition-opacity duration-150 data-closed:opacity-0 motion-reduce:transition-none" />
        <div className="fixed inset-0 flex">
          <DialogPanel className="flex h-full w-[min(20rem,88vw)] flex-col border-r border-white/8 bg-[#0c0c0e] shadow-2xl transition duration-150 data-closed:-translate-x-full motion-reduce:transition-none">
            <DialogTitle className="sr-only">Watch navigation</DialogTitle>
            {nav}
          </DialogPanel>
        </div>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/8 bg-ink px-2 shadow-[0_10px_32px_rgba(0,0,0,.12)] sm:gap-3 sm:px-4 md:px-5">
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
            className="flex size-12 min-w-12 items-center justify-center rounded-md border border-white/10 bg-white/3 text-sm text-dim hover:border-white/20 sm:h-9 sm:w-auto sm:flex-1 sm:justify-start sm:px-3 md:max-w-sm"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="hidden truncate sm:inline">Search or run a command…</span>
            <span className="ml-auto hidden rounded border border-white/10 px-1.5 text-[10px] text-dim sm:inline">
              {shortcutLabel}
            </span>
          </button>
          <span className="hidden flex-1 md:block" />
          <strong className="hidden shrink-0 text-sm text-snow lg:inline">{VIEW_TITLE[route.view]}</strong>
          {coverage ? (
            <span className={cn("hidden rounded-full border px-2 py-1 text-[10px] sm:inline", ended ? "border-danger/30 text-danger" : "border-white/10 text-dim")}>
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
            className="size-12 rounded-full border border-white/10 px-0 text-xs text-snow sm:size-8 sm:text-[10px]"
            onClick={() => void signOut()}
            title="Sign out"
            aria-label={`Sign out ${login}`}
          >
            {login.slice(0, 2).toUpperCase()}
          </Button>
        </header>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-auto px-5 py-8 md:px-8",
            !guidanceOpen && "[&_.watch-guidance]:hidden",
          )}
        >
          {children}
        </div>
      </div>
      <Dialog open={plansOpen} onClose={setPlansOpen} className="relative z-50">
        <DialogBackdrop className="fixed inset-0 bg-black/70 transition-opacity duration-150 data-closed:opacity-0 motion-reduce:transition-none" />
        <div className="fixed inset-0 grid place-items-center overflow-y-auto px-4 py-8">
          <DialogPanel className="w-full max-w-xl rounded-xl border border-white/15 bg-[#0e0e11] p-5 shadow-2xl transition duration-150 data-closed:scale-95 data-closed:opacity-0 motion-reduce:transition-none">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-dim">Hosted coverage</p>
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
