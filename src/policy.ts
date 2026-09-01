import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { canonicalJson, findingFingerprint } from "./receipt.ts";
import type {
  Finding,
  PolicyException,
  ScanPolicyShape,
  ScanReport,
  ScanStatus,
  SuppressedFinding,
} from "./scanner/types.ts";

export const POLICY_VERSION = 1;
export const MIN_EXCEPTION_REASON = 8;
export const MAX_EXCEPTION_DAYS = 730;

const RULE_ID = /^[A-Z]{2,8}-\d{3}$/;

export type { PolicyException, SuppressedFinding } from "./scanner/types.ts";
export type ScanPolicy = ScanPolicyShape;

export function policyHash(policy: ScanPolicy): string {
  return createHash("sha256")
    .update(
      canonicalJson({
        version: policy.version,
        strict: policy.strict,
        exceptions: policy.exceptions.map((entry) => ({
          actor: entry.actor,
          expiresAt: entry.expiresAt,
          pathPattern: entry.pathPattern,
          reason: entry.reason,
          rule: entry.rule,
        })),
      }),
    )
    .digest("hex");
}

export function matchPathGlob(pattern: string | null, filePath: string): boolean {
  if (!pattern || pattern === "*" || pattern === "**") return true;
  const value = filePath.replace(/\\/g, "/").replace(/^\.\//, "");
  const source = pattern
    .replace(/\\/g, "/")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "(?:.*/)?")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`^${source}$`).test(value);
}

export function normalizeExpiry(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T23:59:59.000Z`;
  return trimmed;
}

export function exceptionCovers(
  exception: PolicyException,
  finding: Finding,
  now = new Date(),
): boolean {
  if (exception.rule !== finding.rule) return false;
  const expires = Date.parse(exception.expiresAt);
  if (!Number.isFinite(expires) || expires <= now.getTime()) return false;
  return matchPathGlob(exception.pathPattern, finding.path);
}

export function validateExceptionInput(input: {
  rule: string;
  pathPattern?: string | null;
  reason: string;
  expiresAt: string;
  actor: string;
  now?: Date;
}): PolicyException {
  const rule = input.rule.trim().toUpperCase();
  if (!RULE_ID.test(rule)) {
    throw Object.assign(new Error("Allowlist rule must look like SRC-001."), { status: 400 });
  }
  const reason = input.reason.trim();
  if (reason.length < MIN_EXCEPTION_REASON) {
    throw Object.assign(
      new Error(`Allowlist reason must be at least ${MIN_EXCEPTION_REASON} characters.`),
      { status: 400 },
    );
  }
  const actor = input.actor.trim();
  if (!actor) {
    throw Object.assign(new Error("Allowlist entries need an actor."), { status: 400 });
  }
  const expires = Date.parse(normalizeExpiry(input.expiresAt));
  if (!Number.isFinite(expires)) {
    throw Object.assign(new Error("Allowlist expiry must be an ISO date."), { status: 400 });
  }
  const now = input.now ?? new Date();
  if (expires <= now.getTime()) {
    throw Object.assign(new Error("Allowlist expiry must be in the future."), { status: 400 });
  }
  const max = now.getTime() + MAX_EXCEPTION_DAYS * 24 * 60 * 60 * 1000;
  if (expires > max) {
    throw Object.assign(
      new Error(`Allowlist expiry cannot be more than ${MAX_EXCEPTION_DAYS} days away.`),
      { status: 400 },
    );
  }
  const pathPattern = input.pathPattern?.trim() ? input.pathPattern.trim() : null;
  if (pathPattern && pathPattern.length > 500) {
    throw Object.assign(new Error("Path pattern is too long."), { status: 400 });
  }
  return {
    rule,
    pathPattern,
    reason,
    expiresAt: new Date(expires).toISOString(),
    actor,
  };
}

function quoteValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseScalar(raw: string): string | boolean | number {
  const value = quoteValue(raw);
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}

export function parsePolicyYaml(text: string, actor = "cli"): ScanPolicy {
  const trimmed = text.trim();
  if (!trimmed) {
    return { version: POLICY_VERSION, strict: false, exceptions: [] };
  }
  if (trimmed.startsWith("{")) {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    return policyFromObject(json, actor);
  }

  const lines = text.split(/\r?\n/);
  let version = POLICY_VERSION;
  let strict = false;
  const items: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;
  let section: "root" | "allow" = "root";

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "  ");
    const cut = line.replace(/#.*$/, "");
    if (!cut.trim()) continue;
    const indent = cut.match(/^ */)?.[0].length ?? 0;
    const content = cut.trim();

    if (indent === 0 && content === "allow:") {
      section = "allow";
      current = null;
      continue;
    }
    if (indent === 0 && /^[a-zA-Z]/.test(content) && !content.startsWith("- ")) {
      section = "root";
      current = null;
      const colon = content.indexOf(":");
      if (colon <= 0) continue;
      const key = content.slice(0, colon).trim();
      const value = content.slice(colon + 1).trim();
      if (key === "version" && value) version = Number(parseScalar(value));
      if (key === "strict" && value) strict = Boolean(parseScalar(value));
      continue;
    }
    if (section !== "allow") continue;
    if (content.startsWith("- ")) {
      current = {};
      items.push(current);
      const rest = content.slice(2).trim();
      if (rest.includes(":")) {
        const colon = rest.indexOf(":");
        current[rest.slice(0, colon).trim()] = quoteValue(rest.slice(colon + 1));
      }
      continue;
    }
    if (current && indent >= 2 && content.includes(":")) {
      const colon = content.indexOf(":");
      current[content.slice(0, colon).trim()] = quoteValue(content.slice(colon + 1));
    }
  }

  const exceptions = items.map((item, index) => {
    try {
      return validateExceptionInput({
        rule: item.rule ?? item.ruleId ?? "",
        pathPattern: item.path ?? item.pathPattern ?? null,
        reason: item.reason ?? "",
        expiresAt: item.expires ?? item.expiresAt ?? "",
        actor: item.actor || actor,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid allow entry.";
      throw new Error(`allow[${index}]: ${message}`);
    }
  });

  if (version !== POLICY_VERSION) {
    throw new Error(`Unsupported .nospoilers.yml version ${version}.`);
  }
  return { version: POLICY_VERSION, strict, exceptions };
}

function policyFromObject(raw: Record<string, unknown>, actor: string): ScanPolicy {
  const version = Number(raw.version ?? POLICY_VERSION);
  if (version !== POLICY_VERSION) {
    throw new Error(`Unsupported policy version ${version}.`);
  }
  const allow = Array.isArray(raw.allow) ? raw.allow : [];
  const exceptions = allow.map((entry, index) => {
    const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    try {
      return validateExceptionInput({
        rule: String(row.rule ?? ""),
        pathPattern: typeof row.path === "string" ? row.path : null,
        reason: String(row.reason ?? ""),
        expiresAt: String(row.expires ?? row.expiresAt ?? ""),
        actor: typeof row.actor === "string" && row.actor ? row.actor : actor,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid allow entry.";
      throw new Error(`allow[${index}]: ${message}`);
    }
  });
  return {
    version: POLICY_VERSION,
    strict: Boolean(raw.strict),
    exceptions,
  };
}

export async function loadPolicyFile(filePath: string, actor = "cli"): Promise<ScanPolicy> {
  const text = await readFile(filePath, "utf8");
  return parsePolicyYaml(text, actor);
}

export function applyPolicy(report: ScanReport, policy: ScanPolicy | null, now = new Date()): ScanReport {
  if (report.status === "inconclusive") {
    return {
      ...report,
      suppressed: report.suppressed ?? [],
      policyHash: policy ? policyHash(policy) : (report.policyHash ?? null),
    };
  }
  if (!policy) {
    return {
      ...report,
      suppressed: report.suppressed ?? [],
      policyHash: report.policyHash ?? null,
    };
  }

  const suppressed: SuppressedFinding[] = [];
  const findings: Finding[] = [];
  for (const finding of report.findings) {
    const match = policy.exceptions.find((exception) => exceptionCovers(exception, finding, now));
    if (match) {
      suppressed.push({
        finding,
        rule: match.rule,
        pathPattern: match.pathPattern,
        reason: match.reason,
        expiresAt: match.expiresAt,
        actor: match.actor,
      });
      continue;
    }
    findings.push(finding);
  }

  const critical = findings.filter((finding) => finding.severity === "critical");
  const ok = policy.strict ? findings.length === 0 : critical.length === 0;
  const status: ScanStatus = ok ? "passed" : "failed-policy";
  return {
    ...report,
    findings,
    ok,
    status,
    suppressed,
    policyHash: policyHash(policy),
  };
}

export function suppressedFingerprints(suppressed: SuppressedFinding[] | undefined): string[] {
  return (suppressed ?? []).map((row) => findingFingerprint(row.finding)).sort();
}
