import { describe, expect, it } from "vitest";
import { parseWatchRoute, watchHref, watchPath } from "../src/watch/routes.ts";
import { filterDeskAlerts, setupProgress } from "../src/watch/verdict.ts";

describe("2B watch routes", () => {
  it("opens Overview on /watch and keeps settings in the same tree", () => {
    expect(parseWatchRoute("/watch", "").view).toBe("overview");
    expect(parseWatchRoute("/watch/notifications", "").view).toBe("notifications");
    expect(parseWatchRoute("/watch/alerts", "?tab=waiting").tab).toBe("waiting");
    expect(watchPath("policy")).toBe("/watch/policy");
    expect(watchHref("/watch/alerts", "?install=7", { tab: "done" })).toBe(
      "/watch/alerts?install=7&tab=done",
    );
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
});
