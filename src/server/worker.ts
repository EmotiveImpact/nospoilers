import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ENGINE_VERSION, scan, type ScanReport } from "../scanner/index.ts";
import { summarizeWorkspaces } from "../scanner/workspaces.ts";
import type { ScanStatus } from "../scanner/types.ts";
import { commitRefsForCheck, type GithubPort } from "./github.ts";
import type { AlertNotifier } from "./notifier.ts";
import { logJson } from "./log.ts";
import type { NpmAuth, NpmPort } from "./npm.ts";
import { isPublicNpmOrigin, PUBLIC_NPM_ORIGIN } from "./npm-registry.ts";
import {
  ELECTRON_INSTALLER_SKIP_NOTE,
  isElectronInstallerName,
  isScannablePackAssetName,
} from "./paths.ts";
import { applyHostedPolicy } from "./hosted-policy.ts";
import { annotationsForFindings, checkConclusionFor, checkTitleFor } from "./github-checks.ts";
import { persistHostedReceipt, summarizeDiff } from "./receipts.ts";
import { inferReleaseChannel } from "./release-ledger.ts";
import {
  attachCanonicalDeliveryUrl,
  DELIVERY_VERIFY_KIND,
  isSealedArtifactDigest,
  publicGithubReleaseDownloadUrl,
  runDeliveryVerifyJob,
} from "./delivery-verify.ts";
import { scanProspectArtifact } from "./prospects.ts";
import type { JobRow, Store } from "./store.ts";
import type { WebhookHostLookup } from "./siem.ts";
import { crawlOrigin, WebCrawlError, type WebCrawlOpts } from "./web-origin.ts";
import { publicMapFromFindings } from "../scanner/debug-id.ts";
import {
  custodyFingerprint,
  runMapCustodyCheck,
} from "./map-custody.ts";
import { enqueueMapCustodyChecks } from "./map-watch.ts";
import { NAMESPACE_CHECK_KIND, runNamespaceCheck } from "./namespace-watch.ts";

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

function foldScanStatus(statuses: ScanStatus[]): ScanStatus {
  if (statuses.includes("failed-policy")) return "failed-policy";
  if (statuses.length === 0 || statuses.includes("inconclusive")) return "inconclusive";
  return "passed";
}

function titleForScan(
  status: ScanStatus,
  passed: string,
  failed: string,
  inconclusive: string,
): string {
  if (status === "passed") return passed;
  if (status === "failed-policy") return failed;
  return inconclusive;
}

function inconclusiveReport(reason: string, extra: Partial<ScanReport> = {}): ScanReport {
  return {
    target: extra.target ?? "",
    kind: extra.kind ?? "file",
    fileCount: extra.fileCount ?? 0,
    findings: extra.findings ?? [],
    ok: false,
    status: "inconclusive",
    inconclusiveReason: reason,
    manifest: extra.manifest ?? [],
    engineVersion: extra.engineVersion ?? ENGINE_VERSION,
    artifactSha256: extra.artifactSha256 ?? null,
    artifactSha512: extra.artifactSha512 ?? null,
    artifactBytes: extra.artifactBytes ?? null,
    scannedAt: extra.scannedAt ?? new Date().toISOString(),
    suppressed: extra.suppressed ?? [],
    policyHash: extra.policyHash ?? null,
    workspaces: extra.workspaces ?? [],
    debugIds: extra.debugIds ?? [],
    releaseHints: extra.releaseHints ?? [],
  };
}

function noteForAsset(name: string, report: ScanReport): string {
  let note: string;
  if (report.status === "inconclusive") {
    note = `${name}: inconclusive (${report.inconclusiveReason ?? "scan could not finish"}).`;
  } else if (report.status === "failed-policy") {
    const critical = report.findings.filter((finding) => finding.severity === "critical").length;
    note = `${name}: ${critical} critical finding(s).`;
  } else {
    note = `${name}: ${report.findings.length === 0 ? "clean" : "warnings only"} (${report.fileCount} files).`;
  }
  const workspaces = summarizeWorkspaces(report.workspaces);
  return workspaces ? `${note} ${workspaces}` : note;
}

export async function handleJob(
  job: JobRow,
  deps: {
    store: Store;
    github: GithubPort;
    notifier: AlertNotifier;
    scan: ScanFn;
    maxAssetBytes: number;
    npm?: NpmPort;
    receiptSecret?: string;
    webFetch?: typeof fetch;
    webLookup?: WebhookHostLookup;
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
  let hostedUnpackConsumed = job.priority === "heavy" && job.kind !== "web_origin_scan";

  async function refundUnusedHostedUnpack(): Promise<void> {
    if (!hostedUnpackConsumed) return;
    if (!Number.isFinite(installationId) || installationId <= 0) return;
    await deps.store.refundHostedUnpack(installationId);
    hostedUnpackConsumed = false;
  }

  const alertBase = {
    installationId,
    repoId: repo?.id ?? null,
    repoFullName: repo?.fullName ?? null,
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

  if (job.kind === "release_unpublished" || job.kind === "release_deleted") {
    const tag = String(payload.tag ?? payload.name ?? payload.releaseId);
    const gone = job.kind === "release_unpublished" ? "unpublished" : "deleted";
    await deps.notifier.send({
      ...alertBase,
      kind: job.kind,
      title: repo
        ? `Release ${tag} was ${gone} on ${repo.fullName}`
        : `Release ${tag} was ${gone}`,
      body: "GitHub no longer hosts this release. NoSpoilers will not scan assets that are gone. Previous receipts stay on Watch.",
    });
    return;
  }

  if (job.kind === "scan_latest_release") {
    if (!repo) throw new Error("scan_latest_release job missing repo");
    const latest = await deps.github.getLatestRelease(installationId, repo.owner, repo.name);
    if (!latest) {
      await refundUnusedHostedUnpack();
      await deps.notifier.send({
        ...alertBase,
        kind: job.kind,
        title: `No release on ${repo.fullName}`,
        body: "Publish a GitHub Release with a packed artifact attached (.tgz, .tar, .zip, .vsix, .whl, .jar, …), then scan again.",
      });
      return;
    }
    payload.releaseId = latest.id;
    payload.tag = latest.tag_name;
    payload.name = latest.name || latest.tag_name;
    payload.targetCommitish = latest.target_commitish ?? payload.targetCommitish;
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
    const packs = assets.filter((asset) => isScannablePackAssetName(asset.name));
    const installers = assets.filter((asset) => isElectronInstallerName(asset.name));
    if (packs.length === 0 && installers.length > 0) {
      await refundUnusedHostedUnpack();
      await deps.notifier.send({
        ...alertBase,
        kind: job.kind,
        title: `Release ${tag} has Electron installer assets we do not scan`,
        body: `Skipped ${installers.map((asset) => asset.name).join(", ")}. ${ELECTRON_INSTALLER_SKIP_NOTE}`,
      });
      return;
    }
    if (packs.length === 0) {
      await refundUnusedHostedUnpack();
      await deps.notifier.send({
        ...alertBase,
        kind: job.kind,
        title: `Release ${tag} has no pack we can scan`,
        body: "NoSpoilers looks for packed release assets (.tgz, .tar.gz, .tar, .zip, .asar, .vsix, .crx, .xpi, .whl, .jar, .war, .nupkg, .snupkg, .gem, .apk, .aab, .ipa, .xapk). DMG, EXE, MSI, AppImage, and mac/win desktop zip bundles are not packs on this worker. Python sdists are tar.gz with PKG-INFO (Python is not executed). Chrome extension ZIPs are WebExtension layout (root manifest.json), not a CRX header; extension code is not executed. Docker save and OCI archives are tar layouts (manifest.json or oci-layout). APK/AAB/IPA/XAPK are ZIP layouts (AndroidManifest, BundleConfig, Payload/*.app, or a nested APK). Serverless bundles are ZIP layouts (host.json, serverless.yml, .aws-sam, netlify/functions, or .vercel/output). Source trees are not scanned on push. Encrypted or signed wrappers that are not a readable ZIP/tar are inconclusive, never a passing receipt. Encrypted image layers and zip entries are not decrypted. Image, APK, and Apple signatures are not verified. DEX, native libraries, Mach-O, serverless handlers, and Python are never executed.",
      });
      return;
    }

    const allFindings: ScanReport["findings"] = [];
    const notes: string[] = [];
    const statuses: ScanStatus[] = [];
    let unpacked = false;
    if (installers.length > 0) {
      notes.push(
        `Skipped ${installers.map((asset) => asset.name).join(", ")} (Electron installer; isolated worker).`,
      );
    }
    for (const asset of packs) {
      const coordinate = `github:${repo.fullName}@${tag}#${asset.name}`;
      let report: ScanReport;
      if (asset.size > deps.maxAssetBytes) {
        report = inconclusiveReport(
          `${asset.name} is larger than the ${deps.maxAssetBytes} byte scan limit.`,
          { artifactBytes: asset.size, target: asset.name },
        );
      } else {
        const dir = await mkdtemp(path.join(os.tmpdir(), "nospoilers-rel-"));
        const dest = path.join(dir, asset.name.replace(/[^\w.-]+/g, "_"));
        try {
          const bytes = await deps.github.downloadAsset(installationId, asset.url, deps.maxAssetBytes);
          await writeFile(dest, bytes);
          report = await applyHostedPolicy(
            deps.store,
            await deps.scan(dest),
            installationId,
          );
          unpacked = true;
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }
      if (deps.receiptSecret) {
        const persisted = await persistHostedReceipt({
          store: deps.store,
          secret: deps.receiptSecret,
          installationId,
          repoId: repo.id,
          coordinate,
          report,
          channel: inferReleaseChannel(tag),
          sourceRevision: tag,
        });
        report = persisted.report;
        statuses.push(report.status);
        allFindings.push(...report.findings);
        notes.push(noteForAsset(asset.name, report));
        if (report.suppressed.length > 0) {
          notes.push(`${report.suppressed.length} finding(s) suppressed by allowlist.`);
        }
        const diffNote = summarizeDiff(persisted.diff, persisted.comparedTo);
        if (diffNote) notes.push(diffNote);
        if (report.artifactSha256) notes.push(`sha256 ${report.artifactSha256}`);
        if (!repo.private && isSealedArtifactDigest(persisted.revision.artifact_sha256)) {
          const downloadUrl = publicGithubReleaseDownloadUrl({
            owner: repo.owner,
            repo: repo.name,
            tag,
            name: asset.name,
          });
          if (downloadUrl) {
            await attachCanonicalDeliveryUrl(deps.store, {
              installationId,
              revisionId: persisted.revision.id,
              url: downloadUrl,
            });
          }
        }
      } else {
        statuses.push(report.status);
        allFindings.push(...report.findings);
        notes.push(noteForAsset(asset.name, report));
        if (report.suppressed.length > 0) {
          notes.push(`${report.suppressed.length} finding(s) suppressed by allowlist.`);
        }
      }
    }
    if (!unpacked) await refundUnusedHostedUnpack();

    const status = foldScanStatus(statuses);
    const title = titleForScan(
      status,
      `${repo.fullName} ${tag} is allowed to ship`,
      `Spoilers in ${repo.fullName} ${tag}`,
      `Inconclusive scan of ${repo.fullName} ${tag}`,
    );
    let sha: string | null = null;
    for (const ref of commitRefsForCheck(tag, String(payload.targetCommitish ?? ""))) {
      sha = await deps.github.getRefSha(installationId, repo.owner, repo.name, ref);
      if (sha) break;
    }
    if (sha) {
      const check = await deps.github.createCheckRun(installationId, repo.owner, repo.name, {
        name: "NoSpoilers",
        headSha: sha,
        conclusion: checkConclusionFor(status),
        title: checkTitleFor(status, repo.fullName, tag),
        summary: notes.join(" "),
        annotations: annotationsForFindings(allFindings),
      });
      if (!("skipped" in check) && check.htmlUrl) notes.push(`Check ${check.htmlUrl}`);
    }
    await deps.notifier.send({
      ...alertBase,
      kind: job.kind,
      title,
      body: notes.join(" "),
      findings: allFindings,
    });
  }

  if (job.kind === NAMESPACE_CHECK_KIND) {
    if (!deps.npm) throw new Error("namespace_check job is missing the npm port.");
    const namespaceId = Number(payload.namespaceId);
    if (!Number.isFinite(namespaceId) || namespaceId <= 0) return;
    await runNamespaceCheck({
      store: deps.store,
      npm: deps.npm,
      notifier: deps.notifier,
      namespaceId,
    });
    return;
  }

  if (job.kind === "npm_dist_tag") {
    const packageName = String(payload.packageName ?? "");
    const tags = asRecord(payload.distTags);
    await deps.notifier.send({
      ...alertBase,
      kind: job.kind,
      title: `npm dist-tags changed on ${packageName || "a package"}`,
      body: `latest is ${String(tags.latest ?? "unset")}. next/beta/canary tarballs are scanned when those tags point at another version. This alert is a tag-only change with nothing extra to unpack.`,
      packageName: packageName || null,
    });
    return;
  }

  if (job.kind === "npm_scan") {
    if (!deps.npm) throw new Error("npm_scan job is missing the npm port.");
    const packageName = String(payload.packageName ?? "");
    const version = String(payload.version ?? "");
    const distTag = String(payload.distTag ?? "").trim();
    const npmLabel =
      distTag && distTag !== "latest"
        ? `${packageName}@${version} (${distTag})`
        : `${packageName}@${version}`;
    const channel = inferReleaseChannel(distTag || version);
    const tarballUrl = String(payload.tarballUrl ?? "");
    const packageId = Number(payload.packageId);
    const registryOrigin = String(payload.registryOrigin ?? PUBLIC_NPM_ORIGIN);
    let auth: NpmAuth | undefined;
    if (!isPublicNpmOrigin(registryOrigin)) {
      const saved = await deps.store.getNpmRegistryAuth(installationId, registryOrigin);
      if (!saved) {
        await refundUnusedHostedUnpack();
        await deps.notifier.send({
          ...alertBase,
          kind: job.kind,
          title: `Missing registry token for ${packageName || "a package"}`,
          body: "Save an encrypted private-registry token on Watch, then check the package again. The token is not stored on the job.",
          packageName: packageName || null,
        });
        return;
      }
      auth = { registryOrigin: saved.origin, token: saved.token };
    }
    const dir = await mkdtemp(path.join(os.tmpdir(), "nospoilers-npm-"));
    const dest = path.join(dir, `${packageName.replace(/[^\w.-]+/g, "_") || "package"}-${version}.tgz`);
    try {
      const bytes = await deps.npm.downloadTarball(tarballUrl, deps.maxAssetBytes, auth);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      await writeFile(dest, bytes);
      let report = await applyHostedPolicy(
        deps.store,
        await deps.scan(dest),
        installationId,
        Number.isFinite(packageId) && packageId > 0 ? packageId : null,
      );
      let diffNote = "";
      if (deps.receiptSecret && Number.isFinite(installationId) && installationId > 0) {
        const persisted = await persistHostedReceipt({
          store: deps.store,
          secret: deps.receiptSecret,
          installationId,
          packageId: Number.isFinite(packageId) && packageId > 0 ? packageId : null,
          coordinate: `npm:${packageName}@${version}`,
          report,
          channel,
          sourceRevision: version,
        });
        report = persisted.report;
        diffNote = summarizeDiff(persisted.diff, persisted.comparedTo);
        if (
          isPublicNpmOrigin(registryOrigin) &&
          isSealedArtifactDigest(persisted.revision.artifact_sha256)
        ) {
          await attachCanonicalDeliveryUrl(deps.store, {
            installationId,
            revisionId: persisted.revision.id,
            url: tarballUrl,
          });
        }
      }
      const status = report.status;
      const critical = report.findings.filter((finding) => finding.severity === "critical").length;
      if (Number.isFinite(packageId) && packageId > 0) {
        await deps.store.recordWatchedPackageScan(packageId, {
          sha256: report.artifactSha256 ?? sha256,
          status,
        });
        await deps.store.recordPackageMapIdentity(packageId, {
          debugIds: report.debugIds ?? [],
          release: version || report.releaseHints?.[0] || null,
          publicMap: publicMapFromFindings(report.findings),
        });
        await enqueueMapCustodyChecks(
          deps.store,
          installationId,
          `pkg:${packageId}:${version || "latest"}`,
        );
      }
      const notes = [
        status === "inconclusive"
          ? `${report.inconclusiveReason ?? "Scan could not finish."} This is not a clean bill of health.`
          : critical > 0
            ? `${critical} critical finding(s).`
            : "No critical findings.",
        `sha256 ${report.artifactSha256 ?? sha256}`,
      ];
      if (distTag && distTag !== "latest") notes.push(`dist-tag ${distTag}.`);
      if (report.suppressed.length > 0) {
        notes.push(`${report.suppressed.length} finding(s) suppressed by allowlist.`);
      }
      const workspaceNote = summarizeWorkspaces(report.workspaces);
      if (workspaceNote) notes.push(workspaceNote);
      if (diffNote) notes.push(diffNote);
      await deps.notifier.send({
        ...alertBase,
        kind: job.kind,
        title: titleForScan(
          status,
          `npm ${npmLabel} is allowed to ship`,
          `Spoilers in npm ${npmLabel}`,
          `Inconclusive scan of npm ${npmLabel}`,
        ),
        body: notes.join(" "),
        findings: report.findings,
        packageName: packageName || null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("larger than")) {
        const report = inconclusiveReport(message);
        if (Number.isFinite(packageId) && packageId > 0) {
          await deps.store.recordWatchedPackageScan(packageId, {
            sha256: null,
            status: "inconclusive",
          });
        }
        if (deps.receiptSecret && Number.isFinite(installationId) && installationId > 0) {
          await persistHostedReceipt({
            store: deps.store,
            secret: deps.receiptSecret,
            installationId,
            packageId: Number.isFinite(packageId) && packageId > 0 ? packageId : null,
            coordinate: `npm:${packageName}@${version}`,
            report,
            channel,
            sourceRevision: version,
          });
        }
        await refundUnusedHostedUnpack();
        await deps.notifier.send({
          ...alertBase,
          kind: job.kind,
          title: `Inconclusive scan of npm ${npmLabel}`,
          body: `${message} This is not a clean bill of health.`,
          packageName: packageName || null,
        });
        return;
      }
      throw error;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  if (job.kind === "web_origin_scan") {
    const originId = Number(payload.originId);
    const url = String(payload.url ?? "");
    const origin = Number.isFinite(originId) && originId > 0
      ? await deps.store.getWatchedOrigin(originId)
      : null;
    if (!origin) {
      await refundUnusedHostedUnpack();
      return;
    }
    const crawlOpts: WebCrawlOpts = {
      fetch: deps.webFetch,
      lookup: deps.webLookup,
    };
    const dir = await mkdtemp(path.join(os.tmpdir(), "nospoilers-web-"));
    try {
      const crawled = await crawlOrigin(url || origin.origin_url, crawlOpts);
      if (origin.last_sha256 && origin.last_sha256 === crawled.sha256 && !crawled.truncated) {
        await deps.store.touchWatchedOrigin(origin.id);
        await refundUnusedHostedUnpack();
        return;
      }
      // Website jobs use the heavy concurrency lane but reserve daily usage
      // only after the crawl proves there are changed bytes to scan.
      const consumed = await deps.store.consumeHostedUnpack(installationId);
      if (!consumed) {
        await deps.store.noteFairUseExhausted(installationId);
        return;
      }
      hostedUnpackConsumed = true;
      for (const file of crawled.files) {
        const dest = path.join(dir, file.rel);
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, file.bytes);
      }
      let report = await applyHostedPolicy(
        deps.store,
        await deps.scan(dir),
        installationId,
        null,
      );
      if (crawled.truncated) {
        report = {
          ...report,
          ok: false,
          status: "inconclusive",
          inconclusiveReason:
            "Crawl stopped at the asset or size limit. This is not a clean bill of health.",
        };
      }
      report = {
        ...report,
        artifactSha256: crawled.sha256,
        artifactBytes: crawled.files.reduce((sum, file) => sum + file.bytes.length, 0),
      };
      await deps.store.recordWatchedOriginScan(origin.id, {
        sha256: crawled.sha256,
        status: report.status,
      });
      await deps.store.recordOriginMapIdentity(origin.id, {
        debugIds: report.debugIds ?? [],
        release: report.releaseHints?.[0] ?? null,
        publicMap: publicMapFromFindings(report.findings),
      });
      await enqueueMapCustodyChecks(
        deps.store,
        installationId,
        `origin:${origin.id}:${crawled.sha256.slice(0, 12)}`,
      );
      let diffNote = "";
      if (deps.receiptSecret && Number.isFinite(installationId) && installationId > 0) {
        const persisted = await persistHostedReceipt({
          store: deps.store,
          secret: deps.receiptSecret,
          installationId,
          coordinate: `web:${origin.origin_url}`,
          report,
          channel: "stable",
          sourceRevision: crawled.sha256.slice(0, 12),
        });
        report = persisted.report;
        diffNote = summarizeDiff(persisted.diff, persisted.comparedTo);
      }
      const critical = report.findings.filter((finding) => finding.severity === "critical").length;
      const notes = [
        report.status === "inconclusive"
          ? `${report.inconclusiveReason ?? "Scan could not finish."} This is not a clean bill of health.`
          : critical > 0
            ? `${critical} critical finding(s).`
            : "No critical findings.",
        `sha256 ${crawled.sha256}`,
        `${crawled.files.length} file(s) from ${origin.host}. Source was deleted after the scan.`,
      ];
      if (diffNote) notes.push(diffNote);
      await deps.notifier.send({
        ...alertBase,
        kind: job.kind,
        title: titleForScan(
          report.status,
          `${origin.host} is allowed to ship`,
          `Spoilers on ${origin.host}`,
          `Inconclusive crawl of ${origin.host}`,
        ),
        body: notes.join(" "),
        findings: report.findings,
      });
    } catch (error) {
      const message =
        error instanceof WebCrawlError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);
      const report = inconclusiveReport(message);
      await deps.store.recordWatchedOriginScan(origin.id, {
        sha256: null,
        status: "inconclusive",
      });
      if (deps.receiptSecret && Number.isFinite(installationId) && installationId > 0) {
        await persistHostedReceipt({
          store: deps.store,
          secret: deps.receiptSecret,
          installationId,
          coordinate: `web:${origin.origin_url}`,
          report,
          channel: "stable",
        });
      }
      if (error instanceof WebCrawlError) {
        await refundUnusedHostedUnpack();
      }
      await deps.notifier.send({
        ...alertBase,
        kind: job.kind,
        title: `Inconclusive crawl of ${origin.host}`,
        body: `${message} This is not a clean bill of health.`,
      });
      if (!(error instanceof WebCrawlError)) throw error;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  if (job.kind === DELIVERY_VERIFY_KIND) {
    const locationId = Number(payload.locationId);
    const revisionId = Number(payload.revisionId);
    if (!Number.isFinite(locationId) || locationId <= 0) return;
    if (!Number.isFinite(revisionId) || revisionId <= 0) return;
    await runDeliveryVerifyJob({
      store: deps.store,
      notifier: deps.notifier,
      installationId,
      locationId,
      revisionId,
      githubDeliveryId: deliveryId,
      maxBytes: deps.maxAssetBytes,
      fetch: deps.webFetch,
      lookup: deps.webLookup,
    });
    return;
  }

  if (job.kind === "map_custody_check") {
    const destinationId = Number(payload.destinationId);
    const destination =
      Number.isFinite(destinationId) && destinationId > 0
        ? await deps.store.getMapDestination(destinationId)
        : null;
    if (!destination || destination.installation_id !== installationId) return;
    const auth = await deps.store.getMapDestinationAuth(destination.id);
    if (!auth) {
      await deps.store.recordMapDestinationCheck(destination.id, {
        status: "inconclusive",
        error: "Map destination token is missing on this instance.",
        fingerprint: "missing-token",
      });
      return;
    }
    const identities = await deps.store.listMapIdentities(installationId);
    const verdict = await runMapCustodyCheck({
      kind: destination.kind,
      host: destination.host,
      origin: `https://${destination.host}`,
      orgSlug: destination.org_slug,
      projectSlug: destination.project_slug,
      token: auth.token,
      identities,
      fetch: deps.webFetch,
      lookup: deps.webLookup,
    });
    const fingerprint = custodyFingerprint(verdict);
    const previous = destination.last_fingerprint;
    await deps.store.recordMapDestinationCheck(destination.id, {
      status: verdict.status,
      error: verdict.inconclusiveReason,
      fingerprint,
    });
    if (previous === fingerprint) return;
    if (verdict.status === "passed" && verdict.findings.length === 0) return;
    const label = destination.kind === "sentry" ? "Sentry" : "Bugsnag";
    const notes = [
      verdict.inconclusiveReason
        ? `${verdict.inconclusiveReason} This is not a clean bill of health.`
        : verdict.findings.length > 0
          ? `${verdict.findings.length} map-custody finding(s).`
          : "No map-custody findings.",
      `Checked ${label} on ${destination.host}. Tokens and source were not stored.`,
    ];
    await deps.notifier.send({
      ...alertBase,
      kind: job.kind,
      title: titleForScan(
        verdict.status,
        `${label} map custody on ${destination.host} is allowed`,
        `Map custody failed on ${destination.host}`,
        `Inconclusive map custody check on ${destination.host}`,
      ),
      body: notes.join(" "),
      findings: verdict.findings,
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
  npm?: NpmPort;
  receiptSecret?: string;
  webFetch?: typeof fetch;
  webLookup?: WebhookHostLookup;
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
          npm: opts.npm,
          receiptSecret: opts.receiptSecret,
          webFetch: opts.webFetch,
          webLookup: opts.webLookup,
        });
      }
      await opts.store.finishJob(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logJson("error", "job.failed", {
        jobId: job.id,
        kind: job.kind,
        attempts: job.attempts,
        message,
      });
      await opts.store.finishJob(job.id, message);
    } finally {
      if (job.kind === "prospect_scan") prospectRunning -= 1;
      dec();
      void tick();
    }
  }

  let tickInFlight: Promise<void> | null = null;

  async function tick(): Promise<void> {
    if (stopped) return;
    if (ticking) {
      tickRequested = true;
      return;
    }
    ticking = true;
    const running = (async () => {
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
        tickInFlight = null;
        if (tickRequested && !stopped) void tick();
      }
    })();
    tickInFlight = running;
    await running;
  }

  async function runUntilIdle(): Promise<void> {
    if (stopped) return;
    if (tickInFlight) await tickInFlight;
    await tick();
    while (!stopped && activeJobs.size > 0) {
      await Promise.allSettled([...activeJobs]);
      if (tickInFlight) await tickInFlight;
      await tick();
    }
  }

  return {
    tick,
    runUntilIdle,
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
