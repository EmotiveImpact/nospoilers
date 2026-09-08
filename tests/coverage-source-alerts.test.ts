import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  buildSourceViewModels,
  filterSourceViewModels,
} from "../src/watch/view-models.ts";
import type { DeskAlert } from "../src/watch/verdict.ts";

type SourceInput = Parameters<typeof buildSourceViewModels>[0];
type PackageInput = SourceInput["packages"][number];

const checkedAt = "2026-09-08T12:00:00.000Z";

function packageInput(overrides: Partial<PackageInput> = {}): PackageInput {
  return {
    id: 1,
    installation_id: 17,
    package_name: "@sample/first-package",
    last_version: null,
    last_sha256: null,
    last_checked_at: null,
    last_scan_status: null,
    ...overrides,
  };
}

function alertInput(overrides: Partial<DeskAlert> = {}): DeskAlert {
  return {
    id: 1,
    kind: "npm_scan",
    title: "Recorded package finding",
    body: "",
    findings: null,
    created_at: checkedAt,
    full_name: "example/unrelated-repository",
    ...overrides,
  };
}

function packageSource(alerts: DeskAlert[], overrides: Partial<PackageInput> = {}) {
  const source = buildSourceViewModels({
    repos: [],
    packages: [packageInput(overrides)],
    origins: [],
    maps: [],
    alerts,
  })[0];
  assert.ok(source);
  return source;
}

describe("Coverage source alert attribution", () => {
  for (const lastVersion of [null, ""]) {
    for (const coordinate of ["repository", "finding path"]) {
      it(`does not match an unrelated ${coordinate} when the package version is ${JSON.stringify(lastVersion)}`, () => {
        const alert = coordinate === "repository"
          ? alertInput()
          : alertInput({
              full_name: null,
              findings: [{ rule: "MAP-003", path: "https://unrelated.invalid/app.js.map" }],
            });
        const source = packageSource([alert], { last_version: lastVersion });
        assert.equal(source.alertCount, 0);
        assert.equal(source.attention, "unknown");
      });
    }
  }

  it("retains a genuine name match before the package has a saved version", () => {
    const source = packageSource([alertInput({ full_name: "@sample/first-package" })]);
    assert.equal(source.alertCount, 1);
    assert.equal(source.attention, "critical");
  });

  it("retains a genuine version-qualified coordinate", () => {
    const source = packageSource(
      [alertInput({ full_name: "@sample/first-package@1.2.3" })],
      { last_version: "1.2.3" },
    );
    assert.equal(source.alertCount, 1);
    assert.equal(source.attention, "critical");
  });

  it("retains genuine finding-path evidence without a repository coordinate", () => {
    const source = packageSource([alertInput({
      full_name: null,
      findings: [{ rule: "MAP-003", path: "@sample/first-package@1.2.3/dist/app.js.map" }],
    })]);
    assert.equal(source.alertCount, 1);
    assert.equal(source.attention, "critical");
  });

  it("counts one alert once even when its name, version and several paths match", () => {
    const source = packageSource([alertInput({
      full_name: "@sample/first-package@1.2.3",
      findings: [
        { rule: "MAP-003", path: "@sample/first-package@1.2.3/dist/app.js.map" },
        { rule: "MAP-003", path: "@sample/first-package@1.2.3/dist/vendor.js.map" },
      ],
    })], { last_version: "1.2.3" });
    assert.equal(source.alertCount, 1);
  });

  it("counts separate matching alerts without counting an unrelated alert", () => {
    const source = packageSource([
      alertInput({ id: 1, full_name: "@sample/first-package" }),
      alertInput({ id: 2, full_name: "@sample/first-package@1.2.3" }),
      alertInput({ id: 3 }),
    ]);
    assert.equal(source.alertCount, 2);
    assert.equal(source.attention, "critical");
  });

  it("excludes resolved alerts without inventing a passing scan result", () => {
    const source = packageSource([alertInput({
      full_name: "@sample/first-package",
      resolved_at: checkedAt,
    })]);
    assert.equal(source.alertCount, 0);
    assert.equal(source.attention, "unknown");
  });

  it("keeps acknowledged but unresolved matching alerts active", () => {
    const source = packageSource([alertInput({
      full_name: "@sample/first-package",
      acknowledged_at: checkedAt,
    })]);
    assert.equal(source.alertCount, 1);
    assert.equal(source.attention, "critical");
  });

  it("does not assign an alert without usable coordinates", () => {
    const source = packageSource([alertInput({
      full_name: null,
      findings: [{ rule: "MAP-003", path: "" }],
    })]);
    assert.equal(source.alertCount, 0);
    assert.equal(source.attention, "unknown");
  });

  it("preserves the recorded passing status instead of assigning an unrelated alert", () => {
    const source = packageSource([alertInput()], {
      last_scan_status: "passed",
      last_scanned_at: checkedAt,
      last_checked_at: checkedAt,
    });
    assert.equal(source.alertCount, 0);
    assert.equal(source.attention, "ok");
    assert.equal(source.lastScannedAt, checkedAt);
  });

  it("keeps delayed monitoring in attention without inventing a critical alert", () => {
    const source = packageSource([alertInput()], {
      last_scan_status: "passed",
      monitoring: {
        intervalMs: 3_600_000,
        freshness: "delayed",
        nextDispatchAt: null,
        evaluatedAt: checkedAt,
      },
    });
    assert.equal(source.alertCount, 0);
    assert.equal(source.attention, "warning");
    assert.deepEqual(filterSourceViewModels([source], "all", true), [source]);
  });

  it("keeps a mixed-source attention filter scoped to the actual matching source", () => {
    const sources = buildSourceViewModels({
      repos: [{ id: 2, full_name: "example/unrelated-repository", private: true, last_checked_at: checkedAt }],
      packages: [packageInput()],
      origins: [{
        id: 3,
        origin_url: "https://website.invalid",
        host: "website.invalid",
        last_sha256: null,
        last_checked_at: checkedAt,
        last_scan_status: "passed",
      }],
      maps: [{
        id: 4,
        kind: "sentry",
        host: "custody.invalid",
        orgSlug: "sample",
        projectSlug: "private-maps",
        lastCheckedAt: checkedAt,
        lastStatus: "passed",
        lastError: null,
      }],
      alerts: [alertInput()],
    });
    assert.deepEqual(sources.map(({ key, alertCount }) => ({ key, alertCount })), [
      { key: "repo-2", alertCount: 1 },
      { key: "npm-1", alertCount: 0 },
      { key: "web-3", alertCount: 0 },
      { key: "map-4", alertCount: 0 },
    ]);
    assert.deepEqual(filterSourceViewModels(sources, "all", true).map(({ key }) => key), ["repo-2"]);
  });

  it("does not mutate source configuration or saved alert evidence", () => {
    const input: SourceInput = {
      repos: [],
      packages: [packageInput()],
      origins: [],
      maps: [],
      alerts: [alertInput({ full_name: "@sample/first-package" })],
    };
    const before = structuredClone(input);
    buildSourceViewModels(input);
    assert.deepEqual(input, before);
  });
});
