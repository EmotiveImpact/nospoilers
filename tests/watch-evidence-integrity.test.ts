import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { sourceMonitoring } from "../src/server/source-monitoring.ts";
import {
  buildSetupViewModel,
  buildSourceViewModels,
  coverageDonut,
  filterSourceViewModels,
  type SourceMonitoring,
} from "../src/watch/view-models.ts";
import type { DeskAlert } from "../src/watch/verdict.ts";

type SourcesInput = Parameters<typeof buildSourceViewModels>[0];
type SetupInput = Parameters<typeof buildSetupViewModel>[0];
const checkedAt = "2026-09-06T06:00:00Z";
const now = Date.parse("2026-09-06T06:30:00Z");
const empty: SourcesInput = { repos: [], packages: [], origins: [], maps: [] };

function packageRow(overrides: Partial<SourcesInput["packages"][number]> = {}): SourcesInput["packages"][number] {
  return {
    id: 1, installation_id: 7, package_name: "@acme/client", last_version: null,
    last_sha256: null, last_checked_at: null, last_scan_status: null, ...overrides,
  };
}

function originRow(overrides: Partial<SourcesInput["origins"][number]> = {}): SourcesInput["origins"][number] {
  return {
    id: 2, installation_id: 7, origin_url: "https://app.example.test", host: "app.example.test",
    last_sha256: null, last_checked_at: checkedAt, last_scan_status: "passed",
    last_public_map: false, ...overrides,
  };
}

function mapRow(overrides: Partial<SourcesInput["maps"][number]> = {}): SourcesInput["maps"][number] {
  return {
    id: 3, installationId: 7, kind: "sentry", host: "sentry.io", orgSlug: "acme",
    projectSlug: "web", lastCheckedAt: checkedAt, lastStatus: "passed", lastError: null, ...overrides,
  };
}

function alert(overrides: Partial<DeskAlert> = {}): DeskAlert {
  return {
    id: 1, kind: "npm_scan", title: "Recorded finding", body: "",
    full_name: "other/service", findings: [{ rule: "MAP-003", path: "other-package@1.0.0/dist/index.js" }],
    created_at: checkedAt, ...overrides,
  };
}

function allSources(monitoring?: SourceMonitoring): SourcesInput {
  return {
    connections: [{ id: 7, account_login: "acme" }],
    repos: [{ id: 4, installation_id: 7, full_name: "acme/app", private: true, last_checked_at: checkedAt, monitoring }],
    packages: [packageRow({ last_version: "1.0.0", last_checked_at: checkedAt, last_scanned_at: checkedAt, last_scan_status: "passed", monitoring })],
    origins: [originRow({ last_scanned_at: checkedAt, monitoring })],
    maps: [mapRow({ monitoring })],
  };
}

function production(overrides: Partial<SetupInput> = {}) {
  const input: SetupInput = { ...empty, releases: [], setupProbes: {}, origins: [originRow()], ...overrides };
  return buildSetupViewModel(input).steps.find((step) => step.key === "production")!;
}

describe("Gate B source alert evidence", () => {
  it("does not assign unrelated alerts to a package with no version", () => {
    const [source] = buildSourceViewModels({ ...empty, packages: [packageRow()], alerts: [alert()] });
    assert.equal(source.alertCount, 0);
    assert.equal(source.attention, "unknown");
  });

  it("does not contaminate another unversioned package in the same inventory", () => {
    const rows = buildSourceViewModels({
      ...empty,
      packages: [packageRow(), packageRow({ id: 2, package_name: "other-package" })],
      alerts: [alert()],
    });
    assert.deepEqual(rows.map((row) => row.alertCount), [0, 1]);
  });

  it("still matches a scoped package when the evidence contains a published version", () => {
    const [source] = buildSourceViewModels({ ...empty, packages: [packageRow()], alerts: [
      alert({ findings: [{ rule: "MAP-003", path: "@acme/client@1.2.3/dist/index.js" }] }),
    ] });
    assert.equal(source.alertCount, 1);
    assert.equal(source.attention, "critical");
  });

  it("counts one alert only once when both its name and finding path match", () => {
    const [source] = buildSourceViewModels({ ...empty, packages: [packageRow({ last_version: "1.2.3" })], alerts: [
      alert({ full_name: "@acme/client", findings: [{ rule: "MAP-003", path: "@acme/client@1.2.3" }] }),
    ] });
    assert.equal(source.alertCount, 1);
  });

  it("keeps acknowledged findings open but excludes resolved findings", () => {
    const [source] = buildSourceViewModels({ ...empty, packages: [packageRow()], alerts: [
      alert({ full_name: "@acme/client", acknowledged_at: checkedAt }),
      alert({ id: 2, full_name: "@acme/client", resolved_at: checkedAt }),
    ] });
    assert.equal(source.alertCount, 1);
    assert.equal(source.attention, "critical");
  });

  it("does not turn empty or whitespace source coordinates into a wildcard", () => {
    for (const package_name of ["", " ", "\t"]) {
      const [source] = buildSourceViewModels({ ...empty, packages: [packageRow({ package_name })], alerts: [alert()] });
      assert.equal(source.alertCount, 0);
    }
  });

  it("does not mutate the alert feed or the source inputs", () => {
    const input = { ...empty, packages: [packageRow()], alerts: [alert()] };
    const before = structuredClone(input);
    buildSourceViewModels(input);
    assert.deepEqual(input, before);
  });
});

describe("Gate B monitoring evidence", () => {
  for (const freshness of ["unknown", "unrecognised-future-state"]) {
    it(`does not label any source clean when freshness is ${freshness}`, () => {
      const rows = buildSourceViewModels(allSources({ intervalMs: null, freshness, nextDispatchAt: null, evaluatedAt: new Date(now).toISOString() }));
      assert.deepEqual(rows.map((row) => row.attention), ["unknown", "unknown", "unknown", "unknown"]);
      assert.equal(coverageDonut(rows).clean, 0);
      assert.ok(rows.every((row) => row.connectionLabel === "acme"));
    });
  }

  it("keeps delayed sources in the attention filter without overwriting saved evidence", () => {
    const monitoring = sourceMonitoring(60_000, checkedAt, now);
    const rows = buildSourceViewModels(allSources(monitoring));
    assert.deepEqual(rows.map((row) => row.attention), ["warning", "warning", "warning", "warning"]);
    assert.equal(filterSourceViewModels(rows, "all", true).length, 4);
    assert.equal(rows[1].lastScannedAt, checkedAt);
    assert.equal(rows[1].status, "passed");
    assert.ok(rows.every((row) => row.monitoring?.nextDispatchAt === null));
  });

  it("preserves current successful evidence and does not invent a dispatch time", () => {
    const rows = buildSourceViewModels(allSources(sourceMonitoring(3_600_000, checkedAt, now)));
    assert.deepEqual(rows.map((row) => row.attention), ["ok", "ok", "ok", "ok"]);
    assert.ok(rows.every((row) => row.monitoring?.nextDispatchAt === null));
  });

  it("retains backwards-compatible presentation when a response has no monitoring field", () => {
    assert.deepEqual(buildSourceViewModels(allSources()).map((row) => row.attention), ["ok", "ok", "ok", "ok"]);
  });

  for (const lastCheckedAt of [null, "not-a-date", "2026-09-06T07:00:00Z"]) {
    it(`propagates the server's unknown result for timestamp ${lastCheckedAt}`, () => {
      const monitoring = sourceMonitoring(60_000, lastCheckedAt, now);
      assert.equal(monitoring.freshness, "unknown");
      assert.ok(buildSourceViewModels(allSources(monitoring)).every((row) => row.attention === "unknown"));
    });
  }

  for (const intervalMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    it(`does not present a clean monitor for invalid cadence ${intervalMs}`, () => {
      const monitoring = sourceMonitoring(intervalMs, checkedAt, now);
      assert.equal(monitoring.intervalMs, null);
      assert.ok(buildSourceViewModels(allSources(monitoring)).every((row) => row.attention === "unknown"));
    });
  }

  it("never hides critical findings or error/pending states behind unknown freshness", () => {
    const monitoring = sourceMonitoring(0, checkedAt, now);
    const input = allSources(monitoring);
    input.repos[0].private = false;
    input.packages[0].last_scan_status = "inconclusive";
    input.origins[0].last_scan_status = "pending";
    input.maps[0].lastError = "Token rejected";
    assert.deepEqual(buildSourceViewModels(input).map((row) => row.attention), ["critical", "warning", "warning", "critical"]);
  });
});

describe("Gate B setup proof evidence", () => {
  for (const last_scan_status of [null, "inconclusive", "error", "queued", "running", "failed", "future-status"]) {
    it(`does not infer a completed production crawl from a timestamp and ${last_scan_status}`, () => {
      assert.equal(production({ origins: [originRow({ last_scan_status })] }).proof, "check-needed");
    });
  }

  it("preserves explicitly passed production evidence", () => {
    assert.equal(production().proof, "covered");
  });

  for (const last_checked_at of [null, "not-a-date"]) {
    it(`requires a valid recorded check time instead of ${last_checked_at}`, () => {
      assert.equal(production({ origins: [originRow({ last_checked_at })] }).proof, "check-needed");
    });
  }

  for (const lastStatus of ["mismatch", "unverified", "not-verified", "match-failed", "verified-with-errors", "inconclusive", null]) {
    it(`does not accept custody status ${lastStatus} as positive verification`, () => {
      const result = production({
        origins: [originRow({ last_scan_status: "failed", last_public_map: true })],
        maps: [mapRow({ lastStatus })],
      });
      assert.equal(result.proof, "check-needed");
    });
  }

  for (const lastStatus of ["passed", "verified", "match", "VERIFIED"]) {
    it(`records exact custody status ${lastStatus} without claiming public exposure is fixed`, () => {
      const origins = [originRow({ last_scan_status: "failed", last_public_map: true })];
      const maps = [mapRow({ lastStatus })];
      const result = production({ origins, maps });
      assert.equal(result.proof, "covered");
      assert.ok(result.summary.includes("public exposure still needs action"));
      assert.equal(buildSourceViewModels({ ...empty, origins, maps })[0].attention, "critical");
    });
  }

  it("does not accept a positive custody label without a valid timestamp and successful lookup", () => {
    for (const override of [{ lastCheckedAt: null }, { lastCheckedAt: "invalid" }, { lastError: "Forbidden" }]) {
      assert.equal(production({
        origins: [originRow({ last_scan_status: "failed", last_public_map: true })],
        maps: [mapRow({ ...override, lastStatus: "verified" })],
      }).proof, "check-needed");
    }
  });
});
