import { expect, it } from "vitest";
import { latestSourceRelease } from "../src/watch/release-brief.ts";
import type { ReleaseRevision } from "../src/watch/types.ts";

const release = (id: number, coordinate: string, createdAt = "2026-09-08T10:00:00Z"): ReleaseRevision => ({
  id, coordinate, createdAt, receiptId: id, channel: "stable", artifactSha256: "abc",
  artifactBytes: null, mediaType: null, sourceRevision: null, ciRunUrl: null, mismatch: false, receiptStatus: "passed",
});

it("does not link similar package names or a different source kind", () => {
  const source = { kind: "npm", name: "@acme/app" };
  expect(latestSourceRelease(source, [release(1, "npm:@acme/app-tools@1"), release(2, "github:@acme/app@1")])).toBeNull();
  expect(latestSourceRelease(source, [release(3, "npm:@acme/app@2")])?.id).toBe(3);
});
it("selects the newest exact repository result without mutating history", () => {
  const rows = [release(1, "github:acme/app@v1#app.tgz"), release(2, "github:acme/app@v2#app.tgz", "2026-09-08T11:00:00Z")];
  expect(latestSourceRelease({ kind: "github", name: "acme/app" }, rows)?.id).toBe(2);
  expect(rows.map(row => row.id)).toEqual([1, 2]);
});
it("matches website URLs exactly, preserving protocol and path distinctions", () => {
  const source = { kind: "website", name: "https://app.example.com" };
  expect(latestSourceRelease(source, [release(1, "web:https://app.example.com.evil.test"), release(2, "web:http://app.example.com")])).toBeNull();
  expect(latestSourceRelease(source, [release(3, "web:https://app.example.com/")])?.id).toBe(3);
});
it("does not invent an artifact release for a custody destination", () => {
  expect(latestSourceRelease({ kind: "map", name: "app" }, [release(1, "npm:app@1")])).toBeNull();
});
