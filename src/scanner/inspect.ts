import path from "node:path";
import { PACK_FILE_RE, isImageLayerPath } from "./formats.ts";
import type { Finding } from "./types.ts";

const TEXT_LIMIT = 2_000_000;
const MAP_PEEK = 256_000;
const MAX_EMBEDDED_SOURCES = 1_000;
const MAX_EMBEDDED_SOURCE_CHARS = 2_000_000;
const MAX_EMBEDDED_TOTAL_CHARS = 8_000_000;
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

type EmbeddedSource = {
  path: string;
  content: string;
};

function normalizedEmbeddedSourcePath(raw: string, index: number): string {
  const clean = raw
    .replace(/\\/g, "/")
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .replace(/[?#].*$/, "")
    .split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("")
    .split("/")
    .filter((part) => part && part !== ".")
    .map((part) => (part === ".." ? "_parent_" : part))
    .join("/")
    .slice(0, 400);
  return clean || `source-${index + 1}.txt`;
}

function embeddedSources(buf: Buffer): EmbeddedSource[] {
  try {
    const json = JSON.parse(asText(buf, Math.min(buf.length, 8_000_000))) as {
      sources?: unknown;
      sourcesContent?: unknown;
    };
    if (!Array.isArray(json.sourcesContent)) return [];
    const sources = Array.isArray(json.sources) ? json.sources : [];
    const embedded: EmbeddedSource[] = [];
    let totalChars = 0;
    for (const [index, content] of json.sourcesContent.entries()) {
      if (embedded.length >= MAX_EMBEDDED_SOURCES || totalChars >= MAX_EMBEDDED_TOTAL_CHARS) break;
      if (typeof content !== "string" || content.length === 0) continue;
      const source = typeof sources[index] === "string" ? sources[index] : "";
      const retained = content.slice(
        0,
        Math.min(MAX_EMBEDDED_SOURCE_CHARS, MAX_EMBEDDED_TOTAL_CHARS - totalChars),
      );
      totalChars += retained.length;
      embedded.push({ path: normalizedEmbeddedSourcePath(source, index), content: retained });
    }
    return embedded;
  } catch {
    return [];
  }
}

const PRIVATE_KEY =
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/;

const HIGH_CONFIDENCE_TOKEN =
  /(?:github_pat_[A-Za-z0-9_]{40,}|gh[pousr]_[A-Za-z0-9]{36,255}|npm_[A-Za-z0-9]{36}|(?:sk|rk)_live_[A-Za-z0-9]{20,}|sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|glpat-[A-Za-z0-9_-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16}|AIza[0-9A-Za-z_-]{35}|DefaultEndpointsProtocol=https;AccountName=[^;\s]+;AccountKey=)/;

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
  const name = base.toLowerCase();
  return (
    [".npmrc", ".pypirc", ".netrc", "credentials.json", "service-account.json",
      "service_account.json", "serviceaccount.json", "application_default_credentials.json"].includes(name) ||
    name.endsWith(".tfstate") ||
    lower.endsWith("/.aws/credentials") ||
    lower.endsWith("/.docker/config.json") ||
    lower.endsWith("/.kube/config") ||
    lower.includes("/.ssh/") ||
    lower.startsWith(".ssh/") ||
    lower.includes("/.azure/") ||
    lower.startsWith(".azure/") ||
    lower.includes("/.config/gcloud/") ||
    lower.startsWith(".config/gcloud/") ||
    lower.includes("/.cloudflared/") ||
    lower.startsWith(".cloudflared/") ||
    lower.includes("/.pulumi/") ||
    lower.startsWith(".pulumi/")
  );
}

function aiContextFile(rel: string, base: string): boolean {
  const lower = rel.toLowerCase();
  const name = base.toLowerCase();
  return (
    ["claude.md", "claude.local.md", "agents.md", ".mcp.json", "mcp.json",
      "mcp_config.json", "claude_desktop_config.json", "aiconfig.json", ".aiconfig.json",
      "copilot-instructions.md", "memory.md", "memory.json", "system-prompt.md"].includes(name) ||
    /\.prompt\.md$/i.test(name) ||
    /\.transcript\.(?:json|md|txt)$/i.test(name) ||
    lower.includes("/.claude/") ||
    lower.startsWith(".claude/") ||
    lower.includes("/.cursor/") ||
    lower.startsWith(".cursor/") ||
    lower.includes("/.windsurf/") ||
    lower.startsWith(".windsurf/") ||
    lower.includes("/.continue/") ||
    lower.startsWith(".continue/") ||
    lower.includes("/.codex/") ||
    lower.startsWith(".codex/") ||
    lower.includes("/.gemini/") ||
    lower.startsWith(".gemini/") ||
    lower.includes("/.specstory/") ||
    lower.startsWith(".specstory/") ||
    lower.includes("/.aider") ||
    lower.startsWith(".aider")
  );
}

function buildCachePath(rel: string, base: string): boolean {
  const lower = posixPath(rel).toLowerCase();
  const name = base.toLowerCase();
  const parts = lower.split("/");
  if (
    parts.includes(".turbo") ||
    parts.includes(".parcel-cache") ||
    parts.includes(".nyc_output") ||
    parts.includes(".rpt2_cache")
  ) {
    return true;
  }
  if (name === ".eslintcache" || name.endsWith(".eslintcache")) return true;
  if (lower.includes("node_modules/.cache/") || lower.startsWith("node_modules/.cache/")) {
    return true;
  }
  if (lower.includes("/.next/cache/") || lower.startsWith(".next/cache/")) return true;
  if (lower.includes("/.cache/") || lower.startsWith(".cache/")) return true;
  return false;
}

function cloudCredentialDocument(text: string): boolean {
  return (
    /"type"\s*:\s*"service_account"/.test(text) ||
    /DefaultEndpointsProtocol=https;AccountName=[^;\s]+;AccountKey=/i.test(text)
  );
}

function debugArtifact(rel: string, base: string): boolean {
  const lower = rel.toLowerCase();
  return (
    /\.(?:pdb|ilk|exp|symbols?|dwo|dwp|gcno|gcda|sym|crash|tsbuildinfo)$/i.test(base) ||
    /(?:^|\/)[^/]+\.dsym(?:\/|$)/i.test(lower) ||
    /(?:^|\/)(?:npm-debug|yarn-debug|yarn-error|debug)\.log$/i.test(lower) ||
    /(?:^|\/)hs_err_pid\d+\.log$/i.test(lower) ||
    /(?:^|\/)(?:webpack-)?stats\.json$/i.test(lower) ||
    /(?:^|\/)perf\.data$/i.test(lower) ||
    base === ".DS_Store"
  );
}

function crashDumpName(base: string): boolean {
  return (
    /\.(?:dmp|mdmp|hdmp)$/i.test(base) ||
    /^core(?:\.\d+)?$/i.test(base) ||
    /^vgcore\.\d+$/i.test(base)
  );
}

function isMinidump(buf: Buffer): boolean {
  return buf.length >= 4 && buf.subarray(0, 4).equals(Buffer.from("MDMP"));
}

function isElfCore(buf: Buffer): boolean {
  if (buf.length < 18) return false;
  if (buf[0] !== 0x7f || buf[1] !== 0x45 || buf[2] !== 0x4c || buf[3] !== 0x46) return false;
  const data = buf[5];
  if (data !== 1 && data !== 2) return false;
  const type = data === 2 ? buf.readUInt16BE(16) : buf.readUInt16LE(16);
  return type === 4;
}

function crashDump(base: string, buf: Buffer): boolean {
  return crashDumpName(base) || isMinidump(buf) || isElfCore(buf);
}

export function isNestedPack(filePath: string): boolean {
  return PACK_FILE_RE.test(path.posix.basename(filePath.replace(/\\/g, "/")));
}

export function isOverlayWhiteout(base: string): boolean {
  return base === ".wh..wh..opq" || base.startsWith(".wh.");
}

function backupFile(base: string): boolean {
  return /(?:\.(?:bak|old|orig|backup|swp|swo)|~)$/i.test(base);
}

function dumpFile(base: string): boolean {
  return /\.(?:sql|sqlite|sqlite3|dump|pgdump|rdb)$/i.test(base);
}

function internalDoc(rel: string, base: string): boolean {
  const name = base.toLowerCase();
  const lower = posixPath(rel).toLowerCase();
  if (
    [
      "roadmap.md",
      "handoff.md",
      "todo.md",
      "todos.md",
      "internal.md",
      "architecture.md",
      "design.md",
      "rfc.md",
      "spec.md",
      "product.md",
      "month1.md",
      "feature-inventory.md",
      "electron.md",
    ].includes(name) ||
    name.endsWith(".prd.md") ||
    name === "prd.md"
  ) {
    return true;
  }
  if (lower.includes("/docs/internal/") || lower.startsWith("docs/internal/")) return true;
  if ((lower.includes("/adr/") || lower.startsWith("adr/")) && /^\d{4}-.+\.md$/.test(name)) {
    return true;
  }
  return false;
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

export function escapingArchivePathFinding(relPath: string): Finding {
  return {
    rule: "ARC-002",
    severity: "critical",
    path: posixPath(relPath).replace(/^\.\//, ""),
    title: "Archive entry path escapes the pack",
    detail:
      "An entry name is absolute or contains '..'. The path is not used as a filesystem location. Escaping zip entries are not unpacked for content inspection.",
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

function internalApplicationRoute(text: string): boolean {
  return /["'`](?:\/api\/internal(?:\/|["'`])|\/_internal(?:\/|["'`])|\/admin\/|\/debug\/)/i.test(
    text,
  );
}

function inspectEmbeddedSource(mapPath: string, source: EmbeddedSource): Finding[] {
  const sourcePath = `${mapPath}::${source.path}`;
  const rel = posixPath(source.path);
  const base = path.posix.basename(rel);
  const text = source.content.slice(0, TEXT_LIMIT);
  const findings: Finding[] = [];
  const isCredentialConfig = credentialConfig(rel, base);

  if (base === ".env" || base.startsWith(".env.")) {
    findings.push({
      rule: "SEC-001",
      severity: "critical",
      path: sourcePath,
      title: "Environment file embedded in source map",
      detail: "The public source map reconstructs an environment file. Values are never included in reports.",
    });
  }
  if (
    /\.(pem|key|p12|pfx)$/i.test(base) ||
    PRIVATE_KEY.test(text) ||
    /^(?:id_rsa|id_ed25519|id_dsa|id_ecdsa)(?:_sk)?$/i.test(base)
  ) {
    findings.push({
      rule: "SEC-002",
      severity: "critical",
      path: sourcePath,
      title: "Private key embedded in source map",
      detail: "The reconstructed source contains private-key material. NoSpoilers does not report the value.",
    });
  }
  if (
    HIGH_CONFIDENCE_TOKEN.test(text) ||
    cloudCredentialDocument(text) ||
    (isCredentialConfig && hasAssignedCredential(text))
  ) {
    findings.push({
      rule: "SEC-003",
      severity: "critical",
      path: sourcePath,
      title: "Credential embedded in source map",
      detail:
        "A reconstructed source file contains a high-confidence credential pattern. NoSpoilers does not include the value in reports.",
    });
  }
  if (isCredentialConfig) {
    findings.push({
      rule: "SEC-004",
      severity: "warn",
      path: sourcePath,
      title: "Credential configuration embedded in source map",
      detail: "The source map reconstructs a file that commonly carries service credentials.",
    });
  }
  if (aiContextFile(rel, base)) {
    findings.push({
      rule: "AI-001",
      severity: "warn",
      path: sourcePath,
      title: "AI context embedded in source map",
      detail: "The reconstructed tree contains agent instructions, prompts, memory, or tool configuration.",
    });
  }
  if (internalDoc(rel, base)) {
    findings.push({
      rule: "DOC-001",
      severity: "warn",
      path: sourcePath,
      title: "Internal documentation embedded in source map",
      detail: "The reconstructed tree contains internal product or engineering documentation.",
    });
  }
  if (internalLocation(text) || internalApplicationRoute(text)) {
    findings.push({
      rule: "NET-001",
      severity: "warn",
      path: sourcePath,
      title: "Internal route or location embedded in source map",
      detail:
        "The reconstructed source identifies an internal route, private-network endpoint, or developer-machine path.",
    });
  }
  return findings;
}

export function inspectEntry(relPath: string, buf: Buffer, actualBytes = buf.length): Finding[] {
  const rel = posixPath(relPath).replace(/^\.\//, "");
  const base = path.posix.basename(rel);
  if (isOverlayWhiteout(base)) return [];
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
    /\.(pem|key|p12|pfx)$/i.test(base) ||
    PRIVATE_KEY.test(text) ||
    /^(?:id_rsa|id_ed25519|id_dsa|id_ecdsa)(?:_sk)?$/i.test(base)
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
    (HIGH_CONFIDENCE_TOKEN.test(text) ||
      cloudCredentialDocument(text) ||
      (isCredentialConfig && hasAssignedCredential(text)))
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

  if (isNestedPack(rel) && !isImageLayerPath(rel)) {
    findings.push({
      rule: "ARC-001",
      severity: "warn",
      path: rel,
      title: "Nested packed artifact",
      detail:
        "Another packed artifact is inside this pack. Nested archives are unpacked for inspection, never executed.",
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

  if (crashDump(base, buf)) {
    findings.push({
      rule: "CRASH-001",
      severity: "critical",
      path: rel,
      title: "Crash dump shipped",
      detail:
        "Core dumps and minidumps contain process memory. They are spoilers, not release artifacts.",
    });
  }

  if (internalDoc(rel, base)) {
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

  if (buildCachePath(rel, base)) {
    findings.push({
      rule: "CACHE-001",
      severity: "warn",
      path: rel,
      title: "Build cache shipped",
      detail:
        "Compiler and bundler caches do not belong in a public package. They are not executed.",
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
    const reconstructed = embeddedSources(buf);
    findings.push({
      rule: "MAP-001",
      severity: "critical",
      path: rel,
      title: "Source map in the packed artifact",
      detail:
        "Source maps map minified production code back to original TypeScript/JavaScript. They are spoilers.",
    });
    if (reconstructed.length > 0) {
      findings.push({
        rule: "MAP-002",
        severity: "critical",
        path: rel,
        title: "Source map embeds original source",
        detail:
          "sourcesContent is populated. Anyone with this file can reconstruct the original tree.",
      });
      const reconstructedFindings = reconstructed.flatMap((source) =>
        inspectEmbeddedSource(rel, source),
      );
      for (const finding of reconstructedFindings) {
        const lessPrecise = findings.findIndex(
          (existing) => existing.rule === finding.rule && existing.path === rel,
        );
        if (lessPrecise >= 0) findings.splice(lessPrecise, 1);
        findings.push(finding);
      }
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
