import { describe, expect, it } from "vitest";
import {
  isBlockedRegistryHost,
  isPublicNpmOrigin,
  parseRegistryOrigin,
  PUBLIC_NPM_ORIGIN,
  registryMetadataUrl,
  validateRegistryToken,
} from "../src/server/npm-registry.ts";
import { allowedNpmTarballUrl, packFromRegistry } from "../src/server/npm.ts";

describe("private registry origin", () => {
  it("accepts https package hosts and GitHub packages", () => {
    expect(parseRegistryOrigin("https://npm.pkg.github.com")).toEqual({
      origin: "https://npm.pkg.github.com",
      host: "npm.pkg.github.com",
    });
    expect(parseRegistryOrigin("https://gitlab.example.com/api/v4/packages/npm")).toEqual({
      origin: "https://gitlab.example.com/api/v4/packages/npm",
      host: "gitlab.example.com",
    });
    expect(isPublicNpmOrigin(PUBLIC_NPM_ORIGIN)).toBe(true);
    expect(isPublicNpmOrigin("https://npm.pkg.github.com")).toBe(false);
  });

  it("rejects loopback, metadata, IP literals, http, and embedded credentials", () => {
    expect(parseRegistryOrigin("http://npm.pkg.github.com")).toBeNull();
    expect(parseRegistryOrigin("https://127.0.0.1/npm")).toBeNull();
    expect(parseRegistryOrigin("https://localhost")).toBeNull();
    expect(parseRegistryOrigin("https://10.0.0.4")).toBeNull();
    expect(parseRegistryOrigin("https://169.254.169.254")).toBeNull();
    expect(parseRegistryOrigin("https://192.168.1.9")).toBeNull();
    expect(parseRegistryOrigin("https://user:token@npm.pkg.github.com")).toBeNull();
    expect(isBlockedRegistryHost("metadata.google.internal")).toBe(true);
    expect(validateRegistryToken("short")).toBeNull();
    expect(validateRegistryToken("good-token-value")).toBe("good-token-value");
  });

  it("keeps tarball downloads on the saved host", () => {
    expect(() =>
      allowedNpmTarballUrl("https://evil.example/x.tgz", "npm.pkg.github.com"),
    ).toThrow(/npm.pkg.github.com/);
    const parsed = packFromRegistry(
      "@acme/pack",
      {
        name: "@acme/pack",
        "dist-tags": { latest: "1.0.0" },
        versions: {
          "1.0.0": {
            dist: { tarball: "https://npm.pkg.github.com/@acme/pack/-/pack-1.0.0.tgz", shasum: "aa" },
          },
        },
      },
      "npm.pkg.github.com",
    );
    expect(parsed?.tarballUrl).toContain("npm.pkg.github.com");
    expect(registryMetadataUrl("https://npm.pkg.github.com", "@acme/pack")).toBe(
      "https://npm.pkg.github.com/%40acme%2Fpack",
    );
  });
});
