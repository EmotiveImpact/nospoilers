#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { runCliVerify } from "./cli-verify.ts";
import {runGate} from './cli-gate.ts';
import { loadPolicyFile } from "./policy.ts";
import { formatReport, scan, toSarif } from "./scanner/index.ts";
import { receiptSecretFromEnv } from "./receipt.ts";
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
  if (!info.isFile() || info.size > 80 * 1024 * 1024) throw new Error("Hosted scans require a file no larger than 80 MiB.");
  const endpoint = new URL(apiUrl);
  if (endpoint.username || endpoint.password || (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)))) {
    throw new Error('Hosted scan API requires HTTPS (except local development).');
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
    "Idempotency-Key": crypto.randomUUID(),
  };
  if (channel) headers["X-NoSpoilers-Channel"] = channel;
  if (sourceRevision) headers["X-NoSpoilers-Source-Revision"] = sourceRevision;
  if (ciRun) headers["X-NoSpoilers-CI-Run"] = ciRun;
  const response = await fetch(`${origin}/api/v1/scan`, {
    method: "POST",
    headers,
    body: bytes,
    redirect: 'error',
    signal: AbortSignal.timeout(120_000),
  });
  let body = (await response.json()) as {
    error?: string;
    report?: ScanReport;
    receiptId?: number;
    uploadId?:string;
    status?:string;
  };
  if(response.status===202 && body.uploadId){
    const statusUrl=`${origin}/api/v1/scans/${encodeURIComponent(body.uploadId)}`;
    const deadline=Date.now()+10*60_000;
    while(Date.now()<deadline){
      await new Promise(resolve=>setTimeout(resolve,1000));
      const polled=await fetch(statusUrl,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15_000),redirect:'error'});
      body=await polled.json() as typeof body;
      if(!polled.ok || body.status==='failed')throw new Error(body.error??'Hosted scan failed.');
      if(body.status==='done' && body.report)return {report:body.report,receiptId:body.receiptId};
    }
    throw new Error('Scan is still queued or running. Reopen its job in Releases; do not submit a duplicate.');
  }
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
  .argument("<path>", "Directory or packed artifact (tarball, zip, vsix, wheel, jar, crx, xpi, nupkg, gem, docker/oci, apk/aab/ipa, lambda zip, asar)")
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
        const internalLocalScan = process.env.NOSPOILERS_INTERNAL_LOCAL_SCAN === "1";
        if (!apiUrl && !internalLocalScan) {
          process.stderr.write(
            "Scanning requires an active NoSpoilers workspace. Set NOSPOILERS_API_URL and NOSPOILERS_API_TOKEN from Watch. Receipt verification remains free with `nospoilers verify`.\n",
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
  .argument("[path]", "Packed artifact to re-hash")
  .requiredOption("--receipt <file>", "Signed scan receipt JSON")
  .option("--url <https>", "HTTPS delivery URL to stream-hash. Bytes are not stored.")
  .action(async (target: string | undefined, opts: { receipt: string; url?: string }) => {
    const secret = receiptSecretFromEnv();
    if (!secret) {
      process.stderr.write(
        "Set RECEIPT_SECRET or SESSION_SECRET to verify a hosted HMAC receipt. Production signing will move to KMS.\n",
      );
      process.exitCode = 2;
      return;
    }
    try {
      const result = await runCliVerify({
        receiptRaw: await readFile(opts.receipt, "utf8"),
        secret,
        filePath: target,
        url: opts.url,
      });
      for (const line of result.stdout) process.stdout.write(`${line}\n`);
      for (const line of result.stderr) process.stderr.write(`${line}\n`);
      process.exitCode = result.exitCode;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`NoSpoilers could not verify that receipt: ${message}\n`);
      process.exitCode = 2;
    }
  });

program.command('gate').description('Consume a fresh, single-use pre-deployment gate decision for a recorded uploaded build')
  .requiredOption('--api <origin>','NoSpoilers API origin')
  .requiredOption('--stream <id>','Explicit release stream ID')
  .requiredOption('--upload <id>','Completed scan already recorded in this stream')
  .requiredOption('--digest <sha256>','Exact artifact SHA-256 to deploy')
  .requiredOption('--deployment <id>','Deployment attempt identity')
  .option('--decision <id>','Consume an existing unexpired decision, including an explicitly reviewed override')
  .action(async options=>{
    try{const {result,exitCode}=await runGate({...options,token:process.env.NOSPOILERS_TOKEN??''});process.stdout.write(`${JSON.stringify(result)}\n`);if(result.mode==='warn'&&result.readiness!=='ready')process.stderr.write(`Release Gate warning: ${result.readiness}. Warn mode does not block deployment.\n`);process.exitCode=exitCode;}
    catch(error){process.stderr.write(`${error instanceof Error?error.message:'Gate unavailable. Do not deploy.'}\n`);process.exitCode=2;}
  });
await program.parseAsync(process.argv);
