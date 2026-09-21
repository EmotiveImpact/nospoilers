import {
  githubAppConfigured,
  loadConfig,
  databaseMode,
  processRunsJobs,
  resendConfigured,
  stripeConfigured,
  type AppConfig,
} from "./config.ts";
import { Hono } from 'hono';
import { migrateReleaseIntelligence } from './release-intelligence-schema.ts';
import { withReleaseIntelligence } from './release-intelligence-app.ts';
import { intelligencePorts } from './release-intelligence-adapter.ts';
import { listenJobQueued } from "./job-wake.ts";
import { createGithubPort } from "./github.ts";
import { logJson } from "./log.ts";
import { createNpmPort } from "./npm.ts";
import { createLogNotifier } from "./notifier.ts";
import { createApp } from "./app.ts";
import { withReleaseAssurance } from "./assurance-app.ts";
import { runPollerTick, startPoller } from "./poller.ts";
import { assertProductionSecrets } from "./secrets.ts";
import { migrateIfNeeded, openSql } from "./sql.ts";
import { stubGithub } from "./stub-github.ts";
import { createStore } from "./store.ts";
import { createWorker } from "./worker.ts";
import { isolatedScan } from './isolated-scanner.ts';
import { cleanupAbandonedParserFiles } from './parser-cleanup.ts';
import { runWorkspaceNotification } from './workspace-notification-worker.ts';
import { closeRuntimeResources } from './shutdown.ts';

export async function createRuntime(overrides: Partial<AppConfig> = {}) {
  const config = loadConfig(overrides);
  assertProductionSecrets(config);
  const sql = await openSql(config.databaseUrl);
  await migrateIfNeeded(sql, {
    databaseUrl: config.databaseUrl,
  });
  await migrateReleaseIntelligence(sql);
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
  const runJobs = processRunsJobs(config.processRole);
  const worker = createWorker({
    scan: target=>isolatedScan(target,{requireContainer:!['localhost','127.0.0.1','[::1]'].includes(new URL(config.appBaseUrl).hostname)}),
    store,
    github,
    npm,
    notifier,
    // Request-tail flushes may process light work, but heavy jobs belong to
    // the persistent worker even when callers invoke flushJobs explicitly.
    heavyConcurrency: runJobs ? config.heavyConcurrency : 0,
    lightConcurrency: config.lightConcurrency,
    maxAssetBytes: config.maxAssetBytes,
    intervalMs: config.workerIntervalMs,
    staleAfterMs: config.jobStaleMs,
    receiptSecret: config.receiptSecret,
    processNotification:()=>runWorkspaceNotification(sql,{encryptionSecret:config.sessionSecret,emailApiKey:config.resendApiKey,emailFrom:config.resendFromEmail}),
  });
  const wakeWorker = () => {
    if(runJobs)void worker.tick();
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
  const coreApp = createApp({
    config,
    store,
    github,
    npm,
    notifier,
    wakeWorker,
    runScheduledJobs: async () => {
      const expiredPendingScans = await store.deleteExpiredPendingScans();
      await store.expireUploadedScans();
      const result = await runPollerTick(pollerDeps);
      if(runJobs)await worker.runUntilIdle();
      return { ...result, expiredPendingScans };
    },
  });
  const assuranceApp = withReleaseAssurance(coreApp, {
    receiptSecret: config.receiptSecret,
    scopeForRelease: async (id) => {
      const row = await store.getReleaseRevision(id);
      return row ? { installationId: row.installation_id, receiptId: row.receipt_id } : null;
    },
  });
  const intelligenceSecrets = { sessionSecret: config.sessionSecret, receiptSecret: config.receiptSecret };
  const intelligenceApp = withReleaseIntelligence(assuranceApp, {
    sql,
    appBaseUrl: config.appBaseUrl,
    ports: request => intelligencePorts(request, intelligenceSecrets),
    reserve: request => intelligencePorts(request, intelligenceSecrets).reserve(sql),
    context: (request, ref) => intelligencePorts(request, intelligenceSecrets).context(sql, ref),
  });
  // Retain Hono's request/fetch interface used by existing hosts and integration tests.
  const app = new Hono();
  app.all('*', c => intelligenceApp.fetch(c.req.raw));
  const poller = runJobs ? startPoller(pollerDeps, config.pollIntervalMs) : { stop() {} };
  let listening: Promise<() => Promise<void>> | undefined;
  let closing: Promise<void> | undefined;
  let started = false;
  return {
    app,
    store,
    config,
    worker,
    sql,
    runJobs,
    flushJobs: () => worker.runUntilIdle(),
    startBackground() {
      if (started || closing) return;
      started = true;
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
      void cleanupAbandonedParserFiles().catch(()=>logJson('warn','parser.cleanup.failed',{}));
      worker.start();
      listening = listenJobQueued(config.databaseUrl, () => {
        void worker.tick();
      });
    },
    close() {
      closing ??= closeRuntimeResources([
        async () => { await poller.stop(); },
        async () => { if (listening) await (await listening)(); },
        async () => { await worker.stop(); },
        async () => { await sql.close(); },
      ]);
      return closing;
    },
  };
}
