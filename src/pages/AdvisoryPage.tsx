import { useEffect, useState } from "react";

type PublicLookalike = {
  name: string;
  transformation: string;
};

type PublicAdvisory = {
  path: string;
  packageName: string;
  repositoryHost: string | null;
  homepageHost: string | null;
  lookalikes: PublicLookalike[];
  assembledAt: string;
  malwareVerdict: false;
  sent: false;
  disclaimer: string;
};

function tokenFromPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[0] === "advisory" ? (parts[1] ?? "") : "";
}

export function AdvisoryPage({ path }: { path: string }) {
  const token = tokenFromPath(path);
  const [result, setResult] = useState<{
    token: string;
    page: PublicAdvisory | null;
    error: string | null;
  }>(() => ({ token, page: null, error: null }));

  useEffect(() => {
    let cancelled = false;
    if (!token) return;
    void (async () => {
      try {
        const response = await fetch(`/api/advisory/${encodeURIComponent(token)}`);
        const body = (await response.json()) as {
          advisory?: PublicAdvisory;
          error?: string;
        };
        if (!response.ok) throw new Error(body.error ?? "Unknown consumer advisory.");
        if (cancelled) return;
        setResult({ token, page: body.advisory ?? null, error: null });
      } catch (caught) {
        if (cancelled) return;
        setResult({
          token,
          page: null,
          error: caught instanceof Error ? caught.message : "Unknown consumer advisory.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const page = result.token === token ? result.page : null;
  const error = !token
    ? "Unknown consumer advisory."
    : result.token === token
      ? result.error
      : null;

  return (
    <main className="fade-up mx-auto max-w-3xl px-5 py-16 md:py-24">
      <p className="text-[11px] uppercase tracking-[0.28em] text-dim">Package Identity</p>
      <h1 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight text-snow md:text-6xl">
        Advisory
      </h1>
      <p className="mt-5 max-w-lg text-base leading-relaxed text-mute">
        Published by the package owner. Registered lookalike names and public repository host only.
        This is not a malware verdict and not an automatic takedown. NoSpoilers does not send this
        page to npm or GitHub.
      </p>
      {error ? <p className="mt-10 text-sm text-danger">{error}</p> : null}
      {!error && !page ? <p className="mt-10 text-sm text-dim">Loading…</p> : null}
      {page ? (
        <ul className="mt-10 max-w-2xl divide-y divide-white/5">
          <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Package</p>
            <p className="font-mono text-sm text-snow">{page.packageName}</p>
          </li>
          {page.repositoryHost ? (
            <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Repository host</p>
              <p className="font-mono text-sm text-snow">{page.repositoryHost}</p>
            </li>
          ) : null}
          {page.homepageHost ? (
            <li className="flex flex-wrap items-baseline justify-between gap-2 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Homepage host</p>
              <p className="font-mono text-sm text-snow">{page.homepageHost}</p>
            </li>
          ) : null}
          <li className="py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Lookalike names</p>
            {page.lookalikes.length === 0 ? (
              <p className="mt-2 text-sm text-mute">No registered lookalike names published.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {page.lookalikes.map((row) => (
                  <li key={row.name} className="font-mono text-xs text-mute">
                    {row.name}
                    <span className="ml-2 uppercase tracking-[0.16em] text-dim">
                      {row.transformation.replaceAll("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
          <li className="py-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-dim">Review</p>
            <p className="mt-2 text-sm text-mute">{page.disclaimer}</p>
            <p className="mt-2 text-xs text-dim">
              Assembled {new Date(page.assembledAt).toLocaleString()} · not sent
            </p>
          </li>
        </ul>
      ) : null}
    </main>
  );
}
