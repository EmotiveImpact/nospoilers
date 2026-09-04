import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const screens = [
  "OverviewScreen",
  "AlertsScreen",
  "SourcesScreen",
  "ReleasesScreen",
  "TimelineScreen",
  "SetupScreen",
  "NotificationsScreen",
  "PolicyScreen",
  "TeamScreen",
  "RetentionScreen",
  "AuditScreen",
  "HealthScreen",
  "TokensScreen",
  "RegistriesScreen",
];

describe("Watch architecture boundaries", () => {
  it("keeps page and workspace files as orchestration boundaries", () => {
    const page = readFileSync("src/pages/WatchPage.tsx", "utf8");
    const workspace = readFileSync("src/pages/WatchWorkspace.tsx", "utf8");
    expect(page.split("\n").length).toBeLessThanOrEqual(30);
    expect(workspace.split("\n").length).toBeLessThanOrEqual(20);
    expect(workspace).toMatch(/useWatchWorkspaceController/);
    expect(workspace).not.toMatch(/fetch\(|<section|<form/);
  });

  it("keeps every route in a focused screen module", () => {
    for (const screen of screens) {
      expect(readFileSync(path.join("src/components/watch/screens", `${screen}.tsx`), "utf8"))
        .toMatch(new RegExp(`(?:function|const) ${screen}`));
    }
  });

  it("does not regress to core disclosures, microtext, or unicode controls", () => {
    const source = screens
      .map((screen) => readFileSync(path.join("src/components/watch/screens", `${screen}.tsx`), "utf8"))
      .join("\n");
    expect(source).not.toMatch(/<details|<summary/);
    expect(source).not.toMatch(/text-\[(?:10|11)px\]/);
    expect(source).not.toMatch(/[✓→⌥▣⬡⎔]/);
    const dialogs =
      readFileSync("src/components/WatchCommandPalette.tsx", "utf8") +
      readFileSync("src/components/WatchAlertsWorkspace.tsx", "utf8") +
      readFileSync("src/watch/WatchControllerSupport.tsx", "utf8");
    expect(dialogs.match(/motion-reduce:transition-none/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("collapses alert queues into one Alerts nav", () => {
    const shell = readFileSync("src/components/WatchMonolithShell.tsx", "utf8");
    expect(shell).not.toMatch(/Alert views/);
    expect(shell.match(/hrefFor\("alerts"\)/g)).toHaveLength(1);
    expect(readFileSync("src/components/WatchAlertsWorkspace.tsx", "utf8")).toMatch(/watch-page-title/);
    expect(readFileSync("src/components/WatchAlertsWorkspace.tsx", "utf8")).toMatch(/watch-queue-track/);
    expect(readFileSync("src/components/WatchAlertsWorkspace.tsx", "utf8")).toMatch(/watch-seg-n-open/);
    expect(readFileSync("src/components/WatchAlertsWorkspace.tsx", "utf8")).not.toMatch(/className="watch-seg"/);
    expect(readFileSync("src/index.css", "utf8")).toMatch(/\.watch-stage/);
    expect(readFileSync("src/index.css", "utf8")).toMatch(/\.watch-queue-track/);
    expect(readFileSync("src/index.css", "utf8")).not.toMatch(/\.watch-seg-queues/);
    expect(readFileSync("src/components/WatchMonolithShell.tsx", "utf8")).toMatch(/watch-stage/);
    expect(readFileSync("src/index.css", "utf8")).toMatch(/--color-canvas: #09090b;/);
    expect(readFileSync("src/index.css", "utf8")).toMatch(/\.watch-empty/);
    expect(readFileSync("src/components/watch/screens/ReleasesScreen.tsx", "utf8")).toMatch(/text-ok/);
    expect(readFileSync("src/components/watch/screens/HealthScreen.tsx", "utf8")).toMatch(/watch-empty/);
    expect(readFileSync("src/components/watch/screens/AuditScreen.tsx", "utf8")).toMatch(/text-ok/);
  });

  it("applies shell-weight E bloom behind the live rail wordmark", () => {
    const css = readFileSync("src/index.css", "utf8");
    const shell = readFileSync("src/components/WatchMonolithShell.tsx", "utf8");
    expect(shell).toMatch(/watch-rail/);
    expect(css).toMatch(/\.watch-rail::before/);
    expect(css).toMatch(/radial-gradient\(circle at 28% 22%, #161618/);
    expect(css).toMatch(/--color-canvas: #09090b;/);
    expect(css).toMatch(/--color-rail: #050506;/);
    expect(css).not.toMatch(/540px 440px/);
    expect(css).toMatch(/\.watch-queue-track/);
  });

  it("keeps a desktop sidebar collapse control on the logo row", () => {
    const shell = readFileSync("src/components/WatchMonolithShell.tsx", "utf8");
    expect(shell).toMatch(/nospoilers\.watch\.sidebar-collapsed/);
    expect(shell).toMatch(/aria-label=\{opts\.collapsed \? "Expand sidebar" : "Collapse sidebar"\}/);
    expect(shell).toMatch(/showToggle: true/);
    expect(shell).toMatch(/showToggle: false/);
    expect(shell).toMatch(/w-\[244px\]/);
    expect(shell).toMatch(/PanelLeftClose/);
  });

  it("keeps notification and registry settings focused", () => {
    const notifications = readFileSync(
      "src/components/watch/screens/NotificationsScreen.tsx",
      "utf8",
    );
    const registries = readFileSync(
      "src/components/watch/screens/RegistriesScreen.tsx",
      "utf8",
    );
    expect(notifications).toMatch(/role="tablist"/);
    expect(notifications).toMatch(/flow === "email"/);
    expect(notifications).toMatch(/flow === "route-test"/);
    expect(registries).toMatch(/route\.view === "sources" \? \(/);
    expect(registries).toMatch(/Registry credentials/);
  });
});
