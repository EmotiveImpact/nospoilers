import type { SqlClient } from './sql.ts';
import { fail, IntelligenceError, reference, uuid } from '../release-intelligence/model.ts';
import type { Ref } from '../release-intelligence/model.ts';
import { releaseIntelligence } from './release-intelligence-service.ts';
import type { IntelligencePorts } from './release-intelligence-service.ts';
import {automaticCapture} from './automatic-capture.ts';
import {productionParity} from './production-parity-service.ts';
import {releaseGate} from './release-gate-service.ts';
import {releaseGateAccess} from './release-gate-access.ts';
const PREFIX = '/api/release-intelligence/';
export type IntelligenceAppOptions = {
  sql: SqlClient; appBaseUrl: string; ports: (request: Request) => IntelligencePorts;
  reserve: (request: Request) => Promise<boolean>;
  context: (request: Request, ref: Ref) => Promise<{ workspaceId: string }>;
};
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' } });
}
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) fail('Use application/json.', 415);
  if (!request.body) fail('A JSON body is required.');
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let total = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel().catch(() => undefined); reject(new IntelligenceError('Request timed out.', 408)); }, 5000); });
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), timeout]); if (chunk.done) break;
      total += chunk.value.byteLength; if (total > 16 * 1024) fail('Request exceeds the metadata limit.', 413); chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(total); let offset = 0; for (const part of chunks) { bytes.set(part, offset); offset += part.byteLength; }
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail('Invalid JSON.'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('Use a JSON object.');
    return parsed as Record<string, unknown>;
  } finally { clearTimeout(timer); void reader.cancel().catch(() => undefined); }
}
export function withReleaseIntelligence(core: { fetch: (request: Request) => Response | Promise<Response> }, options: IntelligenceAppOptions) {
  return { async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(PREFIX)) return core.fetch(request);
    try {
      if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
      if (request.method === 'POST') {
        const origin = request.headers.get('origin'), site = request.headers.get('sec-fetch-site');
        const allowed = new URL(options.appBaseUrl).origin;
        if (origin && origin !== allowed || site && !['same-origin', 'none'].includes(site) || request.headers.has('cookie') && origin !== allowed) fail('This request must originate from the application.', 403);
      }
      if (!(await options.reserve(request))) { const response = json({ error: 'Too many history requests. Try again shortly.' }, 429); response.headers.set('Retry-After', '60'); return response; }
      const service = releaseIntelligence(options.sql, options.ports(request)), path = url.pathname.slice(PREFIX.length);
      const refRoute = /^record-context\/(upload|release)\/([^/]+)$/.exec(path);
      if (refRoute && request.method === 'GET') return json(await options.context(request, reference({ kind: refRoute[1], id: refRoute[2] })));
      if (path === 'streams') {
        if (request.method === 'POST') return json(await service.create(await body(request) as Parameters<typeof service.create>[0]), 201);
        const recordKind = url.searchParams.get('recordKind'), recordId = url.searchParams.get('recordId');
        const ref = recordKind !== null || recordId !== null ? reference({ kind: recordKind, id: recordId }) : undefined;
        return json(await service.list(uuid(url.searchParams.get('workspaceId')), ref));
      }
      const route = /^streams\/([^/]+)(?:\/(records|baseline|exclusions|export|automatic-capture|production-parity|gate|gate-access))?$/.exec(path);
      if (!route) return json({ error: 'Route unavailable.' }, 404);
      const id = uuid(route[1]), action = route[2];
      if(action==='gate-access'){
        const access=releaseGateAccess(options.sql,options.ports(request));
        if(request.method==='POST')return json(await access.configure(id,await body(request)));
        const kind=url.searchParams.get('recordKind'),recordId=url.searchParams.get('recordId');
        return json(await access.view(id,kind||recordId?reference({kind,id:recordId}):undefined));
      }
      if(action==='gate'){
        const ports=options.ports(request),gate=releaseGate(options.sql,ports.gate?.(id)??ports);
        if(request.method==='GET'){
          const kind=url.searchParams.get('recordKind'),recordId=url.searchParams.get('recordId');
          return json(await gate.view(id,kind||recordId?reference({kind,id:recordId}):undefined));
        }
        const input=await body(request);
        if(input.action==='configure')return json(await gate.configure(id,input));
        if(input.action==='evaluate')return json(await gate.evaluate(id,input),201);
        if(input.action==='override')return json(await gate.override(id,input));
        if(input.action==='consume')return json(await gate.consume(id,input));
        return json({error:'Choose a gate action.'},400);
      }
      if(action==='production-parity'){
        const parity=productionParity(options.sql,options.ports(request));
        if(request.method==='GET')return json(await parity.view(id));
        const input=await body(request);
        if(input.action==='cancel')return json(await parity.cancel(id,uuid(input.runId)));
        return json(await parity.queue(id,input as Parameters<typeof parity.queue>[1]),202);
      }
      if(action==='automatic-capture'){
        const capture=automaticCapture(options.sql,options.ports(request));
        if(request.method==='POST')return json(await capture.configure(id,await body(request) as Parameters<typeof capture.configure>[1]));
        const kind=url.searchParams.get('recordKind'),recordId=url.searchParams.get('recordId');
        return json(await capture.view(id,kind||recordId?{kind,id:recordId}:undefined));
      }
      if (request.method === 'GET' && !action) return json(await service.view(id, url.searchParams.get('snapshotId') ?? undefined, url.searchParams.get('before') ?? undefined));
      if (request.method === 'GET' && action === 'export') {
        const response = json(await service.export(id)); response.headers.set('Content-Disposition', `attachment; filename="nospoilers-history-${id}.json"`); return response;
      }
      if (request.method !== 'POST' || !action || action === 'export') return json({ error: 'Method not allowed.' }, 405);
      const input = await body(request);
      if (action === 'records') return json(await service.capture(id, input.record));
      if (action === 'baseline') return json(await service.baseline(id, input as Parameters<typeof service.baseline>[1]));
      return json(await service.exclude(id, input as Parameters<typeof service.exclude>[1]));
    } catch (error) {
      return error instanceof IntelligenceError ? json({ error: error.message }, error.status) : json({ error: 'Release history is temporarily unavailable.' }, 503);
    }
  } };
}
