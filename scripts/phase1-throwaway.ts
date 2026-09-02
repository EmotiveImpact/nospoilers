import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createAppJwt } from "../src/server/github.ts";
import { loadConfig } from "../src/server/config.ts";

export const THROWAWAY_OWNER = "EmotiveImpact";
export const THROWAWAY_REPO = "nospoilers-throwaway";
export const THROWAWAY_FULL = `${THROWAWAY_OWNER}/${THROWAWAY_REPO}`;
export const THROWAWAY_RELEASE_TAG = "phase1-fixture";
export const THROWAWAY_ASSET = "sourcemap.tgz";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function writeDeniedMessage(): string {
  return [
    `Cannot write ${THROWAWAY_FULL}.`,
    "The GitHub App currently has Contents: read. That can download a Release pack;",
    "it cannot create commits or Release assets.",
    "",
    "Grant Contents: write on the GitHub App (NoSpoilers-dev), then re-run",
    "`npm run phase1:throwaway`. Also grant Pull requests write and Checks write if you",
    "want live setup/remediation PRs and hosted Checks.",
    "",
    "Do not grant Administration. Administration is GitHub repo-admin (make private,",
    "delete Release assets, disable workflows, change settings). NoSpoilers does not",
    "use that permission.",
    "",
    "Or set GITHUB_PROOF_TOKEN to a fine-grained PAT for only this throwaway repo",
    "with Contents: write. Do not use a classic repo PAT. Do not publicize a product repository.",
    "",
  ].join("\n");
}

export async function listThrowawayFiles(): Promise<{ path: string; bytes: Buffer }[]> {
  return walk(path.join(root, "throwaway"));
}

async function walk(dir: string, prefix = ""): Promise<{ path: string; bytes: Buffer }[]> {
  const out: { path: string; bytes: Buffer }[] = [];
  for (const name of await readdir(dir)) {
    if (name === ".DS_Store") continue;
    const rel = prefix ? `${prefix}/${name}` : name;
    const abs = path.join(dir, name);
    const st = await stat(abs);
    if (st.isDirectory()) out.push(...(await walk(abs, rel)));
    else if (rel.startsWith(".github/workflows/")) {
      // Contents write cannot create GitHub Actions YAML. That needs a separate
      // Workflows permission. Do not request it. The API release below is enough.
      continue;
    } else out.push({ path: rel, bytes: await readFile(abs) });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

async function github(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "nospoilers-phase1",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    body = text.slice(0, 200);
  }
  return { status: res.status, body };
}

async function installationWriteToken(): Promise<string | null> {
  const config = loadConfig();
  if (!config.githubAppId || !config.githubPrivateKey) return null;
  const jwt = createAppJwt(config.githubAppId, config.githubPrivateKey);
  const listed = await github(jwt, "https://api.github.com/app/installations?per_page=100");
  if (listed.status >= 300 || !Array.isArray(listed.body)) return null;
  const install = (
    listed.body as {
      id: number;
      account?: { login?: string };
      permissions?: Record<string, string>;
    }[]
  ).find((row) => row.account?.login?.toLowerCase() === THROWAWAY_OWNER.toLowerCase());
  if (!install) return null;
  if ((install.permissions?.contents ?? "none") !== "write") return null;
  const minted = await github(
    jwt,
    `https://api.github.com/app/installations/${install.id}/access_tokens`,
    { method: "POST" },
  );
  const token = (minted.body as { token?: string }).token;
  return minted.status < 300 && token ? token : null;
}

function proofToken(): string {
  loadConfig();
  return (process.env.GITHUB_PROOF_TOKEN ?? "").trim();
}

async function writeToken(): Promise<string | null> {
  const proof = proofToken();
  if (proof) return proof;
  return installationWriteToken();
}

async function putFile(token: string, rel: string, bytes: Buffer): Promise<"created" | "updated" | "same"> {
  const api = `https://api.github.com/repos/${THROWAWAY_FULL}/contents/${rel}`;
  const existing = await github(token, `${api}?ref=main`);
  const content = bytes.toString("base64");
  if (existing.status === 200) {
    const row = existing.body as { sha?: string; content?: string; encoding?: string };
    const current = row.encoding === "base64" ? Buffer.from(row.content ?? "", "base64") : null;
    if (current && current.equals(bytes)) return "same";
    const put = await github(token, api, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Update ${rel} for Phase 1 throwaway fixture.`,
        content,
        sha: row.sha,
        branch: "main",
      }),
    });
    if (put.status >= 300) {
      throw new Error(`Could not update ${rel}: ${put.status} ${JSON.stringify(put.body).slice(0, 200)}`);
    }
    return "updated";
  }
  const put = await github(token, api, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Add ${rel} for Phase 1 throwaway fixture.`,
      content,
      branch: "main",
    }),
  });
  if (put.status >= 300) {
    throw new Error(`Could not create ${rel}: ${put.status} ${JSON.stringify(put.body).slice(0, 200)}`);
  }
  return "created";
}

async function attachFixture(token: string, uploadUrl: string, bytes: Buffer): Promise<void> {
  const uploadBase = uploadUrl.replace(/\{.*\}$/, "");
  const upload = await fetch(`${uploadBase}?name=${THROWAWAY_ASSET}`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "User-Agent": "nospoilers-phase1",
    },
    body: bytes,
  });
  if (!upload.ok) {
    const text = await upload.text();
    throw new Error(`Could not attach fixture: ${upload.status} ${text.slice(0, 200)}`);
  }
}

async function existingRelease(
  token: string,
): Promise<{ upload_url?: string; assets?: { name?: string }[] } | null> {
  const listed = await github(
    token,
    `https://api.github.com/repos/${THROWAWAY_FULL}/releases/tags/${THROWAWAY_RELEASE_TAG}`,
  );
  if (listed.status === 404) return null;
  if (listed.status >= 300) {
    const message = (listed.body as { message?: string }).message ?? String(listed.status);
    throw new Error(`Could not read release ${THROWAWAY_RELEASE_TAG}: ${message}`);
  }
  return listed.body as { upload_url?: string; assets?: { name?: string }[] };
}

async function publishRelease(token: string): Promise<void> {
  const bytes = await readFile(path.join(root, "fixtures", THROWAWAY_ASSET));
  const release = await github(token, `https://api.github.com/repos/${THROWAWAY_FULL}/releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tag_name: THROWAWAY_RELEASE_TAG,
      name: THROWAWAY_RELEASE_TAG,
      body: "NoSpoilers throwaway fixture. Not a product release.",
    }),
  });
  const releaseBody = release.body as {
    message?: string;
    upload_url?: string;
    assets?: { name?: string }[];
  };
  let uploadUrl = releaseBody.upload_url;
  if (release.status === 422) {
    const found = await existingRelease(token);
    if (!found?.upload_url) {
      throw new Error(`Release ${THROWAWAY_RELEASE_TAG} already exists but has no upload URL.`);
    }
    const names = (found.assets ?? []).map((asset) => asset.name ?? "");
    if (names.includes(THROWAWAY_ASSET)) {
      process.stdout.write(`release ${THROWAWAY_RELEASE_TAG} already has ${THROWAWAY_ASSET}\n`);
      return;
    }
    uploadUrl = found.upload_url;
    process.stdout.write(`release ${THROWAWAY_RELEASE_TAG} exists; attaching missing fixture\n`);
  } else if (release.status >= 300 || !uploadUrl) {
    throw new Error(`Could not create release: ${releaseBody.message ?? release.status}`);
  }
  if (!uploadUrl) throw new Error("Release upload URL missing.");
  await attachFixture(token, uploadUrl, bytes);
  process.stdout.write(`attached fixtures/${THROWAWAY_ASSET} to ${THROWAWAY_FULL} release ${THROWAWAY_RELEASE_TAG}\n`);
}

export async function main(): Promise<void> {
  const token = await writeToken();
  if (!token) {
    process.stderr.write(writeDeniedMessage());
    process.exitCode = 2;
    return;
  }

  const got = await github(token, `https://api.github.com/repos/${THROWAWAY_FULL}`);
  const existing = got.body as { message?: string; private?: boolean; full_name?: string };
  if (got.status === 404) {
    process.stderr.write(
      [
        `${THROWAWAY_FULL} does not exist.`,
        "Create that public disposable repo on GitHub (do not publicize a product repository),",
        "then re-run `npm run phase1:throwaway`.",
        "",
      ].join("\n"),
    );
    process.exitCode = 2;
    return;
  }
  if (got.status !== 200) {
    throw new Error(`Could not read ${THROWAWAY_FULL}: ${existing.message ?? got.status}`);
  }
  if (existing.full_name && existing.full_name.toLowerCase() !== THROWAWAY_FULL.toLowerCase()) {
    throw new Error(`Refusing to operate on any repository except ${THROWAWAY_FULL}.`);
  }
  if (existing.private) {
    process.stdout.write(
      `${THROWAWAY_FULL} is still private. Change visibility to public in GitHub yourself.\n`,
    );
    process.stdout.write("That uses your account. The App does not need Administration.\n");
  } else {
    process.stdout.write(`${THROWAWAY_FULL} is already public\n`);
  }

  const files = await listThrowawayFiles();
  for (const file of files) {
    const result = await putFile(token, file.path, file.bytes);
    process.stdout.write(`${result} ${file.path}\n`);
  }

  await publishRelease(token);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
