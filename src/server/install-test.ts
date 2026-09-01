export type PermissionMap = Record<string, string>;

export const REQUIRED_READS = ["contents", "metadata"] as const;
export const OPTIONAL_WRITES = ["contents", "pull_requests", "checks"] as const;

export type RepoProbe = {
  fullName: string;
  ok: boolean;
};

export type LastDelivery = {
  kind: string;
  status: string;
  at: string;
};

export type PermissionTestResult = {
  ok: boolean;
  inventedIncident: false;
  accountLogin: string;
  suspended: boolean;
  repositorySelection: string | null;
  permissions: PermissionMap;
  missingReads: string[];
  optionalWrites: { name: string; granted: boolean }[];
  administrationGranted: boolean;
  repoProbe: RepoProbe | null;
  lastDelivery: LastDelivery | null;
  testedAt: string;
  detail: string;
};

function levelOf(permissions: PermissionMap, name: string): string {
  const value = permissions[name];
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function hasRead(permissions: PermissionMap, name: string): boolean {
  const level = levelOf(permissions, name);
  return level === "read" || level === "write" || level === "admin";
}

export function hasWrite(permissions: PermissionMap, name: string): boolean {
  const level = levelOf(permissions, name);
  return level === "write" || level === "admin";
}

export function summarizePermissionTest(input: {
  accountLogin: string;
  suspended: boolean;
  repositorySelection?: string | null;
  permissions?: PermissionMap | null;
  repoProbe?: RepoProbe | null;
  lastDelivery?: LastDelivery | null;
  testedAt?: string;
}): PermissionTestResult {
  const permissions = input.permissions ?? {};
  const missingReads = REQUIRED_READS.filter((name) => !hasRead(permissions, name));
  const optionalWrites = OPTIONAL_WRITES.map((name) => ({
    name,
    granted: hasWrite(permissions, name),
  }));
  const administrationGranted = hasWrite(permissions, "administration") || levelOf(permissions, "administration") === "admin";
  const suspended = input.suspended;
  const repoProbe = input.repoProbe ?? null;
  const lastDelivery = input.lastDelivery ?? null;
  const reachableReads = missingReads.length === 0;
  const repoOk = repoProbe === null || repoProbe.ok;
  const ok = reachableReads && !suspended && repoOk;
  const bits: string[] = [];
  if (suspended) bits.push("GitHub has suspended this App install.");
  if (missingReads.length > 0) {
    bits.push(`Missing read: ${missingReads.join(", ")}.`);
  }
  if (repoProbe && !repoProbe.ok) {
    bits.push(`Could not read ${repoProbe.fullName}.`);
  }
  if (administrationGranted) {
    bits.push("Administration is granted; NoSpoilers does not need it.");
  }
  if (lastDelivery) {
    bits.push(`Last GitHub job: ${lastDelivery.kind} (${lastDelivery.status}).`);
  } else {
    bits.push("No webhook jobs recorded yet.");
  }
  if (bits.length === 0 || !bits.some((row) => row.includes("not a security incident"))) {
    bits.push("This is not a security incident.");
  }
  return {
    ok,
    inventedIncident: false,
    accountLogin: input.accountLogin,
    suspended,
    repositorySelection: input.repositorySelection ?? null,
    permissions,
    missingReads: [...missingReads],
    optionalWrites,
    administrationGranted,
    repoProbe,
    lastDelivery,
    testedAt: input.testedAt ?? new Date().toISOString(),
    detail: bits.join(" "),
  };
}

export function findingRules(findings: unknown): string[] {
  if (!Array.isArray(findings)) return [];
  const rules: string[] = [];
  for (const entry of findings) {
    if (!entry || typeof entry !== "object" || !("rule" in entry)) continue;
    const rule = (entry as { rule: unknown }).rule;
    if (typeof rule === "string" && rule.trim()) rules.push(rule);
  }
  return rules;
}

export function rotationChecklist(rules: string[]): string[] {
  const set = new Set(rules);
  const items: string[] = [];
  if (set.has("SEC-001") || set.has("SEC-003")) {
    items.push("Rotate the shipped credential and revoke the old value at the provider.");
    items.push("Check GitHub audit and Actions logs for use of that credential.");
  }
  if (set.has("SEC-002")) {
    items.push("Replace the private key, remove it from the pack, and invalidate certificates that used it.");
  }
  if (set.has("MAP-001") || set.has("MAP-002") || set.has("MAP-003")) {
    items.push("Stop shipping source maps, republish, and treat previous map URLs as public.");
  }
  if (items.length === 0) return items;
  items.push("Do not paste secret values into NoSpoilers notes or tickets.");
  return items;
}

export function exposureMs(
  createdAt: string,
  resolvedAt: string | null,
  now = Date.now(),
): number {
  const start = Date.parse(createdAt);
  if (!Number.isFinite(start)) return 0;
  const end = resolvedAt ? Date.parse(resolvedAt) : now;
  if (!Number.isFinite(end) || end < start) return 0;
  return end - start;
}
