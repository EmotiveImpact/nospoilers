import type { Hono } from "hono";

type WebRuntime = {
  app: Hono;
  flushJobs?: () => Promise<void>;
};

export type WebRuntimeLoader = () => Promise<WebRuntime>;

export type VercelExecutionContext = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

export function scheduleVercelBackground(
  work: Promise<unknown>,
  ctx?: VercelExecutionContext,
): void {
  if (ctx?.waitUntil) {
    ctx.waitUntil(work);
    return;
  }
  void work.catch((error: unknown) => {
    console.error("vercel.background_failed", error);
  });
}

export function createVercelHandler(loadRuntime: WebRuntimeLoader) {
  return async (request: Request, ctx?: VercelExecutionContext): Promise<Response> => {
    try {
      const runtime = await loadRuntime();
      const response = await runtime.app.fetch(request);
      if (runtime.flushJobs) {
        scheduleVercelBackground(runtime.flushJobs(), ctx);
      }
      return response;
    } catch (error) {
      console.error("vercel.runtime_failed", error);
      return Response.json(
        { error: "NoSpoilers is temporarily unavailable." },
        { status: 503 },
      );
    }
  };
}
