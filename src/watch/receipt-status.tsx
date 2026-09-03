import type { ReceiptScanStatus } from "@/watch/types";

export function receiptStatusMark(status: ReceiptScanStatus | null) {
  if (status === "failed-policy") {
    return (
      <span className="text-xs uppercase tracking-[0.16em] text-danger">failed policy</span>
    );
  }
  if (status === "inconclusive") {
    return (
      <span className="text-xs uppercase tracking-[0.16em] text-danger">inconclusive</span>
    );
  }
  if (status === "passed") {
    return <span className="text-xs uppercase tracking-[0.16em] text-dim">passed</span>;
  }
  return null;
}
