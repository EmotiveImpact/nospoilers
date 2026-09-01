export const GITHUB_SUSPENDED_ERROR =
  "GitHub suspended the NoSpoilers App. We do not scan until it is unsuspended.";

export function httpErrorForWorkBlock(
  block: { reason: "suspended" | "unpaid" },
  unpaidMessage: string,
): { message: string; status: 402 | 409 } {
  if (block.reason === "suspended") {
    return { message: GITHUB_SUSPENDED_ERROR, status: 409 };
  }
  return { message: unpaidMessage, status: 402 };
}

export type InstallHealthKind =
  | "app_suspended"
  | "app_unsuspended"
  | "app_permissions_updated"
  | "repos_added"
  | "repos_removed";

const REPO_CAP = 20;

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function namesFromRepoList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const names: string[] = [];
  for (const entry of raw) {
    const fullName = obj(entry).full_name;
    if (typeof fullName === "string" && fullName.includes("/")) names.push(fullName);
  }
  return names;
}

function formatRepoNames(names: string[]): string {
  const shown = names.slice(0, REPO_CAP);
  const extra = names.length - shown.length;
  if (shown.length === 0) return "none listed";
  if (extra > 0) return `${shown.join(", ")}, and ${extra} more`;
  return shown.join(", ");
}

export function describeInstallHealth(input: {
  kind: InstallHealthKind;
  accountLogin: string;
  repos?: string[];
}): { title: string; body: string } {
  const account = input.accountLogin.trim() || "this GitHub account";
  switch (input.kind) {
    case "app_suspended":
      return {
        title: `GitHub suspended the NoSpoilers App on ${account}`,
        body: "GitHub paused this installation. Repositories stay listed. We do not scan or enqueue jobs until GitHub unsuspends the App. This is not a coverage or billing change.",
      };
    case "app_unsuspended":
      return {
        title: `GitHub unsuspended the NoSpoilers App on ${account}`,
        body: "The App can watch this install again. Coverage is unchanged.",
      };
    case "app_permissions_updated":
      return {
        title: `GitHub App permissions changed on ${account}`,
        body: "GitHub recorded a permission update for this installation. Confirm the App still has the scopes you intend. Administration is never requested.",
      };
    case "repos_added": {
      const repos = input.repos ?? [];
      const n = repos.length;
      return {
        title:
          n === 1
            ? `NoSpoilers can see one more repository on ${account}`
            : `NoSpoilers can see ${n} more repositories on ${account}`,
        body: `Added: ${formatRepoNames(repos)}. We watch visibility and packed releases on repositories this App can see.`,
      };
    }
    case "repos_removed": {
      const repos = input.repos ?? [];
      const n = repos.length;
      return {
        title:
          n === 1
            ? `One repository left the NoSpoilers install on ${account}`
            : `${n} repositories left the NoSpoilers install on ${account}`,
        body: `Removed: ${formatRepoNames(repos)}. We no longer watch those repositories.`,
      };
    }
  }
}
