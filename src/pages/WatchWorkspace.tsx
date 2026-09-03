import { useWatchWorkspaceController } from "@/watch/useWatchWorkspaceController";

export function WatchWorkspace({ path = "/watch", search }: { path?: string; search: string }) {
  return useWatchWorkspaceController({ path, search });
}
