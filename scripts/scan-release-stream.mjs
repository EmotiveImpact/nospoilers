import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
/** Use a workspace token, not a legacy installation token. Does not adopt a baseline. */
export async function scanReleaseStream(input, deps = {}) {
  const fetcher = deps.fetch ?? fetch, sleep = deps.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const output = deps.log ?? console.log, now = deps.now ?? Date.now;
  try {
    const origin = new URL(input.baseUrl);
    if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
      origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))) throw new Error('Use an HTTPS application origin without credentials or a path.');
    if (!UUID.test(input.streamId) || !input.token || /\s/.test(input.token)) throw new Error('A stream UUID and valid workspace token are required.');
    const info = await (deps.stat ?? stat)(input.file);
    if (!info.isFile() || info.size < 1 || info.size > 80 * 1024 * 1024) throw new Error('Choose a regular artefact file between 1 byte and 80 MiB.');
    const bytes = await (deps.readFile ?? readFile)(input.file);
    if (!bytes.byteLength || bytes.byteLength > 80 * 1024 * 1024) throw new Error('The artefact exceeds the upload budget.');
    const timeoutMs = input.timeoutMs ?? 180_000, deadline = now() + timeoutMs;
    const signal = AbortSignal.timeout(timeoutMs);
    async function call(path, method = 'GET', body, headers = {}) {
      const response = await fetcher(`${origin.origin}${path}`, { method, body, redirect: 'error', signal,
        headers: { authorization: `Bearer ${input.token}`, ...headers } });
      if (!response.ok) throw new Error(`NoSpoilers returned HTTP ${response.status}; no release approval is inferred.`);
      return { status: response.status, data: await response.json() };
    }
    const route = `/api/release-intelligence/streams/${input.streamId}`;
    const before = (await call(route)).data;
    if (before.stream?.id !== input.streamId || before.canWrite !== true) throw new Error('The stream is unavailable or read-only.');
    const submission = (deps.randomUUID ?? randomUUID)();
    const queued = await call('/api/v1/scan', 'POST', new Uint8Array(bytes), {
      'content-type': 'application/octet-stream', 'x-filename': basename(input.file), 'idempotency-key': submission,
      'x-nospoilers-channel': before.stream.channel,
    });
    if (queued.status !== 202 || queued.data.uploadId !== submission || queued.data.statusUrl !== `/api/v1/scans/${submission}`) throw new Error('The scan acknowledgement was incomplete.');
    let record;
    while (now() < deadline) {
      const result = (await call(`/api/v1/scans/${submission}`)).data;
      if (result.uploadId !== submission) throw new Error('The scan result belonged to a different submission.');
      if (['queued', 'running'].includes(result.status)) { await sleep(1500); continue; }
      record = result; break;
    }
    if (!record || record.status !== 'done' || !record.receipt || !record.report || record.report.status === 'inconclusive') throw new Error('No conclusive completed scan was returned.');
    const outcome = record.report.status === 'passed' && record.report.ok === true ? 0 : record.report.status === 'failed-policy' && record.report.ok === false ? 1 : 2;
    if (outcome === 2) throw new Error('The saved scan decision was inconsistent.');
    const captured = (await call(`${route}/records`, 'POST', JSON.stringify({ record: { kind: 'upload', id: submission } }), { 'content-type': 'application/json' })).data;
    if (captured.snapshot?.record_id !== submission || captured.snapshot?.stream_id !== input.streamId) throw new Error('Historical capture was not confirmed.');
    output(`NoSpoilers ${outcome === 0 ? 'policy passed' : 'policy failed'}; signed evidence recorded in the selected release stream. Historical signals remain advisory.`);
    return outcome;
  } catch (error) {
    // Do not print response bodies, bearer credentials or arbitrary remote text.
    output(error instanceof Error && !String(error.message).includes(input.token) ? error.message : 'NoSpoilers workflow failed.');
    return 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [streamId, file] = process.argv.slice(2);
  if (!streamId || !file) { console.error('Usage: node scripts/scan-release-stream.mjs STREAM_UUID ARTEFACT'); process.exitCode = 2; }
  else process.exitCode = await scanReleaseStream({ baseUrl: process.env.NOSPOILERS_BASE_URL ?? '', token: process.env.NOSPOILERS_TOKEN ?? '', streamId, file });
}
