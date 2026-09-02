import type { GithubPort } from "./github.ts";
import { SETUP_ACTION_PATH, SETUP_BRANCH, SETUP_WORKFLOW_PATH } from "./setup-workflow.ts";

export const NOSPOILERS_CHECK_NAME = "NoSpoilers";

export const SETUP_STATUS_REQUIRED_UNKNOWN =
  "Mark the NoSpoilers check required in branch protection if you want CI to block. The App cannot see or set that.";

export type SetupStatus = {
  inventedIncident: false;
  defaultBranch: string;
  setupBranch: string;
  actionOnDefault: boolean;
  actionOnSetup: boolean;
  workflowOnDefault: boolean;
  workflowOnSetup: boolean;
  check: {
    name: string;
    conclusion: string | null;
    htmlUrl: string | null;
    ref: string;
  } | null;
  requiredCheck: "unknown";
  detail: string;
};

function isNoSpoilersCheck(name: string): boolean {
  return name.trim().toLowerCase() === NOSPOILERS_CHECK_NAME.toLowerCase();
}

function detailFor(status: Omit<SetupStatus, "detail" | "inventedIncident">): string {
  const bits: string[] = [];
  if (status.actionOnDefault) bits.push("vendored Action is on the default branch");
  else if (status.actionOnSetup) bits.push(`vendored Action is on ${status.setupBranch}`);
  else bits.push("vendored Action is missing");
  if (status.workflowOnDefault) bits.push("workflow YAML is on the default branch");
  else if (status.workflowOnSetup) bits.push(`workflow YAML is on ${status.setupBranch}`);
  else bits.push("workflow YAML is missing (copy-paste; Workflows write is not requested)");
  if (status.check) {
    bits.push(
      `NoSpoilers check on ${status.check.ref} is ${status.check.conclusion ?? "queued"}`,
    );
  } else {
    bits.push("no NoSpoilers check on the default SHA");
  }
  return `${bits.join(". ")}. ${SETUP_STATUS_REQUIRED_UNKNOWN}`;
}

export async function probeRepoSetupStatus(
  github: GithubPort,
  input: { installationId: number; owner: string; repo: string },
): Promise<SetupStatus> {
  if (!github.pathExists || !github.listCheckRuns) {
    throw new Error("This instance cannot probe GitHub setup files.");
  }
  const repo = await github.getRepo(input.installationId, input.owner, input.repo);
  const defaultBranch = repo.default_branch?.trim() || "main";
  const [actionOnDefault, actionOnSetup, workflowOnDefault, workflowOnSetup] = await Promise.all([
    github.pathExists(input.installationId, input.owner, input.repo, SETUP_ACTION_PATH, defaultBranch),
    github.pathExists(input.installationId, input.owner, input.repo, SETUP_ACTION_PATH, SETUP_BRANCH),
    github.pathExists(input.installationId, input.owner, input.repo, SETUP_WORKFLOW_PATH, defaultBranch),
    github.pathExists(input.installationId, input.owner, input.repo, SETUP_WORKFLOW_PATH, SETUP_BRANCH),
  ]);
  const sha = await github.getRefSha(input.installationId, input.owner, input.repo, defaultBranch);
  const runs = sha
    ? await github.listCheckRuns(input.installationId, input.owner, input.repo, sha)
    : [];
  const match = runs.find((run) => isNoSpoilersCheck(run.name)) ?? null;
  const check = match && sha
    ? {
        name: NOSPOILERS_CHECK_NAME,
        conclusion: match.conclusion,
        htmlUrl: match.htmlUrl,
        ref: sha,
      }
    : null;
  const status = {
    defaultBranch,
    setupBranch: SETUP_BRANCH,
    actionOnDefault,
    actionOnSetup,
    workflowOnDefault,
    workflowOnSetup,
    check,
    requiredCheck: "unknown" as const,
  };
  return {
    inventedIncident: false,
    ...status,
    detail: detailFor(status),
  };
}
