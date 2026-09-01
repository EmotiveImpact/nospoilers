import path from "node:path";
import type { Finding } from "./types.ts";

const TEXT_LIMIT = 2_000_000;
const MAP_PEEK = 256_000;
export const INSPECT_BYTES = 8_000_000;
export const FILE_WARN_BYTES = 10_000_000;
export const TOTAL_WARN_BYTES = 50_000_000;

function asText(buf: Buffer, limit = TEXT_LIMIT): string {
  const slice = buf.subarray(0, Math.min(buf.length, limit));
  return slice.toString("utf8");
}

function posixPath(rel: string): string {
  return rel.split(path.sep).join("/");
}

function looksLikeSourceMap(filePath: string, buf: Buffer): boolean {
  const base = path.posix.basename(posixPath(filePath));
  if (/\.(js|mjs|cjs|css|ts|tsx|jsx)\.map$/i.test(base)) return true;
  if (!base.toLowerCase().endsWith(".map")) return false;
  try {
    const json = JSON.parse(asText(buf, MAP_PEEK)) as {
      version?: unknown;
      mappings?: unknown;
      sources?: unknown;
    };
    return (
      json.version === 3 ||
      typeof json.mappings === "string" ||
      Array.isArray(json.sources)
    );
  } catch {
    return false;
  }
}

function hasEmbeddedSources(buf: Buffer): boolean {
  try {
    const json = JSON.parse(asText(buf, Math.min(buf.length, 8_000_000))) as {
      sourcesContent?: unknown;
    };
    return (
      Array.isArray(json.sourcesContent) &&
      json.sourcesContent.some((chunk) => typeof chunk === "string" && chunk.length > 0)
    );
  } catch {
    return false;
  }
}

const PRIVATE_KEY =
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/;

const HIGH_CONFIDENCE_TOKEN =
  /(?:github_pat_[A-Za-z0-9_]{40,}|gh[pousr]_[A-Za-z0-9]{36,255}|npm_[A-Za-z0-9]{36}|(?:sk|rk)_live_[A-Za-z0-9]{20,}|sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|glpat-[A-Za-z0-9_-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16}|AIza[0-9A-Za-z_-]{35})/;

const CREDENTIAL_ASSIGNMENT =
  /(?:_authToken|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|password)\s*[:=]\s*["']?([A-Za-z0-9_./+=:-]{12,})/gi;

const PLACEHOLDER =
  /(?:example|placeholder|dummy|sample|changeme|replace[_-]?me|your[_-]?(?:token|key|secret)|test[_-]?(?:token|key|secret))/i;

function likelyText(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  if (sample.length === 0) return true;
  let zeroes = 0;
  for (const byte of sample) {
    if (byte === 0) zeroes += 1;
  }
  return zeroes / sample.length < 0.01;
}

function hasAssignedCredential(text: string): boolean {
  CREDENTIAL_ASSIGNMENT.lastIndex = 0;
  for (const match of text.matchAll(CREDENTIAL_ASSIGNMENT)) {
    const value = match[1] ?? "";
    if (!PLACEHOLDER.test(value) && !/^(.)\1{11,}$/.test(value)) return true;
  }
  return false;
}

function credentialConfig(rel: string, base: string): boolean {
  const lower = rel.toLowerCase();
  return (
    [".npmrc", ".pypirc", ".netrc", "credentials.json", "service-account.json",
      "service_account.json", "application_default_credentials.json"].includes(base.toLowerCase()) ||
    lower.endsWith("/.aws/credentials") ||
    lower.endsWith("/.docker/config.json") ||
    lower.endsWith("/.kube/config") ||
    lower.includes("/.ssh/") ||
    lower.startsWith(".ssh/")
  );
}

function aiContextFile(rel: string, base: string): boolean {
  const lower = rel.toLowerCase();
  const name = base.toLowerCase();
  return (
    ["claude.md", "claude.local.md", "agents.md", ".mcp.json", "mcp.json",
      "copilot-instructions.md"].includes(name) ||
    lower.includes("/.claude/") ||
    lower.startsWith(".claude/") ||
    lower.includes("/.cursor/") ||
    lower.startsWith(".cursor/") ||
    lower.includes("/.windsurf/") ||
    lower.startsWith(".windsurf/")
  );
}

function debugArtifact(rel: string, base: string): boolean {
  const lower = rel.toLowerCase();
  return (
    /\.(?:pdb|ilk|exp|symbols?|dmp|tsbuildinfo)$/i.test(base) ||
    /(?:^|\/)[^/]+\.dsym(?:\/|$)/i.test(lower) ||
    /(?:^|\/)(?:npm-debug|yarn-debug|yarn-error|debug)\.log$/i.test(lower) ||
    /(?:^|\/)(?:webpack-)?stats\.json$/i.test(lower) ||
    base === ".DS_Store"
  );
}

function nestedPack(base: string): boolean {
  return /\.(?:tgz|tar\.gz|tar|zip|asar)$/i.test(base);
}

function backupFile(base: string): boolean {
  return /(?:\.(?:bak|old|orig|backup|swp|swo)|~)$/i.test(base);
}

function dumpFile(base: string): boolean {
  return /\.(?:sql|sqlite|sqlite3|dump|pgdump|rdb)$/i.test(base);
}

function internalDoc(base: string): boolean {
  const name = base.toLowerCase();
  return (
    ["roadmap.md", "handoff.md", "todo.md", "todos.md", "internal.md"].includes(name) ||
    name.endsWith(".prd.md")
  );
}

export function suspiciousLink(target: string): boolean {
  const trimmed = target.trim();
  if (!trimmed) return false;
  if (path.isAbsolute(trimmed) || trimmed.startsWith("~") || /^[A-Za-z]:[\\/]/.test(trimmed)) {
    return true;
  }
  const parts = trimmed.replace(/\\/g, "/").split("/");
  return parts.includes("..");
}

export function linkFinding(relPath: string, target: string): Finding | null {
  if (!suspiciousLink(target)) return null;
  return {
    rule: "LNK-001",
    severity: "critical",
    path: posixPath(relPath).replace(/^\.\//, ""),
    title: "Suspicious symlink in the pack",
    detail: "The link points outside the artifact (absolute path or ..). Symlinks are not followed.",
  };
}

function internalLocation(text: string): boolean {
  return (
    /(?:\/Users\/[A-Za-z0-9._-]+\/|\/home\/[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\)/.test(
      text,
    ) ||
    /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|[A-Za-z0-9.-]+\.(?:internal|local))(?::\d+)?(?:[/?#]|$)/i.test(
      text,
    )
  );
}

export function inspectEntry(relPath: string, buf: Buffer, actualBytes = buf.length): Finding[] {
  const rel = posixPath(relPath).replace(/^\.\//, "");
  const base = path.posix.basename(rel);
  const findings: Finding[] = [];
  const parts = rel.split("/");

  if (parts.includes(".git") || rel === ".git" || rel.startsWith(".git/")) {
    findings.push({
      rule: "GIT-001",
      severity: "critical",
      path: rel,
      title: "Git directory packed into the artifact",
      detail:
        "A .git directory inside a release is a spoiler for the whole history, not just HEAD.",
    });
  }

  if (base === ".env" || base.startsWith(".env.")) {
    findings.push({
      rule: "SEC-001",
      severity: "critical",
      path: rel,
      title: "Environment file shipped",
      detail: `${base} does not belong in a public package or installer.`,
    });
  }

  const text = likelyText(buf) ? asText(buf) : "";
  const isCredentialConfig = credentialConfig(rel, base);
  if (
    /\.(pem|key)$/i.test(base) ||
    PRIVATE_KEY.test(text) ||
    base === "id_rsa" ||
    base === "id_ed25519" ||
    base === "id_dsa" ||
    base === "id_ecdsa"
  ) {
    findings.push({
      rule: "SEC-002",
      severity: "critical",
      path: rel,
      title: "Private key shipped",
      detail: "A private key or PEM was found in the packed bytes.",
    });
  }

  if (
    text &&
    (HIGH_CONFIDENCE_TOKEN.test(text) || (isCredentialConfig && hasAssignedCredential(text)))
  ) {
    findings.push({
      rule: "SEC-003",
      severity: "critical",
      path: rel,
      title: "Credential or access token shipped",
      detail:
        "A high-confidence credential pattern was found. NoSpoilers does not include the value in reports.",
    });
  }

  if (isCredentialConfig) {
    findings.push({
      rule: "SEC-004",
      severity: "warn",
      path: rel,
      title: "Credential configuration file shipped",
      detail:
        "This configuration file commonly carries registry, cloud, container, or service credentials.",
    });
  }

  if (nestedPack(base)) {
    findings.push({
      rule: "ARC-001",
      severity: "warn",
      path: rel,
      title: "Nested packed artifact",
      detail:
        "Another tarball, zip, or asar is inside this pack. Nested archives are identified, not executed.",
    });
  }

  if (backupFile(base)) {
    findings.push({
      rule: "BAK-001",
      severity: "warn",
      path: rel,
      title: "Backup file shipped",
      detail: "Backup copies often retain secrets or source that the intended release dropped.",
    });
  }

  if (dumpFile(base)) {
    findings.push({
      rule: "DB-001",
      severity: "critical",
      path: rel,
      title: "Database dump shipped",
      detail: "SQL or database files do not belong in a public package or installer.",
    });
  }

  if (internalDoc(base)) {
    findings.push({
      rule: "DOC-001",
      severity: "warn",
      path: rel,
      title: "Internal documentation shipped",
      detail: "Roadmaps, handoffs, and PRDs are internal context, not customer-facing pack contents.",
    });
  }

  if (aiContextFile(rel, base)) {
    findings.push({
      rule: "AI-001",
      severity: "warn",
      path: rel,
      title: "AI agent context shipped",
      detail:
        "Agent instructions, prompts, memory, or tool configuration can reveal internal operating context.",
    });
  }

  if (debugArtifact(rel, base)) {
    findings.push({
      rule: "DBG-001",
      severity: "warn",
      path: rel,
      title: "Debug or build metadata shipped",
      detail:
        "Debug symbols, build statistics, logs, and compiler state can expose implementation details.",
    });
  }

  if (text && internalLocation(text)) {
    findings.push({
      rule: "NET-001",
      severity: "warn",
      path: rel,
      title: "Internal endpoint or developer path shipped",
      detail:
        "The artifact contains a private-network URL, local endpoint, or absolute developer-machine path.",
    });
  }

  if (looksLikeSourceMap(rel, buf)) {
    findings.push({
      rule: "MAP-001",
      severity: "critical",
      path: rel,
      title: "Source map in the packed artifact",
      detail:
        "Source maps map minified production code back to original TypeScript/JavaScript. They are spoilers.",
    });
    if (hasEmbeddedSources(buf)) {
      findings.push({
        rule: "MAP-002",
        severity: "critical",
        path: rel,
        title: "Source map embeds original source",
        detail:
          "sourcesContent is populated. Anyone with this file can reconstruct the original tree.",
      });
    }
  }

  if (/\.(js|mjs|cjs|css|jsx|ts|tsx)$/i.test(base) && /[#@]\s*sourceMappingURL\s*=/.test(text)) {
    findings.push({
      rule: "MAP-003",
      severity: "critical",
      path: rel,
      title: "sourceMappingURL comment in production file",
      detail:
        "The bundle points at a source map. Even a hidden map on a CDN is a spoiler if this comment ships.",
    });
  }

  if (/\.(ts|tsx|jsx)$/i.test(base) && !base.endsWith(".d.ts")) {
    findings.push({
      rule: "SRC-001",
      severity: "warn",
      path: rel,
      title: "TypeScript/JSX source packed",
      detail: "Original source files in a release usually mean the pack included too much.",
    });
  }

  if (actualBytes >= FILE_WARN_BYTES) {
    findings.push({
      rule: "SIZE-001",
      severity: "warn",
      path: rel,
      title: "Packed file is far over a normal baseline",
      detail: `${base} is ${actualBytes} bytes. A surprise 10+ MB file in a release is often a source map.`,
    });
  }

  return findings;
}
