import { describe, expect, it } from "vitest";
import { buildReleaseBriefModel, releaseFamily } from "../src/watch/release-brief.ts";
import type { ReleaseRevision } from "../src/watch/types.ts";
import {readFileSync} from 'node:fs';

it('labels heterogeneous source revisions truthfully in both saved release surfaces',()=>{
  for(const file of ['../src/components/watch/WatchReleaseBrief.tsx','../src/components/watch/screens/ReleasesScreen.tsx']){
    const source=readFileSync(new URL(file,import.meta.url),'utf8');
    expect(source).toMatch(/source revision \$\{(?:release|preview)\.sourceRevision\}/);
    expect(source).not.toMatch(/commit \$\{(?:release|preview)\.sourceRevision\}/);
  }
});

function revision(overrides: Partial<ReleaseRevision> = {}): ReleaseRevision {
  return {
    id: 7,
    receiptId: 14,
    channel: "stable",
    coordinate: "demo-package@2.8.1",
    artifactSha256: "a".repeat(64),
    artifactBytes: 2048,
    mediaType: "application/gzip",
    sourceRevision: "14316abc",
    ciRunUrl: null,
    mismatch: false,
    receiptStatus: "passed",
    createdAt: "2026-09-04T14:42:00.000Z",
    locations: [],
    approval: null,
    legalHold: null,
    publicPage: null,
    attestations: [],
    ...overrides,
  };
}

describe("release readiness brief", () => {
  it("treats unconfigured optional evidence as non-blocking and does not count it as clean", () => {
    const model = buildReleaseBriefModel(revision());
    expect(model.status).toBe("ready");
    expect(model.cleanChecks).toBe(1);
    expect(model.applicableChecks).toBe(1);
    expect(model.steps.map((step) => step.status)).toEqual([
      "Clean",
      "Not recorded",
      "Not attached",
      "No decision",
    ]);
  });

  it("blocks a failed receipt, delivery mismatch, or legal hold", () => {
    const model = buildReleaseBriefModel(
      revision({
        receiptStatus: "failed-policy",
        locations: [
          {
            id: 2,
            revisionId: 7,
            url: "https://cdn.example.com/demo.tgz",
            host: "cdn.example.com",
            expectedMediaType: null,
            lastStatus: "mismatch",
            lastSha256: null,
            lastMediaType: null,
            lastRedirectHosts: null,
            lastCacheState: null,
            lastRegion: null,
            lastCheckedAt: null,
          },
        ],
        legalHold: {
          active: true,
          actorLogin: "release-admin",
          reason: "Customer review",
          createdAt: "2026-09-04T15:00:00.000Z",
        },
      }),
    );
    expect(model.status).toBe("blocked");
    expect(model.title).toBe("Hold this release");
    expect(model.steps.filter((step) => step.tone === "blocked")).toHaveLength(3);
  });

  it("keeps release history grouped by package family", () => {
    expect(releaseFamily("@scope/pkg@2.8.1")).toBe("@scope/pkg");
    expect(releaseFamily("repo:owner/name#artifact.tgz")).toBe("repo:owner/name");
  });
});
