export type PermissionMap = Record<string, string>;

export const REQUIRED_READS = ["contents", "metadata"] as const;
export const OPTIONAL_READS = ["members"] as const;
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
  optionalReads: { name: string; granted: boolean }[];
  optionalWrites: { name: string; granted: boolean }[];
  administrationGranted: boolean;
  pendingAccepts: string[];
  installUrl: string | null;
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

function permissionRank(level: string): number {
  const value = level.toLowerCase();
  if (value === "admin") return 3;
  if (value === "write") return 2;
  if (value === "read") return 1;
  return 0;
}

/** Permissions we never ask a customer to Accept, even if the App requested them. */
const NEVER_REQUEST_ACCEPT = new Set(["administration"]);

export function pendingAccepts(
  appPermissions: PermissionMap | null | undefined,
  installPermissions: PermissionMap,
): string[] {
  if (!appPermissions) return [];
  const pending: string[] = [];
  for (const [name, appLevel] of Object.entries(appPermissions)) {
    const key = name.toLowerCase();
    if (NEVER_REQUEST_ACCEPT.has(key)) continue;
    if (permissionRank(appLevel) > permissionRank(levelOf(installPermissions, name))) {
      pending.push(key);
    }
  }
  return pending.sort();
}

function pendingPermissionLabel(name: string, appLevel: string): string {
  const rank = permissionRank(appLevel);
  switch (name) {
    case "members":
      return "Members read";
    case "contents":
      return rank >= 2 ? "Contents write" : "Contents read";
    case "pull_requests":
      return rank >= 2 ? "Pull requests write" : "Pull requests read";
    case "checks":
      return rank >= 2 ? "Checks write" : "Checks read";
    case "metadata":
      return "Metadata read";
    default:
      return rank >= 2 ? `${name.replace(/_/g, " ")} write` : name.replace(/_/g, " ");
  }
}

function joinEnglish(names: string[]): string {
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function summarizePermissionTest(input: {
  accountLogin: string;
  suspended: boolean;
  repositorySelection?: string | null;
  permissions?: PermissionMap | null;
  appPermissions?: PermissionMap | null;
  installUrl?: string | null;
  repoProbe?: RepoProbe | null;
  lastDelivery?: LastDelivery | null;
  testedAt?: string;
}): PermissionTestResult {
  const permissions = input.permissions ?? {};
  const missingReads = REQUIRED_READS.filter((name) => !hasRead(permissions, name));
  const optionalReads = OPTIONAL_READS.map((name) => ({
    name,
    granted: hasRead(permissions, name),
  }));
  const optionalWrites = OPTIONAL_WRITES.map((name) => ({
    name,
    granted: hasWrite(permissions, name),
  }));
  const administrationGranted = hasWrite(permissions, "administration") || levelOf(permissions, "administration") === "admin";
  const pending = pendingAccepts(input.appPermissions, permissions);
  const pendingSet = new Set(pending);
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
  if (pending.length > 0) {
    const labels = pending.map((name) =>
      pendingPermissionLabel(name, input.appPermissions?.[name] ?? ""),
    );
    const noun = pending.length === 1 ? "it" : "them";
    const verb = pending.length === 1 ? "is" : "are";
    bits.push(
      `${joinEnglish(labels)} ${verb} requested on the App. Accept ${noun} at the GitHub install page.`,
    );
  }
  if (!hasRead(permissions, "members") && !pendingSet.has("members")) {
    bits.push("Members read is off; collaborator-added Watch will miss GitHub member events.");
  }
  if (!hasWrite(permissions, "contents") && !pendingSet.has("contents")) {
    bits.push("Contents write is off; setup and remediation PRs stay copy-paste.");
  }
  if (!hasWrite(permissions, "pull_requests") && !pendingSet.has("pull_requests")) {
    bits.push("Pull requests write is off; the App cannot open PRs.");
  }
  if (!hasWrite(permissions, "checks") && !pendingSet.has("checks")) {
    bits.push("Checks write is off; hosted release scans skip GitHub Checks.");
  }
  if (repoProbe && !repoProbe.ok) {
    bits.push(`Could not read ${repoProbe.fullName}.`);
  }
  if (administrationGranted) {
    bits.push("Administration is granted; NoSpoilers does not need it. Do not keep that permission.");
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
    optionalReads,
    optionalWrites,
    administrationGranted,
    pendingAccepts: pending,
    installUrl: input.installUrl ?? null,
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
