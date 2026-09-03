import { createHash } from "node:crypto";
import { isBlockedRegistryHost } from "./npm-registry.ts";
import {
  assertPublicWebhookHost,
  isBlockedResolvedAddress,
  lookupWebhookHost,
  type WebhookHostLookup,
} from "./siem.ts";

export const MAX_WATCHED_ORIGINS = 10;
export const MAX_WEB_ASSETS = 40;
export const MAX_WEB_FILE_BYTES = 2_000_000;
export const MAX_WEB_TOTAL_BYTES = 20_000_000;
export const WEB_FETCH_TIMEOUT_MS = 15_000;

/** Bounded same-origin probes. Not a full-site crawl. No `..`. JavaScript is not executed. */
export const EXPOSED_PATH_PROBES = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".git/HEAD",
  ".git/config",
  ".npmrc",
  ".pypirc",
  ".netrc",
  "credentials.json",
  "service-account.json",
  ".aws/credentials",
  ".docker/config.json",
  "id_rsa",
  "id_ed25519",
  "backup.sql",
  "dump.sql",
  "wp-config.php",
  "phpinfo.php",
  "actuator/env",
] as const;

const SENSITIVE_PATH_RE =
  /(?:^|\/)(?:\.env(?:\.[^/]+)?|\.git(?:\/|$)|\.npmrc|\.pypirc|\.netrc|credentials\.json|service-account\.json|id_rsa|id_ed25519|wp-config\.php|phpinfo\.php|dump\.sql|backup\.sql|actuator(?:\/|$)|server-status|debug(?:\/|$)|internal(?:\/|$)|admin(?:\/|$))/i;

const HOST_RE =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export class WebCrawlError extends Error {
  readonly inconclusive = true;
  constructor(message: string) {
    super(message);
    this.name = "WebCrawlError";
  }
}

export type WatchOrigin = {
  url: string;
  host: string;
};

export type CrawledFile = {
  rel: string;
  bytes: Buffer;
};

export type CrawlResult = {
  files: CrawledFile[];
  sha256: string;
  truncated: boolean;
};

export type WebCrawlOpts = {
  fetch?: typeof fetch;
  lookup?: WebhookHostLookup;
  maxAssets?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  timeoutMs?: number;
};

export function parseWatchOrigin(raw: string): WatchOrigin | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2000) return null;
  if (trimmed.includes("\\")) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.hash) return null;
  const host = url.hostname.toLowerCase();
  if (!host || host.length > 253) return null;
  if (isBlockedRegistryHost(host)) return null;
  if (!HOST_RE.test(host)) return null;
  if (url.port) {
    const port = Number(url.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535 || port === 80) return null;
  }
  if (url.pathname.includes("..") || url.pathname.includes("//") || url.pathname.includes("\\")) {
    return null;
  }
  const port = url.port && url.port !== "443" ? `:${url.port}` : "";
  const path = url.pathname || "/";
  const search = url.search;
  return { url: `https://${host}${port}${path}${search}`, host };
}

export function parseWatchRoot(raw: string): WatchOrigin | null {
  const parsed = parseWatchOrigin(raw);
  if (!parsed) return null;
  const url = new URL(parsed.url);
  return { url: `${url.origin}/`, host: parsed.host };
}

export function sameOrigin(left: URL, right: URL): boolean {
  return (
    left.protocol === right.protocol &&
    left.hostname.toLowerCase() === right.hostname.toLowerCase() &&
    (left.port || defaultPort(left.protocol)) === (right.port || defaultPort(right.protocol))
  );
}

function defaultPort(protocol: string): string {
  return protocol === "https:" ? "443" : "80";
}

export function safeRelPath(url: URL, origin: URL): string | null {
  if (!sameOrigin(url, origin)) return null;
  let rel = (url.pathname.replace(/^\/+/, "") || "index.html") + url.search;
  rel = rel.replace(/\\/g, "/");
  if (!rel || rel.includes("..") || rel.startsWith("/") || /^[A-Za-z]:/.test(rel)) return null;
  if (rel.length > 500) return null;
  return rel;
}

export function collectHtmlAssetUrls(html: string, base: URL): string[] {
  const found: string[] = [];
  const scriptSrc = html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi);
  for (const match of scriptSrc) {
    if (match[1]) found.push(match[1]);
  }
  const links = html.matchAll(/<link\b([^>]*?)>/gi);
  for (const match of links) {
    const attrs = match[1] ?? "";
    const rel = /rel\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]?.toLowerCase() ?? "";
    const as = /as\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]?.toLowerCase() ?? "";
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    if (!href) continue;
    if (
      rel.split(/\s+/).includes("stylesheet") ||
      as === "script" ||
      as === "style" ||
      /\.(?:js|mjs|cjs|css)(?:\?|$)/i.test(href)
    ) {
      found.push(href);
    }
  }
  found.push(...collectMapUrls(html, base));
  return uniqueResolved(found, base);
}

export function collectInlineScripts(html: string): string[] {
  const scripts: string[] = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = match[1] ?? "";
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const body = (match[2] ?? "").trim();
    if (body) scripts.push(body);
  }
  return scripts;
}

export function collectMapUrls(text: string, base: URL): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/[#@]\s*sourceMappingURL\s*=\s*(\S+)/g)) {
    const raw = (match[1] ?? "").trim().replace(/["']+$/, "");
    if (raw && !raw.startsWith("data:")) found.push(raw);
  }
  return uniqueResolved(found, base);
}

function uniqueResolved(refs: string[], base: URL): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const trimmed = ref.trim();
    if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("javascript:")) continue;
    let url: URL;
    try {
      url = new URL(trimmed, base);
    } catch {
      continue;
    }
    if (url.protocol !== "https:") continue;
    if (!sameOrigin(url, base)) continue;
    const key = url.href;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function siblingMapUrl(assetUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(assetUrl);
  } catch {
    return null;
  }
  if (url.pathname.endsWith(".map")) return null;
  if (!/\.(?:js|mjs|cjs|css)$/i.test(url.pathname)) return null;
  url.pathname = `${url.pathname}.map`;
  return url.href;
}

export function isHtmlDocument(bytes: Buffer, contentType = ""): boolean {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (type === "text/html" || type === "application/xhtml+xml") return true;
  const start = bytes
    .subarray(0, 512)
    .toString("utf8")
    .replace(/^\uFEFF/, "")
    .trimStart()
    .toLowerCase();
  return start.startsWith("<!doctype html") || start.startsWith("<html");
}

export function collectSensitiveUrls(text: string, base: URL): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/(?:href|src|action)\s*=\s*["']([^"']+)["']/gi)) {
    if (match[1]) found.push(match[1]);
  }
  for (const match of text.matchAll(/\bfetch\(\s*["']([^"']+)["']/gi)) {
    if (match[1]) found.push(match[1]);
  }
  return uniqueResolved(found, base).filter((href) => {
    try {
      return SENSITIVE_PATH_RE.test(new URL(href).pathname);
    } catch {
      return false;
    }
  });
}

export function exposedProbeUrls(pageUrl: URL): string[] {
  const bases = [new URL("/", pageUrl), new URL("./", pageUrl)];
  const hrefs: string[] = [];
  for (const base of bases) {
    for (const probe of EXPOSED_PATH_PROBES) {
      hrefs.push(new URL(probe, base).href);
    }
  }
  return uniqueResolved(hrefs, pageUrl);
}

function isSecretFilePath(rel: string): boolean {
  const p = rel.toLowerCase();
  return (
    p.startsWith(".") ||
    /\.(env|sql|key|pem|npmrc)(\.|$)/.test(p) ||
    p.includes("id_rsa") ||
    p.includes("id_ed25519") ||
    p.includes("credentials.json") ||
    p.includes("service-account.json") ||
    p.includes("wp-config.php")
  );
}

function looksLikePhpInfo(bytes: Buffer): boolean {
  return /phpinfo\s*\(|PHP Version/i.test(bytes.subarray(0, 8000).toString("utf8"));
}

function keepExposedAsset(
  rel: string,
  bytes: Buffer,
  contentType: string,
  homepageSha256: string,
  fromProbe: boolean,
): boolean {
  if (!isHtmlDocument(bytes, contentType)) return true;
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash === homepageSha256) return false;
  if (fromProbe) {
    return /phpinfo\.php$/i.test(rel) && looksLikePhpInfo(bytes);
  }
  if (isSecretFilePath(rel) && !/phpinfo\.php$/i.test(rel)) return false;
  return /(?:^|\/)(?:internal|admin|debug|actuator|server-status|phpinfo)/i.test(rel);
}

async function readCapped(response: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new WebCrawlError(`Asset is larger than the ${maxBytes} byte per-file crawl limit.`);
  }
  const buf = Buffer.from(await response.arrayBuffer());
  if (buf.length > maxBytes) {
    throw new WebCrawlError(`Asset is larger than the ${maxBytes} byte per-file crawl limit.`);
  }
  return buf;
}

export async function fetchPublicHttps(
  rawUrl: string,
  opts: WebCrawlOpts,
  maxBytes: number,
): Promise<{ bytes: Buffer; contentType: string; url: URL }> {
  const parsed = parseWatchOrigin(rawUrl);
  if (!parsed) throw new WebCrawlError("That website URL is not allowed.");
  const url = new URL(parsed.url);
  const lookup = opts.lookup ?? lookupWebhookHost;
  const publicHost = await assertPublicWebhookHost(url.hostname, lookup);
  if (!publicHost) {
    throw new WebCrawlError("Website host resolved to a private or reserved address.");
  }
  const fetchImpl = opts.fetch ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url.href, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(opts.timeoutMs ?? WEB_FETCH_TIMEOUT_MS),
      headers: { accept: "text/html,application/javascript,text/css,application/json,*/*" },
    });
  } catch (error) {
    throw new WebCrawlError(error instanceof Error ? error.message : "Website fetch failed.");
  }
  if (!response.ok) {
    throw new WebCrawlError(`Website returned HTTP ${response.status}.`);
  }
  const bytes = await readCapped(response, maxBytes);
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
  return { bytes, contentType, url };
}

async function tryOptionalHttps(
  rawUrl: string,
  opts: WebCrawlOpts,
  maxBytes: number,
): Promise<{ bytes: Buffer; contentType: string; url: URL } | null> {
  try {
    return await fetchPublicHttps(rawUrl, opts, maxBytes);
  } catch (error) {
    if (
      error instanceof WebCrawlError &&
      /private or reserved/.test(error.message)
    ) {
      throw error;
    }
    if (error instanceof WebCrawlError) return null;
    throw error;
  }
}

export async function crawlOrigin(startUrl: string, opts: WebCrawlOpts = {}): Promise<CrawlResult> {
  const origin = parseWatchOrigin(startUrl);
  if (!origin) throw new WebCrawlError("That website URL is not allowed.");
  const maxAssets = opts.maxAssets ?? MAX_WEB_ASSETS;
  const maxFileBytes = opts.maxFileBytes ?? MAX_WEB_FILE_BYTES;
  const maxTotalBytes = opts.maxTotalBytes ?? MAX_WEB_TOTAL_BYTES;
  const base = new URL(origin.url);
  const files: CrawledFile[] = [];
  const seen = new Set<string>();
  let total = 0;
  let truncated = false;

  const addFile = (rel: string, bytes: Buffer): boolean => {
    if (seen.has(rel)) return true;
    if (files.length >= maxAssets) {
      truncated = true;
      return false;
    }
    if (total + bytes.length > maxTotalBytes) {
      truncated = true;
      return false;
    }
    seen.add(rel);
    total += bytes.length;
    files.push({ rel, bytes });
    return true;
  };

  const page = await fetchPublicHttps(origin.url, opts, maxFileBytes);
  const pageRel = safeRelPath(page.url, base) ?? "index.html";
  addFile(pageRel, page.bytes);
  const homepageSha256 = createHash("sha256").update(page.bytes).digest("hex");

  const html = page.bytes.toString("utf8");
  const probeHrefs = exposedProbeUrls(page.url);
  const probeSet = new Set(probeHrefs);
  const exposedQueue = [...probeHrefs, ...collectSensitiveUrls(html, page.url)];
  for (const href of exposedQueue) {
    if (files.length >= maxAssets || truncated) {
      truncated = true;
      break;
    }
    const rel = safeRelPath(new URL(href), base);
    if (!rel || seen.has(rel)) continue;
    const asset = await tryOptionalHttps(href, opts, maxFileBytes);
    if (!asset) continue;
    if (!keepExposedAsset(rel, asset.bytes, asset.contentType, homepageSha256, probeSet.has(href))) {
      continue;
    }
    if (!addFile(rel, asset.bytes)) break;
  }

  const queue = collectHtmlAssetUrls(html, page.url);
  for (const [index, inline] of collectInlineScripts(html).entries()) {
    addFile(`inline-${index + 1}.js`, Buffer.from(inline));
  }

  const extraMaps: string[] = [];
  for (const href of queue) {
    const sibling = siblingMapUrl(href);
    if (sibling) extraMaps.push(sibling);
  }
  queue.push(...extraMaps);

  for (const href of queue) {
    if (files.length >= maxAssets || truncated) {
      truncated = true;
      break;
    }
    const rel = safeRelPath(new URL(href), base);
    if (!rel || seen.has(rel)) continue;
    try {
      const asset = await fetchPublicHttps(href, opts, maxFileBytes);
      if (!addFile(rel, asset.bytes)) break;
      const text = asset.bytes.subarray(0, 256_000).toString("utf8");
      for (const mapHref of collectMapUrls(text, asset.url)) {
        const mapRel = safeRelPath(new URL(mapHref), base);
        if (!mapRel || seen.has(mapRel)) continue;
        try {
          const map = await fetchPublicHttps(mapHref, opts, maxFileBytes);
          if (!addFile(mapRel, map.bytes)) break;
        } catch (error) {
          if (error instanceof WebCrawlError && /HTTP 404/.test(error.message)) continue;
          throw error;
        }
      }
    } catch (error) {
      if (error instanceof WebCrawlError && /HTTP 404/.test(error.message) && extraMaps.includes(href)) {
        continue;
      }
      throw error;
    }
  }

  const hash = createHash("sha256");
  for (const file of [...files].sort((a, b) => a.rel.localeCompare(b.rel))) {
    hash.update(file.rel);
    hash.update("\0");
    hash.update(file.bytes);
  }
  return { files, sha256: hash.digest("hex"), truncated };
}

export function isBlockedWebAddress(address: string, family: number): boolean {
  return isBlockedResolvedAddress(address, family);
}
