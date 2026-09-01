import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/server/config.ts";

const OWNER = "EmotiveImpact";
const REPO = "nospoilers-throwaway";
const FULL = `${OWNER}/${REPO}`;

function proofToken(): string {
  loadConfig();
  return (process.env.GITHUB_PROOF_TOKEN ?? "").trim();
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

async function attachFixture(
  token: string,
  uploadUrl: string,
  bytes: Buffer,
): Promise<void> {
  const uploadBase = uploadUrl.replace(/\{.*\}$/, "");
  const upload = await fetch(`${uploadBase}?name=sourcemap.tgz`, {
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
  const listed = await github(token, `https://api.github.com/repos/${FULL}/releases/tags/phase1-fixture`);
  if (listed.status === 404) return null;
  if (listed.status >= 300) {
    const message = (listed.body as { message?: string }).message ?? String(listed.status);
    throw new Error(`Could not read release phase1-fixture: ${message}`);
  }
  return listed.body as { upload_url?: string; assets?: { name?: string }[] };
}

async function main(): Promise<void> {
  const token = proofToken();
  if (!token) {
    process.stderr.write(
      [
        "GITHUB_PROOF_TOKEN is missing.",
        `Create private ${FULL} on GitHub, or add a fine-grained PAT for only that repo`,
        "(Administration + Contents write) as GITHUB_PROOF_TOKEN.",
        "Do not use a classic repo PAT. Do not publicize a product repository.",
        "",
      ].join("\n"),
    );
    process.exit(2);
  }

  const got = await github(token, `https://api.github.com/repos/${FULL}`);
  const existing = got.body as { message?: string; private?: boolean; full_name?: string };
  if (got.status === 404) {
    const created = await github(token, "https://api.github.com/user/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: REPO,
        private: true,
        auto_init: true,
        description: "Disposable NoSpoilers Phase 1 proof. Safe to publicize.",
      }),
    });
    if (created.status >= 300) {
      const message = (created.body as { message?: string }).message ?? String(created.status);
      throw new Error(`Could not create ${FULL}: ${message}`);
    }
    process.stdout.write(`created private ${FULL}\n`);
  } else if (got.status !== 200) {
    throw new Error(`Could not read ${FULL}: ${existing.message ?? got.status}`);
  } else if (existing.full_name && existing.full_name.toLowerCase() !== FULL.toLowerCase()) {
    throw new Error("Refusing to operate on any repository except EmotiveImpact/nospoilers-throwaway.");
  }

  const current = await github(token, `https://api.github.com/repos/${FULL}`);
  const repo = current.body as { private?: boolean };
  if (repo.private) {
    const pub = await github(token, `https://api.github.com/repos/${FULL}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ private: false }),
    });
    if (pub.status >= 300) {
      const message = (pub.body as { message?: string }).message ?? String(pub.status);
      throw new Error(`Could not publicize ${FULL}: ${message}`);
    }
    process.stdout.write(`publicized ${FULL}\n`);
  } else {
    process.stdout.write(`${FULL} is already public\n`);
  }

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const fixture = path.join(root, "fixtures", "sourcemap.tgz");
  const bytes = await readFile(fixture);
  const release = await github(token, `https://api.github.com/repos/${FULL}/releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tag_name: "phase1-fixture",
      name: "phase1-fixture",
      body: "NoSpoilers throwaway fixture. Not a product release.",
    }),
  });
  const releaseBody = release.body as {
    message?: string;
    errors?: unknown;
    upload_url?: string;
    id?: number;
    assets?: { name?: string }[];
  };
  let uploadUrl = releaseBody.upload_url;
  if (release.status === 422) {
    const found = await existingRelease(token);
    if (!found?.upload_url) {
      throw new Error("Release phase1-fixture already exists but has no upload URL.");
    }
    const names = (found.assets ?? []).map((asset) => asset.name ?? "");
    if (names.includes("sourcemap.tgz")) {
      process.stdout.write("release phase1-fixture already has sourcemap.tgz\n");
      return;
    }
    uploadUrl = found.upload_url;
    process.stdout.write("release phase1-fixture exists; attaching missing fixture\n");
  } else if (release.status >= 300 || !uploadUrl) {
    throw new Error(`Could not create release: ${releaseBody.message ?? release.status}`);
  }
  if (!uploadUrl) {
    throw new Error("Release upload URL missing.");
  }
  await attachFixture(token, uploadUrl, bytes);
  process.stdout.write(`attached fixtures/sourcemap.tgz to ${FULL} release phase1-fixture\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
