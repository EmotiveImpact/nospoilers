import type { ReactNode } from "react";

export function WatchPageHeader({
  title,
  kicker,
  lede,
  action,
  narrow,
}: {
  title: string;
  kicker?: string;
  lede?: ReactNode;
  action?: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className={narrow ? "watch-between watch-narrow" : "watch-between"}>
      <div className="min-w-0">
        {kicker ? <p className="watch-kicker">{kicker}</p> : null}
        <h1 className="watch-page-title">{title}</h1>
        {lede ? <p className="watch-page-lede">{lede}</p> : null}
      </div>
      {action}
    </div>
  );
}
