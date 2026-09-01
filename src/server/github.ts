import { createSign } from "node:crypto";
import type { AppConfig } from "./config.ts";
import {
  SETUP_BRANCH,
  SETUP_WORKFLOW_PATH,
  setupCommitMessage,
  setupPullRequestBody,
  setupPullRequestTitle,
  setupWorkflowYaml,
} from "./setup-workflow.ts";

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

export type GithubSetupPrResult =
  | { skipped: "permission"; reason: string }
  | { htmlUrl: string; number: number; existing: boolean };

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
  getInstallation: (installationId: number) => Promise<{
    id: number;
    account: { login: string; type?: string; id: number };
    suspended_at: string | null;
  }>;
  getRepo: (installationId: number, owner: string, repo: string) => Promise<GithubRepo>;
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
};

export function skippedGithubWrites(): Pick<
  GithubPort,
  "getRefSha" | "createCheckRun" | "createSetupPullRequest"
> {
  const reason =
    "Grant Contents write and Pull requests write to open a setup PR. Grant Checks write to report release scans. Do not grant Administration.";
  return {
    getRefSha: async () => null,
    createCheckRun: async () => ({ skipped: "permission", reason }),
    createSetupPullRequest: async () => ({ skipped: "permission", reason }),
  };
}

function permissionDenied(status: number): boolean {
  return status === 403 || status === 404;
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
      const body = await githubJson<{ installations: { id: number }[] }>(
        "https://api.github.com/user/installations",
        accessToken,
      );
      return body.installations.map((row) => row.id);
    },

    async getInstallation(installationId: number) {
      const jwt = createAppJwt(config.githubAppId, config.githubPrivateKey);
      return await githubJson<{
        id: number;
        account: { login: string; type?: string; id: number };
        suspended_at: string | null;
      }>(`https://api.github.com/app/installations/${installationId}`, jwt);
    },

    async getRepo(installationId, owner, repo) {
      const token = await installationToken(installationId);
      return await githubJson<GithubRepo>(
        `https://api.github.com/repos/${owner}/${repo}`,
        token,
      );
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
      const token = await installationToken(installationId);
      const response = await fetch(assetUrl, {
        headers: {
          Accept: "application/octet-stream",
          Authorization: `Bearer ${token}`,
          "User-Agent": "nospoilers",
        },
        redirect: "follow",
      });
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
      if (response.status === 404) return null;
      if (!response.ok) {
        const text = await response.text();
        if (permissionDenied(response.status)) return null;
        throw new GithubApiError(response.status, `GitHub ${response.status}: ${text.slice(0, 400)}`);
      }
      const body = (await response.json()) as { sha?: string };
      return typeof body.sha === "string" ? body.sha : null;
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
      const reason =
        "Grant Contents write and Pull requests write to open a setup PR. Do not grant Administration.";
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

        let fileSha: string | undefined;
        const existingFile = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${SETUP_WORKFLOW_PATH}?ref=${encodeURIComponent(SETUP_BRANCH)}`,
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
          const fileBody = (await existingFile.json()) as { sha?: string };
          if (typeof fileBody.sha === "string") fileSha = fileBody.sha;
        } else if (existingFile.status !== 404) {
          const text = await existingFile.text();
          throw new GithubApiError(
            existingFile.status,
            `GitHub ${existingFile.status}: ${text.slice(0, 400)}`,
          );
        }

        await githubJson(`https://api.github.com/repos/${owner}/${repo}/contents/${SETUP_WORKFLOW_PATH}`, token, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: setupCommitMessage(),
            content: Buffer.from(setupWorkflowYaml(), "utf8").toString("base64"),
            branch: SETUP_BRANCH,
            ...(fileSha ? { sha: fileSha } : {}),
          }),
        });

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
          return { skipped: "permission", reason };
        }
        throw error;
      }
    },
  };
}
