import { resolveTxt } from "node:dns/promises";
import { createHash, randomBytes } from "node:crypto";
import { assertPublicWebhookHost, lookupWebhookHost, type WebhookHostLookup } from "./siem.ts";

export type DomainVerificationMethod = "dns" | "http";

export type DomainVerificationChallenge = {
  token: string;
  dnsName: string;
  dnsValue: string;
  httpUrl: string;
  httpBody: string;
};

export type MintedDeployToken = {
  token: string;
  tokenHash: string;
  tokenPrefix: string;
};

export function hashDeployToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function mintDeployToken(): MintedDeployToken {
  const token = `nsd_${randomBytes(32).toString("hex")}`;
  return {
    token,
    tokenHash: hashDeployToken(token),
    tokenPrefix: token.slice(0, 12),
  };
}

export function parseDeployBearer(header: string | undefined): string | null {
  const token = header?.trim().match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  return /^nsd_[a-f0-9]{64}$/.test(token) ? token : null;
}

export function mintDomainVerificationChallenge(host: string): DomainVerificationChallenge {
  const token = randomBytes(24).toString("base64url");
  const value = `nospoilers-verification=${token}`;
  return {
    token,
    dnsName: `_nospoilers.${host}`,
    dnsValue: value,
    httpUrl: `https://${host}/.well-known/nospoilers-verification.txt`,
    httpBody: value,
  };
}

export function domainVerificationChallenge(
  host: string,
  token: string,
): DomainVerificationChallenge {
  const value = `nospoilers-verification=${token}`;
  return {
    token,
    dnsName: `_nospoilers.${host}`,
    dnsValue: value,
    httpUrl: `https://${host}/.well-known/nospoilers-verification.txt`,
    httpBody: value,
  };
}

export async function verifyDomainOwnership(
  host: string,
  token: string,
  method: DomainVerificationMethod,
  options: {
    resolveTxt?: typeof resolveTxt;
    fetch?: typeof fetch;
    lookup?: WebhookHostLookup;
  } = {},
): Promise<{ method: DomainVerificationMethod; detail: string }> {
  const expected = `nospoilers-verification=${token}`;
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(token)) {
    throw new Error("Domain verification challenge is missing or invalid.");
  }

  if (method === "dns") {
    const records = await (options.resolveTxt ?? resolveTxt)(`_nospoilers.${host}`);
    if (!records.some((parts) => parts.join("") === expected)) {
      throw new Error(`DNS TXT record _nospoilers.${host} does not contain the verification value.`);
    }
    return { method, detail: `Verified DNS control of ${host}.` };
  }

  const publicHost = await assertPublicWebhookHost(host, options.lookup ?? lookupWebhookHost);
  if (!publicHost) throw new Error("Verification host resolved to a private or reserved address.");
  const response = await (options.fetch ?? fetch)(
    `https://${host}/.well-known/nospoilers-verification.txt`,
    {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: { accept: "text/plain" },
    },
  );
  if (!response.ok) {
    throw new Error(`Verification file returned HTTP ${response.status}.`);
  }
  const body = (await response.text()).slice(0, 4_096).trim();
  if (body !== expected) {
    throw new Error("Verification file does not contain the exact challenge value.");
  }
  return { method, detail: `Verified HTTPS control of ${host}.` };
}
