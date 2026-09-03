import { describe, expect, it } from "vitest";
import {
  domainVerificationChallenge,
  hashDeployToken,
  mintDeployToken,
  parseDeployBearer,
  verifyDomainOwnership,
} from "../src/server/domain-verification.ts";

describe("website ownership verification", () => {
  it("verifies the exact DNS TXT challenge", async () => {
    const challenge = domainVerificationChallenge("app.example.com", "A".repeat(32));
    const result = await verifyDomainOwnership(
      "app.example.com",
      challenge.token,
      "dns",
      {
        resolveTxt: async (name) => {
          expect(name).toBe("_nospoilers.app.example.com");
          return [[challenge.dnsValue]];
        },
      },
    );
    expect(result.method).toBe("dns");
  });

  it("verifies an HTTPS well-known file without following redirects", async () => {
    const challenge = domainVerificationChallenge("app.example.com", "B".repeat(32));
    const result = await verifyDomainOwnership(
      "app.example.com",
      challenge.token,
      "http",
      {
        lookup: async () => [{ address: "1.1.1.1", family: 4 }],
        fetch: (async (input, init) => {
          expect(String(input)).toBe(challenge.httpUrl);
          expect(init?.redirect).toBe("error");
          return new Response(challenge.httpBody);
        }) as typeof fetch,
      },
    );
    expect(result.method).toBe("http");
  });

  it("rejects missing proof and mints one-time deploy tokens", async () => {
    await expect(
      verifyDomainOwnership("app.example.com", "C".repeat(32), "dns", {
        resolveTxt: async () => [["wrong"]],
      }),
    ).rejects.toThrow(/does not contain/);

    const minted = mintDeployToken();
    expect(parseDeployBearer(`Bearer ${minted.token}`)).toBe(minted.token);
    expect(parseDeployBearer("Bearer wrong")).toBeNull();
    expect(hashDeployToken(minted.token)).toBe(minted.tokenHash);
    expect(minted.tokenHash).not.toContain(minted.token);
  });
});
