import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as asar from "@electron/asar";
import JSZip from "jszip";
import { x as tarExtract } from "tar";
import type { ReadEntry } from "tar";
import { INSPECT_BYTES, inspectEntry, TOTAL_WARN_BYTES } from "./inspect.ts";
import type { Finding, ScanOptions, ScanReport, ScanTargetKind } from "./types.ts";

export type { Finding, ScanOptions, ScanReport, ScanTargetKind } from "./types.ts";
export { toSarif } from "./sarif.ts";

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
      throw new Error(`Scan exceeded ${this.limits.timeoutMs / 1000} seconds.`);
    }
  }

  beginFile(filePath: string): void {
    this.checkTime();
    this.files += 1;
    if (this.files > this.limits.maxFiles) {
      throw new Error(
        `Archive contains more than ${this.limits.maxFiles} files (stopped at ${filePath}).`,
      );
    }
  }

  addBytes(filePath: string, chunkBytes: number, fileBytes: number): void {
    this.checkTime();
    if (fileBytes > this.limits.maxFileBytes) {
      throw new Error(
        `${filePath} expands beyond the ${this.limits.maxFileBytes} byte per-file limit.`,
      );
    }
    this.bytes += chunkBytes;
    if (this.bytes > this.limits.maxUnpackedBytes) {
      throw new Error(
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

async function walkFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(root, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const parent = entry.parentPath;
    files.push(path.join(parent, entry.name));
  }
  return files;
}

type ScanChunk = { findings: Finding[]; fileCount: number; totalBytes: number };

async function scanDirectory(
  root: string,
  limits: ScanLimits,
  prefix = "",
): Promise<ScanChunk> {
  const files = await walkFiles(root);
  const findings: Finding[] = [];
  const budget = new ScanBudget(limits);
  for (const abs of files) {
    const rel = path.join(prefix, path.relative(root, abs)).split(path.sep).join("/");
    const info = await stat(abs);
    budget.beginFile(rel);
    budget.addBytes(rel, info.size, info.size);
    const buf = await readFile(abs);
    findings.push(...inspectEntry(rel, buf.subarray(0, INSPECT_BYTES), info.size));
  }
  return { findings, fileCount: budget.files, totalBytes: budget.bytes };
}

async function scanTarball(archive: string, limits: ScanLimits): Promise<ScanChunk> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "nospoilers-tar-"));
  const extractionBudget = new ScanBudget(limits);
  try {
    await tarExtract({
      file: archive,
      cwd: dir,
      filter(_entryPath: string, entry: ReadEntry) {
        const file =
          entry.type === "File" ||
          entry.type === "OldFile" ||
          entry.type === "ContiguousFile";
        if (!file) return entry.type !== "SymbolicLink" && entry.type !== "Link";
        const size = entry.size ?? 0;
        extractionBudget.beginFile(entry.path);
        extractionBudget.addBytes(entry.path, size, size);
        return true;
      },
    });
    return await scanDirectory(dir, limits);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function scanZip(archive: string, limits: ScanLimits): Promise<ScanChunk> {
  const buf = await readFile(archive);
  const zip = await JSZip.loadAsync(buf);
  const findings: Finding[] = [];
  const budget = new ScanBudget(limits);
  const names = Object.keys(zip.files);
  for (const name of names) {
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;
    budget.beginFile(name);
    const stream = entry.nodeStream("nodebuffer");
    const chunks: Buffer[] = [];
    let fileBytes = 0;
    let retainedBytes = 0;
    for await (const raw of stream as NodeJS.ReadableStream & AsyncIterable<Buffer | Uint8Array>) {
      const chunk = Buffer.from(raw);
      fileBytes += chunk.length;
      budget.addBytes(name, chunk.length, fileBytes);
      if (retainedBytes < INSPECT_BYTES) {
        const kept = chunk.subarray(0, INSPECT_BYTES - retainedBytes);
        chunks.push(kept);
        retainedBytes += kept.length;
      }
    }
    findings.push(...inspectEntry(name, Buffer.concat(chunks, retainedBytes), fileBytes));
  }
  return { findings, fileCount: budget.files, totalBytes: budget.bytes };
}

async function scanAsar(archive: string, limits: ScanLimits): Promise<ScanChunk> {
  const listed = asar.listPackage(archive, { isPack: false });
  const findings: Finding[] = [];
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
  }
  return { findings, fileCount: budget.files, totalBytes: budget.bytes };
}

export async function scan(target: string, options: ScanOptions = {}): Promise<ScanReport> {
  const resolved = path.resolve(target);
  const info = await stat(resolved);
  const kind = kindOf(resolved, info.isDirectory());
  const limits = limitsFor(options);
  if (!info.isDirectory() && info.size > limits.maxInputBytes) {
    throw new Error(`Input is larger than the ${limits.maxInputBytes} byte scan limit.`);
  }

  let findings: Finding[] = [];
  let fileCount = 0;
  let totalBytes = 0;

  if (kind === "directory") {
    ({ findings, fileCount, totalBytes } = await scanDirectory(resolved, limits));
  } else if (kind === "tarball") {
    ({ findings, fileCount, totalBytes } = await scanTarball(resolved, limits));
  } else if (kind === "zip") {
    ({ findings, fileCount, totalBytes } = await scanZip(resolved, limits));
  } else if (kind === "asar") {
    ({ findings, fileCount, totalBytes } = await scanAsar(resolved, limits));
  } else {
    const budget = new ScanBudget(limits);
    budget.beginFile(path.basename(resolved));
    budget.addBytes(path.basename(resolved), info.size, info.size);
    const buf = await readFile(resolved);
    findings = inspectEntry(path.basename(resolved), buf.subarray(0, INSPECT_BYTES), info.size);
    fileCount = 1;
    totalBytes = buf.length;
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

  return {
    target: resolved,
    kind,
    fileCount,
    findings,
    ok,
    scannedAt: new Date().toISOString(),
  };
}

export function formatReport(report: ScanReport): string {
  const lines: string[] = [];
  lines.push(`NoSpoilers  ·  ${report.target}`);
  lines.push(`kind ${report.kind}  files ${report.fileCount}  findings ${report.findings.length}`);
  if (report.findings.length === 0) {
    lines.push("Clean. This artifact is allowed to ship.");
    return lines.join("\n");
  }
  for (const finding of report.findings) {
    lines.push("");
    lines.push(`[${finding.severity.toUpperCase()}] ${finding.rule}  ${finding.path}`);
    lines.push(`  ${finding.title}`);
    lines.push(`  ${finding.detail}`);
  }
  lines.push("");
  lines.push(report.ok ? "Warnings only (pass unless --strict)." : "Failed. Spoilers in the pack.");
  return lines.join("\n");
}
