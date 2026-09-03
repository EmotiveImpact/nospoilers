import { pathToFileURL } from "node:url";
import { loadConfig } from "../src/server/config.ts";
import { createGithubPort, type GithubSetupPrResult } from "../src/server/github.ts";
import { hasWrite } from "../src/server/install-test.ts";
import { SETUP_BRANCH } from "../src/server/setup-workflow.ts";

export const SETUP_OWNER = "EmotiveImpact";
export const SETUP_REPO = "nospoilers-throwaway";
export const SETUP_FULL = `${SETUP_OWNER}/${SETUP_REPO}`;
export const SETUP_INSTALL_ID = 158159401;
export const SETUP_APP_SLUG = "nospoilers-dev";
export const PRODUCT_REPOS = ["nospoilers", "Echo"];

export function appPermissionsUrl(slug = SETUP_APP_SLUG): string {
  return `https://github.com/settings/apps/${slug}/permissions`;
}

export function installAcceptUrl(installationId = SETUP_INSTALL_ID): string {
  return `https://github.com/settings/installations/${installationId}`;
}

export function installReviewUrl(installationId = SETUP_INSTALL_ID): string {
  return `${installAcceptUrl(installationId)}/permissions/update`;
}

export function deniedMessage(): string {
  return [
    `Cannot open an App-generated setup PR on ${SETUP_FULL}.`,
    "The GitHub App has Contents write. That committed the vendored Action on",
    `${SETUP_BRANCH}. Opening the reviewable PR needs Pull requests write.`,
    "",
    "If the install page has no Accept button, Pull requests write is not saved",
    "on the App yet. GitHub only shows Accept after that Save. The Configure page",
    "is not the review.",
    "",
    "1. Signed in as EmotiveImpact, open",
    `   ${appPermissionsUrl()}`,
    "2. Repository permissions → Pull requests → Read and write.",
    "3. Save changes at the bottom. Do not change Administration or Workflows.",
    "4. Review the new request at",
    `   ${installReviewUrl()}`,
    `   not ${installAcceptUrl()}.`,
    "5. Accept Pull requests write. Members read may appear too; that is optional.",
    "6. Leave npm run dev running, then npm run phase1:setup-pr.",
    "",
    "Do not grant Administration. Do not request Workflows write.",
    "The workflow YAML stays copy-paste. The App never merges.",
    "Do not invent nospoilers-throwaway-vis. Do not publicize a product repository.",
    "Do not transfer a repository in this proof.",
    "",
  ].join("\n");
}

export function setupPrWriteReady(
  appPermissions: Record<string, string>,
  installPermissions: Record<string, string>,
): boolean {
  return hasWrite(appPermissions, "pull_requests") && hasWrite(installPermissions, "pull_requests");
}

function assertThrowaway(repo: string): void {
  if (PRODUCT_REPOS.includes(repo)) {
    throw new Error("Refusing to open a setup PR on a product repository.");
  }
}

export async function openSetupPullRequest(
  installationId = SETUP_INSTALL_ID,
  owner = SETUP_OWNER,
  repo = SETUP_REPO,
): Promise<GithubSetupPrResult> {
  assertThrowaway(repo);
  const github = createGithubPort(loadConfig());
  return github.createSetupPullRequest(installationId, owner, repo);
}

export async function main(): Promise<void> {
  assertThrowaway(SETUP_REPO);
  const github = createGithubPort(loadConfig());
  const [app, install] = await Promise.all([
    github.getApp(),
    github.getInstallation(SETUP_INSTALL_ID),
  ]);
  if (!setupPrWriteReady(app.permissions, install.permissions)) {
    process.stderr.write(deniedMessage());
    process.exitCode = 2;
    return;
  }

  const result = await github.createSetupPullRequest(SETUP_INSTALL_ID, SETUP_OWNER, SETUP_REPO);
  if ("skipped" in result) {
    process.stderr.write(`${result.reason}\n`);
    if (result.compareUrl) process.stderr.write(`${result.compareUrl}\n`);
    process.stderr.write(deniedMessage());
    process.exitCode = 2;
    return;
  }

  process.stdout.write(
    `${result.existing ? "existing" : "opened"} setup PR ${result.htmlUrl} (#${String(result.number)}). Never merge it.\n`,
  );
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
