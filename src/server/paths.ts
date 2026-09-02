import path from "node:path";
import { PACK_FILE_RE } from "../scanner/formats.ts";

export const PACK_NAME = PACK_FILE_RE;

const ELECTRON_INSTALLER_EXT_RE = /\.(?:dmg|exe|msi|appimage)$/i;

/** electron-builder / Forge desktop zips: Hearback-0.1.7-arm64-mac.zip, App-darwin-arm64.zip */
const ELECTRON_DESKTOP_ZIP_RE =
  /(?:^|[._-])(?:(?:mac|osx|darwin|win|win32|windows)(?:[._-](?:arm64|x64|ia32|x86_64|amd64|universal))?|(?:arm64|x64|ia32|x86_64|amd64|universal)[._-](?:mac|osx|darwin|win|win32|windows))\.zip$/i;

export const ELECTRON_INSTALLER_SKIP_NOTE =
  "NoSpoilers does not unpack DMG, EXE, MSI, AppImage, or mac/win desktop zip bundles on this worker. That stays on an isolated installer worker. Attach a packed artifact (.tgz, a zip that is not a desktop installer, .asar, …) to scan here. Source trees are not scanned. Installers are not executed.";

export function isPackAssetName(name: string): boolean {
  return PACK_FILE_RE.test(name);
}

export function isElectronInstallerName(name: string): boolean {
  const base = path.posix.basename(name.replace(/\\/g, "/"));
  return ELECTRON_INSTALLER_EXT_RE.test(base) || ELECTRON_DESKTOP_ZIP_RE.test(base);
}

export function isScannablePackAssetName(name: string): boolean {
  return isPackAssetName(name) && !isElectronInstallerName(name);
}

export function cheapSensitivePaths(filenames: string[]): string[] {
  const hits: string[] = [];
  for (const file of filenames) {
    const base = file.split("/").pop() ?? file;
    if (base.endsWith(".map")) hits.push(file);
    else if (base === ".env" || base.startsWith(".env.")) hits.push(file);
  }
  return hits;
}

export function pathsFromPushPayload(payload: {
  commits?: { added?: string[]; modified?: string[]; removed?: string[] }[];
}): string[] {
  const names = new Set<string>();
  for (const commit of payload.commits ?? []) {
    for (const name of [...(commit.added ?? []), ...(commit.modified ?? []), ...(commit.removed ?? [])]) {
      names.add(name);
    }
  }
  return [...names];
}
