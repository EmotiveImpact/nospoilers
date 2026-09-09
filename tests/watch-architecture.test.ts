import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from "node:fs";
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
    // The optional Timeline chart is a disclosure; recorded activity stays outside it.
    const withoutOptionalChart = source
      .replace('<details className="timeline-chart-disclosure">', '')
      .replace('<summary><span>Activity by source</span><span>Explore the retained alert chart</span></summary>', '');
    expect(withoutOptionalChart).not.toMatch(/<details|<summary/);
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
    expect(readFileSync("src/components/WatchAlertsWorkspace.tsx", "utf8")).not.toMatch(/className="watch-seg"/);
    expect(readFileSync("src/index.css", "utf8")).toMatch(/\.watch-stage/);
    expect(readFileSync("src/index.css", "utf8")).toMatch(/\.watch-queue-track/);
    expect(readFileSync("src/index.css", "utf8")).not.toMatch(/\.watch-seg-queues/);
    expect(readFileSync("src/components/WatchMonolithShell.tsx", "utf8")).toMatch(/watch-stage/);
    expect(readFileSync("src/index.css", "utf8")).toMatch(/--color-canvas: #09090b;/);
    expect(readFileSync("src/index.css", "utf8")).toMatch(/\.watch-empty/);
    expect(readFileSync("src/components/watch/screens/ReleasesScreen.tsx", "utf8")).toMatch(/buildReleaseBriefModel/);
    expect(readFileSync("src/components/watch/screens/HealthScreen.tsx", "utf8")).toMatch(/watch-empty/);
    expect(readFileSync("src/components/watch/screens/AuditScreen.tsx", "utf8")).toMatch(/text-ok/);
  });

  it("applies Linear view tokens to the live Watch stage only", () => {
    const css = readFileSync("src/index.css", "utf8");
    const shell = readFileSync("src/components/WatchMonolithShell.tsx", "utf8");
    expect(shell).toMatch(/watch-desk/);
    expect(shell).toMatch(/watch-gutter/);
    expect(shell).toMatch(/watch-stage/);
    expect(shell).toMatch(/watch-stage-head/);
    expect(shell).not.toMatch(/bg-canvas\/90/);
    expect(shell).not.toMatch(/watch-frame/);
    expect(shell).not.toMatch(/#101112/);
    expect(css).toMatch(/\.watch-desk/);
    expect(css).toMatch(/\.watch-gutter/);
    expect(css).toMatch(/\.watch-stage::before[\s\S]*?z-index:\s*3/);
    expect(css).toMatch(/\.watch-stage::after[\s\S]*?z-index:\s*4/);
    expect(css).toMatch(/\.watch-stage-head/);
    expect(css).toMatch(/radial-gradient\(circle at 65% 0, #1a1c20 0, transparent 38%\)/);
    expect(css).toMatch(/#090a0c/);
    expect(css).toMatch(/\.watch-desk[\s\S]*?background:\s*#09090b/);
    expect(css).toMatch(/\.watch-gutter[\s\S]*?background:\s*#09090b/);
    expect(css).toMatch(/#ffffff0d/);
    expect(css).toMatch(/#ffffff0f/);
    expect(css).toMatch(/box-shadow:\s*0 0 0 2px #0003/);
    expect(css).toMatch(/border-radius:\s*8px/);
    expect(css).toMatch(/--color-canvas: #09090b;/);
    expect(css).not.toMatch(/#141416/);
    expect(css).not.toMatch(/#101112/);
    expect(css).not.toMatch(/#ffffff14/);
    expect(css).not.toMatch(/\.watch-frame/);
    expect(css).not.toMatch(/#f7f8f808/);
    expect(css).not.toMatch(/540px 440px/);
    expect(css).not.toMatch(/radial-gradient\(circle at 28% 22%, #161618/);
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

  it("uses the guided first-proof screen only for an empty Watch overview", () => {
    const overview = readFileSync("src/components/WatchOverview.tsx", "utf8");
    const firstProof = readFileSync(
      "src/components/watch/WatchFirstProofOverview.tsx",
      "utf8",
    );
    const shell = readFileSync("src/components/WatchMonolithShell.tsx", "utf8");
    expect(overview).toMatch(/verdict\.tone === "empty"/);
    expect(overview).toMatch(/<FirstProofOrUploads/);
    expect(firstProof).toMatch(/Prove your first release is clean/);
    expect(firstProof).toMatch(/Start with one source\. Keep the evidence/);
    expect(firstProof).not.toMatch(/checkout-web|Sample — not your data/);
    expect(firstProof).toMatch(/Connect a GitHub repo/);
    expect(firstProof).toMatch(/watchPath\("scan"\)/);
    expect(shell).toMatch(/compactFirstRunNav/);
    expect(shell).toMatch(/compactFirstRunNav = firstRun/);
    expect(readFileSync("src/watch/useWatchWorkspaceController.tsx", "utf8")).toMatch(
      /overviewSectionState\.status === "ready"/,
    );
  });

  it("routes every supported evidence surface through one honest scan launcher", () => {
    const scan = readFileSync("src/pages/ScanPage.tsx", "utf8");
    expect(scan).toMatch(/GitHub repository/);
    expect(scan).toMatch(/Package or build/);
    expect(scan).toMatch(/Production website/);
    expect(scan).toMatch(/Verify release proof/);
    expect(scan).toMatch(/params\.set\("configure", "website"\)/);
    expect(scan).toMatch(/watchPath\("sources"\)/);
    expect(scan).toMatch(/scanModeFromSearch/);
    expect(scan).toMatch(/Each scan records its supported checks, findings and limitations/);
    expect(scan).not.toMatch(/automatically checks every relevant exposure category/);
    expect(scan).toMatch(/Inspect supported same-origin assets within the scan limits/);
    expect(scan).not.toMatch(/Check every public release asset and map/);
    expect(scan).toMatch(/embedded/);
    expect(readFileSync("src/components/watch/WatchRouteContent.tsx", "utf8")).toMatch(
      /route\.view === "scan"[\s\S]*?<ScanPage/,
    );
  });

  it("keeps the gray-stage mock as a content invert, not live Watch", () => {
    const html = readFileSync("public/mockup-review/2b/20-gray-stage.html", "utf8");
    const index = readFileSync("public/mockup-review/2b/index.html", "utf8");
    expect(index).toMatch(/20-gray-stage\.html/);
    expect(html).toMatch(/\.gray \.view/);
    expect(html).toMatch(/background:\s*#101112/);
    expect(html).toMatch(/#ffffff14/);
    expect(html).toMatch(/#18181b/);
    expect(html).toMatch(/#0c0c0e/);
    expect(html).toMatch(/dataset\.shot/);
    expect(html).toMatch(/id="catalog"/);
    expect(html).toMatch(/19-linear-frame\.html/);
    expect(html).toMatch(/desk\.html/);
    expect(html).toMatch(/11-alerts-one-inbox\.html/);
    expect(html).toMatch(/03-triage-inbox\.html/);
    expect(html).toMatch(/2a-full-overview\.html/);
    expect(html).toMatch(/watch-premium\.html/);
    expect(html).not.toMatch(/background(?:-color)?:\s*#141416/);
    expect(html).not.toMatch(/DRV-8852|MAP-002|vehicle_state|Faster app launch/);
    expect(readFileSync("src/index.css", "utf8")).toMatch(/--color-canvas: #09090b;/);
    expect(readFileSync("src/components/WatchMonolithShell.tsx", "utf8")).not.toMatch(/watch-frame/);
  });

  it("keeps the Linear product-frame mock on Linear's homepage tokens", () => {
    const html = readFileSync("public/mockup-review/2b/19-linear-frame.html", "utf8");
    const index = readFileSync("public/mockup-review/2b/index.html", "utf8");
    expect(index).toMatch(/19-linear-frame\.html/);
    expect(html).toMatch(/\.frame-background/);
    expect(html).toMatch(/background:\s*#101112/);
    expect(html).toMatch(/#ffffff14/);
    expect(html).toMatch(/#090a0b/);
    expect(html).toMatch(/#ffffff03/);
    expect(html).toMatch(/#ffffff0d/);
    expect(html).toMatch(/border-radius:\s*var\(--app-radius\)/);
    expect(html).toMatch(/--app-radius:\s*12px/);
    expect(html).toMatch(/--frame-padding:\s*8px/);
    expect(html).toMatch(/--width:\s*1320px/);
    expect(html).toMatch(/--height:\s*720px/);
    expect(html).toMatch(/dataset\.shot/);
    expect(html).toMatch(/transform-origin:\s*top left/);
    expect(html).not.toMatch(/background(?:-color)?:\s*#141416/);
    expect(html).not.toMatch(/DRV-8852|MAP-002|vehicle_state|Faster app launch/);
    expect(readFileSync("src/index.css", "utf8")).toMatch(/--color-canvas: #09090b;/);
    expect(readFileSync("src/index.css", "utf8")).not.toMatch(/\.watch-frame/);
  });

  it("keeps Linear's plate, rim, and glow on .stage only", () => {
    const html = readFileSync("public/mockup-review/2b/21-stage-linear.html", "utf8");
    expect(html).toMatch(/\.page > #desk > \.gutter > \.stage/);
    expect(html).toMatch(/\.stage-bg/);
    expect(html).toMatch(/\.stage-glow/);
    expect(html).toMatch(/background:\s*#101112/);
    expect(html).toMatch(/#ffffff14/);
    expect(html).toMatch(/treat-plate/);
    expect(html).toMatch(/treat-view/);
    expect(html).toMatch(/treat-nested/);
    expect(html).toMatch(/treat-glow/);
    expect(html).toMatch(/\?shot=a/);
    expect(html).toMatch(/\?shot=f/);
    expect(html).not.toMatch(/background(?:-color)?:\s*#141416/);
    expect(html).not.toMatch(/DRV-8852|MAP-002|vehicle_state|Faster app launch/);
    expect(html).not.toMatch(/Triage <b>60<\/b>/);
    expect(readFileSync("src/index.css", "utf8")).toMatch(/--color-canvas: #09090b;/);
    expect(readFileSync("src/index.css", "utf8")).toMatch(/\.watch-gutter/);
    expect(readFileSync("src/index.css", "utf8")).toMatch(/circle at 65% 0/);
  });

  it("lists every committed mockup HTML file on the 2B index", () => {
    const index = readFileSync("public/mockup-review/2b/index.html", "utf8");
    const root = readFileSync("public/mockup-review/index.html", "utf8");
    const files = execFileSync('git', ['ls-files', '--', 'public/mockup-review/2b/*.html'], {encoding:'utf8'})
      .trim().split('\n').filter(Boolean).map(file=>path.basename(file)).filter(name=>name !== 'index.html');
    expect(files.length).toBeGreaterThanOrEqual(20);
    for (const file of files) {
      expect(index).toContain(file);
    }
    expect(index).toContain("../premium/watch-premium.html");
    expect(root).toContain("2b/21-stage-linear.html");
    expect(root).toContain("2b/20-gray-stage.html");
    expect(root).toContain("premium/watch-premium.html");
    expect(readFileSync("src/pages/MockupsPage.tsx", "utf8")).toMatch(/\/mockup-review\/index\.html/);
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
