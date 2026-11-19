import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scan } from "../src/scanner/index.ts";

async function rulesFor(files: Record<string, string>): Promise<string[]> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ns-precision-"));
  try {
    for (const [rel, contents] of Object.entries(files)) await writeFile(path.join(dir, rel), contents);
    const report = await scan(dir);
    return report.findings.map((finding) => `${finding.rule}:${path.basename(finding.path)}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const filler = (bytes: number) => `/*${"a".repeat(bytes)}*/\n`;
const keyBody = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7".repeat(2);

describe("scanner detection beyond the first text window", () => {
  it("finds a trailing sourceMappingURL comment in a bundle over 2 MB", async () => {
    expect(await rulesFor({ "app.js": `${filler(2_700_000)}//# sourceMappingURL=app.js.map\n` }))
      .toContain("MAP-003:app.js");
  });

  it("finds a token at the end of a large bundle", async () => {
    expect(await rulesFor({ "tok.js": `${filler(2_700_000)}const t="ghp_${"Z".repeat(36)}";\n` }))
      .toContain("SEC-003:tok.js");
  });

  it("recognises a large generically named source map", async () => {
    const map = JSON.stringify({ version: 3, sources: ["a.ts"], mappings: "A".repeat(300_000) });
    expect(await rulesFor({ "chunk.map": map })).toContain("MAP-001:chunk.map");
  });
});

describe("scanner false positives", () => {
  it("ignores sourceMappingURL text inside string literals", async () => {
    const tool = 'const inline = `//# sourceMappingURL=data:application/json;base64,${b}`;\nconst s = "\\n//# sourceMappingURL=" + url;\n';
    expect(await rulesFor({ "register.mjs": tool })).not.toContain("MAP-003:register.mjs");
  });

  it("still flags real comment directives, including minified and CSS forms", async () => {
    expect(await rulesFor({ "a.js": "x();//# sourceMappingURL=a.js.map" })).toContain("MAP-003:a.js");
    expect(await rulesFor({ "b.css": "a{}\n/*# sourceMappingURL=b.css.map */" })).toContain("MAP-003:b.css");
  });

  it("ignores PEM header literals without key material", async () => {
    const lib = "if (pem.indexOf('-----BEGIN PRIVATE KEY-----') === 0) parse(pem);\n";
    expect(await rulesFor({ "import.js": lib })).not.toContain("SEC-002:import.js");
  });

  it("flags real, escaped, encrypted and PGP private keys", async () => {
    const rules = await rulesFor({
      "a.txt": `-----BEGIN PRIVATE KEY-----\n${keyBody}\n-----END PRIVATE KEY-----\n`,
      "b.json": JSON.stringify({ key: `-----BEGIN RSA PRIVATE KEY-----\n${keyBody}\n` }),
      "c.txt": `-----BEGIN ENCRYPTED PRIVATE KEY-----\n${keyBody}\n`,
      "d.txt": `-----BEGIN PGP PRIVATE KEY BLOCK-----\nVersion: GnuPG v2\n\n${keyBody}\n`,
    });
    for (const name of ["a.txt", "b.json", "c.txt", "d.txt"]) expect(rules).toContain(`SEC-002:${name}`);
  });

  it("does not treat the AWS documentation key as a credential", async () => {
    expect(await rulesFor({ "doc.js": 'const id="AKIAIOSFODNN7EXAMPLE";' })).not.toContain("SEC-003:doc.js");
    expect(await rulesFor({ "real.js": 'const id="AKIAZ7Q2LMNOPQRSTUVW";' })).toContain("SEC-003:real.js");
  });

  it("allows env templates with only empty or placeholder values", async () => {
    expect(await rulesFor({ ".env.example": "API_KEY=\nSECRET=<your-secret>\n# comment\nTOKEN=changeme\n" }))
      .not.toContain("SEC-001:.env.example");
    expect(await rulesFor({ ".env.example": "API_KEY=9f8e7d6c5b4a\n" })).toContain("SEC-001:.env.example");
    expect(await rulesFor({ ".env.production": "API_KEY=\n" })).toContain("SEC-001:.env.production");
  });
});

describe("SARIF for inconclusive scans", () => {
  it("marks the invocation unsuccessful instead of looking clean", async () => {
    const { toSarif } = await import("../src/scanner/index.ts");
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-sarif-"));
    try {
      const file = path.join(dir, "broken.zip");
      await writeFile(file, "PK\u0003\u0004 not really a zip");
      const report = await scan(file);
      expect(report.status).toBe("inconclusive");
      const sarif = toSarif(report) as { runs: Array<{ invocations: Array<{ executionSuccessful: boolean }> }> };
      expect(sarif.runs[0]!.invocations[0]!.executionSuccessful).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("policy allow entries fail closed", () => {
  it("rejects a mistyped path key instead of allowing the rule everywhere", async () => {
    const { parsePolicyYaml } = await import("../src/policy.ts");
    expect(() => parsePolicyYaml(`version: 1\nallow:\n  - rule: MAP-001\n    paths: vendor/x.js.map\n    reason: vendored\n    expires: 2099-01-01\n`))
      .toThrow(/unknown key "paths"/);
  });
});
