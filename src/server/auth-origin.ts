const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function authOrigin(requestUrl: string, appBaseUrl: string): string {
  try {
    const request = new URL(requestUrl);
    if (LOOPBACK_HOSTS.has(request.hostname.toLowerCase())) {
      return request.origin;
    }
  } catch {
    // Fall back to the configured public origin.
  }
  return appBaseUrl.replace(/\/$/, "");
}
