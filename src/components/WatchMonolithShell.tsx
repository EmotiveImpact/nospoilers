import './watch/design/app-system.css';
import './watch/design/page-layouts.css';
import './watch/design/journey-shell.css';
import { signOut } from "@/auth.ts";
import './watch/trial-indicator.css';
import {WorkspaceAlertBadge} from './watch/WorkspaceAlertBadge';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { navigate } from "@/nav.ts";
import type { Coverage } from "@/coverage.ts";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Menu as AccountMenu, MenuButton, MenuItems, MenuItem } from "@headlessui/react";
import {
  Activity,
  Settings,
  CircleHelp,
  CreditCard,
  LogOut,
  ChevronUp,
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
  X,
  Scale,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  VIEW_TITLE,
  type AlertTab,
  type WatchRoute,
  type WatchView,
  watchHref,
  watchPath,
} from "@/watch/routes.ts";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {WorkspaceSwitcher} from '@/components/watch/WorkspaceSwitcher';
import {useWorkspaceChoices} from '@/components/watch/useWorkspaceChoices';

function watchViewIcon(path: string) {
  return path === "/watch"
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
}

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
  disconnectedAt?: string|null;
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
  const Icon = watchViewIcon(path);
  return (
    <a
      href={href}
      onClick={(event) => {
        go(event, href);
        onNavigate?.();
      }}
      className={cn(
        "watch-rail-link flex items-center rounded-[5px] border-0 text-[13px] leading-[1.5]",
        collapsed ? "justify-center px-1 py-[10px]" : "gap-3 px-3 py-[10px]",
        active ? "text-snow" : "text-mute hover:text-snow",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className={cn("size-[19px] shrink-0", active ? "opacity-100" : "opacity-50")} aria-hidden />
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

  artifactOnly = false,
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
  role?: "admin" | "member" | "viewer" | null;
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
  firstRun: boolean;
  artifactOnly?: boolean;
  installations: InstallRow[];
  activeInstallId: number | null;
  onInstall: (id: number) => void;
  installUrl?: string;
  onOpenPalette: () => void;
  billing?: ReactNode;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  // The rails may unmount on collapse or dialog close; their data must not.
  const workspaceChoices=useWorkspaceChoices(login);
  useEffect(() => {
    if (!navOpen || typeof window.matchMedia !== 'function') return;
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setNavOpen(false); };
    closeOnDesktop();
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, [navOpen]);
  const workspaceId=new URLSearchParams(search).get('workspace');

  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);
  const routeContent = useRef<HTMLDivElement|null>(null);
  const previousView = useRef(route.view);
  const previousScrollView = useRef(route.view);
  useLayoutEffect(() => {
    if (previousScrollView.current === route.view) return;
    previousScrollView.current = route.view;
    // Reset before paint: otherwise the next page briefly inherits the old offset.
    routeContent.current?.scrollTo({top:0, left:0, behavior:'instant'});
  }, [route.view]);
  useEffect(() => {
    if (previousView.current === route.view || navOpen) return;
    previousView.current = route.view;
    // Query-only changes retain the selected control.
    let observer:MutationObserver|undefined;
    const focusPage = () => {
      routeContent.current?.focus({preventScroll:true});
    };
    let frame = requestAnimationFrame(() => {
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]'));
      if (dialogs.some(dialog => !dialog.hasAttribute('data-watch-navigation'))) return;
      if (!dialogs.length) { focusPage(); return; }
      // Headless UI retains the closing drawer during its exit transition.
      // Wait for teardown instead of racing its focus restoration with a timer.
      observer = new MutationObserver(() => {
        const remaining = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]'));
        if (remaining.some(dialog => !dialog.hasAttribute('data-watch-navigation'))) { observer?.disconnect(); return; }
        if (!remaining.length) { observer?.disconnect(); frame=requestAnimationFrame(focusPage); }
      });
      observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-modal']});
    });
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [route.view, navOpen]);
  const hrefFor = (view: WatchView, tab?: AlertTab) => {
    const params=new URLSearchParams(search);
    if(view==='workspaces')params.delete('workspaceTab');
    // The sidebar opens history, not the last full detail screen.
    if(view==='releases')for(const key of ['uploadView','uploadFinding','uploadTab','release'])params.delete(key);
    return watchHref(watchPath(view), params.toString(), tab ? { tab } : {});
  };
  const closeNav = () => setNavOpen(false);
  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      writeSidebarCollapsed(next);
      return next;
    });
  };
  const shortcutLabel =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
      ? "⌘K"
      : "Ctrl K";
  const settingsViews: WatchView[] = ['workspaces','notifications','policy','team','retention','audit','health','tokens','registries','setup'];
  const settingsActive = settingsViews.includes(route.view);
  const settingsLinks: {view:WatchView;label:string}[] = [
    {view:'workspaces',label:'Workspace'}, {view:'notifications',label:'Notifications'},
    {view:'policy',label:artifactOnly?'Scan policy':'Policy & allowlist'}, {view:'team',label:'Team & roles'},
    {view:'retention',label:'Retention'},
    ...(artifactOnly||teamOnly?[{view:'audit' as const,label:'Audit log'}]:[]),
    ...(!artifactOnly?[{view:'health' as const,label:'Install health'},{view:'setup' as const,label:'Connection diagnostics'}]:[]),
    ...(artifactOnly||adminOnly?[{view:'tokens' as const,label:'Scan API tokens'}]:[]),
    ...(!artifactOnly&&adminOnly?[{view:'registries' as const,label:'Private registries'}]:[]),
  ];
  const billingParams = new URLSearchParams(search);
  billingParams.set('workspaceTab','billing');
  const billingHref = watchHref('/watch/workspaces', billingParams.toString());

  const rail = (opts: { collapsed: boolean; showToggle: boolean }) => (
    <>
      <div className={cn("watch-rail-head", opts.collapsed ? "px-1.5" : "px-3")}>
        <div className={cn("watch-rail-brand flex items-center gap-2", opts.collapsed ? "justify-center" : "justify-between")}>
          {opts.collapsed && opts.showToggle ? (
            <button
              type="button"
              className="group relative inline-flex size-8 shrink-0 items-center justify-center rounded-md text-mute hover:bg-white/[0.06] hover:text-snow"
              aria-label={opts.collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!opts.collapsed}
              onClick={toggleCollapsed}
            >
              <img
                src="/assets/brand/nospoilers-mark-white.png"
                alt=""
                className="size-7 object-contain transition-opacity group-hover/rail:opacity-0 group-focus-visible:opacity-0 motion-reduce:transition-none"
              />
              <PanelLeft className="absolute size-4 opacity-0 transition-opacity group-hover/rail:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none" aria-hidden />
            </button>
          ) : (
            <a
              href={hrefFor("overview")}
              onClick={(event) => { go(event, hrefFor("overview")); closeNav(); }}
              className="flex min-w-0 flex-1 items-center text-snow hover:text-snow"
            >
              <img
                src="/assets/brand/nospoilers-wordmark.png"
                alt="NoSpoilers"
                className="watch-rail-wordmark block h-[38px] w-auto max-w-[152px] object-contain"
              />
            </a>
          )}
          {opts.showToggle && !opts.collapsed ? (
            <button
              type="button"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-mute opacity-0 transition-opacity hover:bg-white/[0.06] hover:text-snow focus-visible:opacity-100 group-hover/rail:opacity-100 motion-reduce:transition-none"
              aria-label={opts.collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!opts.collapsed}
              onClick={toggleCollapsed}
            >
              <PanelLeftClose className="size-4" aria-hidden />
            </button>
          ) : null}
          {!opts.showToggle?<button type="button" className="watch-rail-close" aria-label="Close watch navigation" onClick={closeNav}><X size={20} aria-hidden/></button>:null}
        </div>
        {opts.collapsed?null:<WorkspaceSwitcher search={search} installationId={activeInstallId} choices={workspaceChoices}/>}
        {opts.collapsed ? null : installations.length > 1 ? (
          <label className="mt-3 block">
            <span className="watch-kicker">GitHub source</span>
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
                  {row.disconnectedAt ? " (disconnected)" : row.suspended ? " (suspended)" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <nav
        className={cn(
          "watch-rail-nav flex flex-1 flex-col gap-[18px] overflow-auto",
          opts.collapsed ? "px-1.5" : "px-3",
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
          {<NavLink
            href={hrefFor("alerts")}
            active={route.view === "alerts"}
            collapsed={opts.collapsed}
            onNavigate={closeNav}
          >
            Alerts
            {workspaceId?<WorkspaceAlertBadge workspaceId={workspaceId}/>:openAlertCount > 0 ? (
              <span className="ml-auto font-mono text-[11px] text-[#ff8a80]">{openAlertCount}</span>
            ) : null}
          </NavLink>}
        </div>

        <div className={cn("flex flex-col gap-0.5", !opts.collapsed && "border-t border-line pt-[17px]")}>
          {opts.collapsed ? null : <p className="watch-kicker px-2.5 pb-1.5">Evidence</p>}
          {<NavLink
            href={hrefFor("sources")}
            active={route.view === "sources"}
            collapsed={opts.collapsed}
            onNavigate={closeNav}
          >
            Coverage
            {sourceCount > 0 ? (
              <span className="ml-auto font-mono text-[11px] text-dim">{sourceCount}</span>
            ) : null}
          </NavLink>}
          {(
            <NavLink
              href={hrefFor("releases")}
              active={route.view === "releases"}
              collapsed={opts.collapsed}
              onNavigate={closeNav}
            >
              Releases
            </NavLink>
          )}
          <NavLink href={hrefFor('scan')} active={route.view==='scan'} collapsed={opts.collapsed} onNavigate={closeNav}>New scan</NavLink>
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

        <div className="flex flex-col gap-0.5">
          <a href={hrefFor('workspaces')} onClick={event=>{go(event,hrefFor('workspaces'));closeNav();}} className={cn('watch-rail-link flex items-center rounded-[5px] py-[10px] text-[13px]',opts.collapsed?'justify-center':'gap-3 px-3',settingsActive?'text-snow':'text-mute hover:text-snow')} aria-current={settingsActive?'page':undefined}>
            <Settings className="size-[19px] shrink-0" aria-hidden/><span className={opts.collapsed?'sr-only':''}>Settings</span>
          </a>
        </div>
      </nav>

      <div className={cn("watch-rail-foot border-t border-line py-3",opts.collapsed?"px-1.5":"px-3")}>
        <a href={billingHref} onClick={event=>{go(event,billingHref);closeNav();}} className={cn('flex items-center gap-3 py-2 text-[13px] text-mute hover:text-snow',opts.collapsed?'justify-center':'px-3')}><CreditCard className="size-[19px] shrink-0" aria-hidden/><span className={opts.collapsed?'sr-only':''}>Plan &amp; billing</span></a>
        <a href="/docs" onClick={event=>{go(event,'/docs');closeNav();}} className={cn('flex items-center gap-3 py-2 text-[13px] text-mute hover:text-snow',opts.collapsed?'justify-center':'px-3')}><CircleHelp className="size-[19px] shrink-0" aria-hidden/><span className={opts.collapsed?'sr-only':''}>Help &amp; guides</span></a>
        <AccountMenu as="div" className="relative mt-2">
          <MenuButton aria-label={`Account menu for ${login}`} className={cn('flex w-full items-center rounded-md py-2 text-left text-[13px] text-snow hover:text-white',opts.collapsed?'justify-center':'gap-3 px-3')}>
            <span aria-hidden className="grid size-[19px] shrink-0 place-items-center rounded-full bg-white/10 text-[8px]">{login.slice(0,2).toUpperCase()}</span>
            <span className={cn('min-w-0 flex-1',opts.collapsed&&'sr-only')}><span className="block truncate">{login}</span><span className="block text-[11px] text-dim">{role??'Workspace member'}</span></span>
            {!opts.collapsed?<ChevronUp className="size-3.5 shrink-0 text-dim" aria-hidden/>:null}
          </MenuButton>
          <MenuItems anchor="top start" className="z-50 min-w-48 rounded-md border border-white/10 bg-[#090a0c] p-1 text-[13px] text-[#f4f4f5] shadow-xl outline-none [--anchor-gap:8px]">
            <MenuItem><a href={hrefFor('workspaces')} onClick={event=>{go(event,hrefFor('workspaces'));closeNav();}} className="flex items-center gap-3 rounded px-3 py-2 data-focus:bg-white/[.07]"><Settings className="size-4" aria-hidden/>Workspace settings</a></MenuItem>
            <MenuItem><button type="button" onClick={()=>void signOut()} className="flex w-full items-center gap-3 rounded px-3 py-2 text-left data-focus:bg-white/[.07]"><LogOut className="size-4" aria-hidden/>Sign out</button></MenuItem>
          </MenuItems>
        </AccountMenu>
      </div>
    </>
  );

  const PageIcon = watchViewIcon(watchPath(route.view));
  return (
    <div className="watch-desk">
      <aside
        className={cn(
          "group/rail watch-rail watch-rail--desktop hidden h-full shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex",
          collapsed ? "watch-rail--collapsed w-[60px]" : "watch-rail--expanded w-[200px]",
        )}
      >
        {rail({ collapsed, showToggle: true })}
      </aside>

      <Dialog data-watch-navigation="true" open={navOpen} onClose={setNavOpen} className="watch-navigation-dialog relative z-40 lg:hidden">
        <DialogBackdrop className="fixed inset-0 bg-black/60 transition-opacity duration-150 data-closed:opacity-0 motion-reduce:transition-none" />
        <div className="fixed inset-0 flex">
          <DialogPanel id="watch-mobile-navigation" className="watch-rail watch-rail--mobile flex h-full w-[min(17.5rem,88vw)] flex-col overflow-hidden border-r border-line bg-canvas shadow-2xl transition duration-150 data-closed:-translate-x-full motion-reduce:transition-none">
            <DialogTitle className="sr-only">Watch navigation</DialogTitle>
            {rail({ collapsed: false, showToggle: false })}
          </DialogPanel>
        </div>
      </Dialog>

      <div className="watch-gutter">
        <div className="watch-stage">
        <header className="watch-stage-head flex h-16 shrink-0 items-center gap-2 border-b px-3 sm:gap-3 sm:px-5 md:px-[34px]">
          <button
            type="button"
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-md text-snow hover:bg-white/5 lg:hidden"
            onClick={() => setNavOpen(true)}
            aria-expanded={navOpen}
            aria-controls="watch-mobile-navigation"
          >
            <span className="sr-only">Open watch navigation</span>
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="watch-stage-crumb flex min-w-0 flex-1 items-center gap-2 text-[12px] text-mute sm:flex-none sm:max-w-[220px]"><PageIcon className="hidden size-[17px] shrink-0 sm:block" aria-hidden/><span className="truncate">{artifactOnly&&route.view==='policy'?'Scan policy':VIEW_TITLE[route.view]}</span></div>
          {coverage ? <span className={cn("watch-stage-coverage hidden shrink-0 whitespace-nowrap text-[10px] sm:inline", ended ? "text-danger" : "text-dim")}><span aria-hidden="true" className="mr-2">·</span>{coverage.label}</span> : null}
          <span className="hidden flex-1 sm:block" />
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="Search or run a command"
            data-watch-search-trigger="true"
            className="watch-search-trigger flex size-12 min-w-12 items-center justify-center rounded-md border border-line bg-inset text-[12px] text-dim hover:border-line-strong sm:h-8 sm:w-40 lg:w-[250px] sm:justify-start sm:gap-2 sm:px-3"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="hidden truncate sm:inline">Search…</span>
            <span className="ml-auto hidden rounded border border-white/10 px-1.5 text-xs text-dim xl:inline">
              {shortcutLabel}
            </span>
          </button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="inline-flex size-12 shrink-0 p-0 sm:h-8 sm:w-auto sm:px-3"
            aria-label="New scan"
            onClick={() => navigate(hrefFor("scan"))}
          >
            <PackageSearch className="size-4" aria-hidden />
            <span className="hidden sm:inline">New scan</span>
          </Button>
          {ended ? (
            <Button type="button" size="sm" className="hidden sm:inline-flex" onClick={() => navigate(billingHref)}>
              See plans
            </Button>
          ) : null}
          {installUrl ? (
            <Button as="a" href={installUrl} size="sm" variant="outline" className="hidden 2xl:inline-flex">
              Install on GitHub
            </Button>
          ) : null}
          {billing}
        </header>
        <div
          ref={routeContent}
          tabIndex={-1}
          role="region"
          data-watch-page={route.view}
          aria-label={`${artifactOnly&&route.view==='policy'?'Scan policy':VIEW_TITLE[route.view]} page`}
          className={cn(
            "watch-route-content min-h-0 flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-snow",
            route.view === "alerts" ? "overflow-hidden" : "overflow-auto",
            "[&_.watch-guidance]:hidden",
          )}
        >
          {settingsActive ? <div className="watch-settings-layout"><nav aria-label="Settings sections" className="watch-settings-navigation"><span className="watch-settings-label">Settings</span>{settingsLinks.map(item=><a key={item.view} href={hrefFor(item.view)} aria-current={route.view===item.view?'page':undefined} onClick={event=>go(event,hrefFor(item.view))}>{item.label}</a>)}</nav><div className="watch-settings-content">{children}</div></div> : children}
        </div>
        </div>
      </div>
    </div>
  );
}
