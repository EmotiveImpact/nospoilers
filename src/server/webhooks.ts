import type { Store } from "./store.ts";
import { cheapSensitivePaths, pathsFromPushPayload } from "./paths.ts";

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
    suspended: bool(installation.suspended),
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

export async function enqueueFromWebhook(
  store: Store,
  event: string,
  deliveryId: string,
  payload: Json,
): Promise<{ queued: boolean; kind: string | null }> {
  if (event === "ping") return { queued: false, kind: "ping" };

  const installationId = await ensureInstallation(store, payload);

  if (event === "installation") {
    const action = str(payload.action);
    const installation = obj(payload.installation);
    const account = obj(installation.account);
    const id = num(installation.id);
    if (action === "deleted" || action === "suspend") {
      if (action === "deleted") await store.deleteInstallation(id);
      else {
        await store.upsertInstallation({
          id,
          accountLogin: str(account.login),
          accountType: str(account.type) || "User",
          accountId: num(account.id),
          suspended: true,
        });
      }
      return { queued: false, kind: event };
    }
    await store.upsertInstallation({
      id,
      accountLogin: str(account.login),
      accountType: str(account.type) || "User",
      accountId: num(account.id),
      suspended: action === "unsuspend" ? false : bool(installation.suspended),
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
        owner: owner ?? "",
        name: name ?? str(row.name),
        fullName,
        private: bool(row.private),
        htmlUrl: str(row.html_url) || `https://github.com/${fullName}`,
      });
    }
    for (const raw of removed) {
      await store.removeRepo(num(obj(raw).id));
    }
    return { queued: false, kind: event };
  }

  if (installationId === null) return { queued: false, kind: null };

  if (event === "repository" || event === "public") {
    await rememberRepo(store, installationId, payload);
    const action = event === "public" ? "publicized" : str(payload.action);
    const repo = repoFrom(payload);
    if (!repo) return { queued: false, kind: event };

    let kind: string | null = null;
    if (action === "publicized") kind = "repo_publicized";
    else if (action === "created" && !repo.private) kind = "repo_created_public";
    else if (action === "transferred") kind = "repo_transferred";
    if (!kind) return { queued: false, kind: action };

    const result = await store.enqueueJob({
      deliveryId,
      priority: "light",
      kind,
      payload: { installationId, repo },
    });
    return { queued: result.inserted, kind };
  }

  if (event === "member") {
    await rememberRepo(store, installationId, payload);
    if (str(payload.action) !== "added") return { queued: false, kind: event };
    const member = obj(payload.member);
    const repo = repoFrom(payload);
    const result = await store.enqueueJob({
      deliveryId,
      priority: "light",
      kind: "member_added",
      payload: { installationId, repo, login: str(member.login) },
    });
    return { queued: result.inserted, kind: "member_added" };
  }

  if (event === "fork") {
    await rememberRepo(store, installationId, payload);
    const forkee = obj(payload.forkee);
    const repo = repoFrom(payload);
    const result = await store.enqueueJob({
      deliveryId,
      priority: "light",
      kind: "fork",
      payload: {
        installationId,
        repo,
        fork: str(forkee.full_name),
      },
    });
    return { queued: result.inserted, kind: "fork" };
  }

  if (event === "release") {
    await rememberRepo(store, installationId, payload);
    if (str(payload.action) !== "published") return { queued: false, kind: event };
    const release = obj(payload.release);
    const repo = repoFrom(payload);
    const result = await store.enqueueJob({
      deliveryId,
      priority: "heavy",
      kind: "release_scan",
      payload: {
        installationId,
        repo,
        releaseId: num(release.id),
        tag: str(release.tag_name),
        name: str(release.name) || str(release.tag_name),
      },
    });
    return { queued: result.inserted, kind: "release_scan" };
  }

  if (event === "push") {
    await rememberRepo(store, installationId, payload);
    const hits = cheapSensitivePaths(pathsFromPushPayload(payload as { commits?: { added?: string[] }[] }));
    if (hits.length === 0) return { queued: false, kind: "push_ignored" };
    const repo = repoFrom(payload);
    const result = await store.enqueueJob({
      deliveryId,
      priority: "light",
      kind: "push_sensitive_path",
      payload: { installationId, repo, paths: hits, ref: str(payload.ref) },
    });
    return { queued: result.inserted, kind: "push_sensitive_path" };
  }

  return { queued: false, kind: event };
}
