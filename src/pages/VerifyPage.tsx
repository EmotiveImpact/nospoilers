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
  return <VerificationResult key={token} token={token} />;
}

function VerificationResult({ token }: { token: string }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    token: string;
    page: PublicVerification | null;
    error: string | null;
    unavailable?: boolean;
  }>(() => ({ token, page: null, error: null }));

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    if (!token) return;
    void (async () => {
      try {
        const response = await fetch(`/api/verify/${encodeURIComponent(token)}`, { signal: controller.signal, cache: "no-store" });
        if (response.status === 404 || response.status === 410) {
          if (!cancelled) setResult({ token, page: null, error: "This link is unavailable. It may be incorrect, private or withdrawn by its owner.", unavailable: true });
          return;
        }
        const body = (await response.json()) as {
          verification?: PublicVerification;
          error?: string;
        };
        if (!response.ok) throw new Error(response.status === 429 ? "Too many requests. Wait a moment, then try again." : "Verification could not be loaded. Please try again.");
        if (!body.verification || !Array.isArray(body.verification.deliveries)) throw new Error("The verification response is incomplete. Please try again.");
        if (cancelled) return;
        setResult({ token, page: body.verification ?? null, error: null });
      } catch (caught) {
        if (cancelled) return;
        setResult({
          token,
          page: null,
          error: caught instanceof Error ? caught.message : "Unknown verification page.",
        });
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token, attempt]);

  const page = result.token === token ? result.page : null;
  const passing = Boolean(page?.passingReceipt && page.receiptStatus === "passed" && !page.mismatch);
  const error = !token
    ? "A public verification link is required. Ask the artifact owner for their shared link."
    : result.token === token
      ? result.error
      : null;

  return (
    <main className="fade-up mx-auto max-w-3xl px-5 py-16 md:py-24">
      <p className="text-[11px] uppercase tracking-[0.28em] text-dim">Release Ledger</p>
      <h1 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight text-snow md:text-6xl">
        Verification
      </h1>
      <p className="mt-5 max-w-lg text-base leading-relaxed text-mute">
        An owner-published summary of an existing release record. Reading this page is free
        and does not run a scan. It does not verify a downloaded artifact or establish that
        the software is free of vulnerabilities.
      </p>
      {error ? <section className="mt-10 rounded-xl border border-white/10 p-5" role="alert"><h2 className="text-lg text-snow">{result.unavailable || !token ? "Verification unavailable" : "Could not load verification"}</h2><p className="mt-2 text-sm text-mute">{error}</p>{token && !result.unavailable ? <button type="button" className="mt-4 rounded border border-white/20 px-4 py-2 text-sm text-snow" onClick={() => { setResult({ token, page: null, error: null }); setAttempt(value => value + 1); }}>Try again</button> : null}</section> : null}
      {!error && !page ? <p role="status" className="mt-10 text-sm text-dim">Loading verification…</p> : null}
      {page ? (
        <>
        <section className="mt-8 rounded-xl border border-white/10 p-5" aria-label="Recorded decision">
          <h2 className="text-xl text-snow">{page.mismatch ? "Artifact digest mismatch" : passing ? "Recorded policy passed" : "No passing proof established"}</h2>
          <p className="mt-2 text-sm text-mute">{page.mismatch ? "The recorded bytes changed. Do not treat this release as matching its receipt." : "This is the recorded decision, not a new signature or delivery check. Issuer identity and signature validity are not independently established by this page."}</p>
          <p className="mt-2 text-sm text-dim">Recorded {new Date(page.createdAt).toLocaleString()}. A past result does not guarantee current delivery.</p>
        </section>
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
            <p className={`text-sm ${passing ? "text-snow" : "text-danger"}`}>
              {statusLabel(page.receiptStatus)}
              {page.mismatch ? " · digest changed" : ""}
              {passing ? "" : " · not passing proof"}
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
                    {delivery.lastCheckedAt ? <span className="block mt-1">Last checked {new Date(delivery.lastCheckedAt).toLocaleString()}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </li>
        </ul>
        <p className="mt-6 text-sm text-dim">Only published metadata is shown. Artifact bytes, private findings and full delivery URLs are not included. Failed-policy and inconclusive results are not passing proof; approval is a separate decision.</p>
        </>
      ) : null}
    </main>
  );
}
