import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import * as asar from "@electron/asar";
import JSZip from "jszip";
import { c as tarCreate } from "tar";
import { writeDockerSave, writeOciArchive } from "./image-archive.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = path.join(root, "fixtures");

const originalSource = `export function billingSecret(): string {
  return "this-is-the-plot-twist";
}
`;

const minified = `export function billingSecret(){return"this-is-the-plot-twist"}
`;

const sourceMap = JSON.stringify({
  version: 3,
  file: "index.js",
  sources: ["src/billing.ts"],
  sourcesContent: [originalSource],
  names: ["billingSecret"],
  mappings: "AAAA",
});

async function writeTree(dir: string, files: Record<string, string>): Promise<void> {
  for (const [rel, contents] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, contents);
  }
}

async function packTar(srcDir: string, dest: string): Promise<void> {
  await tarCreate({ gzip: true, file: dest, cwd: srcDir }, ["."]);
}

async function writeZipPack(dest: string, files: Record<string, string | Buffer>): Promise<void> {
  const zip = new JSZip();
  for (const [name, contents] of Object.entries(files)) {
    zip.file(name, contents);
  }
  await writeFile(dest, await zip.generateAsync({ type: "nodebuffer" }));
}

async function writeCrxPack(dest: string, files: Record<string, string | Buffer>): Promise<void> {
  const zip = new JSZip();
  for (const [name, contents] of Object.entries(files)) {
    zip.file(name, contents);
  }
  const packed = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
  const buf = Buffer.alloc(12 + packed.length);
  buf.write("Cr24", 0, 4, "latin1");
  buf.writeUInt32LE(3, 4);
  buf.writeUInt32LE(0, 8);
  packed.copy(buf, 12);
  await writeFile(dest, buf);
}

async function writeGemPack(dest: string, files: Record<string, string>): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ns-gem-"));
  const inner = path.join(dir, "inner");
  try {
    await writeTree(inner, files);
    await tarCreate({ gzip: true, file: path.join(dir, "data.tar.gz"), cwd: inner }, ["."]);
    await writeFile(path.join(dir, "metadata.gz"), gzipSync("---\nname: spoiler\nversion: 1.0.0\n"));
    await tarCreate({ file: dest, cwd: dir }, ["data.tar.gz", "metadata.gz"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  await mkdir(fixtures, { recursive: true });

  const cleanDir = await mkdtemp(path.join(os.tmpdir(), "ns-clean-"));
  const dirtyDir = await mkdtemp(path.join(os.tmpdir(), "ns-dirty-"));
  const envDir = await mkdtemp(path.join(os.tmpdir(), "ns-env-"));
  const asarSrc = await mkdtemp(path.join(os.tmpdir(), "ns-asar-"));

  try {
    await writeTree(cleanDir, { "index.js": minified, "package.json": '{"name":"clean-pack"}' });
    await writeTree(dirtyDir, {
      "index.js": `${minified}//# sourceMappingURL=index.js.map\n`,
      "index.js.map": sourceMap,
      "package.json": '{"name":"spoiler-pack"}',
    });
    await writeTree(envDir, {
      "index.js": minified,
      ".env": "STRIPE_SECRET_KEY=sk_live_example\n",
    });
    await writeTree(asarSrc, {
      "index.js": `${minified}//# sourceMappingURL=index.js.map\n`,
      "index.js.map": sourceMap,
    });

    await packTar(cleanDir, path.join(fixtures, "clean.tgz"));
    await packTar(dirtyDir, path.join(fixtures, "sourcemap.tgz"));
    await packTar(envDir, path.join(fixtures, "dotenv.tgz"));
    await asar.createPackage(asarSrc, path.join(fixtures, "sourcemap.asar"));

    const zip = new JSZip();
    zip.file("index.js", `${minified}//# sourceMappingURL=index.js.map\n`);
    zip.file("index.js.map", sourceMap);
    zip.file("package.json", '{"name":"spoiler-zip"}');
    await writeFile(
      path.join(fixtures, "sourcemap.zip"),
      await zip.generateAsync({ type: "nodebuffer" }),
    );

    const vsix = new JSZip();
    vsix.file("[Content_Types].xml", '<?xml version="1.0"?><Types></Types>');
    vsix.file(
      "extension.vsixmanifest",
      '<?xml version="1.0"?><PackageManifest Version="2.0.0"></PackageManifest>',
    );
    vsix.file("extension/index.js", `${minified}//# sourceMappingURL=index.js.map\n`);
    vsix.file("extension/index.js.map", sourceMap);
    await writeFile(
      path.join(fixtures, "sourcemap.vsix"),
      await vsix.generateAsync({ type: "nodebuffer" }),
    );

    const dirtyJs = {
      "index.js": `${minified}//# sourceMappingURL=index.js.map\n`,
      "index.js.map": sourceMap,
    };
    await writeCrxPack(path.join(fixtures, "sourcemap.crx"), dirtyJs);
    await writeZipPack(path.join(fixtures, "sourcemap.xpi"), {
      "manifest.json": '{"manifest_version":2,"name":"spoiler"}',
      ...dirtyJs,
    });
    await writeZipPack(path.join(fixtures, "sourcemap.whl"), {
      "pkg-1.0.0.dist-info/METADATA": "Name: pkg\nVersion: 1.0.0\n",
      "pkg/static/index.js": `${minified}//# sourceMappingURL=index.js.map\n`,
      "pkg/static/index.js.map": sourceMap,
    });
    await writeZipPack(path.join(fixtures, "sourcemap.jar"), {
      "META-INF/MANIFEST.MF": "Manifest-Version: 1.0\n",
      ...dirtyJs,
    });
    await writeZipPack(path.join(fixtures, "sourcemap.nupkg"), {
      "[Content_Types].xml": '<?xml version="1.0"?><Types></Types>',
      "App.nuspec": "<package></package>",
      ...dirtyJs,
    });
    await writeGemPack(path.join(fixtures, "sourcemap.gem"), dirtyJs);

    const workspaceDir = await mkdtemp(path.join(os.tmpdir(), "ns-workspace-"));
    try {
      await writeTree(workspaceDir, {
        "package.json": JSON.stringify({
          name: "workspace-root",
          private: true,
          workspaces: ["packages/*"],
        }),
        "index.js": minified,
        "packages/ui/package.json": JSON.stringify({ name: "@demo/ui", version: "1.0.0" }),
        "packages/api/package.json": JSON.stringify({
          name: "@demo/api",
          version: "1.0.0",
          private: true,
        }),
        "packages/ui/index.js": "export const ui = 1\n",
        "packages/api/index.js": "export const api = 1\n",
      });
      await packTar(workspaceDir, path.join(fixtures, "workspace.tgz"));
    } finally {
      await rm(workspaceDir, { recursive: true, force: true });
    }

    await writeDockerSave(path.join(fixtures, "clean.docker.tar"), [
      { "index.js": minified, "package.json": '{"name":"clean-image"}' },
    ]);
    await writeDockerSave(path.join(fixtures, "sourcemap.docker.tar"), [
      {
        "index.js": `${minified}//# sourceMappingURL=index.js.map\n`,
        "index.js.map": sourceMap,
      },
    ]);
    await writeOciArchive(path.join(fixtures, "sourcemap.oci.tar"), {
      "index.js": `${minified}//# sourceMappingURL=index.js.map\n`,
      "index.js.map": sourceMap,
    });

    const dexStub = Buffer.from("dex\n035\0", "latin1");
    await writeZipPack(path.join(fixtures, "clean.apk"), {
      "AndroidManifest.xml": '<?xml version="1.0"?><manifest package="app.clean"></manifest>',
      "classes.dex": dexStub,
      "assets/www/index.js": minified,
    });
    await writeZipPack(path.join(fixtures, "sourcemap.apk"), {
      "AndroidManifest.xml": '<?xml version="1.0"?><manifest package="app.spoiler"></manifest>',
      "classes.dex": dexStub,
      "META-INF/CERT.RSA": Buffer.from("not-a-real-signature"),
      "assets/www/index.js": `${minified}//# sourceMappingURL=index.js.map\n`,
      "assets/www/index.js.map": sourceMap,
    });
    await writeZipPack(path.join(fixtures, "sourcemap.ipa"), {
      "Payload/Spoiler.app/Info.plist": '<?xml version="1.0"?><plist></plist>',
      "Payload/Spoiler.app/www/index.js": `${minified}//# sourceMappingURL=index.js.map\n`,
      "Payload/Spoiler.app/www/index.js.map": sourceMap,
    });
    await writeZipPack(path.join(fixtures, "clean.lambda.zip"), {
      "host.json": '{"version":"2.0"}',
      "index.js": minified,
      "package.json": '{"name":"clean-fn"}',
    });
    await writeZipPack(path.join(fixtures, "sourcemap.lambda.zip"), {
      "host.json": '{"version":"2.0"}',
      "index.js": `${minified}//# sourceMappingURL=index.js.map\n`,
      "index.js.map": sourceMap,
      "package.json": '{"name":"spoiler-fn"}',
    });
  } finally {
    await rm(cleanDir, { recursive: true, force: true });
    await rm(dirtyDir, { recursive: true, force: true });
    await rm(envDir, { recursive: true, force: true });
    await rm(asarSrc, { recursive: true, force: true });
  }

  process.stdout.write(`Wrote fixtures to ${fixtures}\n`);
}

await main();
