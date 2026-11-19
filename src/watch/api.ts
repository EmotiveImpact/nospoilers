export class WatchApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "WatchApiError";
    this.status = status;
  }
}

export async function loadWatchJson<T>(
  url: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const response = await fetcher(url, {
    credentials: "include",
    ...init,
  });
  // A proxy 502/413 page is HTML; never surface the JSON parser's "Unexpected token" to people.
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new WatchApiError(body?.error ?? `Request failed (${response.status})`, response.status);
  }
  if (body === null) throw new WatchApiError(`Unreadable response (${response.status})`, response.status);
  return body;
}

export function scopedWatchApi(path: string, installationId: number | null): string {
  if (!installationId) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}installationId=${installationId}`;
}

/**
 * Starts unrelated desk reads together without coupling their success states.
 * Callers consume each named result independently so one failing endpoint does
 * not erase healthy data from every route.
 */
export async function loadWatchResources<T extends Record<string, () => Promise<unknown>>>(
  resources: T,
): Promise<{ [K in keyof T]: PromiseSettledResult<Awaited<ReturnType<T[K]>>> }> {
  const entries = Object.entries(resources);
  const settled = await Promise.allSettled(entries.map(([, load]) => load()));
  return Object.fromEntries(
    entries.map(([key], index) => [key, settled[index]]),
  ) as { [K in keyof T]: PromiseSettledResult<Awaited<ReturnType<T[K]>>> };
}
