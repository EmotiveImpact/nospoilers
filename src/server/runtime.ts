import {
  githubAppConfigured,
  loadConfig,
  databaseMode,
  processRunsJobs,
  resendConfigured,
  stripeConfigured,
  type AppConfig,
} from "./config.ts";
import { listenJobQueued } from "./job-wake.ts";
import { createGithubPort } from "./github.ts";
import { logJson } from "./log.ts";
import { createNpmPort } from "./npm.ts";
import { createLogNotifier } from "./notifier.ts";
import { createApp } from "./app.ts";
import { runPollerTick, startPoller } from "./poller.ts";
import { assertProductionSecrets } from "./secrets.ts";
import { migrateIfNeeded, openSql } from "./sql.ts";
import { stubGithub } from "./stub-github.ts";
import { createStore } from "./store.ts";
import { createWorker } from "./worker.ts";

export async function createRuntime(overrides: Partial<AppConfig> = {}) {
  const config = loadConfig(overrides);
  assertProductionSecrets(config);
  const sql = await openSql(config.databaseUrl);
  await migrateIfNeeded(sql, {
    databaseUrl: config.databaseUrl,
  });
  const store = createStore(sql, {
    jobMaxAttempts: config.jobMaxAttempts,
    tokenSecret: config.sessionSecret,
  });
  const github = githubAppConfigured(config) ? createGithubPort(config) : stubGithub();
  const npm = createNpmPort();
  const notifier = createLogNotifier(store, {
    resend: resendConfigured(config)
      ? { apiKey: config.resendApiKey, fromEmail: config.resendFromEmail }
      : undefined,
  });
  const worker = createWorker({
    store,
    github,
    npm,
    notifier,
    heavyConcurrency: config.heavyConcurrency,
    lightConcurrency: config.lightConcurrency,
    maxAssetBytes: config.maxAssetBytes,
    intervalMs: config.workerIntervalMs,
    staleAfterMs: config.jobStaleMs,
    receiptSecret: config.receiptSecret,
  });
  const runJobs = processRunsJobs(config.processRole);
  const wakeWorker = () => {
    void worker.tick();
  };
  const pollerDeps = {
    store,
    github,
    notifier,
    npm,
    wakeWorker,
    prospectDiscovery: config.githubDiscoveryToken
      ? { token: config.githubDiscoveryToken, maxAssetBytes: config.maxAssetBytes }
      : undefined,
    staleAfterMs: config.jobStaleMs,
  };
  const app = createApp({
    config,
    store,
    github,
    npm,
    notifier,
    wakeWorker,
    runScheduledJobs: async () => {
      const result = await runPollerTick(pollerDeps);
      await worker.runUntilIdle();
      return result;
    },
  });
  const poller = runJobs ? startPoller(pollerDeps, config.pollIntervalMs) : { stop() {} };
  let stopListen: (() => Promise<void>) | undefined;
  return {
    app,
    store,
    config,
    worker,
    sql,
    runJobs,
    flushJobs: () => worker.runUntilIdle(),
    startBackground() {
      logJson("info", "runtime.start", {
        database: databaseMode(config.databaseUrl),
        githubApp: githubAppConfigured(config),
        stripe: stripeConfigured(config),
        resend: resendConfigured(config),
        role: config.processRole,
        jobs: runJobs,
        recoveryIntervalMs: config.workerIntervalMs,
        visibilityPollIntervalMs: config.pollIntervalMs,
      });
      if (!runJobs) return;
      worker.start();
      void listenJobQueued(config.databaseUrl, () => {
        void worker.tick();
      }).then((stop) => {
        stopListen = stop;
      });
    },
    async close() {
      await worker.stop();
      poller.stop();
      if (stopListen) await stopListen();
      await sql.close();
    },
  };
}
