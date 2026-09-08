import { PACK_FILE_RE } from "../scanner/formats.ts";

export const SETUP_WORKFLOW_PATH = ".github/workflows/nospoilers.yml";
export const SETUP_ACTION_PATH = ".github/actions/nospoilers/action.yml";
export const SETUP_BRANCH = "nospoilers/setup";
export const MAX_SETUP_PACKS = 8;

export const SETUP_PACK_GLOBS = [
  "package.tgz",
  "dist/*.tgz",
  "dist/*.tar.gz",
  "dist/*.tar",
  "dist/*.zip",
  "dist/*.asar",
  "dist/*.vsix",
  "dist/*.whl",
  "dist/*.jar",
  "dist/*.war",
  "dist/*.nupkg",
  "dist/*.snupkg",
  "dist/*.crx",
  "dist/*.xpi",
  "dist/*.gem",
  "dist/*.apk",
  "dist/*.aab",
  "dist/*.ipa",
  "dist/*.xapk",
] as const;

export const SETUP_PERMISSIONS = [
  "Contents: Read and write (commit the vendored Action on a branch; not Administration)",
  "Pull requests: Read and write (open a reviewable PR; never merge it)",
  "Checks: Read and write (optional; report release-scan results on the tag SHA)",
] as const;

export function isGithubActionsWorkflowPath(filePath: string): boolean {
  return /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(filePath.replace(/^\.\//, ""));
}

export function setupCommitFiles(canWriteWorkflows: boolean): SetupFile[] {
  if (canWriteWorkflows) return setupFiles();
  return setupFiles().filter((file) => !isGithubActionsWorkflowPath(file.path));
}

export type SetupFile = {
  path: string;
  content: string;
};

function yamlPathFilters(indent: string): string {
  return SETUP_PACK_GLOBS.map((glob) => `${indent}- ${glob}`).join("\n");
}

function indentBlock(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => (line.length ? pad + line : line))
    .join("\n");
}

export function setupActionScanPython(): string {
  return `import json
import os
import sys
import time
import uuid
import urllib.error
import urllib.request
from pathlib import Path

MISSING = (
    "Set repository variable NOSPOILERS_API_URL to your NoSpoilers HTTPS origin "
    "and secret NOSPOILERS_API_TOKEN to a token minted on Watch. "
    "This Action POSTs packed bytes to /api/v1/scan; it does not execute the pack. "
    "Do not grant Administration."
)

def fail(message: str, code: int) -> None:
    sys.stderr.write(message + "\\n")
    raise SystemExit(code)

url = (os.environ.get("NOSPOILERS_API_URL") or "").strip().rstrip("/")
token = (os.environ.get("NOSPOILERS_API_TOKEN") or "").strip()
pack = (os.environ.get("NOSPOILERS_PACK") or "").strip()

if not url or not token:
    fail(MISSING, 2)
if not pack:
    fail("path is required.", 2)

path = Path(pack)
if path.is_absolute() or ".." in path.parts:
    fail("path must be a relative packed file.", 2)
if path.is_symlink() or not path.is_file():
    fail("path must be an existing packed file, not a symlink.", 2)

if path.stat().st_size > 80 * 1024 * 1024:
    fail("packed file exceeds the hosted 80 MB limit.", 2)
data = path.read_bytes()
if not data:
    fail("packed file is empty.", 2)

headers = {
    "Authorization": "Bearer " + token,
    "X-Filename": path.name,
    "Content-Type": "application/octet-stream",
    "Idempotency-Key": str(uuid.uuid4()),
}
channel = (os.environ.get("NOSPOILERS_CHANNEL") or "").strip().lower()
if channel in ("stable", "beta", "canary"):
    headers["X-NoSpoilers-Channel"] = channel
revision = (os.environ.get("NOSPOILERS_SOURCE_REVISION") or os.environ.get("GITHUB_SHA") or "").strip()
if revision:
    headers["X-NoSpoilers-Source-Revision"] = revision
ci_run = (os.environ.get("NOSPOILERS_CI_RUN") or "").strip()
if not ci_run:
    server = (os.environ.get("GITHUB_SERVER_URL") or "").rstrip("/")
    repo = os.environ.get("GITHUB_REPOSITORY") or ""
    run_id = os.environ.get("GITHUB_RUN_ID") or ""
    if server.startswith("https://") and repo and run_id:
        ci_run = server + "/" + repo + "/actions/runs/" + run_id
if ci_run:
    headers["X-NoSpoilers-CI-Run"] = ci_run

req = urllib.request.Request(url + "/api/v1/scan", data=data, method="POST", headers=headers)
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None
opener = urllib.request.build_opener(NoRedirect())

try:
    with opener.open(req, timeout=120) as resp:
        raw = resp.read().decode("utf-8")
except urllib.error.HTTPError as err:
    raw = err.read().decode("utf-8", "replace")
    try:
        payload = json.loads(raw) if raw else {}
        message = payload.get("error") or raw or str(err)
    except json.JSONDecodeError:
        message = raw or str(err)
    fail("Hosted scan failed (%s): %s" % (err.code, message), 2)
except Exception as err:
    fail("Hosted scan failed: %s" % err, 2)

try:
    body = json.loads(raw)
except json.JSONDecodeError:
    fail("Hosted scan returned non-JSON.", 2)

if isinstance(body, dict) and body.get("queued") and body.get("uploadId"):
    job = str(body["uploadId"])
    try:
        uuid.UUID(job)
    except ValueError:
        fail("Hosted scan returned an invalid job identifier.", 2)
    deadline = time.monotonic() + 600
    while time.monotonic() < deadline:
        time.sleep(1)
        poll = urllib.request.Request(url + "/api/v1/scans/" + job, headers={"Authorization": "Bearer " + token})
        try:
            with opener.open(poll, timeout=30) as resp:
                body = json.loads(resp.read().decode("utf-8"))
        except Exception:
            fail("Could not retrieve the queued scan. Reopen the job in Releases.", 2)
        if body.get("status") == "failed":
            fail(body.get("error") or "Hosted scan failed.", 2)
        if body.get("status") == "done":
            break
    else:
        fail("Scan remains queued or running. Reopen the job in Releases.", 2)

report = body.get("report") if isinstance(body, dict) else None
receipt = body.get("receipt") if isinstance(body, dict) else None
if not isinstance(report, dict):
    report = {}
if not isinstance(receipt, dict):
    receipt = {}

status = receipt.get("status") or report.get("status")
ok = report.get("ok")
reason = report.get("inconclusiveReason") or receipt.get("inconclusiveReason")

if status == "inconclusive":
    fail(reason or "Inconclusive. Not a passing receipt.", 2)
if status == "failed-policy" or ok is False:
    sys.stdout.write("failed-policy\\n")
    raise SystemExit(1)
if status == "passed" or ok is True:
    sys.stdout.write("passed\\n")
    raise SystemExit(0)
fail("Hosted scan response was missing a receipt status.", 2)
`;
}

export function setupActionYaml(): string {
  return `# Generated by NoSpoilers. Review this PR; it is never merged automatically.
# POSTs packed bytes to hosted /api/v1/scan. Never executes the pack.
name: NoSpoilers
description: Fail the job if a packed artifact contains source maps, secrets, or a .git directory.
inputs:
  path:
    description: Packed artifact relative to the repo root
    required: true
  api-url:
    description: NoSpoilers origin for POST /api/v1/scan (repository variable NOSPOILERS_API_URL)
    required: false
    default: ""
  api-token:
    description: Scan API token minted on Watch (repository secret NOSPOILERS_API_TOKEN)
    required: false
    default: ""
runs:
  using: composite
  steps:
    - name: Scan packed artifact
      shell: bash
      working-directory: \${{ github.workspace }}
      env:
        NOSPOILERS_API_URL: \${{ inputs.api-url }}
        NOSPOILERS_API_TOKEN: \${{ inputs.api-token }}
        NOSPOILERS_PACK: \${{ inputs.path }}
        GITHUB_SHA: \${{ github.sha }}
        GITHUB_SERVER_URL: \${{ github.server_url }}
        GITHUB_REPOSITORY: \${{ github.repository }}
        GITHUB_RUN_ID: \${{ github.run_id }}
      run: |
        python3 - <<'PY'
${indentBlock(setupActionScanPython(), 8)}
        PY
`;
}

export function setupWorkflowYaml(): string {
  const filters = yamlPathFilters("      ");
  const globEnv = JSON.stringify([...SETUP_PACK_GLOBS]);
  return `# Generated by NoSpoilers. Review this PR; it is never merged automatically.
# Scans packed artifacts that exist (package.tgz and dist/* packs). Source pushes are not unpacked.
# Customer CI cannot uses: the private product Action; this workflow vendors a hosted-scan step.
name: NoSpoilers

on:
  workflow_dispatch:
    inputs:
      path:
        description: Packed artifact (.tgz, .tar, .zip, .vsix, .whl, .jar, …) relative to the repo root
        required: true
        default: package.tgz
  push:
    paths:
${filters}
  pull_request:
    paths:
${filters}

jobs:
  list-packs:
    name: List packed artifacts
    runs-on: ubuntu-latest
    outputs:
      packs: \${{ steps.list.outputs.packs }}
    steps:
      - uses: actions/checkout@v4
      - id: list
        name: Resolve pack paths
        env:
          NS_DISPATCH_PATH: \${{ github.event.inputs.path }}
          NS_MAX_PACKS: "${MAX_SETUP_PACKS}"
          NS_PACK_GLOBS: '${globEnv}'
          NS_PACK_RE: '${PACK_FILE_RE.source}'
        run: |
          python3 - <<'PY'
          import glob, json, os, re
          from pathlib import Path

          pack_re = re.compile(os.environ["NS_PACK_RE"], re.I)

          def usable(raw: str) -> bool:
              path = Path(raw)
              if path.is_absolute() or ".." in path.parts:
                  return False
              if path.is_symlink() or not path.is_file():
                  return False
              name = str(path).replace("\\\\", "/")
              return bool(pack_re.search(name))

          max_packs = int(os.environ.get("NS_MAX_PACKS", "8"))
          globs = json.loads(os.environ["NS_PACK_GLOBS"])
          event = os.environ.get("GITHUB_EVENT_NAME", "")
          dispatch = (os.environ.get("NS_DISPATCH_PATH") or "").strip()
          packs = []
          if event == "workflow_dispatch" and dispatch:
              if not usable(dispatch):
                  raise SystemExit("workflow_dispatch path must be a relative packed file that exists.")
              packs = [dispatch.replace("\\\\", "/")]
          else:
              seen = set()
              for pattern in globs:
                  for match in glob.glob(pattern):
                      name = match.replace("\\\\", "/")
                      if name in seen or not usable(name):
                          continue
                      seen.add(name)
                      packs.append(name)
              packs = sorted(packs)[:max_packs]
          output = Path(os.environ["GITHUB_OUTPUT"])
          with output.open("a", encoding="utf-8") as fh:
              fh.write("packs<<NS_PACKS\\n")
              fh.write(json.dumps(packs) + "\\n")
              fh.write("NS_PACKS\\n")
          PY

  nospoilers:
    name: NoSpoilers
    needs: list-packs
    if: needs.list-packs.outputs.packs != '[]'
    strategy:
      fail-fast: true
      matrix:
        pack: \${{ fromJSON(needs.list-packs.outputs.packs) }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/nospoilers
        with:
          path: \${{ matrix.pack }}
          api-url: \${{ vars.NOSPOILERS_API_URL }}
          api-token: \${{ secrets.NOSPOILERS_API_TOKEN }}

  nospoilers-missing:
    name: No packed artifact
    needs: list-packs
    if: needs.list-packs.outputs.packs == '[]'
    runs-on: ubuntu-latest
    steps:
      - name: Fail closed
        run: |
          echo "No packed artifact found. Add package.tgz or a pack under dist/, or dispatch with a path." >&2
          exit 1
`;
}

export function setupFiles(): SetupFile[] {
  return [
    { path: SETUP_WORKFLOW_PATH, content: setupWorkflowYaml() },
    { path: SETUP_ACTION_PATH, content: setupActionYaml() },
  ];
}

export function setupPullRequestTitle(): string {
  return "Add NoSpoilers pack scan to CI";
}

export function setupPullRequestBody(): string {
  return [
    "This pull request is from NoSpoilers. It is **not** merged automatically.",
    "",
    "It adds a GitHub Action that scans **packed** artifacts that exist: `package.tgz` and matching files under `dist/` (npm tarball, zip, VSIX, wheel, JAR, gem, Docker/OCI image, APK/IPA, Lambda zip, or Electron asar).",
    "Each existing pack is scanned. If none exist, the workflow fails closed. It does not unpack the git tree on ordinary source pushes.",
    "",
    "The scan step is vendored at `.github/actions/nospoilers`. It POSTs packed bytes to hosted `POST /api/v1/scan`. It does not execute the pack. Customer CI cannot `uses:` the private product Action repository.",
    "",
    "After you merge:",
    "",
    "1. Mint a scan API token on Watch.",
    "2. Set repository variable `NOSPOILERS_API_URL` to your NoSpoilers HTTPS origin. GitHub-hosted runners cannot reach localhost.",
    "3. Set repository secret `NOSPOILERS_API_TOKEN` to that token.",
    "4. Put the file you publish at `package.tgz` or under `dist/`, or dispatch the workflow with a path.",
    "5. Optionally mark the **NoSpoilers** check as required in branch protection.",
    "6. Keep Contents write and Pull requests write if you want NoSpoilers to open later setup PRs.",
    "7. Paste `.github/workflows/nospoilers.yml` from Watch if it is not in this PR. The App does not request Workflows write, so it cannot create GitHub Actions YAML.",
    "8. Do **not** grant Administration on all repositories.",
    "",
    "The hosted GitHub App still scans **Release assets** on our servers. This workflow is the",
    "pre-publish CI gate on yours. Unpaid hosted scans return 402. Inconclusive is exit 2, not a passing receipt.",
  ].join("\n");
}

export function setupCommitMessage(): string {
  return "Add NoSpoilers packed-artifact scan workflow.";
}
