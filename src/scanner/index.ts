import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, readlink, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as asar from "@electron/asar";
import JSZip from "jszip";
import { x as tarExtract } from "tar";
import { applyPolicy } from "../policy.ts";
import { INSPECT_BYTES, inspectEntry, isNestedPack, linkFinding, escapingArchivePathFinding, TOTAL_WARN_BYTES } from "./inspect.ts";
import {
  CRX_INCONCLUSIVE,
  ENCRYPTION_INCONCLUSIVE,
  archivePathEscapes,
  isTarFamilyKind,
  isZipFamilyKind,
  listZipEntryNames,
  packFormatFromName,
  sniffPackFormat,
  unwrapCrx,
  zipPayloadForKind,
  zipResolvedName,
  zipUsesEncryption,
} from "./formats.ts";
import {
  ScanInconclusiveError,
  type Finding,
  type ManifestEntry,
  type ScanOptions,
  type ScanReport,
  type ScanStatus,
  type ScanTargetKind,
} from "./types.ts";
import {
  discoverWorkspaces,
  summarizeWorkspaces,
  workspaceFileFrom,
  type WorkspaceFile,
} from "./workspaces.ts";

export type {
  Finding,
  ManifestEntry,
  ScanOptions,
  ScanReport,
  ScanStatus,
  ScanTargetKind,
  WorkspaceDiscovery,
  WorkspaceKind,
  WorkspaceMember,
} from "./types.ts";
export { ScanInconclusiveError } from "./types.ts";
export { toSarif } from "./sarif.ts";
export { discoverWorkspaces, summarizeWorkspaces } from "./workspaces.ts";

export const ENGINE_VERSION = "0.1.0";
export const DEFAULT_MAX_INPUT_BYTES = 80 * 1024 * 1024;
export const DEFAULT_MAX_UNPACKED_BYTES = 500 * 1024 * 1024;
export const DEFAULT_MAX_FILES = 25_000;
export const DEFAULT_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const DEFAULT_TIMEOUT_MS = 90_000;

type ScanLimits = {
  maxInputBytes: number;
  maxUnpackedBytes: number;
  maxFiles: number;
  maxFileBytes: number;
  timeoutMs: number;
  deadline: number;
};

class ScanBudget {
  files = 0;
  bytes = 0;
  private readonly limits: ScanLimits;

  constructor(limits: ScanLimits) {
    this.limits = limits;
  }

  checkTime(): void {
    if (Date.now() > this.limits.deadline) {
      throw new ScanInconclusiveError(
        "timeout",
        `Scan exceeded ${this.limits.timeoutMs / 1000} seconds.`,
      );
    }
  }

  beginFile(filePath: string): void {
    this.checkTime();
    this.files += 1;
    if (this.files > this.limits.maxFiles) {
      throw new ScanInconclusiveError(
        "limit",
        `Archive contains more than ${this.limits.maxFiles} files (stopped at ${filePath}).`,
      );
    }
  }

  addBytes(filePath: string, chunkBytes: number, fileBytes: number): void {
    this.checkTime();
    if (fileBytes > this.limits.maxFileBytes) {
      throw new ScanInconclusiveError(
        "limit",
        `${filePath} expands beyond the ${this.limits.maxFileBytes} byte per-file limit.`,
      );
    }
    this.bytes += chunkBytes;
    if (this.bytes > this.limits.maxUnpackedBytes) {
      throw new ScanInconclusiveError(
        "limit",
        `Archive expands beyond the ${this.limits.maxUnpackedBytes} byte unpacked limit.`,
      );
    }
  }
}

function limitsFor(options: ScanOptions): ScanLimits {
  const positive = (value: number | undefined, fallback: number) =>
    value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
  const timeoutMs = positive(options.timeoutMs, DEFAULT_TIMEOUT_MS);
  return {
    maxInputBytes: positive(options.maxInputBytes, DEFAULT_MAX_INPUT_BYTES),
    maxUnpackedBytes: positive(options.maxUnpackedBytes, DEFAULT_MAX_UNPACKED_BYTES),
    maxFiles: positive(options.maxFiles, DEFAULT_MAX_FILES),
    maxFileBytes: positive(options.maxFileBytes, DEFAULT_MAX_FILE_BYTES),
    timeoutMs,
    deadline: Date.now() + timeoutMs,
  };
}

function kindOf(target: string, isDir: boolean): ScanTargetKind {
  if (isDir) return "directory";
  return packFormatFromName(target) ?? "file";
}

async function walkTree(
  root: string,
): Promise<{ files: string[]; links: { abs: string; target: string }[] }> {
  const files: string[] = [];
  const links: { abs: string; target: string }[] = [];
  const entries = await readdir(root, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    const parent = entry.parentPath;
    const abs = path.join(parent, entry.name);
    if (entry.isSymbolicLink()) {
      try {
        links.push({ abs, target: await readlink(abs) });
      } catch {
        links.push({ abs, target: "" });
      }
      continue;
    }
    if (entry.isFile()) files.push(abs);
  }
  return { files, links };
}

type ScanChunk = {
  findings: Finding[];
  fileCount: number;
  totalBytes: number;
  manifest: ManifestEntry[];
  workspaceFiles: WorkspaceFile[];
};

export const MAX_NEST_DEPTH = 3;

type ScanCtx = {
  limits: ScanLimits;
  budget: ScanBudget;
  depth: number;
};

function emptyChunk(budget: ScanBudget): ScanChunk {
  return {
    findings: [],
    fileCount: budget.files,
    totalBytes: budget.bytes,
    manifest: [],
    workspaceFiles: [],
  };
}

function pushWorkspace(rel: string, buf: Buffer, into: WorkspaceFile[]): void {
  const file = workspaceFileFrom(rel, buf);
  if (file) into.push(file);
}

function nestPrefix(outer: string, inner: string): string {
  const left = outer.replace(/\\/g, "/").replace(/^\.\//, "");
  const right = inner.replace(/\\/g, "/").replace(/^\.\//, "");
  return `${left}!/${right}`;
}

function packKindFromName(name: string): ScanTargetKind | null {
  return packFormatFromName(name);
}

function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function hashFileBytes(bytes: Buffer): { sha256: string; sha512: string } {
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sha512: createHash("sha512").update(bytes).digest("hex"),
  };
}

async function withTempFile(bytes: Buffer, ext: string, run: (filePath: string) => Promise<ScanChunk>): Promise<ScanChunk> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "nospoilers-nest-"));
  const dest = path.join(dir, `inner${ext}`);
  try {
    await writeFile(dest, bytes);
    return await run(dest);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function maybeScanNested(rel: string, bytes: Buffer, ctx: ScanCtx): Promise<ScanChunk> {
  const kind = sniffPackFormat(bytes, rel) ?? packKindFromName(rel);
  if (!kind || kind === "file" || kind === "directory" || ctx.depth >= MAX_NEST_DEPTH || bytes.length < 20) {
    return emptyChunk(ctx.budget);
  }
  const nested: ScanCtx = { ...ctx, depth: ctx.depth + 1 };
  try {
    if (isZipFamilyKind(kind)) {
      const payload = zipPayloadForKind(bytes, kind);
      if (kind === "crx" && !unwrapCrx(bytes)) {
        throw new ScanInconclusiveError("malformed", CRX_INCONCLUSIVE);
      }
      if (zipUsesEncryption(payload)) {
        throw new ScanInconclusiveError("malformed", ENCRYPTION_INCONCLUSIVE);
      }
      return await scanZipBytes(payload, nested, rel);
    }
    if (isTarFamilyKind(kind)) {
      const ext = rel.toLowerCase().endsWith(".tar") ? ".tar" : ".tgz";
      return await withTempFile(bytes, ext, (filePath) => scanTarball(filePath, nested, rel));
    }
    return await withTempFile(bytes, ".asar", (filePath) => scanAsar(filePath, nested, rel));
  } catch (error) {
    if (error instanceof ScanInconclusiveError && error.reason !== "malformed") throw error;
    return emptyChunk(ctx.budget);
  }
}

async function mergeNested(
  rel: string,
  bytes: Buffer,
  ctx: ScanCtx,
  findings: Finding[],
  manifest: ManifestEntry[],
  workspaceFiles: WorkspaceFile[],
): Promise<void> {
  if (!isNestedPack(rel)) return;
  const nested = await maybeScanNested(rel, bytes, ctx);
  findings.push(...nested.findings);
  manifest.push(...nested.manifest);
  workspaceFiles.push(...nested.workspaceFiles);
}

async function scanDirectory(
  root: string,
  ctx: ScanCtx,
  label = "",
  countFiles = true,
): Promise<ScanChunk> {
  const { files, links } = await walkTree(root);
  const findings: Finding[] = [];
  const manifest: ManifestEntry[] = [];
  const workspaceFiles: WorkspaceFile[] = [];
  const relOf = (abs: string) => {
    const inner = path.relative(root, abs).split(path.sep).join("/");
    return label ? nestPrefix(label, inner) : inner;
  };
  for (const link of links) {
    const rel = relOf(link.abs);
    const finding = linkFinding(rel, link.target);
    if (finding) findings.push(finding);
  }
  for (const abs of files) {
    const rel = relOf(abs);
    const info = await stat(abs);
    if (countFiles) {
      ctx.budget.beginFile(rel);
      ctx.budget.addBytes(rel, info.size, info.size);
    }
    const buf = await readFile(abs);
    findings.push(...inspectEntry(rel, buf.subarray(0, INSPECT_BYTES), info.size));
    manifest.push({ path: rel, size: info.size, sha256: sha256Buffer(buf) });
    pushWorkspace(rel, buf, workspaceFiles);
    await mergeNested(rel, buf, ctx, findings, manifest, workspaceFiles);
  }
  return { findings, fileCount: ctx.budget.files, totalBytes: ctx.budget.bytes, manifest, workspaceFiles };
}

async function scanTarball(archive: string, ctx: ScanCtx, label = ""): Promise<ScanChunk> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "nospoilers-tar-"));
  let limitError: ScanInconclusiveError | null = null;
  const linkFindings: Finding[] = [];
  try {
    await tarExtract({
      file: archive,
      cwd: dir,
      filter(entryPath, entry) {
        if (limitError) return false;
        try {
          const type = "type" in entry ? entry.type : "File";
          const storedPath = "path" in entry ? entry.path : entryPath;
          const display = label ? nestPrefix(label, String(storedPath)) : String(storedPath);
          if (archivePathEscapes(String(storedPath))) {
            linkFindings.push(escapingArchivePathFinding(display));
            return false;
          }
          if (type === "SymbolicLink" || type === "Link") {
            const target =
              "linkpath" in entry && typeof entry.linkpath === "string" ? entry.linkpath : "";
            const finding = linkFinding(display, target);
            if (finding) linkFindings.push(finding);
            return false;
          }
          const file =
            type === "File" ||
            type === "OldFile" ||
            type === "ContiguousFile";
          if (!file) return false;
          const size = entry.size ?? 0;
          ctx.budget.beginFile(display);
          ctx.budget.addBytes(display, size, size);
          return true;
        } catch (error) {
          if (error instanceof ScanInconclusiveError) {
            limitError = error;
            return false;
          }
          throw error;
        }
      },
    });
    if (limitError) throw limitError;
    const scanned = await scanDirectory(dir, ctx, label, false);
    return {
      ...scanned,
      findings: [...linkFindings, ...scanned.findings],
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function zipObjectOriginalName(
  entry: { unsafeOriginalName?: string },
  fallback: string,
): string {
  const original = entry.unsafeOriginalName;
  return typeof original === "string" && original.length > 0 ? original : fallback;
}

async function scanZipBytes(buf: Buffer, ctx: ScanCtx, label = ""): Promise<ScanChunk> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch (error) {
    throw new ScanInconclusiveError(
      "malformed",
      error instanceof Error ? error.message : "Zip archive is malformed.",
    );
  }
  const findings: Finding[] = [];
  const manifest: ManifestEntry[] = [];
  const workspaceFiles: WorkspaceFile[] = [];
  const escapingRaw = new Set<string>();
  const skipResolved = new Set<string>();
  for (const raw of listZipEntryNames(buf)) {
    if (!archivePathEscapes(raw) || escapingRaw.has(raw)) continue;
    escapingRaw.add(raw);
    const display = label ? nestPrefix(label, raw) : raw;
    findings.push(escapingArchivePathFinding(display));
    skipResolved.add(zipResolvedName(raw));
  }
  const names = Object.keys(zip.files);
  for (const name of names) {
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;
    const original = zipObjectOriginalName(entry, name);
    const stored = archivePathEscapes(original) ? original : name;
    const display = label ? nestPrefix(label, stored) : stored;
    if (
      escapingRaw.has(original) ||
      skipResolved.has(name) ||
      archivePathEscapes(name) ||
      archivePathEscapes(original)
    ) {
      if (!escapingRaw.has(original) && !escapingRaw.has(name)) {
        findings.push(escapingArchivePathFinding(display));
      }
      ctx.budget.beginFile(display);
      continue;
    }
    ctx.budget.beginFile(display);
    const stream = entry.nodeStream("nodebuffer");
    const chunks: Buffer[] = [];
    const hash = createHash("sha256");
    let fileBytes = 0;
    let retainedBytes = 0;
    const keepAll = isNestedPack(name);
    await new Promise<void>((resolve, reject) => {
      let stopped = false;
      stream.on("data", (raw: Buffer | Uint8Array) => {
        if (stopped) return;
        try {
          const chunk = Buffer.from(raw);
          fileBytes += chunk.length;
          ctx.budget.addBytes(display, chunk.length, fileBytes);
          hash.update(chunk);
          if (keepAll || retainedBytes < INSPECT_BYTES) {
            const kept = keepAll ? chunk : chunk.subarray(0, INSPECT_BYTES - retainedBytes);
            chunks.push(kept);
            retainedBytes += kept.length;
          }
        } catch (error) {
          stopped = true;
          const destroy = (stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy;
          if (typeof destroy === "function") destroy.call(stream);
          else stream.pause();
          reject(error);
        }
      });
      stream.on("error", (error) => {
        if (stopped) return;
        stopped = true;
        reject(error);
      });
      stream.on("end", () => {
        if (stopped) return;
        stopped = true;
        resolve();
      });
    });
    const retained = Buffer.concat(chunks, retainedBytes);
    findings.push(...inspectEntry(display, retained.subarray(0, INSPECT_BYTES), fileBytes));
    manifest.push({ path: display, size: fileBytes, sha256: hash.digest("hex") });
    pushWorkspace(display, retained, workspaceFiles);
    if (keepAll) await mergeNested(display, retained, ctx, findings, manifest, workspaceFiles);
  }
  return { findings, fileCount: ctx.budget.files, totalBytes: ctx.budget.bytes, manifest, workspaceFiles };
}

async function scanAsar(archive: string, ctx: ScanCtx, label = ""): Promise<ScanChunk> {
  const listed = asar.listPackage(archive, { isPack: false });
  const findings: Finding[] = [];
  const manifest: ManifestEntry[] = [];
  const workspaceFiles: WorkspaceFile[] = [];
  for (const raw of listed) {
    const rel = raw.replace(/^\/+/, "");
    const posix = rel.split(path.sep).join("/");
    if (!posix || posix.endsWith("/")) continue;
    let record: ReturnType<typeof asar.statFile>;
    try {
      record = asar.statFile(archive, posix, false);
    } catch {
      continue;
    }
    if (!("size" in record)) continue;
    const display = label ? nestPrefix(label, posix) : posix;
    ctx.budget.beginFile(display);
    ctx.budget.addBytes(display, record.size, record.size);
    const content = asar.extractFile(archive, posix);
    findings.push(...inspectEntry(display, content.subarray(0, INSPECT_BYTES), record.size));
    manifest.push({ path: display, size: record.size, sha256: sha256Buffer(content) });
    pushWorkspace(display, content, workspaceFiles);
    await mergeNested(display, content, ctx, findings, manifest, workspaceFiles);
  }
  return { findings, fileCount: ctx.budget.files, totalBytes: ctx.budget.bytes, manifest, workspaceFiles };
}

export async function scan(target: string, options: ScanOptions = {}): Promise<ScanReport> {
  const resolved = path.resolve(target);
  const info = await stat(resolved);
  let kind = kindOf(resolved, info.isDirectory());
  const limits = limitsFor(options);
  let artifactSha256: string | null = null;
  let artifactSha512: string | null = null;
  let artifactBytes: number | null = info.isDirectory() ? null : info.size;
  let packed: Buffer | null = null;

  const inconclusive = (reason: string): ScanReport => ({
    target: resolved,
    kind,
    fileCount: 0,
    findings: [],
    ok: false,
    status: "inconclusive",
    inconclusiveReason: reason,
    manifest: [],
    engineVersion: ENGINE_VERSION,
    artifactSha256,
    artifactSha512,
    artifactBytes,
    scannedAt: new Date().toISOString(),
    suppressed: [],
    policyHash: null,
    workspaces: [],
  });

  const withPolicy = (report: ScanReport): ScanReport => {
    const policy = options.policy
      ? { ...options.policy, strict: Boolean(options.strict || options.policy.strict) }
      : options.strict
        ? { version: 1, strict: true, exceptions: [] }
        : null;
    return applyPolicy(report, policy);
  };

  if (!info.isDirectory() && info.size > limits.maxInputBytes) {
    return withPolicy(inconclusive(`Input is larger than the ${limits.maxInputBytes} byte scan limit.`));
  }

  try {
    if (!info.isDirectory()) {
      packed = await readFile(resolved);
      const hashed = hashFileBytes(packed);
      artifactSha256 = hashed.sha256;
      artifactSha512 = hashed.sha512;
      artifactBytes = packed.length;
      kind = sniffPackFormat(packed, path.basename(resolved)) ?? "file";
    }

    let findings: Finding[] = [];
    let fileCount = 0;
    let totalBytes = 0;
    let manifest: ManifestEntry[] = [];
    let workspaceFiles: WorkspaceFile[] = [];

    const ctx: ScanCtx = { limits, budget: new ScanBudget(limits), depth: 0 };

    if (kind === "directory") {
      ({ findings, fileCount, totalBytes, manifest, workspaceFiles } = await scanDirectory(resolved, ctx));
    } else if (isTarFamilyKind(kind)) {
      ({ findings, fileCount, totalBytes, manifest, workspaceFiles } = await scanTarball(resolved, ctx));
    } else if (isZipFamilyKind(kind)) {
      if (!packed) throw new ScanInconclusiveError("malformed", "Could not read zip.");
      if (kind === "crx" && !unwrapCrx(packed)) {
        throw new ScanInconclusiveError("malformed", CRX_INCONCLUSIVE);
      }
      const payload = zipPayloadForKind(packed, kind);
      if (zipUsesEncryption(payload)) {
        throw new ScanInconclusiveError("malformed", ENCRYPTION_INCONCLUSIVE);
      }
      ({ findings, fileCount, totalBytes, manifest, workspaceFiles } = await scanZipBytes(
        payload,
        ctx,
      ));
    } else if (kind === "asar") {
      ({ findings, fileCount, totalBytes, manifest, workspaceFiles } = await scanAsar(resolved, ctx));
    } else {
      const budget = new ScanBudget(limits);
      const name = path.basename(resolved);
      budget.beginFile(name);
      budget.addBytes(name, info.size, info.size);
      const buf = packed ?? (await readFile(resolved));
      findings = inspectEntry(name, buf.subarray(0, INSPECT_BYTES), info.size);
      fileCount = 1;
      totalBytes = buf.length;
      manifest = [{ path: name, size: buf.length, sha256: sha256Buffer(buf) }];
      pushWorkspace(name, buf, workspaceFiles);
    }

    if (totalBytes >= TOTAL_WARN_BYTES) {
      findings.push({
        rule: "SIZE-002",
        severity: "warn",
        path: path.basename(resolved),
        title: "Packed artifact is far over a normal baseline",
        detail: `Unpacked payload is ${totalBytes} bytes. A jump like this is how a 59 MB source map ships.`,
      });
    }

    const critical = findings.filter((f) => f.severity === "critical");
    const ok = options.strict ? findings.length === 0 : critical.length === 0;
    const status: ScanStatus = ok ? "passed" : "failed-policy";

    return withPolicy({
      target: resolved,
      kind,
      fileCount,
      findings,
      ok,
      status,
      inconclusiveReason: null,
      manifest,
      engineVersion: ENGINE_VERSION,
      artifactSha256,
      artifactSha512,
      artifactBytes,
      scannedAt: new Date().toISOString(),
      suppressed: [],
      policyHash: null,
      workspaces: discoverWorkspaces(workspaceFiles),
    });
  } catch (error) {
    if (error instanceof ScanInconclusiveError) {
      return withPolicy(inconclusive(error.message));
    }
    throw error;
  }
}

export function formatReport(report: ScanReport): string {
  const lines: string[] = [];
  lines.push(`NoSpoilers  ·  ${report.target}`);
  lines.push(`kind ${report.kind}  files ${report.fileCount}  status ${report.status}`);
  const workspaceLine = summarizeWorkspaces(report.workspaces);
  if (workspaceLine) lines.push(workspaceLine);
  if (report.artifactSha256) {
    lines.push(`sha256 ${report.artifactSha256}`);
  }
  if (report.status === "inconclusive") {
    lines.push(report.inconclusiveReason ?? "Inconclusive.");
    lines.push("This is not a clean bill of health. No passing receipt.");
    return lines.join("\n");
  }
  if (report.policyHash) {
    lines.push(`policy ${report.policyHash.slice(0, 12)}`);
  }
  if (report.findings.length === 0) {
    lines.push("Clean. This artifact is allowed to ship.");
  } else {
    for (const finding of report.findings) {
      lines.push("");
      lines.push(`[${finding.severity.toUpperCase()}] ${finding.rule}  ${finding.path}`);
      lines.push(`  ${finding.title}`);
      lines.push(`  ${finding.detail}`);
    }
    lines.push("");
    lines.push(report.ok ? "Warnings only (pass unless --strict)." : "Failed. Spoilers in the pack.");
  }
  if (report.suppressed.length > 0) {
    lines.push("");
    lines.push(`Suppressed by policy (${report.suppressed.length}):`);
    for (const row of report.suppressed) {
      lines.push(
        `  ${row.finding.rule}  ${row.finding.path}  ${row.reason} (expires ${row.expiresAt.slice(0, 10)}, ${row.actor})`,
      );
    }
  }
  return lines.join("\n");
}
