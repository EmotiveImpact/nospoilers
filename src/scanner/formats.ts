import path from "node:path";
import type { ScanTargetKind } from "./types.ts";

export const PACK_FILE_RE =
  /\.(?:tgz|tar\.gz|tar|zip|asar|vsix|crx|xpi|whl|jar|war|nupkg|snupkg|gem)$/i;

const ZIP_KINDS = new Set<ScanTargetKind>([
  "zip",
  "vsix",
  "crx",
  "xpi",
  "wheel",
  "jar",
  "nupkg",
]);

const TAR_KINDS = new Set<ScanTargetKind>(["tarball", "gem"]);

export function isZipFamilyKind(kind: ScanTargetKind): boolean {
  return ZIP_KINDS.has(kind);
}

export function isTarFamilyKind(kind: ScanTargetKind): boolean {
  return TAR_KINDS.has(kind);
}

export function packFormatFromName(name: string): ScanTargetKind | null {
  const lower = path.posix.basename(name.replace(/\\/g, "/")).toLowerCase();
  if (lower.endsWith(".asar")) return "asar";
  if (lower.endsWith(".vsix")) return "vsix";
  if (lower.endsWith(".crx")) return "crx";
  if (lower.endsWith(".xpi")) return "xpi";
  if (lower.endsWith(".whl")) return "wheel";
  if (lower.endsWith(".jar") || lower.endsWith(".war")) return "jar";
  if (lower.endsWith(".nupkg") || lower.endsWith(".snupkg")) return "nupkg";
  if (lower.endsWith(".gem")) return "gem";
  if (lower.endsWith(".zip")) return "zip";
  if (lower.endsWith(".tgz") || lower.endsWith(".tar.gz") || lower.endsWith(".tar")) {
    return "tarball";
  }
  return null;
}

function isZipMagic(bytes: Buffer): boolean {
  if (bytes.length < 4) return false;
  return (
    (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) ||
    (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x05 && bytes[3] === 0x06) ||
    (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x07 && bytes[3] === 0x08)
  );
}

function isCrxMagic(bytes: Buffer): boolean {
  return bytes.length >= 4 && bytes.subarray(0, 4).toString("latin1") === "Cr24";
}

function isGzipMagic(bytes: Buffer): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function isTarMagic(bytes: Buffer): boolean {
  if (bytes.length < 262) return false;
  const magic = bytes.subarray(257, 262).toString("latin1");
  return magic === "ustar" || magic.startsWith("ustar");
}

export function unwrapCrx(bytes: Buffer): Buffer | null {
  if (!isCrxMagic(bytes) || bytes.length < 16) return null;
  const version = bytes.readUInt32LE(4);
  let start = 0;
  if (version === 3) {
    const headerSize = bytes.readUInt32LE(8);
    start = 12 + headerSize;
  } else if (version === 2) {
    const pubKeyLen = bytes.readUInt32LE(8);
    const sigLen = bytes.readUInt32LE(12);
    start = 16 + pubKeyLen + sigLen;
  } else {
    return null;
  }
  if (start <= 0 || start >= bytes.length) return null;
  const zip = bytes.subarray(start);
  return isZipMagic(zip) ? zip : null;
}

export function zipPayloadForKind(bytes: Buffer, kind: ScanTargetKind): Buffer {
  if (kind !== "crx") return bytes;
  return unwrapCrx(bytes) ?? bytes;
}

function decodeZipName(bytes: Buffer): string {
  return bytes.toString("utf8");
}

/** Stored local and central names. JSZip resolves `..`; this list does not. */
export function listZipEntryNames(bytes: Buffer): string[] {
  const names: string[] = [];
  let offset = 0;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0x50 || bytes[offset + 1] !== 0x4b) break;
    const sig = bytes.readUInt32LE(offset);
    if (sig === 0x04034b50) {
      if (offset + 30 > bytes.length) break;
      const flags = bytes.readUInt16LE(offset + 6);
      const nameLen = bytes.readUInt16LE(offset + 26);
      const extraLen = bytes.readUInt16LE(offset + 28);
      const compSize = bytes.readUInt32LE(offset + 18);
      const nameStart = offset + 30;
      if (nameStart + nameLen > bytes.length) break;
      names.push(decodeZipName(bytes.subarray(nameStart, nameStart + nameLen)));
      const header = 30 + nameLen + extraLen;
      if (flags & 0x8) {
        offset += header;
        const next = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x07, 0x08]), offset);
        if (next < 0) break;
        offset = next + 16;
        continue;
      }
      offset += header + compSize;
      continue;
    }
    if (sig === 0x02014b50) {
      if (offset + 46 > bytes.length) break;
      const nameLen = bytes.readUInt16LE(offset + 28);
      const extraLen = bytes.readUInt16LE(offset + 30);
      const commentLen = bytes.readUInt16LE(offset + 32);
      const nameStart = offset + 46;
      if (nameStart + nameLen > bytes.length) break;
      names.push(decodeZipName(bytes.subarray(nameStart, nameStart + nameLen)));
      offset += 46 + nameLen + extraLen + commentLen;
      continue;
    }
    if (sig === 0x06054b50 || sig === 0x07084b50) break;
    break;
  }
  return names;
}

export function zipUsesEncryption(bytes: Buffer): boolean {
  let offset = 0;
  while (offset + 30 <= bytes.length) {
    if (bytes[offset] !== 0x50 || bytes[offset + 1] !== 0x4b) break;
    const sig = bytes.readUInt32LE(offset);
    if (sig === 0x04034b50) {
      const flags = bytes.readUInt16LE(offset + 6);
      if (flags & 0x1) return true;
      const nameLen = bytes.readUInt16LE(offset + 26);
      const extraLen = bytes.readUInt16LE(offset + 28);
      const compSize = bytes.readUInt32LE(offset + 18);
      const header = 30 + nameLen + extraLen;
      if (flags & 0x8) {
        offset += header;
        const next = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x07, 0x08]), offset);
        if (next < 0) break;
        offset = next + 16;
        continue;
      }
      offset += header + compSize;
      continue;
    }
    if (sig === 0x02014b50 || sig === 0x06054b50) break;
    break;
  }
  return false;
}

/** Same collapse JSZip applies so we can skip inspecting sanitized zip-slip entries. */
export function zipResolvedName(name: string): string {
  const parts = name.replace(/\\/g, "/").split("/");
  const result: string[] = [];
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (part === "." || (part === "" && index !== 0 && index !== parts.length - 1)) {
      continue;
    }
    if (part === "..") {
      result.pop();
      continue;
    }
    result.push(part);
  }
  return result.join("/");
}

export function archivePathEscapes(name: string): boolean {
  const n = name.replace(/\\/g, "/");
  if (!n || n.startsWith("/") || n.startsWith("~") || /^[A-Za-z]:/.test(n)) return true;
  return n.split("/").includes("..");
}

export function sniffPackFormat(bytes: Buffer, filename = ""): ScanTargetKind | null {
  const fromName = packFormatFromName(filename);
  if (isCrxMagic(bytes)) return "crx";
  if (isZipMagic(bytes)) {
    if (fromName && ZIP_KINDS.has(fromName)) return fromName;
    if (fromName === "crx") return "crx";
    return "zip";
  }
  if (isGzipMagic(bytes) || isTarMagic(bytes)) {
    if (fromName === "gem") return "gem";
    return "tarball";
  }
  return fromName;
}

export const ENCRYPTION_INCONCLUSIVE =
  "Encrypted zip entries are not decrypted. The scan is inconclusive, never a passing receipt.";

export const CRX_INCONCLUSIVE =
  "CRX header did not contain a ZIP payload. The signing wrapper is not executed.";
