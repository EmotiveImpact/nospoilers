#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { Command } from "commander";
import { formatReport, scan, toSarif } from "./scanner/index.ts";

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
  .action(
    async (target: string, opts: { strict?: boolean; json?: boolean; sarif?: string }) => {
      try {
        const report = await scan(target, { strict: Boolean(opts.strict) });
        if (opts.sarif) {
          await writeFile(opts.sarif, `${JSON.stringify(toSarif(report), null, 2)}\n`);
        }
        if (opts.json) {
          process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        } else {
          process.stdout.write(`${formatReport(report)}\n`);
        }
        process.exitCode = report.ok ? 0 : 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`NoSpoilers could not scan that path: ${message}\n`);
        process.exitCode = 2;
      }
    },
  );

await program.parseAsync(process.argv);
