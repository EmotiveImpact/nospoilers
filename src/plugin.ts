import type { IncomingMessage, ServerResponse } from "node:http";
import { getRequestListener } from "@hono/node-server";
import type { Plugin } from "vite";
import { createRuntime } from "./server/runtime.ts";

export function nospoilersApi(): Plugin {
  return {
    name: "nospoilers-api",
    configureServer(server) {
      if (process.env.VITEST) return;
      const ready = createRuntime().then((runtime) => {
        runtime.startBackground();
        const listener = getRequestListener(runtime.app.fetch);
        return { runtime, listener };
      });

      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith("/api")) {
          next();
          return;
        }
        void ready
          .then(({ listener }) => {
            listener(req, res);
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "API failed to start.";
            if (!res.headersSent) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: message }));
            }
          });
      });

      server.httpServer?.once("close", () => {
        void ready.then(({ runtime }) => runtime.close());
      });
    },
    configurePreviewServer(server) {
      const ready = createRuntime().then((runtime) => {
        runtime.startBackground();
        const listener = getRequestListener(runtime.app.fetch);
        return { runtime, listener };
      });
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith("/api")) {
          next();
          return;
        }
        void ready.then(({ listener }) => {
          listener(req, res);
        });
      });
    },
  };
}
