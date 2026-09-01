import { githubAppConfigured, loadConfig, type AppConfig } from "./config.ts";
import { createGithubPort } from "./github.ts";
import { createLogNotifier } from "./notifier.ts";
import { createApp } from "./app.ts";
import { startPoller } from "./poller.ts";
import { migrate, openSql } from "./sql.ts";
import { stubGithub } from "./stub-github.ts";
import { createStore } from "./store.ts";
import { createWorker } from "./worker.ts";

export async function createRuntime(overrides: Partial<AppConfig> = {}) {
  const config = loadConfig(overrides);
  const sql = await openSql(config.databaseUrl);
  await migrate(sql);
  const store = createStore(sql);
  const github = githubAppConfigured(config) ? createGithubPort(config) : stubGithub();
  const notifier = createLogNotifier(store);
  const worker = createWorker({
    store,
    github,
    notifier,
    heavyConcurrency: config.heavyConcurrency,
    lightConcurrency: config.lightConcurrency,
    maxAssetBytes: config.maxAssetBytes,
    intervalMs: config.workerIntervalMs,
  });
  const app = createApp({
    config,
    store,
    github,
    wakeWorker: () => {
      void worker.tick();
    },
  });
  const poller = startPoller({ store, github, notifier }, config.pollIntervalMs);
  return {
    app,
    store,
    config,
    worker,
    sql,
    startBackground() {
      worker.start();
    },
    async close() {
      await worker.stop();
      poller.stop();
      await sql.close();
    },
  };
}
