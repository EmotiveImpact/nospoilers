import { decryptSecret, looksEncrypted } from './secret-box.ts';
import { postSlackWebhook } from './slack.ts';
import { parseFromEmail, postResendEmail } from './email.ts';

export type WorkspaceDeliveryResult = {
  ok: boolean;
  retryable: boolean;
  code: 'sent' | 'configuration' | 'credentials' | 'rejected' | 'temporary';
};

// Only public, bounded copy crosses this boundary. Do not pass finding bodies,
// evidence URLs, source contents, or provider exception text to notifications.
export async function sendWorkspaceNotification(
  destination: { kind: string; webhook_ciphertext: string },
  options: {
    encryptionSecret: string;
    emailApiKey?: string;
    emailFrom?: string;
    fetch?: typeof fetch;
    purpose: 'test' | 'alert';
  },
): Promise<WorkspaceDeliveryResult> {
  const failed = (code: WorkspaceDeliveryResult['code'], retryable = false): WorkspaceDeliveryResult => ({ ok: false, code, retryable });
  if (!['slack', 'email'].includes(destination.kind) || !options.encryptionSecret) return failed('configuration');
  if (destination.kind === 'email' && (!options.emailApiKey?.trim() || !parseFromEmail(options.emailFrom ?? ''))) return failed('configuration');
  // Independent destinations must never silently fall back to plaintext secrets.
  if (!looksEncrypted(destination.webhook_ciphertext)) return failed('credentials');
  let secret: string;
  try { secret = decryptSecret(destination.webhook_ciphertext, options.encryptionSecret); }
  catch { return failed('credentials'); }
  const text = options.purpose === 'test'
    ? 'NoSpoilers notification test. No scan was run and no alert was created.'
    : 'A NoSpoilers workspace alert needs attention. Sign in to review the private evidence.';
  const posted = destination.kind === 'slack'
    ? await postSlackWebhook(secret, { text }, options.fetch)
    : await postResendEmail({ apiKey: options.emailApiKey!, from: options.emailFrom!, to: secret, subject: 'NoSpoilers notification', text }, options.fetch);
  if (posted.ok) return { ok: true, code: 'sent', retryable: false };
  // Provider bodies and exception messages can contain webhook credentials.
  if (posted.status === 0 || posted.status === 429 || posted.status >= 500) return failed('temporary', true);
  if (posted.status === 401 || posted.status === 403 || posted.status === 404 || posted.status === 410) return failed('credentials');
  return failed('rejected');
}
