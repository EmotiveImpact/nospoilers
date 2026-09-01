import path from "node:path";
import type { ScanTargetKind } from "./types.ts";

export const PACK_FILE_RE =
  /\.(?:tgz|tar\.gz|tar|zip|asar|vsix|crx|xpi|whl|jar|war|nupkg|snupkg|gem|apk|aab|ipa|xapk)$/i;

const ZIP_KINDS = new Set<ScanTargetKind>([
  "zip",
  "vsix",
  "crx",
  "xpi",
  "wheel",
  "jar",
  "nupkg",
  "apk",
  "aab",
  "ipa",
]);

const NAMED_ZIP_KINDS = new Set<ScanTargetKind>(["vsix", "crx", "xpi", "wheel", "jar", "nupkg"]);

const TAR_KINDS = new Set<ScanTargetKind>(["tarball", "gem", "docker", "oci"]);

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
  if (lower.endsWith(".apk") || lower.endsWith(".xapk")) return "apk";
  if (lower.endsWith(".aab")) return "aab";
  if (lower.endsWith(".ipa")) return "ipa";
  if (lower.endsWith(".oci.tar") || lower.endsWith(".oci")) return "oci";
  if (lower.endsWith(".docker.tar")) return "docker";
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

export function sniffMobileLayout(paths: string[]): "apk" | "aab" | "ipa" | null {
  const names = paths.map((p) => posixArchivePath(p).split("!/")[0] ?? p);
  if (names.some((n) => /(?:^|\/)Payload\/[^/]+\.app\//i.test(n) || n === "iTunesMetadata.plist")) {
    return "ipa";
  }
  if (
    names.some(
      (n) =>
        n === "BundleConfig.pb" ||
        n.endsWith("/BundleConfig.pb") ||
        n.startsWith("base/manifest/") ||
        n.includes("/base/manifest/"),
    )
  ) {
    return "aab";
  }
  if (
    names.some(
      (n) =>
        n === "AndroidManifest.xml" ||
        n.endsWith("/AndroidManifest.xml") ||
        /(?:^|\/)classes\d*\.dex$/i.test(n),
    )
  ) {
    return "apk";
  }
  return null;
}

export function sniffPackFormat(bytes: Buffer, filename = ""): ScanTargetKind | null {
  const fromName = packFormatFromName(filename);
  if (isCrxMagic(bytes)) return "crx";
  if (isZipMagic(bytes)) {
    if (fromName === "crx") return "crx";
    if (fromName && NAMED_ZIP_KINDS.has(fromName)) return fromName;
    const mobile = sniffMobileLayout(listZipEntryNames(bytes));
    if (mobile) return mobile;
    if (fromName && ZIP_KINDS.has(fromName)) return fromName;
    return "zip";
  }
  if (isGzipMagic(bytes) || isTarMagic(bytes)) {
    if (fromName === "gem") return "gem";
    if (fromName === "oci" || fromName === "docker") return fromName;
    return "tarball";
  }
  return fromName;
}

export const ENCRYPTION_INCONCLUSIVE =
  "Encrypted zip entries are not decrypted. The scan is inconclusive, never a passing receipt.";

export const CRX_INCONCLUSIVE =
  "CRX header did not contain a ZIP payload. The signing wrapper is not executed.";

export const IMAGE_ENCRYPTION_INCONCLUSIVE =
  "Encrypted OCI/Docker layers are not decrypted. The scan is inconclusive, never a passing receipt. Image signatures are not verified and not executed.";

export const MOBILE_SIGNING_NOTE =
  "APK Signature Scheme v1–v4, Play App Signing, and Apple code signatures are not verified. FairPlay-encrypted Mach-O and other encrypted payloads are not decrypted. DEX, native libraries, and Mach-O are never executed.";

function posixArchivePath(rel: string): string {
  return rel.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function isImageLayerPath(rel: string): boolean {
  const posix = posixArchivePath(rel);
  const outer = posix.includes("!/") ? posix.slice(0, posix.indexOf("!/")) : posix;
  const base = path.posix.basename(outer);
  if (base === "layer.tar") return true;
  return /(?:^|\/)blobs\/sha256\/[a-f0-9]{64}$/i.test(outer);
}

export function couldBeImageManifest(rel: string): boolean {
  const posix = posixArchivePath(rel);
  const base = path.posix.basename(posix);
  if (base === "manifest.json" || base === "index.json" || base === "oci-layout") return true;
  return /(?:^|\/)blobs\/sha256\/[a-f0-9]{64}$/i.test(posix);
}

function jsonHasEncryptedLayer(value: unknown, depth = 0): boolean {
  if (depth > 10 || value == null) return false;
  if (Array.isArray(value)) return value.some((item) => jsonHasEncryptedLayer(item, depth + 1));
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if (typeof rec.mediaType === "string") {
      const mediaType = rec.mediaType.toLowerCase();
      if (mediaType.includes("encrypted") && (mediaType.includes("layer") || mediaType.includes("tar"))) {
        return true;
      }
    }
    return Object.values(rec).some((item) => jsonHasEncryptedLayer(item, depth + 1));
  }
  return false;
}

export function imageManifestUsesEncryption(rel: string, buf: Buffer): boolean {
  if (!couldBeImageManifest(rel) || buf.length > 2_000_000 || buf.length < 2) return false;
  const start = buf.subarray(0, 1).toString("utf8");
  if (start !== "{" && start !== "[") return false;
  try {
    return jsonHasEncryptedLayer(JSON.parse(buf.toString("utf8")));
  } catch {
    return false;
  }
}

export function sniffImageLayout(paths: string[]): "docker" | "oci" | null {
  const names = paths.map((p) => posixArchivePath(p).split("!/")[0] ?? p);
  const hasOciLayout = names.some((n) => n === "oci-layout");
  const hasIndex = names.some((n) => n === "index.json");
  const hasBlobs = names.some((n) => n.startsWith("blobs/sha256/") || n.includes("/blobs/sha256/"));
  if (hasOciLayout || (hasIndex && hasBlobs)) return "oci";
  const hasManifest = names.some((n) => n === "manifest.json");
  const hasLayerTar = names.some((n) => n === "layer.tar" || n.endsWith("/layer.tar"));
  if (hasManifest && (hasLayerTar || hasBlobs)) return "docker";
  return null;
}
