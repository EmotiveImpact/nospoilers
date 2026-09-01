import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { c as tarCreate } from "tar";
import { applyPolicy } from "../src/policy.ts";
import { buildUnsignedReceipt, signReceipt, verifyReceipt } from "../src/receipt.ts";
import { formatReport, scan, toSarif } from "../src/scanner/index.ts";
import {
  discoverWorkspaces,
  expandBraces,
  MAX_WORKSPACE_MEMBERS,
  MAX_WORKSPACE_ROOTS,
  parsePnpmWorkspacePackages,
  summarizeWorkspaces,
  type WorkspaceFile,
} from "../src/scanner/workspaces.ts";

function file(pathName: string, text: string): WorkspaceFile {
  return { path: pathName, text };
}

describe("workspace glob helpers", () => {
  it("expands nested braces", () => {
    expect(expandBraces("packages/{ui,api}")).toEqual(["packages/ui", "packages/api"]);
    expect(expandBraces("apps/{web,native}/{src,dist}")).toEqual([
      "apps/web/src",
      "apps/web/dist",
      "apps/native/src",
      "apps/native/dist",
    ]);
  });

  it("parses pnpm workspace YAML lists and JSON", () => {
    expect(
      parsePnpmWorkspacePackages(`packages:\n  - "packages/*"\n  - '!packages/skip'\n`),
    ).toEqual(["packages/*", "!packages/skip"]);
    expect(parsePnpmWorkspacePackages(`{ "packages": ["apps/*"] }`)).toEqual(["apps/*"]);
  });
});

describe("discoverWorkspaces", () => {
  it("finds npm workspace members and skips node_modules", () => {
    const found = discoverWorkspaces([
      file("package.json", JSON.stringify({ name: "root", private: true, workspaces: ["packages/*"] })),
      file("packages/ui/package.json", JSON.stringify({ name: "@demo/ui" })),
      file("packages/api/package.json", JSON.stringify({ name: "@demo/api", private: true })),
      file("node_modules/hidden/package.json", JSON.stringify({ name: "hidden" })),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]?.kind).toBe("npm");
    expect(found[0]?.root).toBe(".");
    expect(found[0]?.members.map((row) => row.name)).toEqual(["@demo/api", "@demo/ui"]);
    expect(found[0]?.members.find((row) => row.name === "@demo/api")?.private).toBe(true);
    expect(found[0]?.members.some((row) => row.name === "hidden")).toBe(false);
  });

  it("reads pnpm-workspace.yaml and marks the kind pnpm", () => {
    const found = discoverWorkspaces([
      file("package.json", JSON.stringify({ name: "root" })),
      file("pnpm-workspace.yaml", "packages:\n  - packages/*\n"),
      file("packages/core/package.json", JSON.stringify({ name: "@demo/core" })),
    ]);
    expect(found[0]?.kind).toBe("pnpm");
    expect(found[0]?.members).toEqual([
      { name: "@demo/core", path: "packages/core", private: false },
    ]);
  });

  it("classifies yarn and bun from lockfiles and packageManager", () => {
    const yarn = discoverWorkspaces([
      file("package.json", JSON.stringify({ name: "root", workspaces: ["packages/*"] })),
      file("yarn.lock", ""),
      file("packages/ui/package.json", JSON.stringify({ name: "@demo/ui" })),
    ]);
    expect(yarn[0]?.kind).toBe("yarn");

    const bun = discoverWorkspaces([
      file(
        "package.json",
        JSON.stringify({ name: "root", packageManager: "bun@1.1.0", workspaces: ["packages/*"] }),
      ),
      file("bun.lockb", ""),
      file("packages/ui/package.json", JSON.stringify({ name: "@demo/ui" })),
    ]);
    expect(bun[0]?.kind).toBe("bun");
  });

  it("honors exclude globs and brace includes", () => {
    const found = discoverWorkspaces([
      file(
        "package.json",
        JSON.stringify({ name: "root", workspaces: ["packages/{ui,api,skip}", "!packages/skip"] }),
      ),
      file("packages/ui/package.json", JSON.stringify({ name: "@demo/ui" })),
      file("packages/api/package.json", JSON.stringify({ name: "@demo/api" })),
      file("packages/skip/package.json", JSON.stringify({ name: "@demo/skip" })),
    ]);
    expect(found[0]?.members.map((row) => row.name)).toEqual(["@demo/api", "@demo/ui"]);
  });

  it("discovers workspaces inside nested pack paths", () => {
    const found = discoverWorkspaces([
      file(
        "inner.tgz!/package.json",
        JSON.stringify({ name: "inner", workspaces: ["packages/*"] }),
      ),
      file("inner.tgz!/packages/ui/package.json", JSON.stringify({ name: "@nested/ui" })),
    ]);
    expect(found[0]?.root).toBe("inner.tgz!");
    expect(found[0]?.members[0]).toEqual({
      name: "@nested/ui",
      path: "inner.tgz!/packages/ui",
      private: false,
    });
  });

  it("caps roots and members", () => {
    const files: WorkspaceFile[] = [];
    for (let i = 0; i < MAX_WORKSPACE_ROOTS + 5; i += 1) {
      files.push(
        file(`app${i}/package.json`, JSON.stringify({ name: `app${i}`, workspaces: ["packages/*"] })),
      );
      files.push(file(`app${i}/packages/a/package.json`, JSON.stringify({ name: `pkg-${i}` })));
    }
    expect(discoverWorkspaces(files)).toHaveLength(MAX_WORKSPACE_ROOTS);

    const crowded: WorkspaceFile[] = [
      file("package.json", JSON.stringify({ name: "root", workspaces: ["packages/*"] })),
    ];
    for (let i = 0; i < MAX_WORKSPACE_MEMBERS + 8; i += 1) {
      crowded.push(file(`packages/p${i}/package.json`, JSON.stringify({ name: `pkg-${i}` })));
    }
    expect(discoverWorkspaces(crowded)[0]?.members).toHaveLength(MAX_WORKSPACE_MEMBERS);
  });
});

describe("scan workspace packs", () => {
  it("attaches npm workspaces to a directory scan and keeps them after policy", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-ws-dir-"));
    try {
      await mkdir(path.join(dir, "packages/ui"), { recursive: true });
      await mkdir(path.join(dir, "packages/api"), { recursive: true });
      await mkdir(path.join(dir, "node_modules/hidden"), { recursive: true });
      await writeFile(
        path.join(dir, "package.json"),
        JSON.stringify({ name: "root", private: true, workspaces: ["packages/*"] }),
      );
      await writeFile(path.join(dir, "packages/ui/package.json"), JSON.stringify({ name: "@demo/ui" }));
      await writeFile(
        path.join(dir, "packages/api/package.json"),
        JSON.stringify({ name: "@demo/api", private: true }),
      );
      await writeFile(
        path.join(dir, "node_modules/hidden/package.json"),
        JSON.stringify({ name: "hidden" }),
      );
      await writeFile(path.join(dir, "index.js"), "console.log(1)\n");
      const report = await scan(dir);
      expect(report.workspaces).toHaveLength(1);
      expect(report.workspaces?.[0]?.kind).toBe("npm");
      expect(report.workspaces?.[0]?.members.map((row) => row.name).sort()).toEqual([
        "@demo/api",
        "@demo/ui",
      ]);
      const policed = applyPolicy(report, {
        version: 1,
        strict: false,
        exceptions: [],
      });
      expect(policed.workspaces).toEqual(report.workspaces);
      expect(formatReport(report)).toMatch(/npm workspace at \./);
      const sarif = toSarif(report) as {
        runs: { properties?: { workspaceSummary?: string }; results: unknown[] }[];
      };
      expect(sarif.runs[0]?.properties?.workspaceSummary).toMatch(/@demo\/ui/);
      expect(sarif.runs[0]?.results).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("discovers pnpm workspaces from a tarball without executing members", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-ws-tar-"));
    const dest = path.join(os.tmpdir(), `ns-ws-${Date.now()}.tgz`);
    try {
      await mkdir(path.join(dir, "packages/core"), { recursive: true });
      await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "root" }));
      await writeFile(path.join(dir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
      await writeFile(
        path.join(dir, "packages/core/package.json"),
        JSON.stringify({ name: "@demo/core" }),
      );
      await tarCreate({ gzip: true, file: dest, cwd: dir }, ["."]);
      const report = await scan(dest);
      expect(report.kind).toBe("tarball");
      expect(report.workspaces?.[0]?.kind).toBe("pnpm");
      expect(report.workspaces?.[0]?.members).toEqual([
        expect.objectContaining({ name: "@demo/core" }),
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
      await rm(dest, { force: true });
    }
  });

  it("discovers workspaces inside a zip and a nested tarball", async () => {
    const inner = await mkdtemp(path.join(os.tmpdir(), "ns-ws-inner-"));
    const outer = await mkdtemp(path.join(os.tmpdir(), "ns-ws-outer-"));
    const innerTar = path.join(outer, "payload.tgz");
    const zipPath = path.join(os.tmpdir(), `ns-ws-${Date.now()}.zip`);
    try {
      await mkdir(path.join(inner, "packages/ui"), { recursive: true });
      await writeFile(
        path.join(inner, "package.json"),
        JSON.stringify({ name: "inner", workspaces: ["packages/*"] }),
      );
      await writeFile(
        path.join(inner, "packages/ui/package.json"),
        JSON.stringify({ name: "@nested/ui" }),
      );
      await tarCreate({ gzip: true, file: innerTar, cwd: inner }, ["."]);

      const zip = new JSZip();
      zip.file(
        "package.json",
        JSON.stringify({ name: "zip-root", workspaces: ["packages/*"] }),
      );
      zip.file("packages/web/package.json", JSON.stringify({ name: "@zip/web" }));
      zip.file("payload.tgz", await readFile(innerTar));
      await writeFile(zipPath, await zip.generateAsync({ type: "nodebuffer" }));

      const report = await scan(zipPath);
      const names = report.workspaces?.flatMap((row) => row.members.map((member) => member.name)) ?? [];
      expect(names).toEqual(expect.arrayContaining(["@zip/web", "@nested/ui"]));
    } finally {
      await rm(inner, { recursive: true, force: true });
      await rm(outer, { recursive: true, force: true });
      await rm(zipPath, { force: true });
    }
  });
});

describe("workspace receipts", () => {
  it("records members on new receipts and still verifies legacy receipts without the field", () => {
    const report = {
      target: "/tmp/workspace.tgz",
      kind: "tarball" as const,
      fileCount: 3,
      findings: [],
      ok: true,
      status: "passed" as const,
      inconclusiveReason: null,
      manifest: [{ path: "package.json", size: 12, sha256: "aa".repeat(32) }],
      engineVersion: "0.1.0",
      artifactSha256: "bb".repeat(32),
      artifactSha512: null,
      artifactBytes: 12,
      scannedAt: "2026-09-01T00:00:00.000Z",
      suppressed: [],
      policyHash: null,
      workspaces: [
        {
          kind: "npm" as const,
          root: ".",
          configPath: "package.json",
          globs: ["packages/*"],
          members: [{ name: "@demo/ui", path: "packages/ui", private: false }],
        },
      ],
    };
    const signed = signReceipt(buildUnsignedReceipt(report, "npm:workspace@1.0.0"), "receipt-test-secret");
    expect(signed.workspaces?.[0]?.members[0]?.name).toBe("@demo/ui");
    expect(verifyReceipt(JSON.stringify(signed), "receipt-test-secret").ok).toBe(true);

    const { workspaces: _dropped, signature: _signature, ...legacy } = signed;
    const oldSigned = signReceipt(legacy, "receipt-test-secret");
    expect("workspaces" in oldSigned).toBe(false);
    expect(verifyReceipt(JSON.stringify(oldSigned), "receipt-test-secret").ok).toBe(true);
  });
});

describe("summarizeWorkspaces", () => {
  it("names publishable and private members", () => {
    expect(
      summarizeWorkspaces([
        {
          kind: "npm",
          root: ".",
          configPath: "package.json",
          globs: ["packages/*"],
          members: [
            { name: "@demo/ui", path: "packages/ui", private: false },
            { name: "@demo/api", path: "packages/api", private: true },
          ],
        },
      ]),
    ).toMatch(/publishable @demo\/ui/);
  });
});
