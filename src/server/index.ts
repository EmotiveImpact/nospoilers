import { serve } from "@hono/node-server";
import { createRuntime } from "./runtime.ts";

const runtime = await createRuntime();
runtime.startBackground();

serve(
  {
    fetch: runtime.app.fetch,
    port: runtime.config.port,
    hostname: "0.0.0.0",
  },
  (info) => {
    console.log(`NoSpoilers API on http://127.0.0.1:${info.port}`);
    console.log("UI: npm run dev (same /api routes via Vite).");
  },
);
