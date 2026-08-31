export const PACK_NAME = /\.(?:tgz|tar\.gz|zip|asar)$/i;

export function isPackAssetName(name: string): boolean {
  return PACK_NAME.test(name);
}

export function cheapSensitivePaths(filenames: string[]): string[] {
  const hits: string[] = [];
  for (const file of filenames) {
    const base = file.split("/").pop() ?? file;
    if (base.endsWith(".map")) hits.push(file);
    else if (base === ".env" || base.startsWith(".env.")) hits.push(file);
  }
  return hits;
}

export function pathsFromPushPayload(payload: {
  commits?: { added?: string[]; modified?: string[]; removed?: string[] }[];
}): string[] {
  const names = new Set<string>();
  for (const commit of payload.commits ?? []) {
    for (const name of [...(commit.added ?? []), ...(commit.modified ?? []), ...(commit.removed ?? [])]) {
      names.add(name);
    }
  }
  return [...names];
}
