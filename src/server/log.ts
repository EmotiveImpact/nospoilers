export type LogLevel = "info" | "warn" | "error";

const SENSITIVE_KEY =
  /secret|token|password|authorization|cookie|databaseurl|connectionstring|privatekey|access_token|pem/i;

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    if (/postgres(?:ql)?:\/\//i.test(value) || /pglite:\/\//i.test(value)) return "[redacted-url]";
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return sanitizeFields(value as Record<string, unknown>);
  }
  return value;
}

export function sanitizeFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redact(value);
  }
  return out;
}

export function logJson(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...sanitizeFields(fields),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
