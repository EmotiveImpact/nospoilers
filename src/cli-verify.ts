import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { redactDeliveryUrl, verifyDeliveryUrl } from "./server/delivery-verify.ts";
import type { WebhookHostLookup } from "./server/siem.ts";
import { verifyReceipt, type SignedReceipt } from "./receipt.ts";

export type CliVerifyResult = {
  exitCode: 0 | 1 | 2;
  stdout: string[];
  stderr: string[];
};

export async function runCliVerify(input: {
  receiptRaw: string;
  secret: string;
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

  const checked = verifyReceipt(input.receiptRaw, input.secret, fileSha256);
  if (!checked.ok || !checked.receipt) {
    return {
      exitCode: 1,
      stdout: [],
      stderr: [checked.reason ?? "Receipt did not verify."],
    };
  }
  const receipt = checked.receipt;
  const lines = [
    `Receipt ${receipt.status}  sha256 ${receipt.artifactSha256}` +
      (receipt.artifactBytes != null ? `  ${receipt.artifactBytes} bytes` : "") +
      `  ${receipt.coordinate}`,
  ];

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

  return finishReceiptStatus(receipt, lines, Boolean(filePath));
}

function finishReceiptStatus(
  receipt: SignedReceipt,
  lines: string[],
  hashedFile: boolean,
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
  return { exitCode: 0, stdout: lines, stderr: [] };
}
