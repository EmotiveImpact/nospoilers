// Mint an Ed25519 receipt signing key for RECEIPT_SIGNING_KEY.
// Usage: npx tsx scripts/receipt-keygen.ts
// Prints the private key (keep it secret), the public key and its key id. Rotating: move the
// old public key into RECEIPT_RETIRED_PUBLIC_KEYS so older receipts still verify.
import { generateReceiptSigningKey } from "../src/receipt.ts";

const key = generateReceiptSigningKey();
process.stdout.write(`# Add to the web and worker environment. Newlines may be escaped as \\n.\n`);
process.stdout.write(`RECEIPT_SIGNING_KEY="${key.privateKeyPem.trim().replace(/\n/g, "\\n")}"\n\n`);
process.stdout.write(`# Public, safe to share. Served at /.well-known/nospoilers-receipt-keys.json\n`);
process.stdout.write(`RECEIPT_PUBLIC_KEY=${key.publicKey}\n`);
process.stdout.write(`RECEIPT_KEY_ID=${key.kid}\n`);
