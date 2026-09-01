import type { Finding, ScanStatus } from "../scanner/types.ts";
import type { GithubCheckAnnotation, GithubCheckConclusion } from "./github.ts";

export function checkConclusionFor(status: ScanStatus): GithubCheckConclusion {
  if (status === "passed") return "success";
  if (status === "inconclusive") return "neutral";
  return "failure";
}

export function annotationsForFindings(findings: Finding[]): GithubCheckAnnotation[] {
  return findings.slice(0, 50).map((finding) => ({
    path: finding.path.replace(/!\/?/g, "/").replace(/^\/+/, "") || "artifact",
    start_line: 1,
    end_line: 1,
    annotation_level:
      finding.severity === "critical" ? "failure" : finding.severity === "warn" ? "warning" : "notice",
    title: finding.rule,
    message: `${finding.title}. ${finding.detail}`.slice(0, 64_000),
  }));
}

export function checkTitleFor(status: ScanStatus, fullName: string, tag: string): string {
  if (status === "passed") return `${fullName} ${tag} is allowed to ship`;
  if (status === "inconclusive") return `Inconclusive scan of ${fullName} ${tag}`;
  return `Spoilers in ${fullName} ${tag}`;
}
