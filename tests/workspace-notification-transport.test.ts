import { expect, it, vi } from 'vitest';
import { encryptSecret } from '../src/server/secret-box.ts';
import { sendWorkspaceNotification } from '../src/server/workspace-notification-transport.ts';

const key = 'transport-test-key';
const webhook = 'https://hooks.slack.com/services/T1/B1/private-secret';
const destination = { kind: 'slack', webhook_ciphertext: encryptSecret(webhook, key) };
it('sends bounded notification copy without exposing evidence or credentials in results', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'));
  expect(await sendWorkspaceNotification(destination, { encryptionSecret: key, fetch: fetcher, purpose: 'alert' })).toEqual({ ok: true, code: 'sent', retryable: false });
  const body = String(fetcher.mock.calls[0][1]?.body);
  expect(body).toContain('Sign in'); expect(body).not.toContain('private-secret');
  expect(fetcher.mock.calls[0][1]?.redirect).toBe('error');
});
it('fails closed for plaintext, bad encryption and unconfigured email without sending', async () => {
  const fetcher = vi.fn<typeof fetch>();
  for (const dest of [ { ...destination, webhook_ciphertext: webhook }, { ...destination, webhook_ciphertext: 'ns1.invalid' }, { kind: 'email', webhook_ciphertext: encryptSecret('owner@example.com', key) } ]) {
    expect((await sendWorkspaceNotification(dest, { encryptionSecret: key, fetch: fetcher, purpose: 'test' })).ok).toBe(false);
  }
  expect(fetcher).not.toHaveBeenCalled();
});
it('classifies retries without returning raw errors or provider bodies', async () => {
  for (const status of [400, 401, 403, 404, 410, 429, 500, 503]) {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(webhook, { status }));
    const result = await sendWorkspaceNotification(destination, { encryptionSecret: key, fetch: fetcher, purpose: 'test' });
    expect(result.retryable).toBe(status === 429 || status >= 500);
    expect(JSON.stringify(result)).not.toContain(webhook);
  }
  const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error(webhook));
  expect(await sendWorkspaceNotification(destination, { encryptionSecret: key, fetch: fetcher, purpose: 'test' })).toEqual({ ok: false, code: 'temporary', retryable: true });
});
