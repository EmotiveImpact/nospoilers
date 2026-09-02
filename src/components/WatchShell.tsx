import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { navigate } from "@/nav.ts";
import {
  DESK_VIEWS,
  SETTINGS_VIEWS,
  settingsHref,
  watchHref,
  watchPath,
  type SettingsView,
  type WatchRoute,
  type WatchView,
} from "@/watch/routes.ts";
import type { ReactNode } from "react";

const DESK_LABELS: Record<(typeof DESK_VIEWS)[number], string> = {
  overview: "Overview",
  alerts: "Alerts",
  sources: "Sources",
  releases: "Releases",
  timeline: "Timeline",
  setup: "Setup",
};

const SETTINGS_LABELS: Record<SettingsView, string> = {
  notifications: "Notifications",
  policy: "Allowlist",
  team: "Team",
  retention: "Retention",
  audit: "Audit log",
  health: "Install health",
  tokens: "Scan API",
  registries: "Registries",
};

export function WatchShell({
  route,
  search,
  account,
  coverageLabel,
  coverageEnded,
  role,
  installations,
  activeInstallId,
  installUrl,
  openAlertCount,
  sourceCount,
  showSetup,
  onInstallChange,
  onOpenPalette,
  children,
}: {
  route: WatchRoute;
  search: string;
  account: string;
  coverageLabel: string | null;
  coverageEnded: boolean;
  role: "admin" | "member" | null;
  installations: { id: number; account_login: string; suspended?: boolean }[];
  activeInstallId: number | null;
  installUrl: string | undefined;
  openAlertCount: number;
  sourceCount: number;
  showSetup: boolean;
  onInstallChange: (id: number) => void;
  onOpenPalette: () => void;
  children: ReactNode;
}) {
  const deskItems = DESK_VIEWS.filter((view) => view !== "setup" || showSetup);
  const navItems: { view: WatchView; label: string; count?: number }[] =
    route.wall === "desk"
      ? deskItems.map((view) => ({
          view,
          label: DESK_LABELS[view],
          count: view === "alerts" ? openAlertCount : view === "sources" ? sourceCount : undefined,
        }))
      : SETTINGS_VIEWS.map((view) => ({ view, label: SETTINGS_LABELS[view] }));

  return (
    <div className="fade-up flex min-h-[calc(100svh-4rem)] flex-col bg-ink">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-3 sm:px-5">
        <nav className="flex items-center gap-1 rounded-md border border-white/10 p-0.5" aria-label="Desk or settings">
          <ModeLink
            href={watchHref("/watch", search)}
            active={route.wall === "desk"}
            label="Desk"
          />
          <ModeLink
            href={settingsHref(search)}
            active={route.wall === "settings"}
            label="Settings"
          />
        </nav>
        <p className="hidden text-xs text-dim md:block">
          {route.wall === "desk"
            ? "Work only. Retention, Slack, tokens, and the allowlist are in Settings."
            : "Configuration. Critical leaks stay on the desk."}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenPalette}
            className="hidden h-8 items-center gap-2 rounded-md border border-white/10 px-2.5 text-[11px] text-dim hover:border-white/25 hover:text-snow sm:inline-flex"
          >
            Jump
            <kbd className="rounded border border-white/15 px-1 font-mono text-[10px]">⌘K</kbd>
          </button>
          {account ? (
            <span className="text-[11px] uppercase tracking-[0.16em] text-dim">{account}</span>
          ) : null}
          {coverageLabel ? (
            <span
              className={cn(
                "text-[11px] uppercase tracking-[0.16em]",
                coverageEnded ? "text-danger" : "text-dim",
              )}
            >
              {coverageLabel}
              {role ? ` · ${role}` : ""}
            </span>
          ) : null}
          {installations.length > 1 ? (
            <label className="flex items-center gap-2">
              <span className="sr-only">GitHub install</span>
              <select
                value={activeInstallId ?? ""}
                onChange={(event) => {
                  const id = Number(event.target.value);
                  if (!Number.isFinite(id) || id <= 0) return;
                  onInstallChange(id);
                }}
                className="h-8 rounded-md border border-white/15 bg-ink px-2 text-xs text-snow outline-none focus:border-white/40"
              >
                {installations.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.account_login}
                    {row.suspended ? " (suspended)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {installUrl ? (
            <Button as="a" href={installUrl} size="sm" variant="outline">
              Install on GitHub
            </Button>
          ) : null}
          {coverageEnded ? (
            <Button type="button" size="sm" onClick={() => navigate("/pricing")}>
              Subscribe
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="border-b border-white/5 bg-[#0b0b0d] md:w-60 md:shrink-0 md:border-b-0 md:border-r">
          <div className="px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-dim">
              {route.wall === "desk" ? "Desk" : "Settings"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-dim">
              {route.wall === "desk"
                ? "Overview, alerts, and sources. Configuration left this surface."
                : "One page at a time. Each form still saves itself."}
            </p>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:px-2" aria-label="Watch">
            {navItems.map((item) => {
              const href = watchHref(watchPath(item.view), search);
              const active = route.view === item.view;
              return (
                <a
                  key={item.view}
                  href={href}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                      return;
                    }
                    event.preventDefault();
                    navigate(href);
                  }}
                  className={cn(
                    "flex shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm",
                    active ? "bg-white/8 text-snow" : "text-mute hover:bg-white/5 hover:text-snow",
                  )}
                >
                  <span>{item.label}</span>
                  {typeof item.count === "number" && item.count > 0 ? (
                    <span
                      className={cn(
                        "text-[11px] tabular-nums",
                        item.view === "alerts" ? "text-danger" : "text-dim",
                      )}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </a>
              );
            })}
          </nav>
          {route.wall === "desk" ? (
            <div className="hidden px-3 pb-4 md:block">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => navigate(settingsHref(search))}
              >
                Open settings
              </Button>
            </div>
          ) : (
            <div className="hidden px-3 pb-4 md:block">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => navigate(watchHref("/watch", search))}
              >
                Back to desk
              </Button>
            </div>
          )}
        </aside>
        <div className="min-w-0 flex-1 px-4 py-8 sm:px-8 md:py-10">{children}</div>
      </div>
    </div>
  );
}

function ModeLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        navigate(href);
      }}
      className={cn(
        "rounded px-3 py-1.5 text-sm",
        active ? "bg-snow text-ink" : "text-mute hover:text-snow",
      )}
    >
      {label}
    </a>
  );
}
