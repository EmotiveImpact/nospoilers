import { createSign } from "node:crypto";
import type { AppConfig } from "./config.ts";

export type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  owner: { login: string };
};

export type GithubReleaseAsset = {
  id: number;
  name: string;
  size: number;
  url: string;
};

export type GithubPort = {
  exchangeCode: (code: string) => Promise<string>;
  getUser: (accessToken: string) => Promise<{ id: number; login: string; avatar_url: string }>;
  listUserInstallations: (accessToken: string) => Promise<number[]>;
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
  ) => Promise<{ id: number; tag_name: string; name: string } | null>;
  downloadAsset: (installationId: number, assetUrl: string, maxBytes: number) => Promise<Buffer>;
};

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
    throw new Error(`GitHub ${response.status} ${url}: ${text.slice(0, 400)}`);
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
        throw new Error(`GitHub ${response.status}: ${text.slice(0, 400)}`);
      }
      return (await response.json()) as { id: number; tag_name: string; name: string };
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
  };
}
