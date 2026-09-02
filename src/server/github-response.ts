import { SETUP_WORKFLOW_PATH } from "./setup-workflow.ts";
import { NOSPOILERS_SCAN_WORKFLOW, workflowIsNoSpoilersScan as workflowPathIsScan } from "../github-response-copy.ts";

/** GitHub App Administration is repo-admin. Do not grant it for Phase 1. */

export const RESPONSE_PERMISSIONS = ["administration"] as const;

export {
  ADMINISTRATION_DENIED,
  DELETE_PACK_ASSETS_COPY,
  DISABLE_WORKFLOW_COPY,
  MAKE_PRIVATE_COPY,
  NOSPOILERS_SCAN_WORKFLOW,
  deletePackAssetsConfirm,
  disableWorkflowConfirm,
  makePrivateConfirm,
  parseWorkflowPath,
} from "../github-response-copy.ts";

export function workflowIsNoSpoilersScan(workflowPath: string): boolean {
  return workflowPathIsScan(workflowPath) || workflowPath.trim() === SETUP_WORKFLOW_PATH;
}

if (SETUP_WORKFLOW_PATH !== NOSPOILERS_SCAN_WORKFLOW) {
  throw new Error("NoSpoilers scan workflow path drifted between setup YAML and Watch responses.");
}
