import { useEffect, useState } from "react";

type PublicDelivery = {
  host: string;
  lastStatus: string | null;
  lastCheckedAt: string | null;
  lastSha256: string | null;
};

type PublicVerification = {
  path: string;
  coordinate: string;
  channel: string;
  artifactSha256: string;
  artifactSha512: string | null;
  artifactBytes: number | null;
  mediaType: string | null;
  sourceRevision: string | null;
  receiptStatus: string | null;
  mismatch: boolean;
  passingReceipt: boolean;
  approval: "approved" | "rejected" | null;
  createdAt: string;
  deliveries: PublicDelivery[];
};

function tokenFromPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[0] === "verify" ? (parts[1] ?? "") : "";
}

function statusLabel(status: string | null): string {
  if (status === "passed") return "passed";
  if (status === "failed-policy") return "failed policy";
  if (status === "inconclusive") return "inconclusive";
  return "unknown";
}

export function VerifyPage({ path }: { path: string }) {
  const token = tokenFromPath(path);
  const [page, setPage] = useState<PublicVerification | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPage(null);
    setError(null);
    if (!token) {
      setError("Unknown verification page.");
      return;
    }
    void (async () => {
      try {
        const response = await fetch(`/api/verify/${encodeURIComponent(token)}`);
        const body = (await response.json()) as {
          verification?: PublicVerification;
          error?: string;
        };
        if (!response.ok) throw new Error(body.error ?? "Unknown verification page.");
        if (cancelled) return;
        setPage(body.verification ?? null);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Unknown verification page.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="fade-up mx-auto max-w-3xl px-5 py-16 md:py-24">
      <p className="text-[11px] uppercase tracking-[0.28em] text-dim">Release Ledger</p>
      <h1 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight text-snow md:text-6xl">
        Verification
      </h1>
      <p className="mt-5 max-w-lg text-base leading-relaxed text-mute">
        Published by the artifact owner. Digests and last delivery match only. Query strings and
        pack bytes are not here. Failed-policy and inconclusive are not a clean result. This is
        not scheduled CDN verification.
      </p>
      {error ? <p className="mt-10 text-sm text-danger">{error}</p> : null}
      {!error && !page ? <p className="mt-10 text-sm text-dim">Loading…</p> : null}
      {page ? (
        <ul className="mt-10 max-w-2xl divide-y divide-white/5">
          <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Coordinate</p>
            <p className="font-mono text-sm text-snow">{page.coordinate}</p>
          </li>
          <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Channel</p>
            <p className="text-sm text-snow">{page.channel}</p>
          </li>
          <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Receipt</p>
            <p className={`text-sm ${page.passingReceipt ? "text-snow" : "text-danger"}`}>
              {statusLabel(page.receiptStatus)}
              {page.mismatch ? " · digest changed" : ""}
              {page.passingReceipt ? "" : " · not clean"}
            </p>
          </li>
          {page.approval ? (
            <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Approval</p>
              <p className="text-sm text-snow">
                {page.approval === "approved" ? "approved to ship" : "rejected"}
              </p>
            </li>
          ) : null}
          <li className="py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">SHA-256</p>
            <p className="mt-2 break-all font-mono text-xs text-snow">{page.artifactSha256}</p>
          </li>
          {page.artifactSha512 ? (
            <li className="py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-dim">SHA-512</p>
              <p className="mt-2 break-all font-mono text-xs text-mute">{page.artifactSha512}</p>
            </li>
          ) : null}
          <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Size</p>
            <p className="text-sm text-snow">
              {page.artifactBytes != null ? `${page.artifactBytes} bytes` : "unknown"}
              {page.mediaType ? ` · ${page.mediaType}` : ""}
            </p>
          </li>
          {page.sourceRevision ? (
            <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Source revision</p>
              <p className="font-mono text-sm text-snow">{page.sourceRevision}</p>
            </li>
          ) : null}
          <li className="py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Delivery</p>
            {page.deliveries.length === 0 ? (
              <p className="mt-2 text-sm text-mute">No delivery host published.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {page.deliveries.map((delivery) => (
                  <li key={delivery.host} className="font-mono text-xs text-mute">
                    {delivery.host}
                    {delivery.lastStatus ? ` · ${delivery.lastStatus.replaceAll("_", " ")}` : " · not checked"}
                    {delivery.lastSha256 ? ` · ${delivery.lastSha256.slice(0, 12)}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </li>
        </ul>
      ) : null}
    </main>
  );
}
