import { describe, expect, it } from "vitest";
import { annotationsForFindings, checkConclusionFor, checkTitleFor } from "../src/server/github-checks.ts";
import { commitRefsForCheck, githubCommitMissing } from "../src/server/github.ts";
import type { Finding } from "../src/scanner/types.ts";

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    rule: "MAP-001",
    severity: "critical",
    title: "Source map packed",
    detail: "A .map file is in the artifact.",
    path: "package/app.js.map",
    ...overrides,
  };
}

describe("GitHub Checks mapping", () => {
  it("maps scan status to check conclusions", () => {
    expect(checkConclusionFor("passed")).toBe("success");
    expect(checkConclusionFor("inconclusive")).toBe("neutral");
    expect(checkConclusionFor("failed-policy")).toBe("failure");
  });

  it("sanitizes nested-pack paths and caps annotations", () => {
    const nested = annotationsForFindings([
      finding({ path: "payload.tgz!/.env", rule: "SEC-001", title: "Environment file" }),
    ]);
    expect(nested[0]?.path).toBe("payload.tgz/.env");
    expect(nested[0]?.start_line).toBe(1);
    expect(nested[0]?.annotation_level).toBe("failure");

    const jump = annotationsForFindings([
      finding({
        rule: "SIZE-003",
        severity: "warn",
        title: "Unpacked size jumped versus the last approved or previous scan",
        path: "artifact",
      }),
    ]);
    expect(jump[0]?.annotation_level).toBe("warning");
    expect(jump[0]?.title).toBe("SIZE-003");

    const many = annotationsForFindings(
      Array.from({ length: 60 }, (_, i) => finding({ path: `package/${i}.map` })),
    );
    expect(many).toHaveLength(50);
  });

  it("resolves Checks against the tag name, not tags/tag as a commit SHA", () => {
    expect(commitRefsForCheck("v0.1.7", "main")).toEqual(["v0.1.7", "main"]);
    expect(commitRefsForCheck("tags/v0.1.7", "refs/tags/v0.1.7")).toEqual(["v0.1.7"]);
    expect(commitRefsForCheck("phase1-fixture", null)).toEqual(["phase1-fixture"]);
    expect(githubCommitMissing(422)).toBe(true);
    expect(githubCommitMissing(404)).toBe(true);
    expect(githubCommitMissing(500)).toBe(false);
  });

  it("titles a failed release scan without calling it allowed to ship", () => {
    expect(checkTitleFor("failed-policy", "octo/throwaway", "v1")).toContain("Spoilers");
    expect(checkTitleFor("failed-policy", "octo/throwaway", "v1")).not.toContain("allowed to ship");
    expect(checkTitleFor("passed", "octo/throwaway", "v1")).toContain("allowed to ship");
  });
});
