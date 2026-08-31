import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as asar from "@electron/asar";
import JSZip from "jszip";
import { x as tarExtract } from "tar";
import { inspectEntry, TOTAL_WARN_BYTES } from "./inspect.ts";
import type { Finding, ScanOptions, ScanReport, ScanTargetKind } from "./types.ts";

export type { Finding, ScanOptions, ScanReport, ScanTargetKind } from "./types.ts";
export { toSarif } from "./sarif.ts";

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

async function scanDirectory(root: string, prefix = ""): Promise<ScanChunk> {
  const files = await walkFiles(root);
  const findings: Finding[] = [];
  let totalBytes = 0;
  for (const abs of files) {
    const rel = path.join(prefix, path.relative(root, abs)).split(path.sep).join("/");
    const buf = await readFile(abs);
    totalBytes += buf.length;
    findings.push(...inspectEntry(rel, buf));
  }
  return { findings, fileCount: files.length, totalBytes };
}

async function scanTarball(archive: string): Promise<ScanChunk> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "nospoilers-tar-"));
  try {
    await tarExtract({ file: archive, cwd: dir });
    return await scanDirectory(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function scanZip(archive: string): Promise<ScanChunk> {
  const buf = await readFile(archive);
  const zip = await JSZip.loadAsync(buf);
  const findings: Finding[] = [];
  let fileCount = 0;
  let totalBytes = 0;
  const names = Object.keys(zip.files);
  for (const name of names) {
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;
    fileCount += 1;
    const content = await entry.async("nodebuffer");
    totalBytes += content.length;
    findings.push(...inspectEntry(name, content));
  }
  return { findings, fileCount, totalBytes };
}

async function scanAsar(archive: string): Promise<ScanChunk> {
  const listed = asar.listPackage(archive, { isPack: false });
  const findings: Finding[] = [];
  let fileCount = 0;
  let totalBytes = 0;
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
    fileCount += 1;
    const content = asar.extractFile(archive, posix);
    totalBytes += content.length;
    findings.push(...inspectEntry(posix, content));
  }
  return { findings, fileCount, totalBytes };
}

export async function scan(target: string, options: ScanOptions = {}): Promise<ScanReport> {
  const resolved = path.resolve(target);
  const info = await stat(resolved);
  const kind = kindOf(resolved, info.isDirectory());

  let findings: Finding[] = [];
  let fileCount = 0;
  let totalBytes = 0;

  if (kind === "directory") {
    ({ findings, fileCount, totalBytes } = await scanDirectory(resolved));
  } else if (kind === "tarball") {
    ({ findings, fileCount, totalBytes } = await scanTarball(resolved));
  } else if (kind === "zip") {
    ({ findings, fileCount, totalBytes } = await scanZip(resolved));
  } else if (kind === "asar") {
    ({ findings, fileCount, totalBytes } = await scanAsar(resolved));
  } else {
    const buf = await readFile(resolved);
    findings = inspectEntry(path.basename(resolved), buf);
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
