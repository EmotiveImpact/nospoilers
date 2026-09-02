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

async function zipBuffer(files: Record<string, string | Buffer>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, contents] of Object.entries(files)) {
    zip.file(name, contents);
  }
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

async function writeZipPack(dest: string, files: Record<string, string | Buffer>): Promise<void> {
  await writeFile(dest, await zipBuffer(files));
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

function encryptedZipStub(): Buffer {
  const name = Buffer.from("x");
  const buf = Buffer.alloc(30 + name.length);
  buf.writeUInt32LE(0x04034b50, 0);
  buf.writeUInt16LE(20, 4);
  buf.writeUInt16LE(1, 6);
  buf.writeUInt16LE(0, 8);
  buf.writeUInt16LE(0, 10);
  buf.writeUInt16LE(0, 12);
  buf.writeUInt32LE(0, 14);
  buf.writeUInt32LE(0, 18);
  buf.writeUInt32LE(0, 22);
  buf.writeUInt16LE(name.length, 26);
  buf.writeUInt16LE(0, 28);
  name.copy(buf, 30);
  return buf;
}

function crxWithoutZipStub(): Buffer {
  const buf = Buffer.alloc(16);
  buf.write("Cr24", 0, 4, "latin1");
  buf.writeUInt32LE(3, 4);
  buf.writeUInt32LE(0, 8);
  return buf;
}

async function writeGemPack(
  dest: string,
  files: Record<string, string>,
  name = "spoiler",
): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ns-gem-"));
  const inner = path.join(dir, "inner");
  try {
    await writeTree(inner, files);
    await tarCreate({ gzip: true, file: path.join(dir, "data.tar.gz"), cwd: inner }, ["."]);
    await writeFile(path.join(dir, "metadata.gz"), gzipSync(`---\nname: ${name}\nversion: 1.0.0\n`));
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
    await writeZipPack(path.join(fixtures, "sourcemap.chrome.zip"), {
      "manifest.json":
        '{"manifest_version":3,"name":"spoiler","background":{"service_worker":"background.js"}}',
      "background.js": `${minified}//# sourceMappingURL=background.js.map\n`,
      "background.js.map": sourceMap,
      "_locales/en/messages.json": "{}",
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
    await writeZipPack(path.join(fixtures, "sourcemap.war"), {
      "WEB-INF/web.xml": "<web-app></web-app>",
      "WEB-INF/classes/index.js": `${minified}//# sourceMappingURL=index.js.map\n`,
      "WEB-INF/classes/index.js.map": sourceMap,
    });
    await writeZipPack(path.join(fixtures, "sourcemap.snupkg"), {
      "[Content_Types].xml": '<?xml version="1.0"?><Types></Types>',
      "package.nuspec": "<package></package>",
      "lib/net8.0/index.js": `${minified}//# sourceMappingURL=index.js.map\n`,
      "lib/net8.0/index.js.map": sourceMap,
    });
    await writeGemPack(path.join(fixtures, "sourcemap.gem"), dirtyJs);

    const cleanJs = { "index.js": minified };
    const cleanVsix = new JSZip();
    cleanVsix.file("[Content_Types].xml", '<?xml version="1.0"?><Types></Types>');
    cleanVsix.file(
      "extension.vsixmanifest",
      '<?xml version="1.0"?><PackageManifest Version="2.0.0"></PackageManifest>',
    );
    cleanVsix.file("extension/index.js", minified);
    await writeFile(
      path.join(fixtures, "clean.vsix"),
      await cleanVsix.generateAsync({ type: "nodebuffer" }),
    );
    await writeCrxPack(path.join(fixtures, "clean.crx"), cleanJs);
    await writeZipPack(path.join(fixtures, "clean.xpi"), {
      "manifest.json": '{"manifest_version":2,"name":"clean"}',
      ...cleanJs,
    });
    await writeZipPack(path.join(fixtures, "clean.chrome.zip"), {
      "manifest.json":
        '{"manifest_version":3,"name":"clean","background":{"service_worker":"background.js"}}',
      "background.js": minified,
      "_locales/en/messages.json": "{}",
    });
    await writeZipPack(path.join(fixtures, "clean.whl"), {
      "pkg-1.0.0.dist-info/METADATA": "Name: pkg\nVersion: 1.0.0\n",
      "pkg/static/index.js": minified,
    });
    await writeZipPack(path.join(fixtures, "clean.jar"), {
      "META-INF/MANIFEST.MF": "Manifest-Version: 1.0\n",
      ...cleanJs,
    });
    await writeZipPack(path.join(fixtures, "clean.nupkg"), {
      "[Content_Types].xml": '<?xml version="1.0"?><Types></Types>',
      "App.nuspec": "<package></package>",
      ...cleanJs,
    });
    await writeZipPack(path.join(fixtures, "clean.war"), {
      "WEB-INF/web.xml": "<web-app></web-app>",
      "WEB-INF/classes/index.js": minified,
    });
    await writeZipPack(path.join(fixtures, "clean.snupkg"), {
      "[Content_Types].xml": '<?xml version="1.0"?><Types></Types>',
      "package.nuspec": "<package></package>",
      "lib/net8.0/index.js": minified,
    });
    await writeGemPack(path.join(fixtures, "clean.gem"), cleanJs, "clean");

    const sdistClean = await mkdtemp(path.join(os.tmpdir(), "ns-sdist-clean-"));
    const sdistDirty = await mkdtemp(path.join(os.tmpdir(), "ns-sdist-dirty-"));
    try {
      await writeTree(sdistClean, {
        "clean-1.0.0/PKG-INFO": "Metadata-Version: 2.1\nName: clean\nVersion: 1.0.0\n",
        "clean-1.0.0/pyproject.toml": '[project]\nname = "clean"\nversion = "1.0.0"\n',
        "clean-1.0.0/src/clean/__init__.py": "x = 1\n",
        "clean-1.0.0/src/clean/static/index.js": minified,
      });
      await writeTree(sdistDirty, {
        "spoiler-1.0.0/PKG-INFO": "Metadata-Version: 2.1\nName: spoiler\nVersion: 1.0.0\n",
        "spoiler-1.0.0/pyproject.toml": '[project]\nname = "spoiler"\nversion = "1.0.0"\n',
        "spoiler-1.0.0/src/spoiler/__init__.py": "x = 1\n",
        "spoiler-1.0.0/src/spoiler/static/index.js": `${minified}//# sourceMappingURL=index.js.map\n`,
        "spoiler-1.0.0/src/spoiler/static/index.js.map": sourceMap,
      });
      await packTar(sdistClean, path.join(fixtures, "clean.sdist.tgz"));
      await packTar(sdistDirty, path.join(fixtures, "sourcemap.sdist.tgz"));
    } finally {
      await rm(sdistClean, { recursive: true, force: true });
      await rm(sdistDirty, { recursive: true, force: true });
    }

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
    await writeOciArchive(path.join(fixtures, "clean.oci.tar"), {
      "index.js": minified,
    });
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
    await writeZipPack(path.join(fixtures, "clean.xapk"), {
      "manifest.json": '{"xapk_version":2,"package_name":"app.clean"}',
      "app.apk": await zipBuffer({
        "AndroidManifest.xml": '<?xml version="1.0"?><manifest package="app.clean"></manifest>',
        "classes.dex": dexStub,
        "assets/www/index.js": minified,
      }),
    });
    await writeZipPack(path.join(fixtures, "sourcemap.apk"), {
      "AndroidManifest.xml": '<?xml version="1.0"?><manifest package="app.spoiler"></manifest>',
      "classes.dex": dexStub,
      "META-INF/CERT.RSA": Buffer.from("not-a-real-signature"),
      "assets/www/index.js": `${minified}//# sourceMappingURL=index.js.map\n`,
      "assets/www/index.js.map": sourceMap,
    });
    await writeZipPack(path.join(fixtures, "sourcemap.xapk"), {
      "manifest.json": '{"xapk_version":2,"package_name":"app.spoiler"}',
      "app.apk": await zipBuffer({
        "AndroidManifest.xml": '<?xml version="1.0"?><manifest package="app.spoiler"></manifest>',
        "classes.dex": dexStub,
        "assets/www/index.js": `${minified}//# sourceMappingURL=index.js.map\n`,
        "assets/www/index.js.map": sourceMap,
      }),
    });
    await writeZipPack(path.join(fixtures, "clean.aab"), {
      "BundleConfig.pb": Buffer.from("pb"),
      "base/manifest/AndroidManifest.xml":
        '<?xml version="1.0"?><manifest package="app.clean"></manifest>',
      "base/dex/classes.dex": dexStub,
      "base/assets/www/index.js": minified,
    });
    await writeZipPack(path.join(fixtures, "sourcemap.aab"), {
      "BundleConfig.pb": Buffer.from("pb"),
      "base/manifest/AndroidManifest.xml":
        '<?xml version="1.0"?><manifest package="app.spoiler"></manifest>',
      "base/dex/classes.dex": dexStub,
      "base/assets/www/index.js": `${minified}//# sourceMappingURL=index.js.map\n`,
      "base/assets/www/index.js.map": sourceMap,
    });
    await writeZipPack(path.join(fixtures, "clean.ipa"), {
      "Payload/Clean.app/Info.plist": '<?xml version="1.0"?><plist></plist>',
      "Payload/Clean.app/www/index.js": minified,
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
    await writeFile(path.join(fixtures, "inconclusive.encrypted.zip"), encryptedZipStub());
    await writeFile(path.join(fixtures, "inconclusive.crx"), crxWithoutZipStub());
    await writeOciArchive(path.join(fixtures, "inconclusive.encrypted.oci.tar"), {
      "index.js": minified,
    }, { encrypted: true });
  } finally {
    await rm(cleanDir, { recursive: true, force: true });
    await rm(dirtyDir, { recursive: true, force: true });
    await rm(envDir, { recursive: true, force: true });
    await rm(asarSrc, { recursive: true, force: true });
  }

  process.stdout.write(`Wrote fixtures to ${fixtures}\n`);
}

await main();
