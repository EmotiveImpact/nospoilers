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

export default createVercelHandler(loadRuntime);
