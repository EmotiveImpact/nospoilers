import { createHash } from "node:crypto";
import type { Store } from "./store.ts";
import { logJson } from "./log.ts";
import { cheapSensitivePaths, isScannablePackAssetName, pathsFromPushPayload } from "./paths.ts";
import {
  describeInstallHealth,
  namesFromRepoList,
  type InstallHealthKind,
} from "./install-health.ts";

type Json = Record<string, unknown>;

function obj(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function bool(value: unknown): boolean {
  return Boolean(value);
}

export function packAssetFingerprint(assets: unknown): string {
  if (!Array.isArray(assets)) return "empty";
  const rows = assets
    .filter((asset): asset is Record<string, unknown> => Boolean(asset) && typeof asset === "object")
    .filter((asset) => isScannablePackAssetName(String(asset.name ?? "")))
    .map((asset) => ({
      id: asset.id ?? "",
      name: String(asset.name ?? ""),
      size: asset.size ?? "",
      digest: String(asset.digest ?? ""),
    }))
    .sort(
      (left, right) =>
        String(left.id).localeCompare(String(right.id)) || left.name.localeCompare(right.name),
    );
  if (rows.length === 0) return "empty";
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 16);
}

export function releaseScanDeliveryId(
  installationId: number,
  releaseId: number,
  fingerprint: string,
): string {
  return `release-scan:${installationId}:${releaseId}:${fingerprint}`;
}

function repoFrom(payload: Json): {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
} | null {
  const repository = obj(payload.repository);
  if (!repository.id) return null;
  const owner = obj(repository.owner);
  return {
    id: num(repository.id),
    owner: str(owner.login),
    name: str(repository.name),
    fullName: str(repository.full_name),
    private: bool(repository.private),
    htmlUrl: str(repository.html_url),
  };
}

function installationIdOf(payload: Json): number | null {
  const installation = obj(payload.installation);
  if (installation.id === undefined) return null;
  return num(installation.id);
}

async function ensureInstallation(store: Store, payload: Json): Promise<number | null> {
  const id = installationIdOf(payload);
  if (id === null) return null;
  const installation = obj(payload.installation);
  const account = obj(installation.account);
  const repository = obj(payload.repository);
  const owner = obj(repository.owner);
  await store.upsertInstallation({
    id,
    accountLogin: str(account.login) || str(owner.login) || "unknown",
    accountType: str(account.type) || "User",
    accountId: num(account.id) || 0,
  });
  return id;
}

async function rememberRepo(store: Store, installationId: number, payload: Json): Promise<void> {
  const repo = repoFrom(payload);
  if (!repo) return;
  await store.upsertRepo({
    id: repo.id,
    installationId,
    owner: repo.owner,
    name: repo.name,
    fullName: repo.fullName,
    private: repo.private,
    htmlUrl: repo.htmlUrl,
  });
}

async function recordInstallHealth(
  store: Store,
  input: {
    installationId: number;
    deliveryId: string;
    kind: InstallHealthKind;
    accountLogin: string;
    repos?: string[];
  },
): Promise<void> {
  if (!(await store.installationHasCoverage(input.installationId))) return;
  const described = describeInstallHealth({
    kind: input.kind,
    accountLogin: input.accountLogin,
    repos: input.repos,
  });
  await store.insertAlert({
    installationId: input.installationId,
    kind: input.kind,
    title: described.title,
    body: described.body,
    githubDeliveryId: `${input.deliveryId}:${input.kind}`,
  });
}

async function enqueueCovered(
  store: Store,
  installationId: number,
  input: {
    deliveryId: string;
    priority: "light" | "heavy";
    kind: string;
    payload: unknown;
  },
): Promise<{ queued: boolean; kind: string; skipped?: "uncovered" | "fair_use" }> {
  if (!(await store.installationWorkAllowed(installationId))) {
    return { queued: false, kind: input.kind, skipped: "uncovered" };
  }
  const result = await store.enqueueJob(input);
  if (result.skipped === "fair_use") {
    await store.noteFairUseExhausted(installationId);
    return { queued: false, kind: input.kind, skipped: "fair_use" };
  }
  return { queued: result.inserted, kind: input.kind };
}

async function renameInstallationTarget(
  store: Store,
  payload: Json,
): Promise<{ queued: boolean; kind: string }> {
  if (str(payload.action) !== "renamed") {
    return { queued: false, kind: "installation_target" };
  }
  const id = installationIdOf(payload);
  if (id === null) return { queued: false, kind: "installation_target" };
  const existing = await store.getInstallation(id);
  if (!existing) return { queued: false, kind: "installation_target" };

  const account = obj(payload.account);
  const installAccount = obj(obj(payload.installation).account);
  const login =
    str(account.login) ||
    str(account.slug) ||
    str(installAccount.login) ||
    str(installAccount.slug);
  if (!login) return { queued: false, kind: "installation_target" };

  const type =
    str(account.type) ||
    str(payload.target_type) ||
    str(installAccount.type) ||
    existing.account_type;
  const accountIdRaw = num(account.id) || num(installAccount.id);
  const accountId =
    Number.isFinite(accountIdRaw) && accountIdRaw > 0 ? accountIdRaw : existing.account_id;

  await store.upsertInstallation({
    id,
    accountLogin: login,
    accountType: type || "User",
    accountId,
    suspended: existing.suspended,
  });
  logJson("info", "installation_target.renamed", { installationId: id });
  return { queued: false, kind: "installation_target" };
}

async function revokeGithubAppAuthorization(
  store: Store,
  payload: Json,
): Promise<{ queued: boolean; kind: string }> {
  if (str(payload.action) !== "revoked") {
    return { queued: false, kind: "github_app_authorization" };
  }
  const senderId = num(obj(payload.sender).id);
  if (!Number.isFinite(senderId) || senderId <= 0) {
    return { queued: false, kind: "github_app_authorization" };
  }
  const userId = String(senderId);
  if (!(await store.userExists(userId))) {
    return { queued: false, kind: "github_app_authorization" };
  }
  await store.deleteUserSessions(userId);
  await store.clearUserAccessToken(userId);
  logJson("info", "github_app_authorization.revoked", { userId });
  return { queued: false, kind: "github_app_authorization" };
}

export async function enqueueFromWebhook(
  store: Store,
  event: string,
  deliveryId: string,
  payload: Json,
): Promise<{ queued: boolean; kind: string | null; skipped?: "uncovered" | "fair_use" }> {
  if (event === "ping") return { queued: false, kind: "ping" };

  if (event === "github_app_authorization") {
    return await revokeGithubAppAuthorization(store, payload);
  }

  if (event === "installation_target") {
    return await renameInstallationTarget(store, payload);
  }

  const installationId = await ensureInstallation(store, payload);

  if (event === "installation") {
    const action = str(payload.action);
    const installation = obj(payload.installation);
    const account = obj(installation.account);
    const id = num(installation.id);
    const accountLogin = str(account.login) || "unknown";
    if (action === "deleted") {
      await store.deleteInstallation(id);
      return { queued: false, kind: event };
    }
    if (action === "suspend") {
      await store.upsertInstallation({
        id,
        accountLogin,
        accountType: str(account.type) || "User",
        accountId: num(account.id),
        suspended: true,
      });
      await recordInstallHealth(store, {
        installationId: id,
        deliveryId,
        kind: "app_suspended",
        accountLogin,
      });
      return { queued: false, kind: event };
    }
    await store.upsertInstallation({
      id,
      accountLogin,
      accountType: str(account.type) || "User",
      accountId: num(account.id),
      suspended: action === "unsuspend" ? false : bool(installation.suspended),
      reconnect:action==='created',
    });
    const repos = Array.isArray(payload.repositories) ? payload.repositories : [];
    for (const raw of repos) {
      const row = obj(raw);
      const fullName = str(row.full_name);
      const [owner, name] = fullName.split("/");
      await store.upsertRepo({
        id: num(row.id),
        installationId: id,
        owner: owner ?? "",
        name: name ?? str(row.name),
        fullName,
        private: bool(row.private),
        htmlUrl: str(row.html_url) || `https://github.com/${fullName}`,
      });
    }
    if (action === "unsuspend") {
      await recordInstallHealth(store, {
        installationId: id,
        deliveryId,
        kind: "app_unsuspended",
        accountLogin,
      });
    } else if (action === "new_permissions_accepted") {
      await recordInstallHealth(store, {
        installationId: id,
        deliveryId,
        kind: "app_permissions_updated",
        accountLogin,
      });
    }
    return { queued: false, kind: event };
  }

  if (event === "installation_repositories") {
    const id = await ensureInstallation(store, payload);
    if (id === null) return { queued: false, kind: event };
    const added = Array.isArray(payload.repositories_added) ? payload.repositories_added : [];
    const removed = Array.isArray(payload.repositories_removed) ? payload.repositories_removed : [];
    for (const raw of added) {
      const row = obj(raw);
      const fullName = str(row.full_name);
      const [owner, name] = fullName.split("/");
      await store.upsertRepo({
        id: num(row.id),
        installationId: id,
        reconnect: true,
        owner: owner ?? "",
        name: name ?? str(row.name),
        fullName,
        private: bool(row.private),
        htmlUrl: str(row.html_url) || `https://github.com/${fullName}`,
      });
    }
    for (const raw of removed) {
      await store.removeRepo(num(obj(raw).id),id);
    }
    const account = obj(obj(payload.installation).account);
    const accountLogin = str(account.login) || "unknown";
    const addedNames = namesFromRepoList(added);
    const removedNames = namesFromRepoList(removed);
    if (addedNames.length > 0) {
      await recordInstallHealth(store, {
        installationId: id,
        deliveryId,
        kind: "repos_added",
        accountLogin,
        repos: addedNames,
      });
    }
    if (removedNames.length > 0) {
      await recordInstallHealth(store, {
        installationId: id,
        deliveryId,
        kind: "repos_removed",
        accountLogin,
        repos: removedNames,
      });
    }
    return { queued: false, kind: event };
  }

  if (installationId === null) return { queued: false, kind: null };

  if (event === "repository" || event === "public") {
    const action = event === "public" ? "publicized" : str(payload.action);
    const repo = repoFrom(payload);
    if (!repo) return { queued: false, kind: event };

    if (action === "deleted") {
      await store.removeRepo(repo.id,installationId);
      return { queued: false, kind: "repo_deleted" };
    }

    await rememberRepo(store, installationId, payload);

    let kind: string | null = null;
    if (action === "publicized") kind = "repo_publicized";
    else if (action === "created" && !repo.private) kind = "repo_created_public";
    else if (action === "transferred") kind = "repo_transferred";
    if (!kind) return { queued: false, kind: action };

    return await enqueueCovered(store, installationId, {
      deliveryId,
      priority: "light",
      kind,
      payload: { installationId, repo },
    });
  }

  if (event === "member") {
    await rememberRepo(store, installationId, payload);
    if (str(payload.action) !== "added") return { queued: false, kind: event };
    const member = obj(payload.member);
    const repo = repoFrom(payload);
    return await enqueueCovered(store, installationId, {
      deliveryId,
      priority: "light",
      kind: "member_added",
      payload: { installationId, repo, login: str(member.login) },
    });
  }

  if (event === "fork") {
    await rememberRepo(store, installationId, payload);
    const forkee = obj(payload.forkee);
    const repo = repoFrom(payload);
    return await enqueueCovered(store, installationId, {
      deliveryId,
      priority: "light",
      kind: "fork",
      payload: {
        installationId,
        repo,
        fork: str(forkee.full_name),
      },
    });
  }

  if (event === "release") {
    await rememberRepo(store, installationId, payload);
    const action = str(payload.action);
    const release = obj(payload.release);
    const repo = repoFrom(payload);
    const releaseId = num(release.id);
    const tag = str(release.tag_name);
    if (!repo || !Number.isFinite(releaseId) || releaseId <= 0 || !tag) {
      return { queued: false, kind: event };
    }
    const releaseName = str(release.name) || tag;

    if (action === "unpublished" || action === "deleted") {
      const kind = action === "unpublished" ? "release_unpublished" : "release_deleted";
      return await enqueueCovered(store, installationId, {
        deliveryId: `${kind}:${installationId}:${releaseId}`,
        priority: "light",
        kind,
        payload: {
          installationId,
          repo,
          releaseId,
          tag,
          name: releaseName,
        },
      });
    }

    const scanActions = new Set(["published", "edited", "prereleased", "released"]);
    if (!scanActions.has(action)) {
      return { queued: false, kind: event };
    }

    const fingerprint = packAssetFingerprint(release.assets);
    if (action !== "published" && fingerprint === "empty") {
      return { queued: false, kind: "release_scan" };
    }

    return await enqueueCovered(store, installationId, {
      deliveryId: releaseScanDeliveryId(installationId, releaseId, fingerprint),
      priority: fingerprint === "empty" ? "light" : "heavy",
      kind: "release_scan",
      payload: {
        installationId,
        repo,
        releaseId,
        tag,
        name: releaseName,
        targetCommitish: str(release.target_commitish),
      },
    });
  }

  if (event === "push") {
    await rememberRepo(store, installationId, payload);
    const hits = cheapSensitivePaths(pathsFromPushPayload(payload as { commits?: { added?: string[] }[] }));
    if (hits.length === 0) return { queued: false, kind: "push_ignored" };
    const repo = repoFrom(payload);
    return await enqueueCovered(store, installationId, {
      deliveryId,
      priority: "light",
      kind: "push_sensitive_path",
      payload: { installationId, repo, paths: hits, ref: str(payload.ref) },
    });
  }

  return { queued: false, kind: event };
}
