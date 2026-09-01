import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, readlink, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as asar from "@electron/asar";
import JSZip from "jszip";
import { x as tarExtract } from "tar";
import { applyPolicy } from "../policy.ts";
import { INSPECT_BYTES, inspectEntry, linkFinding, TOTAL_WARN_BYTES } from "./inspect.ts";
import {
  ScanInconclusiveError,
  type Finding,
  type ManifestEntry,
  type ScanOptions,
  type ScanReport,
  type ScanStatus,
  type ScanTargetKind,
} from "./types.ts";

export type {
  Finding,
  ManifestEntry,
  ScanOptions,
  ScanReport,
  ScanStatus,
  ScanTargetKind,
} from "./types.ts";
export { ScanInconclusiveError } from "./types.ts";
export { toSarif } from "./sarif.ts";

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
  const lower = target.toLowerCase();
  if (lower.endsWith(".asar")) return "asar";
  if (lower.endsWith(".zip")) return "zip";
  if (lower.endsWith(".tgz") || lower.endsWith(".tar.gz") || lower.endsWith(".tar")) {
    return "tarball";
  }
  return "file";
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
};

function sha256Buffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function hashFileBytes(bytes: Buffer): { sha256: string; sha512: string } {
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sha512: createHash("sha512").update(bytes).digest("hex"),
  };
}

async function scanDirectory(
  root: string,
  limits: ScanLimits,
  prefix = "",
): Promise<ScanChunk> {
  const { files, links } = await walkTree(root);
  const findings: Finding[] = [];
  const manifest: ManifestEntry[] = [];
  const budget = new ScanBudget(limits);
  for (const link of links) {
    const rel = path.join(prefix, path.relative(root, link.abs)).split(path.sep).join("/");
    const finding = linkFinding(rel, link.target);
    if (finding) findings.push(finding);
  }
  for (const abs of files) {
    const rel = path.join(prefix, path.relative(root, abs)).split(path.sep).join("/");
    const info = await stat(abs);
    budget.beginFile(rel);
    budget.addBytes(rel, info.size, info.size);
    const buf = await readFile(abs);
    findings.push(...inspectEntry(rel, buf.subarray(0, INSPECT_BYTES), info.size));
    manifest.push({ path: rel, size: info.size, sha256: sha256Buffer(buf) });
  }
  return { findings, fileCount: budget.files, totalBytes: budget.bytes, manifest };
}

async function scanTarball(archive: string, limits: ScanLimits): Promise<ScanChunk> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "nospoilers-tar-"));
  const extractionBudget = new ScanBudget(limits);
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
          if (type === "SymbolicLink" || type === "Link") {
            const target =
              "linkpath" in entry && typeof entry.linkpath === "string" ? entry.linkpath : "";
            const finding = linkFinding(storedPath, target);
            if (finding) linkFindings.push(finding);
            return false;
          }
          const file =
            type === "File" ||
            type === "OldFile" ||
            type === "ContiguousFile";
          if (!file) return false;
          const size = entry.size ?? 0;
          extractionBudget.beginFile(storedPath);
          extractionBudget.addBytes(storedPath, size, size);
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
    const scanned = await scanDirectory(dir, limits);
    return {
      ...scanned,
      findings: [...linkFindings, ...scanned.findings],
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function scanZip(archive: string, limits: ScanLimits): Promise<ScanChunk> {
  let buf: Buffer;
  try {
    buf = await readFile(archive);
  } catch (error) {
    throw new ScanInconclusiveError(
      "malformed",
      error instanceof Error ? error.message : "Could not read zip.",
    );
  }
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
  const budget = new ScanBudget(limits);
  const names = Object.keys(zip.files);
  for (const name of names) {
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;
    budget.beginFile(name);
    const stream = entry.nodeStream("nodebuffer");
    const chunks: Buffer[] = [];
    const hash = createHash("sha256");
    let fileBytes = 0;
    let retainedBytes = 0;
    await new Promise<void>((resolve, reject) => {
      let stopped = false;
      stream.on("data", (raw: Buffer | Uint8Array) => {
        if (stopped) return;
        try {
          const chunk = Buffer.from(raw);
          fileBytes += chunk.length;
          budget.addBytes(name, chunk.length, fileBytes);
          hash.update(chunk);
          if (retainedBytes < INSPECT_BYTES) {
            const kept = chunk.subarray(0, INSPECT_BYTES - retainedBytes);
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
    findings.push(...inspectEntry(name, Buffer.concat(chunks, retainedBytes), fileBytes));
    manifest.push({ path: name, size: fileBytes, sha256: hash.digest("hex") });
  }
  return { findings, fileCount: budget.files, totalBytes: budget.bytes, manifest };
}

async function scanAsar(archive: string, limits: ScanLimits): Promise<ScanChunk> {
  const listed = asar.listPackage(archive, { isPack: false });
  const findings: Finding[] = [];
  const manifest: ManifestEntry[] = [];
  const budget = new ScanBudget(limits);
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
    budget.beginFile(posix);
    budget.addBytes(posix, record.size, record.size);
    const content = asar.extractFile(archive, posix);
    findings.push(...inspectEntry(posix, content.subarray(0, INSPECT_BYTES), record.size));
    manifest.push({ path: posix, size: record.size, sha256: sha256Buffer(content) });
  }
  return { findings, fileCount: budget.files, totalBytes: budget.bytes, manifest };
}

export async function scan(target: string, options: ScanOptions = {}): Promise<ScanReport> {
  const resolved = path.resolve(target);
  const info = await stat(resolved);
  const kind = kindOf(resolved, info.isDirectory());
  const limits = limitsFor(options);
  let artifactSha256: string | null = null;
  let artifactSha512: string | null = null;
  let artifactBytes: number | null = info.isDirectory() ? null : info.size;

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
      const packed = await readFile(resolved);
      const hashed = hashFileBytes(packed);
      artifactSha256 = hashed.sha256;
      artifactSha512 = hashed.sha512;
      artifactBytes = packed.length;
    }

    let findings: Finding[] = [];
    let fileCount = 0;
    let totalBytes = 0;
    let manifest: ManifestEntry[] = [];

    if (kind === "directory") {
      ({ findings, fileCount, totalBytes, manifest } = await scanDirectory(resolved, limits));
    } else if (kind === "tarball") {
      ({ findings, fileCount, totalBytes, manifest } = await scanTarball(resolved, limits));
    } else if (kind === "zip") {
      ({ findings, fileCount, totalBytes, manifest } = await scanZip(resolved, limits));
    } else if (kind === "asar") {
      ({ findings, fileCount, totalBytes, manifest } = await scanAsar(resolved, limits));
    } else {
      const budget = new ScanBudget(limits);
      const name = path.basename(resolved);
      budget.beginFile(name);
      budget.addBytes(name, info.size, info.size);
      const buf = await readFile(resolved);
      findings = inspectEntry(name, buf.subarray(0, INSPECT_BYTES), info.size);
      fileCount = 1;
      totalBytes = buf.length;
      manifest = [{ path: name, size: buf.length, sha256: sha256Buffer(buf) }];
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
