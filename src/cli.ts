#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { loadPolicyFile } from "./policy.ts";
import { formatReport, scan, toSarif } from "./scanner/index.ts";
import { receiptSecretFromEnv, verifyReceipt } from "./receipt.ts";

const program = new Command();

program
  .name("nospoilers")
  .description("No spoilers in production. Scan the packed artifact, not git history.")
  .version("0.1.0");

program
  .command("scan")
  .argument("<path>", "Directory, npm tarball, zip, or Electron asar to scan")
  .option("--strict", "Fail on warnings as well as critical findings", false)
  .option("--json", "Print the report as JSON", false)
  .option("--sarif <file>", "Write a SARIF 2.1 report to this path")
  .option("--policy <file>", "Load a .nospoilers.yml or JSON policy file")
  .option("--no-policy", "Do not load .nospoilers.yml from the current directory")
  .action(
    async (
      target: string,
      opts: { strict?: boolean; json?: boolean; sarif?: string; policy?: string | boolean },
    ) => {
      try {
        let policyPath: string | null = null;
        if (opts.policy === false) {
          policyPath = null;
        } else if (typeof opts.policy === "string" && opts.policy.length > 0) {
          policyPath = opts.policy;
        } else {
          const auto = path.join(process.cwd(), ".nospoilers.yml");
          if (existsSync(auto)) policyPath = auto;
        }
        const policy = policyPath ? await loadPolicyFile(policyPath) : null;
        const report = await scan(target, { strict: Boolean(opts.strict), policy });
        if (opts.sarif) {
          await writeFile(opts.sarif, `${JSON.stringify(toSarif(report), null, 2)}\n`);
        }
        if (opts.json) {
          process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        } else {
          process.stdout.write(`${formatReport(report)}\n`);
        }
        if (report.status === "inconclusive") process.exitCode = 2;
        else process.exitCode = report.ok ? 0 : 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`NoSpoilers could not scan that path: ${message}\n`);
        process.exitCode = 2;
      }
    },
  );

program
  .command("verify")
  .argument("<path>", "Packed artifact to re-hash")
  .requiredOption("--receipt <file>", "Signed scan receipt JSON")
  .action(async (target: string, opts: { receipt: string }) => {
    const secret = receiptSecretFromEnv();
    if (!secret) {
      process.stderr.write(
        "Set RECEIPT_SECRET or SESSION_SECRET to verify a hosted HMAC receipt. Production signing will move to KMS.\n",
      );
      process.exitCode = 2;
      return;
    }
    try {
      const bytes = await readFile(target);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const raw = await readFile(opts.receipt, "utf8");
      const result = verifyReceipt(raw, secret, sha256);
      if (!result.ok || !result.receipt) {
        process.stderr.write(`${result.reason ?? "Receipt did not verify."}\n`);
        process.exitCode = 1;
        return;
      }
      const receipt = result.receipt;
      process.stdout.write(
        `Receipt ${receipt.status}  sha256 ${receipt.artifactSha256}  ${receipt.coordinate}\n`,
      );
      if (receipt.status === "inconclusive") {
        process.stdout.write(
          `${receipt.inconclusiveReason ?? "Inconclusive."} Authentic, but not a passing result.\n`,
        );
        process.exitCode = 2;
        return;
      }
      if (receipt.status !== "passed") {
        process.stdout.write("Authentic receipt, but this artifact failed policy.\n");
        process.exitCode = 1;
        return;
      }
      process.stdout.write("Artifact SHA-256 matches a passing receipt.\n");
      process.exitCode = 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`NoSpoilers could not verify that receipt: ${message}\n`);
      process.exitCode = 2;
    }
  });

await program.parseAsync(process.argv);
