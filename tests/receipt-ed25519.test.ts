import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fetchIssuerKeys, runCliVerify } from "../src/cli-verify.ts";
import {
  RECEIPT_ALG_ED25519,
  RECEIPT_KEYS_PATH,
  RECEIPT_VERSION_ED25519,
  buildUnsignedReceipt,
  composeReceiptKeyMaterial,
  generateReceiptSigningKey,
  parseReceiptKeyMaterial,
  receiptPublicKeys,
  signReceipt,
  verifyReceipt,
  verifyReceiptPublic,
  verifyReceiptSignature,
} from "../src/receipt.ts";
import type { ScanReport } from "../src/scanner/index.ts";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import type { GithubPort } from "../src/server/github.ts";
import { migrate, openSql } from "../src/server/sql.ts";
import { createStore } from "../src/server/store.ts";

const HMAC = "legacy-hmac-secret";
const KEY = generateReceiptSigningKey();
const OTHER = generateReceiptSigningKey();
/** A migrating instance: signs Ed25519, still verifies its older HMAC receipts. */
const BUNDLE = composeReceiptKeyMaterial({ signingKey: KEY.privateKeyPem, hmacSecret: HMAC });

function passedReport(overrides: Partial<ScanReport> = {}): ScanReport {
  return {
    target: "/tmp/clean.tgz",
    kind: "tarball",
    fileCount: 1,
    findings: [],
    ok: true,
    status: "passed",
    inconclusiveReason: null,
    manifest: [{ path: "package/index.js", size: 12, sha256: "aa".repeat(32) }],
    engineVersion: "0.1.0",
    artifactSha256: "bb".repeat(32),
    artifactSha512: "cc".repeat(64),
    artifactBytes: 12,
    scannedAt: "2026-10-31T00:00:00.000Z",
    suppressed: [],
    policyHash: null,
    ...overrides,
  };
}

function githubStub(): GithubPort {
  const fail = async (): Promise<never> => {
    throw new Error("GitHub stub: unexpected call");
  };
  return new Proxy({} as GithubPort, { get: () => fail });
}

describe("Ed25519 receipts", () => {
  it("mints a version 2 receipt that carries its own key id and public key", () => {
    const signed = signReceipt(buildUnsignedReceipt(passedReport(), "npm:clean@1.0.0"), KEY.privateKeyPem);
    expect(signed.v).toBe(RECEIPT_VERSION_ED25519);
    expect(signed.alg).toBe(RECEIPT_ALG_ED25519);
    expect(signed.keyId).toBe(KEY.kid);
    expect(signed.publicKey).toBe(KEY.publicKey);
    expect(signed.signer).toBe(`ed25519:${KEY.kid}`);
    expect(signed.signature).toMatch(/^[0-9a-f]{128}$/);
  });

  it("verifies without any instance secret, and reports whether the issuer was pinned", () => {
    const signed = signReceipt(buildUnsignedReceipt(passedReport(), "npm:clean@1.0.0"), KEY.privateKeyPem);
    const raw = JSON.stringify(signed);

    const unpinned = verifyReceiptPublic(raw, { expectedSha256: "bb".repeat(32) });
    expect(unpinned.ok).toBe(true);
    expect(unpinned.issuer).toBe("embedded");
    expect(unpinned.keyId).toBe(KEY.kid);

    const pinned = verifyReceiptPublic(raw, { trustedPublicKeys: [KEY.publicKey] });
    expect(pinned.ok).toBe(true);
    expect(pinned.issuer).toBe("trusted");

    const wrongPin = verifyReceiptPublic(raw, { trustedPublicKeys: [OTHER.publicKey] });
    expect(wrongPin.ok).toBe(false);
    expect(wrongPin.code).toBe("unrecognized-signature");
    expect(wrongPin.keyId).toBe(KEY.kid);
  });

  it("rejects a tampered body, a swapped key, and a forged signature", () => {
    const signed = signReceipt(buildUnsignedReceipt(passedReport(), "npm:clean@1.0.0"), KEY.privateKeyPem);

    const tampered = { ...signed, findingCount: 0, status: "passed", coordinate: "npm:evil@9.9.9" };
    expect(verifyReceiptPublic(JSON.stringify(tampered)).code).toBe("unrecognized-signature");

    // Attacker swaps in their own key but keeps the old signature.
    const swapped = { ...signed, publicKey: OTHER.publicKey, keyId: OTHER.kid, signer: `ed25519:${OTHER.kid}` };
    expect(verifyReceiptPublic(JSON.stringify(swapped)).code).toBe("unrecognized-signature");

    // Attacker re-signs with their own key: the signature is intact but the instance refuses it.
    const resigned = signReceipt(buildUnsignedReceipt(passedReport(), "npm:clean@1.0.0"), OTHER.privateKeyPem);
    const onInstance = verifyReceipt(JSON.stringify(resigned), BUNDLE);
    expect(onInstance.ok).toBe(false);
    expect(onInstance.code).toBe("unrecognized-signature");
    expect(onInstance.keyId).toBe(OTHER.kid);
    expect(verifyReceiptSignature(resigned, BUNDLE)).toBe(false);
  });

  it("will not mint a passing version 2 receipt for a failed scan", () => {
    expect(() =>
      signReceipt(
        { ...buildUnsignedReceipt(passedReport(), "npm:clean@1.0.0"), ok: false },
        KEY.privateKeyPem,
      ),
    ).toThrow(/passing receipt/);
  });

  it("keeps older HMAC receipts verifiable on a migrated instance", () => {
    const legacy = signReceipt(buildUnsignedReceipt(passedReport(), "npm:clean@1.0.0"), HMAC);
    expect(legacy.v).toBe(1);
    const checked = verifyReceipt(JSON.stringify(legacy), BUNDLE, "bb".repeat(32));
    expect(checked.ok).toBe(true);
    expect(checked.issuer).toBeUndefined();
    // And the migrated instance now signs version 2.
    expect(signReceipt(buildUnsignedReceipt(passedReport(), "npm:clean@1.0.0"), BUNDLE).v).toBe(2);
    // A version 1 receipt cannot be checked publicly: it needs the issuer.
    expect(verifyReceiptPublic(JSON.stringify(legacy)).code).toBe("unrecognized-signature");
  });

  it("accepts receipts from a retired key and publishes both keys", () => {
    const retiredSigned = signReceipt(buildUnsignedReceipt(passedReport(), "npm:clean@1.0.0"), OTHER.privateKeyPem);
    const rotated = composeReceiptKeyMaterial({
      signingKey: KEY.privateKeyPem,
      hmacSecret: HMAC,
      retiredPublicKeys: [OTHER.publicKey],
    });
    const checked = verifyReceipt(JSON.stringify(retiredSigned), rotated);
    expect(checked.ok).toBe(true);
    expect(checked.issuer).toBe("trusted");
    expect(receiptPublicKeys(rotated)).toEqual([
      { kid: KEY.kid, alg: "Ed25519", publicKey: KEY.publicKey, status: "active" },
      { kid: OTHER.kid, alg: "Ed25519", publicKey: OTHER.publicKey, status: "retired" },
    ]);
    expect(receiptPublicKeys(HMAC)).toEqual([]);
  });

  it("parses key material in every supported shape and rejects the wrong key type", () => {
    expect(parseReceiptKeyMaterial("").signingKey).toBeNull();
    expect(parseReceiptKeyMaterial(HMAC).hmacSecret).toBe(HMAC);
    const escaped = KEY.privateKeyPem.trim().replace(/\n/g, "\\n");
    expect(parseReceiptKeyMaterial(escaped).keyId).toBe(KEY.kid);
    const bundle = parseReceiptKeyMaterial(BUNDLE);
    expect(bundle.keyId).toBe(KEY.kid);
    expect(bundle.hmacSecret).toBe(HMAC);
    expect(() => parseReceiptKeyMaterial(JSON.stringify({ signingKey: KEY.privateKeyPem, retiredPublicKeys: ["not-a-key"] }))).toThrow(/retired/);
    const rsa = "-----BEGIN PRIVATE KEY-----\nMIIBVAIBADANBgkqhkiG9w0BAQEFAASCAT4wggE6AgEAAkEAz\n-----END PRIVATE KEY-----";
    expect(() => parseReceiptKeyMaterial(rsa)).toThrow();
  });

  it("loadConfig bundles RECEIPT_SIGNING_KEY with the HMAC secret", () => {
    const previous = { ...process.env };
    try {
      process.env.RECEIPT_SIGNING_KEY = KEY.privateKeyPem.trim().replace(/\n/g, "\\n");
      process.env.RECEIPT_SECRET = HMAC;
      process.env.RECEIPT_RETIRED_PUBLIC_KEYS = OTHER.publicKey;
      const config = loadConfig({ sessionSecret: "sess" });
      const material = parseReceiptKeyMaterial(config.receiptSecret);
      expect(material.keyId).toBe(KEY.kid);
      expect(material.hmacSecret).toBe(HMAC);
      expect([...material.retiredPublicKeys.keys()]).toEqual([OTHER.kid]);
      process.env.RECEIPT_SIGNING_KEY = "-----BEGIN PRIVATE KEY-----\nnot a key\n-----END PRIVATE KEY-----";
      expect(() => loadConfig({ sessionSecret: "sess" })).toThrow();
    } finally {
      process.env = previous;
    }
  });
});

describe("Ed25519 receipts over HTTP and the CLI", () => {
  async function appWith(receiptSecret: string) {
    const sql = await openSql("pglite://:memory:");
    await migrate(sql);
    const config = loadConfig({
      githubWebhookSecret: "wh",
      githubAppId: "1",
      githubPrivateKey: "x",
      githubClientId: "c",
      githubClientSecret: "s",
      sessionSecret: "sess",
      receiptSecret,
    });
    const app = createApp({ config, store: createStore(sql), github: githubStub() });
    return { app, close: () => sql.close() };
  }

  it("publishes the instance keys and names the key in /api/receipts/verify", async () => {
    const { app, close } = await appWith(BUNDLE);
    try {
      const keys = await app.request(RECEIPT_KEYS_PATH);
      expect(keys.status).toBe(200);
      expect(await keys.json()).toEqual({ keys: [{ kid: KEY.kid, alg: "Ed25519", publicKey: KEY.publicKey, status: "active" }] });

      const signed = signReceipt(buildUnsignedReceipt(passedReport(), "npm:clean@1.0.0"), BUNDLE);
      const ok = await app.request("/api/receipts/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receipt: signed, sha256: "bb".repeat(32) }),
      });
      expect(ok.status).toBe(200);
      expect(await ok.json()).toMatchObject({ ok: true, alg: "Ed25519", keyId: KEY.kid, status: "passed" });

      const foreign = signReceipt(buildUnsignedReceipt(passedReport(), "npm:clean@1.0.0"), OTHER.privateKeyPem);
      const refused = await app.request("/api/receipts/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receipt: foreign }),
      });
      expect(refused.status).toBe(400);
      expect(await refused.json()).toMatchObject({ ok: false, code: "unrecognized-signature", keyId: OTHER.kid });
    } finally {
      await close();
    }
  });

  it("serves an empty key list on an HMAC-only instance", async () => {
    const { app, close } = await appWith(HMAC);
    try {
      expect(await (await app.request(RECEIPT_KEYS_PATH)).json()).toEqual({ keys: [] });
    } finally {
      await close();
    }
  });

  it("CLI verifies a pinned receipt with no secret, and refuses to call an unpinned one passing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "nospoilers-ed25519-"));
    try {
      const bytes = Buffer.from("hello world");
      const { createHash } = await import("node:crypto");
      const sha = createHash("sha256").update(bytes).digest("hex");
      const file = path.join(dir, "pack.tgz");
      await writeFile(file, bytes);
      const signed = signReceipt(
        buildUnsignedReceipt(passedReport({ artifactSha256: sha, artifactBytes: bytes.length }), "npm:clean@1.0.0"),
        KEY.privateKeyPem,
      );
      const raw = JSON.stringify(signed);

      const pinned = await runCliVerify({ receiptRaw: raw, filePath: file, trustedPublicKeys: [KEY.publicKey] });
      expect(pinned.exitCode).toBe(0);
      expect(pinned.stdout.join("\n")).toContain(`Ed25519 key ${KEY.kid}. Issuer confirmed.`);

      const unpinned = await runCliVerify({ receiptRaw: raw, filePath: file });
      expect(unpinned.exitCode).toBe(2);
      expect(unpinned.stdout.join("\n")).toContain("Issuer not confirmed");

      const wrongKey = await runCliVerify({ receiptRaw: raw, filePath: file, trustedPublicKeys: [OTHER.publicKey] });
      expect(wrongKey.exitCode).toBe(1);

      // A secret-holding instance still verifies with its own material.
      const onInstance = await runCliVerify({ receiptRaw: raw, filePath: file, secret: BUNDLE });
      expect(onInstance.exitCode).toBe(0);

      // A different file never passes, pinned or not.
      await writeFile(file, Buffer.from("tampered"));
      expect((await runCliVerify({ receiptRaw: raw, filePath: file, trustedPublicKeys: [KEY.publicKey] })).exitCode).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("fetchIssuerKeys reads the well-known list over https only", async () => {
    const { app, close } = await appWith(BUNDLE);
    try {
      const fetchImpl: typeof fetch = async (input, init) => app.request(input instanceof URL ? input.pathname : String(input), init);
      expect(await fetchIssuerKeys("https://nospoilers.example", fetchImpl)).toEqual([KEY.publicKey]);
      await expect(fetchIssuerKeys("http://nospoilers.example", fetchImpl)).rejects.toThrow(/https/);
      await expect(fetchIssuerKeys("https://user:pw@nospoilers.example", fetchImpl)).rejects.toThrow(/credentials/);
    } finally {
      await close();
    }
  });
});
