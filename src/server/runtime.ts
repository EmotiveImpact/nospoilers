import { githubAppConfigured, loadConfig, databaseMode, stripeConfigured, type AppConfig } from "./config.ts";
import { createGithubPort } from "./github.ts";
import { logJson } from "./log.ts";
import { createNpmPort } from "./npm.ts";
import { createLogNotifier } from "./notifier.ts";
import { createApp } from "./app.ts";
import { startPoller } from "./poller.ts";
import { assertProductionSecrets } from "./secrets.ts";
import { migrate, openSql } from "./sql.ts";
import { stubGithub } from "./stub-github.ts";
import { createStore } from "./store.ts";
import { createWorker } from "./worker.ts";

export async function createRuntime(overrides: Partial<AppConfig> = {}) {
  const config = loadConfig(overrides);
  assertProductionSecrets(config);
  const sql = await openSql(config.databaseUrl);
  await migrate(sql);
  const store = createStore(sql, {
    jobMaxAttempts: config.jobMaxAttempts,
    tokenSecret: config.sessionSecret,
  });
  const github = githubAppConfigured(config) ? createGithubPort(config) : stubGithub();
  const npm = createNpmPort();
  const notifier = createLogNotifier(store);
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
  const app = createApp({
    config,
    store,
    github,
    npm,
    notifier,
    wakeWorker: () => {
      void worker.tick();
    },
  });
  const poller = startPoller(
    {
      store,
      github,
      notifier,
      npm,
      wakeWorker: () => {
        void worker.tick();
      },
      prospectDiscovery: config.githubDiscoveryToken
        ? { token: config.githubDiscoveryToken, maxAssetBytes: config.maxAssetBytes }
        : undefined,
      staleAfterMs: config.jobStaleMs,
    },
    config.pollIntervalMs,
  );
  return {
    app,
    store,
    config,
    worker,
    sql,
    startBackground() {
      logJson("info", "runtime.start", {
        database: databaseMode(config.databaseUrl),
        githubApp: githubAppConfigured(config),
        stripe: stripeConfigured(config),
        recoveryIntervalMs: config.workerIntervalMs,
        visibilityPollIntervalMs: config.pollIntervalMs,
      });
      worker.start();
    },
    async close() {
      await worker.stop();
      poller.stop();
      await sql.close();
    },
  };
}
