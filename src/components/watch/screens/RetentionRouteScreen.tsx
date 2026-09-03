import { useWatchScreenContext } from "@/components/watch/WatchScreenContext";

export function RetentionRouteScreen() {
  const { RetentionScreen, beginConfirm, canChangeRetention, confirmBusy, confirmForm, confirming, ended, previewing, retention, retentionConfirmToken, retentionDraft, route, setRetentionDraft } = useWatchScreenContext();
  return (
    <>
      {route.view === "retention" ? (
                <RetentionScreen
                  previewing={previewing}
                  ended={ended}
                  retention={retention}
                  draft={retentionDraft}
                  canChange={canChangeRetention}
                  busy={confirmBusy}
                  confirmation={confirmForm(confirming?.kind === "retention")}
                  onDraft={setRetentionDraft}
                  onSave={() =>
                    beginConfirm({
                      kind: "retention",
                      days: retentionDraft,
                      expected: retentionConfirmToken(retentionDraft),
                    })
                  }
                />
              ) : null}
    </>
  );
}
