import type { Finding, ScanReport } from "./types.ts";

type SarifLevel = "error" | "warning" | "note";

function levelFor(severity: Finding["severity"]): SarifLevel {
  return severity === "critical" ? "error" : "warning";
}

const RULES: Record<
  string,
  { name: string; shortDescription: string }
> = {
  "MAP-001": { name: "source-map-file", shortDescription: "Source map file packed into the artifact" },
  "MAP-002": { name: "embedded-sources", shortDescription: "Source map embeds original source" },
  "MAP-003": { name: "source-mapping-url", shortDescription: "sourceMappingURL comment in a production file" },
  "SEC-001": { name: "dotenv-file", shortDescription: "Environment file packed into the artifact" },
  "SEC-002": { name: "private-key", shortDescription: "Private key packed into the artifact" },
  "SEC-003": { name: "access-token", shortDescription: "Credential or access token packed into the artifact" },
  "SEC-004": { name: "credential-config", shortDescription: "Credential configuration packed into the artifact" },
  "AI-001": { name: "ai-context", shortDescription: "AI agent instructions, prompts, or memory packed into the artifact" },
  "NET-001": { name: "internal-location", shortDescription: "Internal endpoint or developer path packed into the artifact" },
  "DBG-001": { name: "debug-artifact", shortDescription: "Debug or build metadata packed into the artifact" },
  "GIT-001": { name: "git-directory", shortDescription: "Git directory packed into the artifact" },
  "SRC-001": { name: "original-source", shortDescription: "TypeScript or JSX source packed into the artifact" },
  "SIZE-001": { name: "oversized-file", shortDescription: "Packed file is far over a normal baseline" },
  "SIZE-002": { name: "oversized-artifact", shortDescription: "Packed artifact is far over a normal baseline" },
  "ARC-001": { name: "nested-archive", shortDescription: "Nested tgz, zip, or asar packed inside the artifact" },
  "BAK-001": { name: "backup-copy", shortDescription: "Backup copy packed into the artifact" },
  "DB-001": { name: "database-dump", shortDescription: "Database dump packed into the artifact" },
  "DOC-001": { name: "internal-doc", shortDescription: "Internal roadmap, handoff, or PRD packed into the artifact" },
  "LNK-001": { name: "escaping-symlink", shortDescription: "Symlink that points outside the pack" },
};

export function toSarif(report: ScanReport): object {
  const used = [...new Set(report.findings.map((f) => f.rule))];
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "NoSpoilers",
            version: "0.1.0",
            informationUri: "https://cursor.com/codebase/emotiveimpact/NoSpoilers",
            rules: used.map((id) => ({
              id,
              name: RULES[id]?.name ?? id,
              shortDescription: { text: RULES[id]?.shortDescription ?? id },
            })),
          },
        },
        results: report.findings.map((finding) => ({
          ruleId: finding.rule,
          level: levelFor(finding.severity),
          message: { text: `${finding.title} (${finding.path})` },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: finding.path.replace(/\\/g, "/") },
              },
            },
          ],
        })),
      },
    ],
  };
}
