type ShutdownSignal = 'SIGINT' | 'SIGTERM';
type Signals = {
  on: (signal: ShutdownSignal, listener: () => void) => unknown;
  off: (signal: ShutdownSignal, listener: () => void) => unknown;
};

/** Preserve drain order, but never let one failed cleanup strand later resources. */
export async function closeRuntimeResources(steps: Array<() => void | Promise<void>>): Promise<void> {
  const failures: unknown[] = [];
  for (const step of steps) {
    try { await step(); }
    catch (error) { failures.push(error); }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, 'Multiple runtime resources failed to close.');
}

/** Stop admissions before draining work and closing the durable store. */
export function installGracefulShutdown(options: {
  signals: Signals;
  closeHttp: () => Promise<void>;
  closeRuntime: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  let closing: Promise<void> | undefined;
  const shutdown = () => {
    if (!closing) closing = (async () => {
      try {
        try { await options.closeHttp(); }
        finally { await options.closeRuntime(); }
      } catch (error) { options.onError(error); }
      finally {
        options.signals.off('SIGINT', onSignal);
        options.signals.off('SIGTERM', onSignal);
      }
    })();
    return closing;
  };
  const onSignal = () => { void shutdown(); };
  options.signals.on('SIGINT', onSignal);
  options.signals.on('SIGTERM', onSignal);
  return shutdown;
}
