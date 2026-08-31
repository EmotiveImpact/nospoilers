import { createHmac, timingSafeEqual } from "node:crypto";

export function githubSignature(secret: string, rawBody: string): string {
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  return `sha256=${digest}`;
}

export function verifyGitHubSignature(secret: string, rawBody: string, header: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = githubSignature(secret, rawBody);
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
