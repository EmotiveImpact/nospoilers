/** Shared Watch copy for one-click GitHub responses. Safe for the client bundle. */

export const NOSPOILERS_SCAN_WORKFLOW = ".github/workflows/nospoilers.yml";

export const ADMINISTRATION_DENIED =
  "GitHub App Administration is not granted, and NoSpoilers does not need it for Phase 1. Administration is repo-admin (make the repository private, delete Release assets, disable workflows). Do that in GitHub yourself, or grant Administration later. Contents write is not enough and is not this action.";

export const MAKE_PRIVATE_COPY =
  "Make this GitHub repository private. Type the owner/repo name. This needs GitHub Administration, which this App should not have yet. A 409 returns these steps instead of changing visibility.";

export const DELETE_PACK_ASSETS_COPY =
  "Delete packed Release assets on the latest GitHub Release (maps, tgz, zip, and other packs). Source trees are not touched. This needs GitHub Administration. A 409 returns GitHub UI steps instead of deleting.";

export const DISABLE_WORKFLOW_COPY =
  "Disable one GitHub Actions workflow under .github/workflows/. Type the workflow path. This needs GitHub Administration. The NoSpoilers scan workflow cannot be disabled here.";

export function makePrivateConfirm(fullName: string): string {
  return fullName.trim();
}

export function deletePackAssetsConfirm(fullName: string): string {
  return `delete pack assets on ${fullName.trim()}`;
}

export function parseWorkflowPath(raw: string): string | null {
  const trimmed = raw.trim().replace(/^\/+/, "");
  if (!trimmed.startsWith(".github/workflows/")) return null;
  const base = trimmed.slice(".github/workflows/".length);
  if (!base || base.includes("..") || base.includes("/") || !/^[A-Za-z0-9._-]+\.ya?ml$/i.test(base)) {
    return null;
  }
  return `.github/workflows/${base}`;
}

export function disableWorkflowConfirm(workflowPath: string): string {
  return workflowPath.trim();
}

export function workflowIsNoSpoilersScan(workflowPath: string): boolean {
  return workflowPath.trim() === NOSPOILERS_SCAN_WORKFLOW;
}
