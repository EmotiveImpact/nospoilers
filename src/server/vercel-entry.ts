import { waitUntil } from "@vercel/functions";
import { createRuntime } from "./runtime.ts";
import { createVercelHandler, type WebRuntimeLoader } from "./vercel.ts";

let runtime: ReturnType<typeof createRuntime> | undefined;

const loadRuntime: WebRuntimeLoader = () => {
  runtime ??= createRuntime({
    processRole: "web",
  }).catch((error: unknown) => {
    runtime = undefined;
    throw error;
  });
  return runtime;
};

const handler = createVercelHandler(loadRuntime);

export default {
  fetch(request: Request) {
    return handler(request, { waitUntil });
  },
};
