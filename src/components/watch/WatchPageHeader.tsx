import type { ReactNode } from "react";

export function WatchPageHeader({
  title,
  kicker,
  lede,
  action,
  narrow,
  status,
}: {
  title: string;
  kicker?: string;
  lede?: ReactNode;
  action?: ReactNode;
  narrow?: boolean;
  /** A live one-line summary under the title, led by a status dot. */
  status?: { tone: "exposed" | "attention" | "clear" | "pending"; text: string };
}) {
  return (
    <div className={narrow ? "watch-between watch-narrow" : "watch-between"}>
      <div className="min-w-0">
        {kicker ? <p className="watch-kicker">{kicker}</p> : null}
        <h1 className="watch-page-title">{title}</h1>
        {status ? <p className="watch-page-status"><i className={`watch-rail-dot is-${status.tone}`} aria-hidden />{status.text}</p> : null}
        {lede ? <p className="watch-page-lede">{lede}</p> : null}
      </div>
      {action}
    </div>
  );
}
