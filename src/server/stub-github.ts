import type { GithubPort } from "./github.ts";

export function stubGithub(): GithubPort {
  const fail = async (): Promise<never> => {
    throw new Error("GitHub App is not configured. Add the env vars from .env.example.");
  };
  return {
    exchangeCode: fail,
    getUser: fail,
    listUserInstallations: fail,
    getRepo: fail,
    listReleaseAssets: fail,
    getLatestRelease: fail,
    downloadAsset: fail,
  };
}
