export type WatchSectionState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export function combineWatchSectionStates(states: WatchSectionState[]): WatchSectionState {
  const errors = states.filter(
    (state): state is Extract<WatchSectionState, { status: "error" }> =>
      state.status === "error",
  );
  if (errors.length > 0) {
    return { status: "error", message: errors.map((state) => state.message).join(" ") };
  }
  return states.some((state) => state.status === "loading")
    ? { status: "loading" }
    : { status: "ready" };
}
