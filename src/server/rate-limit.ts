export function createRateLimiter(opts: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string, now = Date.now()): boolean {
      if (opts.limit <= 0) return true;
      const recent = (hits.get(key) ?? []).filter((at) => now - at < opts.windowMs);
      if (recent.length >= opts.limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}

export function clientKey(forwardedFor: string | undefined, realIp: string | undefined): string {
  const forwarded = forwardedFor?.split(",")[0]?.trim();
  return forwarded || realIp?.trim() || "local";
}
