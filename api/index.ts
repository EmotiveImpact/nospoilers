import { createRuntime } from "../src/server/runtime.ts";
import { createVercelHandler, type WebRuntimeLoader } from "../src/server/vercel.ts";

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

export default createVercelHandler(loadRuntime);
