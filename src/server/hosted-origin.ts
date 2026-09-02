import { isBlockedRegistryHost } from "./npm-registry.ts";

export type HostedScanOrigin = {
  origin: string;
  githubRunnersReachable: boolean;
};

export function hostedScanOrigin(appBaseUrl: string): HostedScanOrigin {
  const origin = appBaseUrl.trim().replace(/\/$/, "");
  return {
    origin,
    githubRunnersReachable: githubRunnersCanReachOrigin(origin),
  };
}

export function githubRunnersCanReachOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (!host) return false;
  if (isBlockedRegistryHost(host)) return false;
  return true;
}
