import { describe, expect, it } from "vitest";
import { parseWatchRoute, watchHref, watchPath } from "../src/watch/routes.ts";
import { filterDeskAlerts, setupProgress } from "../src/watch/verdict.ts";
import { previewAlerts, previewRepos } from "../src/preview.ts";
import { exposureByDay } from "../src/watch/exposure.ts";
import {
  buildSetupViewModel,
  buildSourceViewModels,
  buildTimelineLanes,
  filterSourceViewModels,
} from "../src/watch/view-models.ts";
import {
  loadSelectedAlertActivity,
  shouldLoadAlertActivity,
} from "../src/watch/useWatchDeskController.ts";
import {
  buildPaletteItems,
  nextPaletteIndex,
} from "../src/watch/command.ts";
import { combineWatchSectionStates } from "../src/watch/data-state.ts";

describe("Watch preview", () => {
  it("shows structure without inventing tenant rows", () => {
    expect(previewRepos()).toEqual([]);
    expect(previewAlerts()).toEqual([]);
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
    expect(parseWatchRoute("/watch/notifications", "").view).toBe("notifications");
    expect(parseWatchRoute("/watch/alerts", "?tab=waiting").tab).toBe("waiting");
    expect(parseWatchRoute("/watch/releases", "?release=12").releaseId).toBe(12);
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
    expect(filterDeskAlerts(rows, "open", "dana").map((row) => row.id)).toEqual([1, 2, 3]);
    expect(filterDeskAlerts(rows, "waiting", "dana").map((row) => row.id)).toEqual([2]);
    expect(filterDeskAlerts(rows, "mine", "dana").map((row) => row.id)).toEqual([3]);
    expect(filterDeskAlerts(rows, "done", "dana").map((row) => row.id)).toEqual([4]);
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
