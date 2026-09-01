import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { c as tarCreate } from "tar";

export type ImageArchiveFiles = Record<string, string | Buffer>;

async function writeTree(dir: string, files: ImageArchiveFiles): Promise<void> {
  for (const [rel, contents] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, contents);
  }
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function packEntries(dest: string, cwd: string, entries: string[], gzip: boolean): Promise<void> {
  await tarCreate(
    { file: dest, cwd, gzip, portable: true, mtime: new Date(0) },
    entries,
  );
}

async function packLayerTar(files: ImageArchiveFiles, gzip: boolean): Promise<Buffer> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ns-layer-"));
  try {
    await writeTree(dir, files);
    const dest = path.join(os.tmpdir(), `ns-layer-${Date.now()}-${Math.random().toString(16).slice(2)}.tar`);
    try {
      await packEntries(dest, dir, Object.keys(files), gzip);
      return await readFile(dest);
    } finally {
      await rm(dest, { force: true });
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function writeDockerSave(dest: string, layers: ImageArchiveFiles[]): Promise<void> {
  if (layers.length === 0) throw new Error("docker save needs at least one layer");
  const root = await mkdtemp(path.join(os.tmpdir(), "ns-docker-"));
  try {
    const layerNames: string[] = [];
    for (const [index, files] of layers.entries()) {
      const id = `layer${index}`;
      const layerDir = path.join(root, id);
      await mkdir(layerDir, { recursive: true });
      const tarBytes = await packLayerTar(files, false);
      await writeFile(path.join(layerDir, "layer.tar"), tarBytes);
      await writeFile(path.join(layerDir, "VERSION"), "1.0\n");
      await writeFile(path.join(layerDir, "json"), "{}\n");
      layerNames.push(`${id}/layer.tar`);
    }
    const config = JSON.stringify({
      architecture: "amd64",
      os: "linux",
      rootfs: {
        type: "layers",
        diff_ids: layerNames.map((_, index) => `sha256:${"ab".repeat(32).slice(0, 64)}${index}`),
      },
    });
    await writeFile(path.join(root, "config.json"), `${config}\n`);
    await writeFile(
      path.join(root, "manifest.json"),
      `${JSON.stringify([
        { Config: "config.json", RepoTags: ["spoiler:latest"], Layers: layerNames },
      ])}\n`,
    );
    await packEntries(dest, root, ["."], false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function writeOciArchive(
  dest: string,
  files: ImageArchiveFiles,
  options: { encrypted?: boolean } = {},
): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "ns-oci-"));
  try {
    const layerBytes = await packLayerTar(files, true);
    const layerDigest = sha256(layerBytes);
    const configBytes = Buffer.from(
      JSON.stringify({
        architecture: "amd64",
        os: "linux",
        rootfs: { type: "layers", diff_ids: [`sha256:${layerDigest}`] },
      }),
    );
    const configDigest = sha256(configBytes);
    const layerMedia = options.encrypted
      ? "application/vnd.oci.image.layer.v1.tar+gzip+encrypted"
      : "application/vnd.oci.image.layer.v1.tar+gzip";
    const manifestBytes = Buffer.from(
      JSON.stringify({
        schemaVersion: 2,
        mediaType: "application/vnd.oci.image.manifest.v1+json",
        config: {
          mediaType: "application/vnd.oci.image.config.v1+json",
          digest: `sha256:${configDigest}`,
          size: configBytes.length,
        },
        layers: [
          {
            mediaType: layerMedia,
            digest: `sha256:${layerDigest}`,
            size: layerBytes.length,
          },
        ],
      }),
    );
    const manifestDigest = sha256(manifestBytes);
    await mkdir(path.join(root, "blobs", "sha256"), { recursive: true });
    await writeFile(path.join(root, "oci-layout"), JSON.stringify({ imageLayoutVersion: "1.0.0" }));
    await writeFile(path.join(root, "blobs", "sha256", layerDigest), layerBytes);
    await writeFile(path.join(root, "blobs", "sha256", configDigest), configBytes);
    await writeFile(path.join(root, "blobs", "sha256", manifestDigest), manifestBytes);
    await writeFile(
      path.join(root, "index.json"),
      JSON.stringify({
        schemaVersion: 2,
        manifests: [
          {
            mediaType: "application/vnd.oci.image.manifest.v1+json",
            digest: `sha256:${manifestDigest}`,
            size: manifestBytes.length,
          },
        ],
      }),
    );
    await packEntries(dest, root, ["."], false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
