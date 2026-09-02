import { describe, expect, it } from "vitest";
import { formatExposure, kindLabel } from "../src/watch/format.ts";
import {
  parseWatchRoute,
  settingsHref,
  watchHref,
  watchPath,
} from "../src/watch/routes.ts";
import { deskVerdict, filterDeskAlerts, newestOpenAlert } from "../src/watch/verdict.ts";

describe("watch routes", () => {
  it("treats /watch as the desk overview", () => {
    expect(parseWatchRoute("/watch", "")).toEqual({
      wall: "desk",
      view: "overview",
      alertId: null,
      tab: "open",
    });
  });

  it("reads desk pages, settings pages, alert id, and saved views", () => {
    expect(parseWatchRoute("/watch/alerts", "?alert=12&tab=waiting")).toMatchObject({
      wall: "desk",
      view: "alerts",
      alertId: 12,
      tab: "waiting",
    });
    expect(parseWatchRoute("/watch/settings/retention", "?install=7")).toMatchObject({
      wall: "settings",
      view: "retention",
    });
    expect(watchPath("overview")).toBe("/watch");
    expect(watchPath("policy")).toBe("/watch/settings/policy");
    expect(watchHref("/watch/alerts", "?install=7&as=trial", { alert: 3, tab: "mine" })).toBe(
      "/watch/alerts?install=7&as=trial&alert=3&tab=mine",
    );
    expect(settingsHref("?install=7")).toBe("/watch/settings/notifications?install=7");
  });
});

describe("watch verdict", () => {
  const leak = {
    id: 2,
    kind: "npm_scan",
    title: "Original source in published pack",
    body: "MAP-002",
    findings: [{ rule: "MAP-002", path: "dist/cli.js.map" }],
    created_at: new Date(Date.now() - 41 * 60_000).toISOString(),
    full_name: "nospoilers@0.4.2",
  };

  it("uses live coverage and source counts, not invented incidents", () => {
    expect(
      deskVerdict({ ended: true, githubPaused: false, sourceCount: 2, alerts: [leak] }).title,
    ).toBe("We stopped looking.");
    expect(
      deskVerdict({ ended: false, githubPaused: true, sourceCount: 2, alerts: [] }).title,
    ).toBe("GitHub suspended the NoSpoilers App.");
    expect(
      deskVerdict({ ended: false, githubPaused: false, sourceCount: 0, alerts: [] }).title,
    ).toBe("Nothing is being watched yet.");
    expect(
      deskVerdict({ ended: false, githubPaused: false, sourceCount: 2, alerts: [] }).title,
    ).toBe("Nothing is exposed right now.");
    expect(
      deskVerdict({ ended: false, githubPaused: false, sourceCount: 2, alerts: [leak] }).title,
    ).toBe("One thing is exposed right now.");
  });

  it("filters the inbox from real alert fields", () => {
    const resolved = { ...leak, id: 3, resolved_at: new Date().toISOString() };
    const assigned = { ...leak, id: 4, assigned_to_login: "dana" };
    expect(filterDeskAlerts([leak, resolved], "open", "dana")).toEqual([leak]);
    expect(filterDeskAlerts([leak, resolved], "done", "dana")).toEqual([resolved]);
    expect(filterDeskAlerts([leak, assigned], "mine", "dana")).toEqual([assigned]);
    expect(newestOpenAlert([resolved, leak])?.id).toBe(2);
  });
});

describe("watch format", () => {
  it("keeps the same exposure clock and kind labels the desk already used", () => {
    expect(formatExposure(41 * 60_000, new Date().toISOString(), null)).toBe("41 min");
    expect(kindLabel("npm_scan")).toBe("npm pack");
    expect(kindLabel("fair_use_budget")).toBe("Fair use");
  });
});
