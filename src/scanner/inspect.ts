import path from "node:path";
import type { Finding } from "./types.ts";

const TEXT_LIMIT = 2_000_000;
const MAP_PEEK = 256_000;

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

export function inspectEntry(relPath: string, buf: Buffer): Finding[] {
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

  const text = asText(buf);
  if (
    /\.(pem|key)$/i.test(base) ||
    PRIVATE_KEY.test(text) ||
    base === "id_rsa" ||
    base === "id_ed25519" ||
    base === "id_dsa"
  ) {
    findings.push({
      rule: "SEC-002",
      severity: "critical",
      path: rel,
      title: "Private key shipped",
      detail: "A private key or PEM was found in the packed bytes.",
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

  return findings;
}
