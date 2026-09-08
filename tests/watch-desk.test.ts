import { describe, expect, it } from "vitest";
import { asFindingList, leadFinding } from "../src/watch/format.ts";
import { parseWatchRoute, watchHref, watchPath } from "../src/watch/routes.ts";

it('drops release pagination when leaving history while preserving workspace and scan mode',()=>{
 const search='?workspace=team&install=7&uploadBefore=old&upload=record&uploadView=detail&mode=github';
 expect(watchHref('/watch/scan',search)).toBe('/watch/scan?workspace=team&install=7&mode=github');
 expect(new URL(watchHref('/watch/releases',search),'http://localhost').searchParams.get('uploadBefore')).toBe('old');
});
import { deskVerdict, filterDeskAlerts, setupProgress } from "../src/watch/verdict.ts";
import { exposureByDay } from "../src/watch/exposure.ts";
import {
  buildPackSpark,
  buildSetupViewModel,
  buildSourceViewModels,
  buildTimelineLanes,
  countOpenAlerts,
  coverageDonut,
  filterSourceViewModels,
  latestSealedReleases,
  nextExceptionExpiry,
  sourceKindCounts,
} from "../src/watch/view-models.ts";
import { formatAgo, shortDigest } from "../src/watch/format.ts";
import {
  loadSelectedAlertActivity,
  selectDeskAlert,
  shouldLoadAlertActivity,
} from "../src/watch/useWatchDeskController.ts";

describe('alert selection identity',()=>{
  it('never substitutes another alert for an unavailable deep link',()=>{
    expect(selectDeskAlert([{id:1}],2)).toBeNull();
    expect(selectDeskAlert([{id:1}],null)).toEqual({id:1});
    expect(selectDeskAlert([{id:1},{id:2}],2)).toEqual({id:2});
  });
});
import {
  buildPaletteItems,
  nextPaletteIndex,
} from "../src/watch/command.ts";
import { combineWatchSectionStates } from "../src/watch/data-state.ts";
import { withoutWatchImpersonation } from "../src/watch/controller-utils.ts";

describe("Watch authentication boundary", () => {
  it("removes legacy billing impersonation while preserving real desk state", () => {
    expect(withoutWatchImpersonation("?as=trial")).toBe("");
    expect(withoutWatchImpersonation("?as=ended&install=7&configure=github")).toBe(
      "?install=7&configure=github",
    );
    expect(withoutWatchImpersonation("?install=7")).toBe("?install=7");
  });
});

describe("Watch overview verdict states", () => {
  const base = { ended: false, githubPaused: false, alerts: [] };

  it("does not report a clean verdict before a connected source has evidence", () => {
    expect(
      deskVerdict({ ...base, sourceCount: 1, checkedSourceCount: 0, checksInFlight: 0 }),
    ).toMatchObject({ tone: "pending", title: "Connected. Not checked yet." });
  });

  it("keeps the verdict pending while a check is running", () => {
    expect(
      deskVerdict({ ...base, sourceCount: 1, checkedSourceCount: 0, checksInFlight: 1 }),
    ).toMatchObject({ tone: "pending", title: "A check is running." });
  });

  it("reports partial evidence instead of a false all-clear", () => {
    expect(
      deskVerdict({ ...base, sourceCount: 3, checkedSourceCount: 2, checksInFlight: 0 }),
    ).toMatchObject({ tone: "warn", title: "Some sources still need proof." });
  });

  it("reports clear only when every connected source has evidence", () => {
    expect(
      deskVerdict({ ...base, sourceCount: 2, checkedSourceCount: 2, checksInFlight: 0 }),
    ).toMatchObject({ tone: "ok", title: "No exposure is known from the latest checks." });
  });

  it("never hides a real open alert behind a pending check", () => {
    expect(
      deskVerdict({
        ...base,
        sourceCount: 1,
        checkedSourceCount: 0,
        checksInFlight: 1,
        alerts: [
          {
            id: 9,
            kind: "repo_publicized",
            title: "Repository became public",
            body: "",
            findings: null,
            created_at: "2026-09-04T18:00:00Z",
          },
        ],
      }),
    ).toMatchObject({ tone: "crit", title: "One thing is exposed right now." });
  });

  it("raises source-level exposure evidence before an inbox alert exists", () => {
    expect(
      deskVerdict({
        ...base,
        sourceCount: 1,
        checkedSourceCount: 0,
        criticalSourceCount: 1,
        checksInFlight: 0,
      }),
    ).toMatchObject({ tone: "crit", title: "One source needs attention." });
  });

  it("does not confuse a paused GitHub installation with an ended plan", () => {
    expect(
      deskVerdict({
        ...base,
        githubPaused: true,
        sourceCount: 1,
        checkedSourceCount: 1,
      }),
    ).toMatchObject({ tone: "paused", title: "GitHub suspended the NoSpoilers App." });
  });
});

describe("Watch exposure chart", () => {
  it("derives daily exposure from alert open and close times", () => {
    const now = Date.parse("2026-09-03T12:00:00Z");
    const days = exposureByDay(
      [
        {
          id: 1,
          kind: "repo_publicized",
          title: "Public",
          body: "",
          findings: null,
          created_at: "2026-09-03T10:00:00Z",
        },
        {
          id: 2,
          kind: "release_scan",
          title: "Map",
          body: "",
          findings: null,
          created_at: "2026-09-02T22:00:00Z",
          resolved_at: "2026-09-03T01:00:00Z",
        },
      ],
      now,
    );
    expect(days.at(-2)?.exposedMs).toBe(2 * 60 * 60 * 1000);
    expect(days.at(-1)?.exposedMs).toBe(3 * 60 * 60 * 1000);
  });
});

describe("2B watch routes", () => {
  it("opens Overview on /watch and keeps settings in the same tree", () => {
    expect(parseWatchRoute("/watch", "").view).toBe("overview");
    expect(parseWatchRoute("/watch/scan", "").view).toBe("scan");
    expect(parseWatchRoute("/watch/notifications", "").view).toBe("notifications");
    expect(parseWatchRoute("/watch/alerts", "?tab=waiting").tab).toBe("waiting");
    expect(parseWatchRoute("/watch/releases", "?release=12").releaseId).toBe(12);
    expect(parseWatchRoute("/watch/releases", "?preview=9").releasePreviewId).toBe(9);
    expect(watchHref("/watch/releases", "?install=7", { previewRelease: 9 })).toBe(
      "/watch/releases?install=7&preview=9",
    );
    expect(
      parseWatchRoute(
        "/watch/sources",
        "?install=7&source=npm-4&sourceType=npm&attention=1&configure=npm",
      ),
    ).toMatchObject({
      sourceKey: "npm-4",
      sourceFilter: "npm",
      sourceAttention: true,
      sourceConfigure: "npm",
    });
    expect(watchPath("policy")).toBe("/watch/policy");
    expect(watchHref("/watch/alerts", "?install=7", { tab: "done" })).toBe(
      "/watch/alerts?install=7&tab=done",
    );
    expect(
      watchHref("/watch/sources", "?install=7", {
        source: "repo-2",
        sourceType: "github",
        attention: true,
        configure: "github",
      }),
    ).toBe("/watch/sources?install=7&source=repo-2&sourceType=github&attention=1&configure=github");
  });
});

describe("alert views", () => {
  const rows = [
    { id: 1, kind: "npm_scan", title: "open", body: "", findings: null, created_at: "2026-01-01T00:00:00Z" },
    {
      id: 2,
      kind: "npm_scan",
      title: "waiting",
      body: "",
      findings: null,
      created_at: "2026-01-01T00:00:00Z",
      acknowledged_at: "2026-01-01T01:00:00Z",
    },
    {
      id: 3,
      kind: "npm_scan",
      title: "mine",
      body: "",
      findings: null,
      created_at: "2026-01-01T00:00:00Z",
      assigned_to_login: "dana",
    },
    {
      id: 4,
      kind: "npm_scan",
      title: "done",
      body: "",
      findings: null,
      created_at: "2026-01-01T00:00:00Z",
      resolved_at: "2026-01-01T02:00:00Z",
    },
  ];

  it("treats waiting as acknowledged and still open", () => {
    expect(filterDeskAlerts(rows, "open", "dana").map((row) => row.id)).toEqual([1, 3]);
    expect(filterDeskAlerts(rows, "waiting", "dana").map((row) => row.id)).toEqual([2]);
    expect(filterDeskAlerts(rows, "mine", "dana").map((row) => row.id)).toEqual([3]);
    expect(filterDeskAlerts(rows, "done", "dana").map((row) => row.id)).toEqual([4]);
    expect(filterDeskAlerts(rows, "open", "dana",true).map((row) => row.id)).toEqual([3]);
    expect(filterDeskAlerts(rows, "open", "",true)).toEqual([]);
  });
});

describe("setup ring", () => {
  it("counts the five leak paths from live connections", () => {
    const progress = setupProgress({
      repos: 1,
      packages: 1,
      origins: 0,
      maps: 1,
      tokens: 0,
    });
    expect(progress.done).toBe(3);
    expect(progress.total).toBe(5);
  });

  it("does not infer workflow or release coverage from a repository count", () => {
    const setup = buildSetupViewModel({
      repos: [
        { id: 1, full_name: "acme/app", private: true, last_checked_at: null },
        { id: 2, full_name: "acme/api", private: true, last_checked_at: null },
      ],
      releases: [],
      setupProbes: {},
      packages: [],
      origins: [],
      maps: [],
    });
    expect(setup.steps.find((step) => step.key === "visibility")?.proof).toBe("check-needed");
    expect(setup.steps.find((step) => step.key === "release-assets")?.proof).toBe("check-needed");
    expect(setup.steps.find((step) => step.key === "workflow-check")?.proof).toBe("check-needed");
    expect(setup.done).toBe(0);
  });

  it("requires real production and map proof when a public map was found", () => {
    const base = {
      repos: [],
      releases: [],
      setupProbes: {},
      packages: [],
      origins: [
        {
          id: 1,
          origin_url: "https://app.example.test",
          host: "app.example.test",
          last_sha256: "abc",
          last_checked_at: "2026-09-03T10:00:00Z",
          last_scan_status: "failed",
          last_public_map: true,
        },
      ],
    };
    expect(buildSetupViewModel({ ...base, maps: [] }).steps.at(-1)?.proof).toBe("check-needed");
    expect(
      buildSetupViewModel({
        ...base,
        maps: [
          {
            id: 1,
            kind: "sentry",
            host: "sentry.io",
            orgSlug: "acme",
            projectSlug: "web",
            lastCheckedAt: "2026-09-03T10:10:00Z",
            lastStatus: "verified",
            lastError: null,
          },
        ],
      }).steps.at(-1)?.proof,
    ).toBe("covered");
  });

  it("only covers GitHub visibility after a real check supplied evidence", () => {
    const setup = buildSetupViewModel({
      repos: [
        {
          id: 1,
          full_name: "acme/app",
          private: true,
          last_checked_at: "2026-09-03T10:00:00Z",
        },
      ],
      releases: [],
      setupProbes: {},
      packages: [],
      origins: [],
      maps: [],
    });
    expect(setup.steps.find((step) => step.key === "visibility")?.proof).toBe("covered");
    expect(setup.done).toBe(1);
  });
});

describe("normalized source views", () => {
  it('names only the authenticated connection matching the source identity',()=>{
    const input={repos:[{id:1,installation_id:7,full_name:'acme/app',private:true,last_checked_at:null}],packages:[],origins:[],maps:[]};
    expect(buildSourceViewModels({...input,connections:[{id:8,account_login:'other'}]})[0]?.connectionLabel).toBeNull();
    expect(buildSourceViewModels({...input,connections:[{id:7,account_login:'acme'}]})[0]?.connectionLabel).toBe('acme');
  });
  it('keeps registry metadata freshness separate from actual scan time', () => {
    const rows=buildSourceViewModels({repos:[],origins:[],maps:[],packages:[{id:1,package_name:'app',last_version:'1',last_sha256:null,last_checked_at:'2026-09-06T12:00:00Z',last_scanned_at:'2026-09-01T12:00:00Z',last_scan_status:'passed'},{id:2,package_name:'unscanned',last_version:null,last_sha256:null,last_checked_at:'2026-09-06T12:00:00Z',last_scan_status:null}]});
    expect(rows[0]).toMatchObject({lastCheckedAt:'2026-09-06T12:00:00Z',lastScannedAt:'2026-09-01T12:00:00Z'});
    expect(rows[1]?.lastScannedAt).toBeNull();
    expect(rows[0]?.scope).toContain('not the repository or deployed website');
    expect(rows[0]?.connectionId).toBeNull();
  });
  it('preserves the actual source connection identity across source kinds',()=>{
    const rows=buildSourceViewModels({repos:[{id:1,installation_id:7,full_name:'acme/app',private:true,last_checked_at:null}],packages:[{id:2,installation_id:8,package_name:'app',last_version:null,last_sha256:null,last_checked_at:null,last_scan_status:null}],origins:[{id:3,installation_id:9,origin_url:'https://app.example.com',host:'app.example.com',last_sha256:null,last_checked_at:null,last_scan_status:null}],maps:[{id:4,installationId:10,kind:'sentry',host:'sentry.io',orgSlug:null,projectSlug:'app',lastCheckedAt:null,lastStatus:null,lastError:null}]});
    expect(rows.map(row=>row.connectionId)).toEqual([7,8,9,10]);
  });
  it.each(['inconclusive', 'error', 'future-status', null, 'passed'])('does not invent successful coverage for %s', (status) => {
    const rows=buildSourceViewModels({repos:[],packages:[{id:1,package_name:'app',last_version:'1',last_sha256:null,last_checked_at:'2026-09-06',last_scan_status:status}],origins:[{id:2,origin_url:'https://app.example.com',host:'app.example.com',last_sha256:null,last_checked_at:'2026-09-06',last_scan_status:status}],maps:[{id:3,kind:'sentry',host:'sentry.io',orgSlug:null,projectSlug:'app',lastCheckedAt:'2026-09-06',lastStatus:status,lastError:null}]});
    const expected=status==='passed'?'ok':status==='inconclusive'||status==='error'?'warning':'unknown';
    expect(rows.map(row=>row.attention)).toEqual([expected,expected,expected]);
    if(expected==='warning')expect(filterSourceViewModels(rows,'all',true)).toHaveLength(3);
  });
  it("unifies real source kinds and filters attention without illustrative rows", () => {
    const sources = buildSourceViewModels({
      repos: [{ id: 1, full_name: "acme/app", private: true, last_checked_at: null }],
      packages: [
        {
          id: 2,
          package_name: "@acme/app",
          last_version: "1.0.0",
          last_sha256: "abc",
          last_checked_at: "2026-09-03T10:00:00Z",
          last_scan_status: "failed-policy",
        },
      ],
      origins: [],
      maps: [],
      alerts: [],
    });
    expect(sources.map((source) => source.kind)).toEqual(["github", "npm"]);
    expect(filterSourceViewModels(sources, "npm", true).map((source) => source.key)).toEqual([
      "npm-2",
    ]);
  });

  it("does not crash Coverage when a legacy alert stores digest metadata instead of findings", () => {
    const sources = buildSourceViewModels({
      repos: [{ id: 1, full_name: "acme/app", private: true, last_checked_at: null }],
      packages: [],
      origins: [],
      maps: [],
      alerts: [
        {
          id: 9,
          kind: "release_digest_mismatch",
          title: "Digest changed",
          body: "",
          findings: {
            coordinate: "web:https://app.example.com/",
            previousSha256: "old",
            artifactSha256: "new",
          },
          created_at: "2026-09-03T10:00:00Z",
        } as never,
      ],
    });
    expect(sources).toHaveLength(1);
    expect(sources[0]?.alertCount).toBe(0);
    expect(asFindingList({ coordinate: "web:https://app.example.com/" })).toEqual([]);
    expect(
      leadFinding({
        findings: { previousSha256: "old", artifactSha256: "new" },
      }),
    ).toBeNull();
    expect(() =>
      buildTimelineLanes(
        [
          {
            id: 9,
            kind: "release_digest_mismatch",
            title: "Digest changed",
            body: "",
            findings: { coordinate: "web:https://app.example.com/" } as never,
            created_at: "2026-09-03T10:00:00Z",
          },
        ],
        { now: Date.parse("2026-09-03T12:00:00Z"), days: 7 },
      ),
    ).not.toThrow();
  });
});

describe("source-lane timeline", () => {
  it("clips spans to the retained window and keeps open state", () => {
    const now = Date.parse("2026-09-03T12:00:00Z");
    const lanes = buildTimelineLanes(
      [
        {
          id: 7,
          kind: "npm_scan",
          title: "Map exposed",
          body: "",
          full_name: "@acme/app@1.0.0",
          findings: [{ rule: "MAP-002", path: "dist/app.js.map" }],
          created_at: "2026-09-03T10:00:00Z",
        },
      ],
      { now, days: 7 },
    );
    expect(lanes).toHaveLength(1);
    expect(lanes[0]?.spans[0]).toMatchObject({
      alertId: 7,
      rule: "MAP-002",
      open: true,
      severity: "critical",
      startedAt: "2026-09-03T10:00:00.000Z",
      endedAt: null,
    });
    expect(lanes[0]?.spans[0]?.left).toBeGreaterThan(90);
  });
});

describe("selected alert activity", () => {
  it("loads activity as soon as a real alert is selected and caches empty results", async () => {
    expect(
      shouldLoadAlertActivity({
        previewing: false,
        selectedAlertId: 19,
        alertEvents: {},
      }),
    ).toBe(true);
    const calls: string[] = [];
    const fetcher = (async (input: unknown) => {
      calls.push(String(input));
      return new Response(
        JSON.stringify({
          events: [
            {
              id: 1,
              actor_login: "dana",
              action: "acknowledged",
              detail: null,
              created_at: "2026-09-03T10:00:00Z",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const events = await loadSelectedAlertActivity(19, fetcher);
    expect(calls).toEqual(["/api/alerts/19/events"]);
    expect(events[0]?.action).toBe("acknowledged");
    expect(
      shouldLoadAlertActivity({
        previewing: false,
        selectedAlertId: 19,
        alertEvents: { 19: events },
      }),
    ).toBe(false);
  });
});

describe("truthful section states", () => {
  it("lets an error dominate loading so no section can render an empty success state", () => {
    expect(
      combineWatchSectionStates([
        { status: "loading" },
        { status: "error", message: "alerts unavailable" },
        { status: "ready" },
      ]),
    ).toEqual({ status: "error", message: "alerts unavailable" });
    expect(combineWatchSectionStates([{ status: "loading" }, { status: "ready" }])).toEqual({
      status: "loading",
    });
  });
});

describe("command palette keyboard model", () => {
  it("wraps and supports Home and End", () => {
    expect(nextPaletteIndex(2, "ArrowDown", 3)).toBe(0);
    expect(nextPaletteIndex(0, "ArrowUp", 3)).toBe(2);
    expect(nextPaletteIndex(1, "Home", 3)).toBe(0);
    expect(nextPaletteIndex(1, "End", 3)).toBe(2);
  });

  it("deep-links real entities and omits admin actions for members", () => {
    const items = buildPaletteItems({
      query: "artifact",
      search: "?install=7",
      teamOnly: true,
      adminOnly: false,
      alerts: [{ id: 12, title: "Artifact exposed" }],
      sources: [{ key: "npm-4", name: "artifact-kit" }],
      releases: [{ id: 9, coordinate: "artifact-kit@1.2.0" }],
    });
    expect(items.map((item) => item.href)).toContain("/watch/alerts?install=7&alert=12");
    expect(items.map((item) => item.href)).toContain("/watch/sources?install=7&source=npm-4");
    expect(items.map((item) => item.href)).toContain("/watch/releases?install=7&release=9");
    expect(items.some((item) => item.id === "do-add-source")).toBe(false);
  });
});

describe("overview bento", () => {
  it("keeps empty coverage, alerts, and sparks hollow instead of inventing rows", () => {
    expect(coverageDonut([])).toEqual({
      clean: 0,
      warn: 0,
      crit: 0,
      total: 0,
      pct: 0,
      okEnd: 0,
      warnEnd: 0,
    });
    expect(sourceKindCounts([])).toEqual({ github: 0, npm: 0, website: 0, map: 0 });
    expect(countOpenAlerts([])).toEqual({ open: 0, critical: 0, warning: 0, assigned: 0 });
    expect(buildPackSpark([])).toEqual({ bars: [], packCount: 0, failedPolicy: 0 });
    expect(latestSealedReleases([])).toEqual([]);
    expect(nextExceptionExpiry([])).toBeNull();
  });

  it("colors spark bars from real receipt statuses in the 30-day window", () => {
    const now = Date.parse("2026-09-04T12:00:00Z");
    const spark = buildPackSpark(
      [
        { createdAt: "2026-08-01T12:00:00Z", receiptStatus: "failed-policy" },
        { createdAt: "2026-08-20T12:00:00Z", receiptStatus: "inconclusive" },
        { createdAt: "2026-09-03T12:00:00Z", receiptStatus: "passed" },
        { createdAt: "2026-09-04T08:00:00Z", receiptStatus: "failed-policy" },
      ],
      now,
    );
    expect(spark.packCount).toBe(3);
    expect(spark.failedPolicy).toBe(1);
    expect(spark.bars.some((bar) => bar.tone === "bad")).toBe(true);
    expect(spark.bars.some((bar) => bar.tone === "warn")).toBe(true);
  });

  it("counts assigned open alerts from the live login only", () => {
    const counts = countOpenAlerts(
      [
        {
          id: 1,
          kind: "release_scan",
          title: "Map",
          body: "",
          findings: [{ rule: "MAP-002", path: "dist/cli.js.map" }],
          created_at: "2026-09-04T10:00:00Z",
          assigned_to_login: "red",
        },
        {
          id: 2,
          kind: "repo_publicized",
          title: "Public",
          body: "",
          findings: null,
          created_at: "2026-09-04T11:00:00Z",
          assigned_to_login: "other",
        },
        {
          id: 3,
          kind: "release_scan",
          title: "Done",
          body: "",
          findings: [{ rule: "MAP-001", path: "dist/app.js.map" }],
          created_at: "2026-09-01T10:00:00Z",
          resolved_at: "2026-09-02T10:00:00Z",
        },
      ],
      "Red",
    );
    expect(counts).toEqual({ open: 2, critical: 1, warning: 1, assigned: 1 });
  });

  it("shortens digests and relative times without inventing values", () => {
    expect(shortDigest("9f31abc0a")).toBe("9f31…c0a");
    expect(shortDigest("ab")).toBe("ab");
    expect(formatAgo("2026-09-04T11:20:00Z", Date.parse("2026-09-04T12:00:00Z"))).toBe("40m ago");
  });
});
