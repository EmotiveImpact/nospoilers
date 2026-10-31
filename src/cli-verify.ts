import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { redactDeliveryUrl, verifyDeliveryUrl } from "./server/delivery-verify.ts";
import type { WebhookHostLookup } from "./server/siem.ts";
import { RECEIPT_KEYS_PATH, verifyReceipt, verifyReceiptPublic, type ReceiptVerifyResult, type SignedReceipt } from "./receipt.ts";

export type CliVerifyResult = {
  exitCode: 0 | 1 | 2;
  stdout: string[];
  stderr: string[];
};

/** Load the raw base64 Ed25519 keys an issuer publishes, so a receipt can be pinned to it. */
export async function fetchIssuerKeys(issuer: string, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  let origin: URL;
  try {
    origin = new URL(issuer);
  } catch {
    throw new Error("--issuer must be an https origin such as https://nospoilers.dev");
  }
  if (origin.protocol !== "https:" || origin.username || origin.password) {
    throw new Error("--issuer must be an https origin without credentials");
  }
  const response = await fetchImpl(new URL(RECEIPT_KEYS_PATH, origin.origin), { redirect: "error" });
  if (!response.ok) throw new Error(`issuer key list returned HTTP ${response.status}`);
  const body = (await response.json()) as { keys?: unknown };
  const keys = Array.isArray(body.keys) ? body.keys : [];
  const out = keys
    .map((k) => (k && typeof k === "object" ? (k as { publicKey?: unknown }).publicKey : undefined))
    .filter((k): k is string => typeof k === "string" && k.length > 0);
  if (out.length === 0) throw new Error("issuer publishes no receipt keys");
  return out;
}

export async function runCliVerify(input: {
  receiptRaw: string;
  /** Instance key material. Optional for version 2 receipts, which verify with a pinned key instead. */
  secret?: string;
  /** Raw base64 Ed25519 public keys to pin the issuer to. */
  trustedPublicKeys?: string[];
  filePath?: string;
  url?: string;
  fetch?: typeof fetch;
  lookup?: WebhookHostLookup;
}): Promise<CliVerifyResult> {
  const filePath = input.filePath?.trim() || "";
  const url = input.url?.trim() || "";
  if (!filePath && !url) {
    return {
      exitCode: 2,
      stdout: [],
      stderr: ["Give a packed file, a --url, or both."],
    };
  }

  let fileSha256: string | undefined;
  if (filePath) {
    const bytes = await readFile(filePath);
    fileSha256 = createHash("sha256").update(bytes).digest("hex");
  }

  const pinned = input.trustedPublicKeys ?? [];
  const secret = input.secret?.trim() ?? "";
  let checked: ReceiptVerifyResult;
  if (secret && pinned.length === 0) {
    checked = verifyReceipt(input.receiptRaw, secret, fileSha256);
  } else {
    checked = verifyReceiptPublic(input.receiptRaw, { expectedSha256: fileSha256, trustedPublicKeys: pinned });
    if (!checked.ok && checked.code === 'unrecognized-signature' && secret && pinned.length === 0) {
      checked = verifyReceipt(input.receiptRaw, secret, fileSha256);
    }
  }
  if (!checked.ok || !checked.receipt) {
    const hint = !secret && pinned.length === 0 && checked.code === 'unrecognized-signature'
      ? " Version 1 receipts need RECEIPT_SECRET from the issuing instance."
      : "";
    return {
      exitCode: 1,
      stdout: [],
      stderr: [(checked.reason ?? "Receipt did not verify.") + hint],
    };
  }
  const receipt = checked.receipt;
  const lines = [
    `Receipt ${receipt.status}  sha256 ${receipt.artifactSha256}` +
      (receipt.artifactBytes != null ? `  ${receipt.artifactBytes} bytes` : "") +
      `  ${receipt.coordinate}`,
  ];
  if (checked.keyId) {
    lines.push(
      checked.issuer === 'trusted'
        ? `Signed with Ed25519 key ${checked.keyId}. Issuer confirmed.`
        : `Signed with Ed25519 key ${checked.keyId}. Issuer not confirmed: pass --issuer or --public-key to pin it.`,
    );
  }
  const issuerUnconfirmed = checked.issuer === 'embedded';

  if (url) {
    const delivery = await verifyDeliveryUrl({
      url,
      expectedSha256: receipt.artifactSha256,
      fetch: input.fetch,
      lookup: input.lookup,
    });
    const redacted = redactDeliveryUrl(url);
    if (redacted.includes("?")) {
      return {
        exitCode: 2,
        stdout: [],
        stderr: ["Delivery URL query strings must not be printed."],
      };
    }
    lines.push(
      `URL ${redacted}  ${delivery.status}` +
        (delivery.redirectHosts ? `  hops ${delivery.redirectHosts.split(",").join(" → ")}` : "") +
        (delivery.deliveryRegion ? `  region ${delivery.deliveryRegion}` : "") +
        (delivery.cacheState ? `  cache ${delivery.cacheState}` : ""),
    );
    if (delivery.status === "matched") {
      lines.push("Delivery SHA-256 matches this receipt. Bytes were hashed in transit and not stored.");
    } else if (delivery.status === "mismatch") {
      lines.push(
        `Delivery SHA-256 ${delivery.observedSha256 ?? "unknown"} does not match this receipt. Bytes were not stored.`,
      );
      return { exitCode: 1, stdout: lines, stderr: [] };
    } else if (delivery.status === "missing" || delivery.status === "redirect" || delivery.status === "content_type") {
      lines.push(delivery.error ?? `Delivery URL ${delivery.status}.`);
      return { exitCode: 1, stdout: lines, stderr: [] };
    } else {
      lines.push(delivery.error ?? "Delivery URL could not be verified.");
      return { exitCode: 2, stdout: lines, stderr: [] };
    }
  }

  return finishReceiptStatus(receipt, lines, Boolean(filePath), issuerUnconfirmed);
}

function finishReceiptStatus(
  receipt: SignedReceipt,
  lines: string[],
  hashedFile: boolean,
  issuerUnconfirmed = false,
): CliVerifyResult {
  if (receipt.status === "inconclusive") {
    lines.push(`${receipt.inconclusiveReason ?? "Inconclusive."} Authentic, but not a passing result.`);
    return { exitCode: 2, stdout: lines, stderr: [] };
  }
  if (receipt.status !== "passed") {
    lines.push("Authentic receipt, but this artifact failed policy.");
    return { exitCode: 1, stdout: lines, stderr: [] };
  }
  lines.push(
    hashedFile
      ? "Artifact SHA-256 matches a passing receipt."
      : "Delivery SHA-256 matches a passing receipt.",
  );
  if (issuerUnconfirmed) {
    lines.push("The signature is intact, but nobody has vouched for the key. Not a passing result until the issuer is pinned.");
    return { exitCode: 2, stdout: lines, stderr: [] };
  }
  return { exitCode: 0, stdout: lines, stderr: [] };
}
