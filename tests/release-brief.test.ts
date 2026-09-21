import { describe, expect, it } from "vitest";
import { buildReleaseBriefModel, releaseFamily } from "../src/watch/release-brief.ts";
import type { ReleaseRevision } from "../src/watch/types.ts";
import {readFileSync} from 'node:fs';
import {assessRelease} from '../src/assurance/decision.ts';
import {sample,warning,delivery,NOW} from './assurance-fixtures.ts';

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
  for(const mode of ['ready','review','blocked','unknown'] as const)it(`presents the canonical ${mode} decision`,()=>{
    const snapshot=mode==='review'?warning():sample();
    if(mode==='blocked')snapshot.release.legalHold={active:true};
    if(mode==='unknown')snapshot.signature='invalid';
    const readiness=assessRelease(snapshot,NOW);
    const model=buildReleaseBriefModel(revision({id:Number(snapshot.release.id),receiptId:readiness.receiptId!,readiness}));
    expect(model.status).toBe(mode);
    expect(model.title).toBe(readiness.title);
    expect(model.detail).toBe(readiness.summary);
  });

  it('keeps production mismatch separate and never calls attestation presence verified identity',()=>{
    const snapshot=sample();
    snapshot.release.locations=[{...delivery(),lastStatus:'mismatch'}];
    snapshot.release.attestations=[{source:'github',status:'present',createdAt:new Date(NOW).toISOString()}];
    const readiness=assessRelease(snapshot,NOW);
    const model=buildReleaseBriefModel(revision({id:Number(snapshot.release.id),receiptId:readiness.receiptId!,readiness}));
    expect(model.status).toBe('ready');
    expect(model.steps.find(step=>step.key==='delivery')?.tone).toBe('blocked');
    expect(model.steps.find(step=>step.key==='identity')?.tone).toBe('waiting');
    expect(model.steps.find(step=>step.key==='identity')?.evidence).toContain('not established');
    expect(model.cleanChecks).toBe(3);
  });

  it('rejects another record assessment and a what-if preview as the saved decision',()=>{
    const readiness=assessRelease(sample(),NOW);
    expect(buildReleaseBriefModel(revision({readiness})).status).toBe('unknown');
    expect(buildReleaseBriefModel(revision({id:2,receiptId:2,readiness:{...readiness,preview:true}})).status).toBe('unknown');
  });
  it("does not infer readiness from an unverified passing status", () => {
    const model = buildReleaseBriefModel(revision());
    expect(model.status).toBe("unknown");
    expect(model.cleanChecks).toBe(0);
    expect(model.applicableChecks).toBe(0);
    expect(model.steps.every(step => step.status === 'Unknown')).toBe(true);
  });

  it("does not synthesize a second decision from raw metadata without an assessment", () => {
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
    expect(model.status).toBe("unknown");
    expect(model.title).toBe("Evidence is incomplete");
    expect(model.steps.filter((step) => step.tone === "blocked")).toHaveLength(0);
  });

  it("keeps release history grouped by package family", () => {
    expect(releaseFamily("@scope/pkg@2.8.1")).toBe("@scope/pkg");
    expect(releaseFamily("repo:owner/name#artifact.tgz")).toBe("repo:owner/name");
  });
});
