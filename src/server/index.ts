import { serve } from "@hono/node-server";
import { processRunsHttp } from "./config.ts";
import { createRuntime } from "./runtime.ts";

const runtime = await createRuntime();
runtime.startBackground();

if (processRunsHttp(runtime.config.processRole)) {
  serve(
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
