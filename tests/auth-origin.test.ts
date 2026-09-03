import { describe, expect, it } from "vitest";
import { authOrigin } from "../src/server/auth-origin.ts";

describe("GitHub OAuth origin", () => {
  it("uses the stable local origin when the browser is on loopback", () => {
    expect(
      authOrigin(
        "http://127.0.0.1:4347/api/auth/github",
        "https://changing-tunnel.trycloudflare.com",
      ),
    ).toBe("http://127.0.0.1:4347");
    expect(
      authOrigin(
        "http://localhost:4347/api/auth/github",
        "https://changing-tunnel.trycloudflare.com",
      ),
    ).toBe("http://localhost:4347");
  });

  it("keeps the configured public origin for non-local requests", () => {
    expect(
      authOrigin(
        "https://changing-tunnel.trycloudflare.com/api/auth/github",
        "https://changing-tunnel.trycloudflare.com/",
      ),
    ).toBe("https://changing-tunnel.trycloudflare.com");
  });

  it("does not trust an arbitrary Host header as an OAuth callback", () => {
    expect(
      authOrigin(
        "https://attacker.example/api/auth/github",
        "https://app.example",
      ),
    ).toBe("https://app.example");
  });
});
