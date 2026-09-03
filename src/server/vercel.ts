import type { Hono } from "hono";

type WebRuntime = {
  app: Hono;
};

export type WebRuntimeLoader = () => Promise<WebRuntime>;

export function createVercelHandler(loadRuntime: WebRuntimeLoader) {
  return async (request: Request): Promise<Response> => {
    try {
      const runtime = await loadRuntime();
      return await runtime.app.fetch(request);
    } catch (error) {
      console.error("vercel.runtime_failed", error);
      return Response.json(
        { error: "NoSpoilers is temporarily unavailable." },
        { status: 503 },
      );
    }
  };
}
