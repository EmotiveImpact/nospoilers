import type { DisclosureReport } from "./disclosure.ts";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapePdf(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function renderDisclosureReportHtml(report: DisclosureReport): string {
  const replies = report.replies
    .map(
      (row) =>
        `<li><code>${escapeHtml(row.channel)}</code> · ${escapeHtml(row.summary)} · ${escapeHtml(row.receivedAt)}</li>`,
    )
    .join("");
  const attachments = report.attachments
    .map(
      (row) =>
        `<li>${escapeHtml(row.filename)} · ${escapeHtml(row.mediaType)} · ${row.byteLength} bytes${row.expired ? " · expired" : ""}${row.ciphertextDeleted ? " · ciphertext deleted" : ""}</li>`,
    )
    .join("");
  const events = report.events
    .map((row) => `<li>${escapeHtml(row.summary)} · ${escapeHtml(row.actor)}</li>`)
    .join("");
  const fingerprints = report.fingerprints.map((fp) => `<li><code>${escapeHtml(fp)}</code></li>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Disclosure report · ${escapeHtml(report.coordinate)}</title>
  <style>
    body { background: #0b0b0b; color: #f4f4f4; font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; margin: 2rem; }
    h1, h2 { font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; font-size: 12px; color: #9a9a9a; }
    p, li { color: #d4d4d4; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .mute { color: #8a8a8a; }
  </style>
</head>
<body>
  <h1>Disclosure Desk report</h1>
  <p>${escapeHtml(report.coordinate)}${report.packageName ? ` · ${escapeHtml(report.packageName)}` : ""} · ${escapeHtml(report.state)} · ${escapeHtml(report.findingCategory)}</p>
  <p class="mute">${escapeHtml(report.artifact.name)}${report.artifact.version ? ` · ${escapeHtml(report.artifact.version)}` : ""}${report.artifact.sha256 ? ` · SHA-256 ${escapeHtml(report.artifact.sha256)}` : " · hash not recorded"}</p>
  <p class="mute">Never sent. Operator notes and attachment bytes are omitted. Finding values are not included.</p>
  <h2>Service level</h2>
  <p>Opened ${escapeHtml(report.sla.openedAt)}</p>
  <p>Verified ${report.sla.verifiedAt ? escapeHtml(report.sla.verifiedAt) : "not yet"}</p>
  <p>Acknowledged ${report.sla.acknowledgedAt ? escapeHtml(report.sla.acknowledgedAt) : "not yet"}</p>
  <p>Assignee ${report.assignee ? escapeHtml(report.assignee) : "unassigned"} · review ${escapeHtml(report.reviewState)}</p>
  <h2>Fingerprints</h2>
  <ul>${fingerprints || "<li>none</li>"}</ul>
  <h2>Vendor replies</h2>
  <ul>${replies || "<li>none</li>"}</ul>
  <h2>Attachments (metadata only)</h2>
  <ul>${attachments || "<li>none</li>"}</ul>
  <h2>Activity</h2>
  <ul>${events || "<li>none</li>"}</ul>
</body>
</html>
`;
}

export function renderDisclosureReportPdf(report: DisclosureReport): Buffer {
  const lines = [
    report.coordinate,
    report.packageName ? `package ${report.packageName}` : "package none",
    `artifact ${report.artifact.name}${report.artifact.version ? ` ${report.artifact.version}` : ""}`,
    report.artifact.sha256 ? `sha256 ${report.artifact.sha256}` : "sha256 not recorded",
    `state ${report.state} · ${report.findingCategory} · review ${report.reviewState}`,
    `assignee ${report.assignee ?? "unassigned"}`,
    `opened ${report.sla.openedAt}`,
    `verified ${report.sla.verifiedAt ?? "not yet"}`,
    `acknowledged ${report.sla.acknowledgedAt ?? "not yet"}`,
    "Never sent. Notes and attachment bytes omitted.",
    ...report.fingerprints.slice(0, 12).map((fp) => `fp ${fp}`),
    ...report.replies.slice(0, 8).map((row) => `reply ${row.channel} ${row.summary.slice(0, 80)}`),
    ...report.attachments.slice(0, 8).map((row) => `file ${row.filename} ${row.byteLength}b`),
  ].slice(0, 40);
  const ops = ["BT", "/F1 10 Tf", "14 TL", "50 780 Td", ...lines.flatMap((line) => [`T*`, `(${escapePdf(line)}) Tj`]), "ET"];
  const stream = ops.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];
  let offset = 9;
  const xref = ["0000000000 65535 f "];
  const chunks = ["%PDF-1.4\n"];
  for (const object of objects) {
    xref.push(`${String(offset).padStart(10, "0")} 00000 n `);
    chunks.push(`${object}\n`);
    offset += Buffer.byteLength(`${object}\n`);
  }
  const xrefStart = offset;
  chunks.push(`xref\n0 ${objects.length + 1}\n${xref.join("\n")}\n`);
  chunks.push(`trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);
  return Buffer.concat(chunks.map((part) => Buffer.from(part)));
}
