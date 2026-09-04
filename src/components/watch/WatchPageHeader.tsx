import type { ReactNode } from "react";

export function WatchPageHeader({
  title,
  lede,
  action,
  narrow,
}: {
  title: string;
  lede?: ReactNode;
  action?: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className={narrow ? "watch-between watch-narrow" : "watch-between"}>
      <div className="min-w-0">
        <h1 className="watch-page-title">{title}</h1>
        {lede ? <p className="watch-page-lede">{lede}</p> : null}
      </div>
      {action}
    </div>
  );
}
