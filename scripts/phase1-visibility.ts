import { pathToFileURL } from "node:url";
import { createAppJwt } from "../src/server/github.ts";
import { loadConfig } from "../src/server/config.ts";

export const VIS_OWNER = "EmotiveImpact";
export const VIS_REPO = "nospoilers-throwaway";
export const VIS_FULL = `${VIS_OWNER}/${VIS_REPO}`;
export const PRODUCT_REPOS = ["nospoilers", "Echo"];

const INSTALL_ID = 158159401;

function github(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  return fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "nospoilers-phase1-visibility",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  }).then(async (res) => {
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text.slice(0, 240);
    }
    return { status: res.status, body };
  });
}

export function webhookUrl(appBaseUrl: string): string {
  return `${appBaseUrl.replace(/\/+$/, "")}/api/webhooks/github`;
}

export function deniedMessage(): string {
  return [
    `Cannot change visibility or collaborators on ${VIS_FULL}.`,
    "The GitHub App has Contents write. That cannot publicize a repo or add a collaborator.",
    "",
    "Publicize is private → public on this throwaway. If it is already public,",
    "use GitHub Settings → Danger zone → Private, then Public. Leave npm run dev",
    "running so the webhook can land. Do not invent nospoilers-throwaway-vis.",
    "Optional: GITHUB_PROOF_TOKEN as a fine-grained PAT for only this disposable",
    "repo with Administration + Contents write. Do not use a classic repo PAT.",
    "Do not grant the App Administration. Do not publicize a product repository.",
    "Do not transfer a repository in this proof.",
    "",
  ].join("\n");
}

async function appJwt(): Promise<string | null> {
  const config = loadConfig();
  if (!config.githubAppId || !config.githubPrivateKey) return null;
  return createAppJwt(config.githubAppId, config.githubPrivateKey);
}

async function installationToken(): Promise<string | null> {
  const jwt = await appJwt();
  if (!jwt) return null;
  const minted = await github(
    jwt,
    `https://api.github.com/app/installations/${INSTALL_ID}/access_tokens`,
    { method: "POST" },
  );
  const token = (minted.body as { token?: string }).token;
  return minted.status < 300 && token ? token : null;
}

function proofToken(): string {
  loadConfig();
  return (process.env.GITHUB_PROOF_TOKEN ?? "").trim();
}

async function pointWebhook(): Promise<{ url: string; updated: boolean }> {
  const config = loadConfig();
  const jwt = await appJwt();
  if (!jwt) throw new Error("GitHub App JWT is missing.");
  const want = webhookUrl(config.appBaseUrl);
  const current = await github(jwt, "https://api.github.com/app/hook/config");
  const have = (current.body as { url?: string }).url ?? "";
  if (current.status >= 300) {
    throw new Error(`Could not read App webhook: ${current.status} ${JSON.stringify(current.body).slice(0, 200)}`);
  }
  if (have === want) return { url: have, updated: false };
  if (!config.appBaseUrl.startsWith("https://")) {
    throw new Error(`APP_BASE_URL must be https for GitHub to deliver. Have ${config.appBaseUrl}`);
  }
  const patched = await github(jwt, "https://api.github.com/app/hook/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: want, content_type: "json" }),
  });
  if (patched.status >= 300) {
    throw new Error(`Could not point App webhook: ${patched.status} ${JSON.stringify(patched.body).slice(0, 200)}`);
  }
  return { url: want, updated: true };
}

async function publicize(token: string): Promise<{ status: number; private: boolean | null }> {
  if (PRODUCT_REPOS.includes(VIS_REPO)) {
    throw new Error("Refusing to publicize a product repository.");
  }
  const patched = await github(token, `https://api.github.com/repos/${VIS_FULL}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ private: false }),
  });
  const row = patched.body as { private?: boolean; message?: string };
  return { status: patched.status, private: typeof row.private === "boolean" ? row.private : null };
}

export async function main(): Promise<void> {
  const hook = await pointWebhook();
  process.stdout.write(
    hook.updated ? `pointed GitHub App webhook at ${hook.url}\n` : `GitHub App webhook already ${hook.url}\n`,
  );

  const proof = proofToken();
  const token = proof || (await installationToken());
  if (!token) {
    process.stderr.write(deniedMessage());
    process.exitCode = 2;
    return;
  }

  const result = await publicize(token);
  if (result.status === 200 && result.private === false) {
    process.stdout.write(`publicized ${VIS_FULL}. Wait for repo_publicized on Watch.\n`);
    return;
  }
  process.stdout.write(
    `publicize ${VIS_FULL} returned ${result.status} (private=${String(result.private)}).\n`,
  );
  if (!proof) {
    process.stderr.write(deniedMessage());
    process.exitCode = 2;
  }
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
