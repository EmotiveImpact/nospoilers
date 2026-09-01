#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { loadPolicyFile } from "./policy.ts";
import { formatReport, scan, toSarif } from "./scanner/index.ts";
import { receiptSecretFromEnv, verifyReceipt } from "./receipt.ts";
import type { ScanReport } from "./scanner/types.ts";
import { inferReleaseChannel } from "./server/release-ledger.ts";

function githubActionsRunUrl(): string {
  const server = (process.env.GITHUB_SERVER_URL || "").replace(/\/$/, "");
  const repo = process.env.GITHUB_REPOSITORY || "";
  const runId = process.env.GITHUB_RUN_ID || "";
  if (!server.startsWith("https://") || !repo || !runId) return "";
  return `${server}/${repo}/actions/runs/${runId}`;
}

async function scanViaHostedApi(
  target: string,
  apiUrl: string,
  token: string,
  meta: { channel?: string; sourceRevision?: string; ciRun?: string },
): Promise<{ report: ScanReport; receiptId?: number }> {
  const info = statSync(target);
  if (info.isDirectory()) {
    throw new Error("Hosted scan API accepts a packed file, not a directory.");
  }
  const bytes = await readFile(target);
  const origin = apiUrl.replace(/\/$/, "");
  const channel =
    (meta.channel || process.env.NOSPOILERS_CHANNEL || "").trim() ||
    (process.env.GITHUB_REF_NAME ? inferReleaseChannel(process.env.GITHUB_REF_NAME) : "");
  const sourceRevision =
    (meta.sourceRevision || process.env.NOSPOILERS_SOURCE_REVISION || process.env.GITHUB_SHA || "").trim();
  const ciRun = (meta.ciRun || process.env.NOSPOILERS_CI_RUN || githubActionsRunUrl()).trim();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "X-Filename": path.basename(target),
    "Content-Type": "application/octet-stream",
  };
  if (channel) headers["X-NoSpoilers-Channel"] = channel;
  if (sourceRevision) headers["X-NoSpoilers-Source-Revision"] = sourceRevision;
  if (ciRun) headers["X-NoSpoilers-CI-Run"] = ciRun;
  const response = await fetch(`${origin}/api/v1/scan`, {
    method: "POST",
    headers,
    body: bytes,
  });
  const body = (await response.json()) as {
    error?: string;
    report?: ScanReport;
    receiptId?: number;
  };
  if (!response.ok || !body.report) {
    throw new Error(body.error ?? `Hosted scan failed (${response.status}).`);
  }
  return { report: body.report, receiptId: body.receiptId };
}

const program = new Command();

program
  .name("nospoilers")
  .description("No spoilers in production. Scan the packed artifact, not git history.")
  .version("0.1.0");

program
  .command("scan")
  .argument("<path>", "Directory or packed artifact (tarball, zip, vsix, wheel, jar, crx, xpi, nupkg, gem, docker/oci, asar)")
  .option("--strict", "Fail on warnings as well as critical findings", false)
  .option("--json", "Print the report as JSON", false)
  .option("--sarif <file>", "Write a SARIF 2.1 report to this path")
  .option("--policy <file>", "Load a .nospoilers.yml or JSON policy file")
  .option("--no-policy", "Do not load .nospoilers.yml from the current directory")
  .option("--api-url <url>", "POST the packed file to a hosted NoSpoilers scan API")
  .option("--api-token <token>", "Scan API token from Watch (nsp_…). Prefer NOSPOILERS_API_TOKEN.")
  .option("--channel <name>", "stable, beta, or canary. Hosted scans only.")
  .option("--source-revision <rev>", "Git SHA, tag, or version recorded on the release revision.")
  .option("--ci-run <url>", "HTTPS CI run URL stored as metadata. Never fetched.")
  .action(
    async (
      target: string,
      opts: {
        strict?: boolean;
        json?: boolean;
        sarif?: string;
        policy?: string | boolean;
        apiUrl?: string;
        apiToken?: string;
        channel?: string;
        sourceRevision?: string;
        ciRun?: string;
      },
    ) => {
      try {
        const apiUrl = (opts.apiUrl || process.env.NOSPOILERS_API_URL || "").trim();
        const apiToken = (opts.apiToken || process.env.NOSPOILERS_API_TOKEN || "").trim();
        if (Boolean(apiUrl) !== Boolean(apiToken)) {
          process.stderr.write(
            "Hosted scan needs both --api-url and --api-token (or NOSPOILERS_API_URL / NOSPOILERS_API_TOKEN).\n",
          );
          process.exitCode = 2;
          return;
        }
        let report: ScanReport;
        if (apiUrl && apiToken) {
          if (opts.policy) {
            process.stderr.write(
              "Hosted scan uses the installation allowlist, not a local policy file.\n",
            );
          }
          const hosted = await scanViaHostedApi(path.resolve(target), apiUrl, apiToken, {
            channel: opts.channel,
            sourceRevision: opts.sourceRevision,
            ciRun: opts.ciRun,
          });
          report = hosted.report;
        } else {
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
          report = await scan(target, { strict: Boolean(opts.strict), policy });
        }
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
