import { serve } from "@hono/node-server";
import { processRunsHttp } from "./config.ts";
import { createRuntime } from "./runtime.ts";
import { installGracefulShutdown } from './shutdown.ts';
import { logJson } from './log.ts';

const runtime = await createRuntime();
runtime.startBackground();

let server: ReturnType<typeof serve> | undefined;
if (processRunsHttp(runtime.config.processRole)) {
  server = serve(
    {
      fetch: runtime.app.fetch,
      port: runtime.config.port,
      hostname: process.env.NOSPOILERS_LOCAL_REVIEW==='1' ? '127.0.0.1' : "0.0.0.0",
    },
    (info) => {
      console.log(`NoSpoilers ${runtime.config.processRole} on http://127.0.0.1:${info.port}`);
    },
  );
} else {
  console.log(`NoSpoilers worker role; HTTP is off. Recovery every ${runtime.config.workerIntervalMs} ms.`);
}

installGracefulShutdown({
  signals: process,
  closeHttp: () => new Promise<void>((resolve, reject) => {
    if (!server) { resolve(); return; }
    server.close(error => error ? reject(error) : resolve());
  }),
  closeRuntime: () => runtime.close(),
  onError: error => {
    logJson('error', 'runtime.shutdown.failed', {message: error instanceof Error ? error.message : 'Shutdown failed'});
    process.exitCode = 1;
  },
});
