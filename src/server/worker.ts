import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { scan, type ScanReport } from "../scanner/index.ts";
import type { GithubPort } from "./github.ts";
import type { AlertNotifier } from "./notifier.ts";
import { isPackAssetName } from "./paths.ts";
import { scanProspectArtifact } from "./prospects.ts";
import type { JobRow, Store } from "./store.ts";

export type ScanFn = (target: string) => Promise<ScanReport>;

type RepoPayload = {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
};

function repoOf(payload: Record<string, unknown>): RepoPayload | null {
  const repo = payload.repo;
  if (!repo || typeof repo !== "object") return null;
  return repo as RepoPayload;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function handleJob(
  job: JobRow,
  deps: {
    store: Store;
    github: GithubPort;
    notifier: AlertNotifier;
    scan: ScanFn;
    maxAssetBytes: number;
  },
): Promise<void> {
  const payload = asRecord(job.payload);
  if (job.kind !== "prospect_scan") {
    const installationId = Number(payload.installationId);
    if (Number.isFinite(installationId) && installationId > 0) {
      if (!(await deps.store.installationWorkAllowed(installationId))) return;
    }
  }
  if (job.kind === "prospect_scan") {
    const prospectId = Number(payload.prospectId);
    if (!Number.isFinite(prospectId) || prospectId <= 0) {
      throw new Error("prospect_scan job missing prospectId");
    }
    await scanProspectArtifact(prospectId, {
      store: deps.store,
      scan: deps.scan,
      maxAssetBytes: deps.maxAssetBytes,
    });
    return;
  }

  const repo = repoOf(payload);
  const installationId = Number(payload.installationId);
  const deliveryId = job.delivery_id;

  const alertBase = {
    installationId,
    repoId: repo?.id ?? null,
    githubDeliveryId: deliveryId,
  };

  if (job.kind === "repo_publicized") {
    if (repo) await deps.store.updateRepoCheck(repo.id, false);
    await deps.notifier.send({
      ...alertBase,
      kind: job.kind,
      title: `${repo?.fullName ?? "A repository"} is public`,
      body: `${repo?.fullName ?? "A repository"} was private and is now public. Anyone with the URL can clone it.`,
    });
    return;
  }

  if (job.kind === "repo_created_public") {
    if (repo) await deps.store.updateRepoCheck(repo.id, false);
    await deps.notifier.send({
      ...alertBase,
      kind: job.kind,
      title: `${repo?.fullName ?? "A repository"} was created public`,
      body: "A new repository was born public. If that was accidental, make it private on GitHub.",
    });
    return;
  }

  if (job.kind === "repo_transferred") {
    await deps.notifier.send({
      ...alertBase,
      kind: job.kind,
      title: `${repo?.fullName ?? "A repository"} was transferred`,
      body: "Ownership moved. Confirm the new account is one you trust and that visibility is still what you want.",
    });
    return;
  }

  if (job.kind === "member_added") {
    await deps.notifier.send({
      ...alertBase,
      kind: job.kind,
      title: `${String(payload.login)} was added to ${repo?.fullName ?? "a repository"}`,
      body: "A collaborator was granted access. If you did not add them, remove them on GitHub.",
    });
    return;
  }

  if (job.kind === "fork") {
    await deps.notifier.send({
      ...alertBase,
      kind: job.kind,
      title: `${repo?.fullName ?? "A repository"} was forked`,
      body: `Fork: ${String(payload.fork)}. Public forks copy whatever was visible at fork time.`,
    });
    return;
  }

  if (job.kind === "push_sensitive_path") {
    const paths = Array.isArray(payload.paths) ? payload.paths.map(String) : [];
    await deps.notifier.send({
      ...alertBase,
      kind: job.kind,
      title: `Sensitive path in ${repo?.fullName ?? "a push"}`,
      body: `This push touched ${paths.join(", ")}. NoSpoilers did not unpack the git tree. If this was a packed artifact, attach it to a GitHub Release so the pack scanner can read the bytes customers get.`,
    });
    return;
  }

  if (job.kind === "scan_latest_release") {
    if (!repo) throw new Error("scan_latest_release job missing repo");
    const latest = await deps.github.getLatestRelease(installationId, repo.owner, repo.name);
    if (!latest) {
      await deps.notifier.send({
        ...alertBase,
        kind: job.kind,
        title: `No release on ${repo.fullName}`,
        body: "Publish a GitHub Release with a .tgz, .zip, or .asar attached, then scan again.",
      });
      return;
    }
    payload.releaseId = latest.id;
    payload.tag = latest.tag_name;
    payload.name = latest.name || latest.tag_name;
    job = { ...job, kind: "release_scan", payload };
  }

  if (job.kind === "release_scan") {
    if (!repo) throw new Error("release_scan job missing repo");
    const releaseId = Number(payload.releaseId);
    const tag = String(payload.tag ?? payload.name ?? releaseId);
    const assets = await deps.github.listReleaseAssets(
      installationId,
      repo.owner,
      repo.name,
      releaseId,
    );
    const packs = assets.filter((asset) => isPackAssetName(asset.name));
    if (packs.length === 0) {
      await deps.notifier.send({
        ...alertBase,
        kind: job.kind,
        title: `Release ${tag} has no pack we can scan`,
        body: "NoSpoilers looks for .tgz, .tar.gz, .zip, or .asar on the release. Source trees are not scanned on push.",
      });
      return;
    }

    const allFindings: ScanReport["findings"] = [];
    const notes: string[] = [];
    for (const asset of packs) {
      if (asset.size > deps.maxAssetBytes) {
        notes.push(`${asset.name} skipped (larger than ${deps.maxAssetBytes} bytes).`);
        continue;
      }
      const dir = await mkdtemp(path.join(os.tmpdir(), "nospoilers-rel-"));
      const dest = path.join(dir, asset.name.replace(/[^\w.-]+/g, "_"));
      try {
        const bytes = await deps.github.downloadAsset(installationId, asset.url, deps.maxAssetBytes);
        await writeFile(dest, bytes);
        const report = await deps.scan(dest);
        allFindings.push(...report.findings);
        notes.push(
          report.ok
            ? `${asset.name}: clean (${report.fileCount} files).`
            : `${asset.name}: ${report.findings.filter((f) => f.severity === "critical").length} critical finding(s).`,
        );
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }

    const critical = allFindings.filter((f) => f.severity === "critical").length;
    await deps.notifier.send({
      ...alertBase,
      kind: job.kind,
      title:
        critical > 0
          ? `Spoilers in ${repo.fullName} ${tag}`
          : `${repo.fullName} ${tag} is allowed to ship`,
      body: notes.join(" "),
      findings: allFindings,
    });
  }
}

export function createWorker(opts: {
  store: Store;
  github: GithubPort;
  notifier: AlertNotifier;
  scan?: ScanFn;
  heavyConcurrency: number;
  lightConcurrency: number;
  maxAssetBytes: number;
  intervalMs: number;
  staleAfterMs?: number;
  onJob?: (job: JobRow) => Promise<void>;
}) {
  const scanFn = opts.scan ?? scan;
  const workerId = `w-${process.pid}-${Math.random().toString(16).slice(2)}`;
  let lightRunning = 0;
  let heavyRunning = 0;
  let prospectRunning = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;
  let ticking = false;
  let tickRequested = false;
  const activeJobs = new Set<Promise<void>>();

  function launch(job: JobRow): void {
    const task = runClaimed(job);
    activeJobs.add(task);
    void task.then(
      () => activeJobs.delete(task),
      () => activeJobs.delete(task),
    );
  }

  async function runClaimed(job: JobRow): Promise<void> {
    const inc = job.priority === "heavy" ? () => (heavyRunning += 1) : () => (lightRunning += 1);
    const dec = job.priority === "heavy" ? () => (heavyRunning -= 1) : () => (lightRunning -= 1);
    inc();
    if (job.kind === "prospect_scan") prospectRunning += 1;
    try {
      if (opts.onJob) await opts.onJob(job);
      else {
        await handleJob(job, {
          store: opts.store,
          github: opts.github,
          notifier: opts.notifier,
          scan: scanFn,
          maxAssetBytes: opts.maxAssetBytes,
        });
      }
      await opts.store.finishJob(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await opts.store.finishJob(job.id, message);
    } finally {
      if (job.kind === "prospect_scan") prospectRunning -= 1;
      dec();
      void tick();
    }
  }

  async function tick(): Promise<void> {
    if (stopped) return;
    if (ticking) {
      tickRequested = true;
      return;
    }
    ticking = true;
    try {
      await opts.store.recoverStaleJobs(opts.staleAfterMs ?? 5 * 60 * 1000);
      do {
        tickRequested = false;
        while (lightRunning < opts.lightConcurrency) {
          const job = await opts.store.claimJob("light", opts.lightConcurrency, workerId);
          if (!job) break;
          launch(job);
        }
        while (heavyRunning < opts.heavyConcurrency) {
          const job = await opts.store.claimJob(
            "heavy",
            opts.heavyConcurrency,
            workerId,
            prospectRunning < 1,
          );
          if (!job) break;
          launch(job);
        }
      } while (tickRequested && !stopped);
    } finally {
      ticking = false;
      if (tickRequested && !stopped) void tick();
    }
  }

  return {
    tick,
    get running() {
      return { light: lightRunning, heavy: heavyRunning, prospect: prospectRunning };
    },
    start() {
      if (timer) return;
      timer = setInterval(() => {
        void tick();
      }, opts.intervalMs);
      void tick();
    },
    async stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = undefined;
      await Promise.allSettled([...activeJobs]);
    },
  };
}
