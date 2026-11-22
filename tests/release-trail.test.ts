import { describe, expect, it } from "vitest";
import {
  artifactLine,
  buildReleaseTrail,
  coordinateName,
  coordinateVersion,
  firstFix,
  readCheck,
  scheduleLine,
  scheduleTag,
  sourcesWhenFound,
  type ReleaseTrailInput,
  type TrailRevisionInput,
} from "../src/watch/release-trail.ts";

const BAD = "a".repeat(64);
const GOOD = "b".repeat(64);
const OTHER = "c".repeat(64);
const now = new Date("2026-11-05T12:20:00.000Z");
const at = (hour: number, minute = 5) => `2026-11-05T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;

const rev = (id: number, version: string, status: string | null, sha: string, createdAt: string): TrailRevisionInput => ({
  id,
  coordinate: `npm:acme-cli@${version}`,
  status,
  artifactSha256: sha,
  createdAt,
});

const blocked = rev(3, "2.4.1", "failed-policy", BAD, at(8, 0));
const fix = rev(4, "2.4.2", "passed", GOOD, at(10, 0));
const lineage = [rev(1, "2.3.2", "passed", OTHER, "2026-11-01T09:00:00.000Z"), rev(2, "2.4.0", "passed", OTHER, "2026-11-03T09:00:00.000Z"), blocked, fix];

function input(extra: Partial<ReleaseTrailInput> = {}): ReleaseTrailInput {
  return {
    release: blocked,
    lineage,
    locations: [
      { id: 1, url: "https://registry.npmjs.org/acme-cli/-/acme-cli-2.4.1.tgz", host: "registry.npmjs.org", canonical: true, lastStatus: "missing", lastSha256: null, lastCheckedAt: at(12) },
      { id: 2, url: "https://cdn.acme.example/cli/2.4.1/cli.tgz", host: "cdn.acme.example", canonical: false, lastStatus: "matched", lastSha256: BAD, lastCheckedAt: at(12) },
      { id: 3, url: "https://get.acme.example/latest.tgz", host: "get.acme.example", canonical: false, lastStatus: "mismatch", lastSha256: GOOD, lastCheckedAt: at(12) },
    ],
    checks: [8, 9, 10, 11, 12].flatMap((hour) => [
      { locationId: 1, status: hour < 10 ? "matched" : "missing", observedSha256: hour < 10 ? BAD : null, createdAt: at(hour) },
      { locationId: 2, status: "matched", observedSha256: BAD, createdAt: at(hour) },
      { locationId: 3, status: hour < 10 ? "matched" : "mismatch", observedSha256: hour < 10 ? BAD : GOOD, createdAt: at(hour) },
    ]),
    now,
    ...extra,
  };
}

describe("release coordinates", () => {
  it("reads the name and version out of a coordinate", () => {
    expect(coordinateVersion("npm:@acme/cli@2.4.1")).toBe("2.4.1");
    expect(coordinateName("npm:@acme/cli@2.4.1")).toBe("@acme/cli");
    expect(coordinateVersion("github:acme/cli@v2.4.1#cli.tgz")).toBe("v2.4.1");
    expect(coordinateName("github:acme/cli@v2.4.1#cli.tgz")).toBe("acme/cli");
    expect(coordinateVersion("web:https://acme.example/")).toBe("");
  });

  it("lines up an asset that carries its version in the file name", () => {
    expect(artifactLine("github:acme/cli@v2.4.1#acme-cli-2.4.1.tgz")).toBe(artifactLine("github:acme/cli@v2.4.2#acme-cli-2.4.2.tgz"));
    expect(artifactLine("github:acme/cli@v2.4.1#acme-cli-v2.4.1-linux.tgz")).toBe(artifactLine("github:acme/cli@v2.4.2#acme-cli-v2.4.2-linux.tgz"));
    expect(artifactLine("github:acme/cli@v2.4.1#acme-cli-2.4.1-linux.tgz")).not.toBe(artifactLine("github:acme/cli@v2.4.2#acme-cli-2.4.2-macos.tgz"));
    // A bare major tag is too short to be taken out of a file name safely.
    expect(artifactLine("github:acme/cli@v1#cli-v1.tgz")).not.toBe(artifactLine("github:acme/cli@v2#cli-v2.tgz"));
  });
});

describe("the fix for a blocked release", () => {
  it("is the first later version of the same line that passed", () => {
    expect(firstFix(blocked, [...lineage, rev(5, "2.4.3", "passed", GOOD, at(11, 0))])?.id).toBe(4);
  });

  it("does not exist for a passing release, an earlier pass or another package", () => {
    expect(firstFix(fix, lineage)).toBeNull();
    expect(firstFix(blocked, [rev(2, "2.4.0", "passed", OTHER, "2026-11-03T09:00:00.000Z"), blocked])).toBeNull();
    expect(firstFix(blocked, [blocked, { ...fix, coordinate: "npm:acme-cli-extra@2.4.2" }])).toBeNull();
    expect(firstFix(blocked, [blocked, rev(5, "2.4.2", "inconclusive", GOOD, at(10, 0))])).toBeNull();
  });
});

describe("reading one recorded check", () => {
  const bySha = new Map(lineage.map((row) => [row.artifactSha256, row]));
  const failed = { status: "failed" as const, bySha, sha: BAD };
  const passed = { status: "passed" as const, bySha, sha: GOOD };

  it("calls a copy of a blocked build exposed only while it serves those bytes", () => {
    expect(readCheck(failed, "matched", BAD)).toEqual({ state: "exposed", label: "Serving this build" });
    expect(readCheck(failed, "missing", null)).toEqual({ state: "clear", label: "No longer served" });
    expect(readCheck(failed, "mismatch", GOOD)).toEqual({ state: "clear", label: "Now serves 2.4.2" });
  });

  it("never calls unread or unknown bytes clear", () => {
    expect(readCheck(failed, null, null).state).toBe("unknown");
    expect(readCheck(failed, "error", null).state).toBe("unknown");
    expect(readCheck(failed, "blocked", null).state).toBe("unknown");
    expect(readCheck(failed, "redirect", null).state).toBe("unknown");
    expect(readCheck(failed, "mismatch", "d".repeat(64))).toEqual({ state: "changed", label: "Replaced by bytes not yet checked" });
  });

  it("reads a passing release against the build that was checked", () => {
    expect(readCheck(passed, "matched", GOOD)).toEqual({ state: "clear", label: "Matches the checked build" });
    expect(readCheck(passed, "mismatch", BAD)).toEqual({ state: "exposed", label: "Serves 2.4.1, also blocked" });
    expect(readCheck(passed, "missing", null).state).toBe("changed");
    expect(readCheck({ ...passed, status: "incomplete" }, "matched", GOOD).state).toBe("unknown");
  });
});

describe("buildReleaseTrail", () => {
  it("draws each copy with its current reading, first reading and hourly cells", () => {
    const trail = buildReleaseTrail(input());
    expect(trail.release).toMatchObject({ name: "acme-cli", version: "2.4.1", status: "failed" });
    expect(trail.fix).toMatchObject({ id: 4, version: "2.4.2" });
    expect(trail.hours).toHaveLength(24);
    expect(trail.hours.at(-1)).toBe("2026-11-05T12:00:00.000Z");
    const [registry, cdn, latest] = trail.sources;
    expect(registry).toMatchObject({ kind: "origin", name: "npm registry", detail: "registry.npmjs.org", state: "clear", label: "No longer served", since: at(10) });
    expect(cdn).toMatchObject({ kind: "copy", name: "cdn.acme.example", detail: "/cli/2.4.1/cli.tgz", state: "exposed", label: "Still serving this build" });
    expect(latest).toMatchObject({ state: "clear", label: "Now serves 2.4.2" });
    expect(registry.first).toEqual({ state: "exposed", label: "Serving this build", at: at(8) });
    expect(registry.cells.slice(-5)).toEqual(["exposed", "exposed", "clear", "clear", "clear"]);
    expect(cdn.cells.slice(-5)).toEqual(["exposed", "exposed", "exposed", "exposed", "exposed"]);
    expect(cdn.cells.slice(0, 19).every((cell) => cell === "none")).toBe(true);
    expect(trail.summary).toMatchObject({ tone: "bad", headline: "1 source is still serving this build", exposed: 1, clear: 2, copies: 3, lastCheckedAt: at(12) });
  });

  it("shows the sources as they stood when first read", () => {
    const found = sourcesWhenFound(buildReleaseTrail(input()));
    expect(found.map((source) => source.state)).toEqual(["exposed", "exposed", "exposed"]);
    expect(found[0].label).toBe("Serving this build");
  });

  it("orders the version line and marks the blocked release and its fix", () => {
    const trail = buildReleaseTrail(input());
    expect(trail.versions.map((version) => [version.version, version.status, version.role])).toEqual([
      ["2.3.2", "passed", "other"],
      ["2.4.0", "passed", "other"],
      ["2.4.1", "failed", "this"],
      ["2.4.2", "passed", "fix"],
    ]);
  });

  it("records what happened in order, with alerts", () => {
    const trail = buildReleaseTrail(input({ alerts: [{ id: 9, title: "cdn.acme.example still serves npm:acme-cli@2.4.1 after the fix", createdAt: at(10, 42), resolvedAt: null }] }));
    expect(trail.events.map((event) => event.text)).toEqual([
      "2.4.1 checked: blocked",
      "npm registry: serving this build",
      "cdn.acme.example: serving this build",
      "get.acme.example: serving this build",
      "2.4.2 passed its check",
      "npm registry: no longer served",
      "get.acme.example: now serves 2.4.2",
      "Alert sent: cdn.acme.example still serves npm:acme-cli@2.4.1 after the fix",
    ]);
    expect(trail.events.map((event) => event.tone)).toEqual(["bad", "bad", "bad", "bad", "good", "good", "good", "bad"]);
  });

  it("reports every copy clear only once none serves the blocked build", () => {
    const trail = buildReleaseTrail(input({
      locations: input().locations.map((location) => location.id === 2 ? { ...location, lastStatus: "missing", lastSha256: null } : location),
    }));
    expect(trail.summary).toMatchObject({ tone: "good", headline: "No source serves this build", exposed: 0, clear: 3 });
  });

  it("keeps unread copies unknown instead of clear", () => {
    const trail = buildReleaseTrail(input({
      locations: [{ id: 2, url: "https://cdn.acme.example/cli.tgz", host: "cdn.acme.example", canonical: false, lastStatus: null, lastSha256: null, lastCheckedAt: null }],
      checks: [],
    }));
    expect(trail.sources[0]).toMatchObject({ state: "unknown", label: "Not checked yet", first: null, since: null });
    expect(trail.summary).toMatchObject({ tone: "plain", headline: "No source has been read yet" });
  });

  it("says plainly when nothing is tracked", () => {
    const trail = buildReleaseTrail(input({ locations: [], checks: [] }));
    expect(trail.summary).toMatchObject({ tone: "plain", headline: "No copy of this release is being tracked", copies: 0 });
    expect(trail.events.map((event) => event.text)).toEqual(["2.4.1 checked: blocked", "2.4.2 passed its check"]);
  });

  it("says whether copies are still read every hour, have stopped being read, or are read on demand only", () => {
    expect(buildReleaseTrail(input()).schedule).toBe("hourly");
    expect(buildReleaseTrail(input({ recheck: { enabled: false, days: 30 } })).schedule).toBe("off");
    const later = new Date("2026-12-06T08:01:00.000Z");
    expect(buildReleaseTrail(input({ now: later })).schedule).toBe("ended");
    expect(buildReleaseTrail(input({ now: new Date("2026-12-05T07:59:00.000Z") })).schedule).toBe("hourly");
    expect(buildReleaseTrail(input({ now: later, recheck: { enabled: true, days: 60 } })).schedule).toBe("hourly");
    expect(buildReleaseTrail(input({ now: later, recheck: { enabled: false, days: 30 } })).schedule).toBe("off");
    expect([scheduleLine("hourly"), scheduleLine("ended"), scheduleLine("off")]).toEqual(["Checked hourly", "Hourly checks have ended", "Hourly checks are off"]);
    expect([scheduleTag("hourly"), scheduleTag("ended"), scheduleTag("off")]).toEqual(["checked every hour", "hourly checks have ended", "hourly checks are off"]);
  });

  it("lists websites and map stores as separately watched context, never as copies", () => {
    const trail = buildReleaseTrail(input({
      websites: [
        { id: 1, host: "app.acme.example", status: "passed", publicMap: false, checkedAt: at(11) },
        { id: 2, host: "docs.acme.example", status: "failed", publicMap: true, checkedAt: at(11) },
        { id: 3, host: "new.acme.example", status: null, publicMap: false, checkedAt: null },
        { id: 4, host: "old.acme.example", status: "passed", publicMap: false, checkedAt: at(11), paused: true },
      ],
      mapStores: [{ id: 1, kind: "sentry", project: "acme/cli", status: "passed", checkedAt: at(11) }],
    }));
    const context = trail.sources.filter((source) => source.scope === "workspace");
    expect(context.map((source) => [source.name, source.state, source.label])).toEqual([
      ["app.acme.example", "clear", "Clean at its last check"],
      ["docs.acme.example", "exposed", "Serves a public source map"],
      ["new.acme.example", "unknown", "Not checked yet"],
      ["old.acme.example", "unknown", "Watching is paused"],
      ["Sentry upload", "clear", "Private, as intended"],
    ]);
    expect(context.every((source) => source.cells.length === 0)).toBe(true);
    expect(trail.summary.copies).toBe(3);
    expect(trail.summary.exposed).toBe(1);
  });

  it("names an attached copy on the registry or a GitHub release by what it is, and shows only its path", () => {
    const attach = (id: number, url: string) => ({ id, url, host: new URL(url).host, canonical: false, lastStatus: "matched", lastSha256: BAD, lastCheckedAt: at(12) });
    const trail = buildReleaseTrail(input({
      locations: [
        attach(1, "https://registry.npmjs.org/acme-cli/-/acme-cli-2.4.1.tgz"),
        attach(2, "https://github.com/acme/cli/releases/download/v2.4.1/acme-cli-2.4.1.tgz"),
        attach(3, "https://github.com/acme/cli/archive/refs/tags/v2.4.1.tar.gz"),
        attach(4, "https://cdn.acme.example/cli/2.4.1/cli.tgz"),
      ],
      checks: [],
    }));
    expect(trail.sources.map((source) => source.name)).toEqual(["npm registry", "GitHub release", "github.com", "cdn.acme.example"]);
    expect(trail.sources[3].detail).toBe("/cli/2.4.1/cli.tgz");
    expect(trail.sources.every((source) => source.kind === "copy" && !source.detail.includes("://"))).toBe(true);
  });

  it("reads a passing release against its own bytes", () => {
    const trail = buildReleaseTrail({
      release: fix,
      lineage,
      locations: [{ id: 7, url: "https://registry.npmjs.org/acme-cli/-/acme-cli-2.4.2.tgz", host: "registry.npmjs.org", canonical: true, lastStatus: "matched", lastSha256: GOOD, lastCheckedAt: at(12) }],
      checks: [{ locationId: 7, status: "matched", observedSha256: GOOD, createdAt: at(12) }],
      now,
    });
    expect(trail.fix).toBeNull();
    expect(trail.sources[0]).toMatchObject({ state: "clear", label: "Matches the checked build" });
    expect(trail.summary).toMatchObject({ tone: "good", headline: "Every source matches the checked build" });
    expect(trail.versions.at(-1)).toMatchObject({ version: "2.4.2", role: "this" });
  });
});
