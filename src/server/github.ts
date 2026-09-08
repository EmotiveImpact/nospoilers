import { createSign } from "node:crypto";
import { pinnedHttps } from './pinned-https.ts';
import type { AppConfig } from "./config.ts";
import {
  REMEDIATION_BRANCH,
  isCustomerOwnedRemediationPath,
  remediationBundle,
  remediationCommitMessage,
  remediationPullRequestBody,
  remediationPullRequestTitle,
  remediationCommitWrites,
} from "./remediation.ts";
import {
  SETUP_BRANCH,
  isGithubActionsWorkflowPath,
  setupCommitFiles,
  setupCommitMessage,
  setupPullRequestBody,
  setupPullRequestTitle,
} from "./setup-workflow.ts";
import { ADMINISTRATION_DENIED } from "./github-response.ts";
import { hasWrite } from "./install-test.ts";
import { isPackAssetName } from "./paths.ts";

export type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  owner: { login: string };
  default_branch?: string;
};

export type GithubReleaseAsset = {
  id: number;
  name: string;
  size: number;
  url: string;
};

export type GithubCheckConclusion = "success" | "failure" | "neutral" | "timed_out";

export type GithubCheckAnnotation = {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: "notice" | "warning" | "failure";
  title?: string;
  message: string;
};

export type GithubCheckResult =
  | { skipped: "permission"; reason: string }
  | { id: number; htmlUrl: string | null };

export type GithubCheckRunSummary = {
  name: string;
  conclusion: string | null;
  htmlUrl: string | null;
};

export type GithubSetupPrResult =
  | {
      skipped: "permission";
      reason: string;
      written?: string[];
      branch?: string;
      compareUrl?: string;
    }
  | { htmlUrl: string; number: number; existing: boolean };

export type GithubAdminResult =
  | { skipped: "permission" | "empty"; reason: string }
  | { ok: true; detail: string; names?: string[] };

export class GithubApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GithubApiError";
    this.status = status;
  }
}

export type GithubPort = {
  exchangeCode: (code: string) => Promise<string>;
  getUser: (accessToken: string) => Promise<{ id: number; login: string; avatar_url: string }>;
  listUserInstallations: (accessToken: string) => Promise<number[]>;
  listInstallationRepositories?: (installationId:number) => Promise<GithubRepo[]>;
  getApp?: () => Promise<{ permissions: Record<string, string> }>;
  getInstallation: (installationId: number) => Promise<{
    id: number;
    account: { login: string; type?: string; id: number };
    suspended_at: string | null;
    created_at?: string;
    permissions?: Record<string, string>;
    repository_selection?: string | null;
    html_url?: string | null;
  }>;
  getRepo: (installationId: number, owner: string, repo: string) => Promise<GithubRepo>;
  listAttestations?: (
    installationId: number,
    owner: string,
    repo: string,
    sha256: string,
  ) => Promise<{ attestations: unknown[] }>;
  listReleaseAssets: (
    installationId: number,
    owner: string,
    repo: string,
    releaseId: number,
  ) => Promise<GithubReleaseAsset[]>;
  getLatestRelease: (
    installationId: number,
    owner: string,
    repo: string,
  ) => Promise<{ id: number; tag_name: string; name: string; target_commitish: string | null } | null>;
  downloadAsset: (installationId: number, assetUrl: string, maxBytes: number) => Promise<Buffer>;
  getRefSha: (
    installationId: number,
    owner: string,
    repo: string,
    ref: string,
  ) => Promise<string | null>;
  pathExists?: (
    installationId: number,
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ) => Promise<boolean>;
  listCheckRuns?: (
    installationId: number,
    owner: string,
    repo: string,
    ref: string,
  ) => Promise<GithubCheckRunSummary[]>;
  createCheckRun: (
    installationId: number,
    owner: string,
    repo: string,
    input: {
      name: string;
      headSha: string;
      conclusion: GithubCheckConclusion;
      title: string;
      summary: string;
      annotations?: GithubCheckAnnotation[];
    },
  ) => Promise<GithubCheckResult>;
  createSetupPullRequest: (
    installationId: number,
    owner: string,
    repo: string,
  ) => Promise<GithubSetupPrResult>;
  createRemediationPullRequest: (
    installationId: number,
    owner: string,
    repo: string,
  ) => Promise<GithubSetupPrResult>;
  makeRepoPrivate: (
    installationId: number,
    owner: string,
    repo: string,
  ) => Promise<GithubAdminResult>;
  deleteLatestPackAssets: (
    installationId: number,
    owner: string,
    repo: string,
  ) => Promise<GithubAdminResult>;
  disableWorkflow: (
    installationId: number,
    owner: string,
    repo: string,
    workflowPath: string,
  ) => Promise<GithubAdminResult>;
};

export function skippedGithubWrites(): Pick<
  GithubPort,
  | "getRefSha"
  | "createCheckRun"
  | "createSetupPullRequest"
  | "createRemediationPullRequest"
  | "makeRepoPrivate"
  | "deleteLatestPackAssets"
  | "disableWorkflow"
> {
  const reason =
    "Grant Contents write and Pull requests write to open a setup or remediation PR. The App does not write GitHub Actions workflow YAML (Workflows write is not requested). Grant Checks write to report release scans. Do not grant Administration.";
  const adminReason = ADMINISTRATION_DENIED;
  return {
    getRefSha: async () => null,
    createCheckRun: async () => ({ skipped: "permission", reason }),
    createSetupPullRequest: async () => ({ skipped: "permission", reason }),
    createRemediationPullRequest: async () => ({ skipped: "permission", reason }),
    makeRepoPrivate: async () => ({ skipped: "permission", reason: adminReason }),
    deleteLatestPackAssets: async () => ({ skipped: "permission", reason: adminReason }),
    disableWorkflow: async () => ({ skipped: "permission", reason: adminReason }),
  };
}

function permissionDenied(status: number): boolean {
  return status === 403 || status === 404;
}

export function githubCommitMissing(status: number): boolean {
  return status === 404 || status === 422;
}

export function commitRefsForCheck(tag: string, targetCommitish?: string | null): string[] {
  const refs: string[] = [];
  const add = (value: string) => {
    const ref = value.trim().replace(/^(?:refs\/)?tags\//, "");
    if (ref && !refs.includes(ref)) refs.push(ref);
  };
  add(tag);
  if (targetCommitish) add(targetCommitish);
  return refs;
}

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function createAppJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlJson({ alg: "RS256", typ: "JWT" });
  const payload = b64urlJson({ iat: now - 60, exp: now + 9 * 60, iss: appId });
  const data = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  const sig = signer.sign(privateKey).toString("base64url");
  return `${data}.${sig}`;
}

async function githubJson<T>(
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "nospoilers",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new GithubApiError(response.status, `GitHub ${response.status} ${url}: ${text.slice(0, 400)}`);
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

/** Fixed GitHub origin, bounded pagination, and no partial inventory on failure. */
async function githubCollection<T extends {id:number}>(path:'user/installations'|'installation/repositories',key:'installations'|'repositories',token:string):Promise<T[]>{
  const rows:T[]=[];const seen=new Set<number>();const signal=AbortSignal.timeout(30_000);
  let expected:number|undefined;
  for(let page=1;page<=100;page++){
    const body=await githubJson<Record<string,unknown>>(`https://api.github.com/${path}?per_page=100&page=${page}`,token,{signal,redirect:'error'});
    const batch=body[key],total=body.total_count;
    if(!Array.isArray(batch)||batch.length>100||!Number.isSafeInteger(total)||Number(total)<0||Number(total)>10_000)
      throw new Error('GitHub returned an incomplete or oversized listing.');
    if(expected!==undefined&&expected!==total)throw new Error('GitHub listing changed during pagination. Retry the connection.');
    expected=Number(total);
    for(const value of batch){
      if(!value||typeof value!=='object'||!Number.isSafeInteger(value.id)||value.id<=0||seen.has(value.id))
        throw new Error('GitHub returned an inconsistent listing.');
      seen.add(value.id);rows.push(value as T);
    }
    if(rows.length===expected)return rows;
    if(rows.length>expected||batch.length<100)throw new Error('GitHub returned an incomplete listing.');
  }
  throw new Error('GitHub listing exceeds the supported connection size.');
}

export function createGithubPort(config: AppConfig): GithubPort {
  const tokenCache = new Map<number, { token: string; expires: number }>();

  async function installationToken(installationId: number): Promise<string> {
    const cached = tokenCache.get(installationId);
    if (cached && cached.expires > Date.now() + 30_000) return cached.token;
    const jwt = createAppJwt(config.githubAppId, config.githubPrivateKey);
    const body = await githubJson<{ token: string; expires_at: string }>(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      jwt,
      { method: "POST" },
    );
    tokenCache.set(installationId, {
      token: body.token,
      expires: Date.parse(body.expires_at),
    });
    return body.token;
  }

  return {
    async exchangeCode(code: string) {
      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "nospoilers",
        },
        body: JSON.stringify({
          client_id: config.githubClientId,
          client_secret: config.githubClientSecret,
          code,
        }),
      });
      const body = (await response.json()) as { access_token?: string; error?: string };
      if (!body.access_token) {
        throw new Error(body.error ?? "GitHub did not return an access token.");
      }
      return body.access_token;
    },

    async getUser(accessToken: string) {
      return await githubJson<{ id: number; login: string; avatar_url: string }>(
        "https://api.github.com/user",
        accessToken,
      );
    },

    async listUserInstallations(accessToken: string) {
      const rows=await githubCollection<{id:number}>('user/installations','installations',accessToken);
      return rows.map(row=>row.id);
    },

    async listInstallationRepositories(installationId:number){
      if(!Number.isSafeInteger(installationId)||installationId<=0)throw new Error('Invalid GitHub installation.');
      const token=await installationToken(installationId);
      const rows=await githubCollection<GithubRepo>('installation/repositories','repositories',token);
      for(const row of rows){
        if(typeof row.name!=='string'||!row.name||typeof row.full_name!=='string'||typeof row.owner?.login!=='string'||typeof row.private!=='boolean'||typeof row.html_url!=='string')
          throw new Error('GitHub returned an invalid repository listing.');
      }
      return rows;
    },

    async getApp() {
      const jwt = createAppJwt(config.githubAppId, config.githubPrivateKey);
      const body = await githubJson<{ permissions?: Record<string, string> }>(
        "https://api.github.com/app",
        jwt,
      );
      return { permissions: body.permissions ?? {} };
    },

    async getInstallation(installationId: number) {
      const jwt = createAppJwt(config.githubAppId, config.githubPrivateKey);
      const body = await githubJson<{
        id: number;
        account: { login: string; type?: string; id: number };
        suspended_at: string | null;
        created_at?: string;
        permissions?: Record<string, string>;
        repository_selection?: string | null;
        html_url?: string | null;
      }>(`https://api.github.com/app/installations/${installationId}`, jwt);
      return {
        id: body.id,
        account: body.account,
        suspended_at: body.suspended_at,
        created_at: body.created_at,
        permissions: body.permissions ?? {},
        repository_selection: body.repository_selection ?? null,
        html_url: body.html_url ?? null,
      };
    },

    async getRepo(installationId, owner, repo) {
      const token = await installationToken(installationId);
      return await githubJson<GithubRepo>(
        `https://api.github.com/repos/${owner}/${repo}`,
        token,
      );
    },

    async listAttestations(installationId, owner, repo, sha256) {
      const digest = sha256.trim().toLowerCase().replace(/^sha256:/, "");
      const token = await installationToken(installationId);
      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/attestations/sha256:${digest}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "User-Agent": "nospoilers",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );
      if (response.status === 404 || response.status === 403) {
        return { attestations: [] };
      }
      if (!response.ok) {
        const text = await response.text();
        throw new GithubApiError(
          response.status,
          `GitHub ${response.status} attestations: ${text.slice(0, 400)}`,
        );
      }
      const body = (await response.json()) as { attestations?: unknown[] };
      return { attestations: Array.isArray(body.attestations) ? body.attestations : [] };
    },

    async listReleaseAssets(installationId, owner, repo, releaseId) {
      const token = await installationToken(installationId);
      const release = await githubJson<{ assets: GithubReleaseAsset[] }>(
        `https://api.github.com/repos/${owner}/${repo}/releases/${releaseId}`,
        token,
      );
      return release.assets ?? [];
    },

    async getLatestRelease(installationId, owner, repo) {
      const token = await installationToken(installationId);
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "nospoilers",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (response.status === 404) return null;
      if (!response.ok) {
        const text = await response.text();
        throw new GithubApiError(response.status, `GitHub ${response.status}: ${text.slice(0, 400)}`);
      }
      const body = (await response.json()) as {
        id: number;
        tag_name: string;
        name: string;
        target_commitish?: string;
      };
      return {
        id: body.id,
        tag_name: body.tag_name,
        name: body.name,
        target_commitish: body.target_commitish ?? null,
      };
    },

    async downloadAsset(installationId, assetUrl, maxBytes) {
      const initial=new URL(assetUrl);
      if(initial.protocol!=='https:' || initial.hostname!=='api.github.com' || initial.port || initial.username || initial.password)
        throw new Error('GitHub asset must originate at the GitHub API.');
      const token = await installationToken(installationId);
      let response = await pinnedHttps(assetUrl, {
        headers: {
          Accept: "application/octet-stream",
          Authorization: `Bearer ${token}`,
          "User-Agent": "nospoilers",
        },
        redirect: "manual",
      },maxBytes);
      if(response.status>=300 && response.status<400){
        const redirected=new URL(response.headers.get('location')??'',assetUrl);
        const allowed=new Set(['release-assets.githubusercontent.com','objects.githubusercontent.com','github-releases.githubusercontent.com']);
        if(redirected.protocol!=='https:' || !allowed.has(redirected.hostname) || redirected.port || redirected.username || redirected.password)throw new Error('GitHub asset redirected to an unapproved host.');
        // GitHub installation credentials must never reach an asset CDN.
        response=await pinnedHttps(redirected.href,{redirect:'error'},maxBytes);
      }
      if (!response.ok) {
        throw new Error(`GitHub asset download failed (${response.status}).`);
      }
      const length = Number(response.headers.get("content-length") ?? "0");
      if (length > maxBytes) {
        throw new Error(`Asset is larger than ${maxBytes} bytes.`);
      }
      const buf = Buffer.from(await response.arrayBuffer());
      if (buf.length > maxBytes) {
        throw new Error(`Asset is larger than ${maxBytes} bytes.`);
      }
      return buf;
    },

    async getRefSha(installationId, owner, repo, ref) {
      if (!ref.trim()) return null;
      const token = await installationToken(installationId);
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "User-Agent": "nospoilers",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );
      if (githubCommitMissing(response.status) || permissionDenied(response.status)) return null;
      if (!response.ok) {
        const text = await response.text();
        throw new GithubApiError(response.status, `GitHub ${response.status}: ${text.slice(0, 400)}`);
      }
      const body = (await response.json()) as { sha?: string };
      return typeof body.sha === "string" ? body.sha : null;
    },

    async pathExists(installationId, owner, repo, filePath, ref) {
      const token = await installationToken(installationId);
      const encoded = filePath
        .replace(/^\.\//, "")
        .split("/")
        .filter(Boolean)
        .map(encodeURIComponent)
        .join("/");
      const url = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${encoded}`);
      if (ref?.trim()) url.searchParams.set("ref", ref.trim());
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "nospoilers",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (response.status === 404) return false;
      if (permissionDenied(response.status)) return false;
      if (!response.ok) {
        const text = await response.text();
        throw new GithubApiError(response.status, `GitHub ${response.status}: ${text.slice(0, 400)}`);
      }
      return true;
    },

    async listCheckRuns(installationId, owner, repo, ref) {
      if (!ref.trim()) return [];
      const token = await installationToken(installationId);
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}/check-runs`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "User-Agent": "nospoilers",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );
      if (githubCommitMissing(response.status) || permissionDenied(response.status)) return [];
      if (!response.ok) {
        const text = await response.text();
        throw new GithubApiError(response.status, `GitHub ${response.status}: ${text.slice(0, 400)}`);
      }
      const body = (await response.json()) as {
        check_runs?: Array<{ name?: string; conclusion?: string | null; html_url?: string | null }>;
      };
      return (body.check_runs ?? [])
        .filter((run) => typeof run.name === "string" && run.name.trim())
        .map((run) => ({
          name: run.name!.trim(),
          conclusion: run.conclusion ?? null,
          htmlUrl: run.html_url ?? null,
        }));
    },

    async createCheckRun(installationId, owner, repo, input) {
      const token = await installationToken(installationId);
      try {
        const body = await githubJson<{ id: number; html_url?: string | null }>(
          `https://api.github.com/repos/${owner}/${repo}/check-runs`,
          token,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: input.name,
              head_sha: input.headSha,
              status: "completed",
              conclusion: input.conclusion,
              output: {
                title: input.title.slice(0, 255),
                summary: input.summary.slice(0, 64_000),
                annotations: (input.annotations ?? []).slice(0, 50),
              },
            }),
          },
        );
        return { id: body.id, htmlUrl: body.html_url ?? null };
      } catch (error) {
        if (error instanceof GithubApiError && permissionDenied(error.status)) {
          return {
            skipped: "permission",
            reason:
              "Grant Checks write to report release scans on the commit SHA. Do not grant Administration.",
          };
        }
        throw error;
      }
    },

    async createSetupPullRequest(installationId, owner, repo) {
      const token = await installationToken(installationId);
      const install = await this.getInstallation(installationId);
      const canWriteWorkflows = hasWrite(install.permissions ?? {}, "workflows");
      const reason =
        "Grant Contents write and Pull requests write to open a setup PR. The App does not write GitHub Actions workflow YAML (Workflows write is not requested). Do not grant Administration.";
      const written: string[] = [];
      let branchReady = false;
      try {
        const repoInfo = await githubJson<{ default_branch?: string }>(
          `https://api.github.com/repos/${owner}/${repo}`,
          token,
        );
        const defaultBranch = repoInfo.default_branch?.trim() || "main";
        const baseRef = await githubJson<{ object: { sha: string } }>(
          `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
          token,
        );
        const baseSha = baseRef.object.sha;
        const created = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "User-Agent": "nospoilers",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref: `refs/heads/${SETUP_BRANCH}`, sha: baseSha }),
        });
        if (!created.ok && created.status !== 422) {
          const text = await created.text();
          throw new GithubApiError(created.status, `GitHub ${created.status}: ${text.slice(0, 400)}`);
        }
        branchReady = true;

        for (const file of setupCommitFiles(canWriteWorkflows)) {
          await putGithubFile(
            token,
            owner,
            repo,
            file.path,
            file.content,
            SETUP_BRANCH,
            setupCommitMessage(),
          );
          written.push(file.path);
        }

        const open = await githubJson<{ html_url: string; number: number }[]>(
          `https://api.github.com/repos/${owner}/${repo}/pulls?head=${encodeURIComponent(`${owner}:${SETUP_BRANCH}`)}&state=open`,
          token,
        );
        if (open[0]) {
          return { htmlUrl: open[0].html_url, number: open[0].number, existing: true };
        }

        const pull = await githubJson<{ html_url: string; number: number }>(
          `https://api.github.com/repos/${owner}/${repo}/pulls`,
          token,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: setupPullRequestTitle(),
              head: SETUP_BRANCH,
              base: defaultBranch,
              body: setupPullRequestBody(),
              draft: false,
            }),
          },
        );
        return { htmlUrl: pull.html_url, number: pull.number, existing: false };
      } catch (error) {
        if (error instanceof GithubApiError && permissionDenied(error.status)) {
          return {
            skipped: "permission",
            reason,
            written,
            ...(branchReady || written.length > 0
              ? {
                  branch: SETUP_BRANCH,
                  compareUrl: `https://github.com/${owner}/${repo}/tree/${SETUP_BRANCH}`,
                }
              : {}),
          };
        }
        throw error;
      }
    },

    async createRemediationPullRequest(installationId, owner, repo) {
      const token = await installationToken(installationId);
      const install = await this.getInstallation(installationId);
      const canWriteWorkflows = hasWrite(install.permissions ?? {}, "workflows");
      const reason =
        "Grant Contents write and Pull requests write to open a remediation PR. The App does not write GitHub Actions workflow YAML (Workflows write is not requested). Do not grant Administration.";
      const written: string[] = [];
      let branchReady = false;
      try {
        const repoInfo = await githubJson<{ default_branch?: string }>(
          `https://api.github.com/repos/${owner}/${repo}`,
          token,
        );
        const defaultBranch = repoInfo.default_branch?.trim() || "main";
        const baseRef = await githubJson<{ object: { sha: string } }>(
          `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
          token,
        );
        const baseSha = baseRef.object.sha;
        const created = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "User-Agent": "nospoilers",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref: `refs/heads/${REMEDIATION_BRANCH}`, sha: baseSha }),
        });
        if (!created.ok && created.status !== 422) {
          const text = await created.text();
          throw new GithubApiError(created.status, `GitHub ${created.status}: ${text.slice(0, 400)}`);
        }
        branchReady = true;

        const existingOnDefault: string[] = [];
        for (const file of remediationBundle()) {
          if (!isCustomerOwnedRemediationPath(file.path)) continue;
          if (await githubFileExists(token, owner, repo, file.path, defaultBranch)) {
            existingOnDefault.push(file.path);
          }
        }
        const writes = remediationCommitWrites(existingOnDefault, canWriteWorkflows);
        for (const file of writes) {
          await putGithubFile(
            token,
            owner,
            repo,
            file.path,
            file.content,
            REMEDIATION_BRANCH,
            remediationCommitMessage(),
          );
          written.push(file.path);
        }

        const open = await githubJson<{ html_url: string; number: number }[]>(
          `https://api.github.com/repos/${owner}/${repo}/pulls?head=${encodeURIComponent(`${owner}:${REMEDIATION_BRANCH}`)}&state=open`,
          token,
        );
        if (open[0]) {
          return { htmlUrl: open[0].html_url, number: open[0].number, existing: true };
        }

        const pull = await githubJson<{ html_url: string; number: number }>(
          `https://api.github.com/repos/${owner}/${repo}/pulls`,
          token,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: remediationPullRequestTitle(),
              head: REMEDIATION_BRANCH,
              base: defaultBranch,
              body: remediationPullRequestBody(),
              draft: false,
            }),
          },
        );
        return { htmlUrl: pull.html_url, number: pull.number, existing: false };
      } catch (error) {
        if (error instanceof GithubApiError && permissionDenied(error.status)) {
          return {
            skipped: "permission",
            reason,
            written,
            ...(branchReady || written.length > 0
              ? {
                  branch: REMEDIATION_BRANCH,
                  compareUrl: `https://github.com/${owner}/${repo}/tree/${REMEDIATION_BRANCH}`,
                }
              : {}),
          };
        }
        throw error;
      }
    },

    async makeRepoPrivate(installationId, owner, repo) {
      const install = await this.getInstallation(installationId);
      if (!hasWrite(install.permissions ?? {}, "administration")) {
        return { skipped: "permission", reason: ADMINISTRATION_DENIED };
      }
      const token = await installationToken(installationId);
      try {
        const current = await githubJson<{ private?: boolean; html_url?: string }>(
          `https://api.github.com/repos/${owner}/${repo}`,
          token,
        );
        if (current.private) {
          return { ok: true, detail: `${owner}/${repo} is already private.` };
        }
        await githubJson(`https://api.github.com/repos/${owner}/${repo}`, token, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ private: true }),
        });
        return { ok: true, detail: `Made ${owner}/${repo} private.` };
      } catch (error) {
        if (error instanceof GithubApiError && permissionDenied(error.status)) {
          return { skipped: "permission", reason: ADMINISTRATION_DENIED };
        }
        throw error;
      }
    },

    async deleteLatestPackAssets(installationId, owner, repo) {
      const install = await this.getInstallation(installationId);
      if (!hasWrite(install.permissions ?? {}, "administration")) {
        return { skipped: "permission", reason: ADMINISTRATION_DENIED };
      }
      try {
        const latest = await this.getLatestRelease(installationId, owner, repo);
        if (!latest) {
          return {
            skipped: "empty",
            reason: "No GitHub Release on this repository. Nothing to delete.",
          };
        }
        const assets = await this.listReleaseAssets(installationId, owner, repo, latest.id);
        const packs = assets.filter((asset) => isPackAssetName(asset.name));
        if (packs.length === 0) {
          return {
            skipped: "empty",
            reason: "The latest Release has no packed assets. Source trees are not deleted.",
          };
        }
        const token = await installationToken(installationId);
        const names: string[] = [];
        for (const asset of packs) {
          await githubJson(
            `https://api.github.com/repos/${owner}/${repo}/releases/assets/${asset.id}`,
            token,
            { method: "DELETE" },
          );
          names.push(asset.name);
        }
        return {
          ok: true,
          detail: `Removed ${names.join(", ")} from ${owner}/${repo} ${latest.tag_name}.`,
          names,
        };
      } catch (error) {
        if (error instanceof GithubApiError && permissionDenied(error.status)) {
          return { skipped: "permission", reason: ADMINISTRATION_DENIED };
        }
        throw error;
      }
    },

    async disableWorkflow(installationId, owner, repo, workflowPath) {
      const install = await this.getInstallation(installationId);
      if (!hasWrite(install.permissions ?? {}, "administration")) {
        return { skipped: "permission", reason: ADMINISTRATION_DENIED };
      }
      const file = workflowPath.replace(/^.*\//, "");
      const token = await installationToken(installationId);
      try {
        await githubJson(
          `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(file)}/disable`,
          token,
          { method: "PUT" },
        );
        return { ok: true, detail: `Disabled ${workflowPath} on ${owner}/${repo}.`, names: [workflowPath] };
      } catch (error) {
        if (error instanceof GithubApiError && permissionDenied(error.status)) {
          return { skipped: "permission", reason: ADMINISTRATION_DENIED };
        }
        throw error;
      }
    },
  };
}

async function githubFileExists(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
  ref: string,
): Promise<boolean> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(ref)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "nospoilers",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (response.status === 404) return false;
  if (!response.ok) {
    const text = await response.text();
    throw new GithubApiError(response.status, `GitHub ${response.status}: ${text.slice(0, 400)}`);
  }
  return true;
}

async function putGithubFile(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
  content: string,
  branch: string,
  message: string,
): Promise<void> {
  let fileSha: string | undefined;
  const existingFile = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "nospoilers",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (existingFile.ok) {
    const fileBody = (await existingFile.json()) as { sha?: string; content?: string; encoding?: string };
    if (typeof fileBody.sha === "string") fileSha = fileBody.sha;
    if (typeof fileBody.content === "string") {
      const decoded = Buffer.from(fileBody.content.replace(/\n/g, ""), "base64").toString("utf8");
      if (decoded === content) return;
    }
  } else if (existingFile.status !== 404) {
    const text = await existingFile.text();
    throw new GithubApiError(
      existingFile.status,
      `GitHub ${existingFile.status}: ${text.slice(0, 400)}`,
    );
  }

  try {
    await githubJson(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch,
        ...(fileSha ? { sha: fileSha } : {}),
      }),
    });
  } catch (error) {
    if (
      isGithubActionsWorkflowPath(filePath) &&
      error instanceof GithubApiError &&
      permissionDenied(error.status)
    ) {
      return;
    }
    throw error;
  }
}
