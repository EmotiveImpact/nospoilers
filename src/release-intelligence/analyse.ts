import { VERSION, HISTORY_LIMIT, MIN_SAMPLES, clean, compatible, sameContext, metrics, keyOf, validate } from './model.ts';
import type { Analysis, Baseline, Evidence, Signal } from './model.ts';
export function median(values: readonly number[]): number | null {
  if (!values.length || values.some(v => !Number.isFinite(v))) return null;
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : sorted[mid - 1] / 2 + sorted[mid] / 2;
}
/** A bounded review heuristic, not a calibrated probability of danger. */
export function unusual(value: number, values: readonly number[], floor: number): number | null {
  if (values.length < MIN_SAMPLES || !Number.isFinite(value)) return null;
  const centre = median(values);
  if (centre === null) return null;
  const mad = median(values.map(v => Math.abs(v - centre)))!;
  return Math.abs(value - centre) > Math.max(floor, Math.abs(centre) * .3, 5.2 * mad) ? centre : null;
}
const extension = (path: string) => { const name = path.split('/').at(-1)!; const dot = name.lastIndexOf('.'); return dot < 0 ? '(none)' : name.slice(dot).toLowerCase(); };
export function analyse(input: { current: Evidence; history: Array<{ evidence: Evidence; excluded: boolean }>; baseline?: Baseline | null; baselineEvidence?: Evidence | null; now?: number }): Analysis {
  const { current, baseline, baselineEvidence } = input, now = input.now ?? Date.now();
  validate(current, now);
  const prior: Evidence[] = [], refs = new Set<string>(), digests = new Set<string>();
  let excluded = 0, duplicates = 0, incompatible = 0;
  for (const row of [...input.history].sort((a, b) => Date.parse(b.evidence.scannedAt) - Date.parse(a.evidence.scannedAt) || keyOf(b.evidence.ref).localeCompare(keyOf(a.evidence.ref)))) {
    const e = row.evidence;
    try { validate(e, now); } catch { incompatible++; continue; }
    if (keyOf(e.ref) === keyOf(current.ref) || Date.parse(e.scannedAt) >= Date.parse(current.scannedAt)) continue;
    if (!compatible(current, e)) { incompatible++; continue; }
    if (row.excluded) { excluded++; continue; }
    if (refs.has(keyOf(e.ref))) continue;
    refs.add(keyOf(e.ref));
    if (digests.has(e.digest)) { duplicates++; continue; }
    digests.add(e.digest);
    if (prior.length < HISTORY_LIMIT) prior.push(e);
  }
  const eligible = prior.filter(e => clean(e) && sameContext(current, e));
  const result: Analysis = {
    version: VERSION, advisory: true,
    state: current.status === 'inconclusive' ? 'unavailable' : !prior.length ? 'first_release' : eligible.length < MIN_SAMPLES ? 'building_history' : 'comparison_available',
    history: prior.length, eligible: eligible.length, excluded, duplicates, incompatible,
    windowStart: prior.at(-1)?.scannedAt ?? null, windowEnd: prior[0]?.scannedAt ?? null,
    metrics: metrics(current), signals: [],
    baseline: { state: !baseline ? 'not_adopted' : baseline.action === 'revoke' ? 'revoked' : 'unavailable', revision: baseline?.revision ?? 0 },
    notice: 'Historical differences are review context, not a security score or permission to deploy. Exact paths may change in content-hashed builds. Only retained, inspected, authorised evidence is compared.',
  };
  if (baseline?.action === 'adopt' && baselineEvidence) {
    try {
      validate(baselineEvidence, now);
      result.baseline.state = baseline.digest !== baselineEvidence.digest || !clean(baselineEvidence) ? 'unavailable'
        : !sameContext(current, baselineEvidence) || Date.parse(baseline.created_at) > Date.parse(current.scannedAt) ? 'incompatible' : 'available';
    } catch { result.baseline.state = 'unavailable'; }
  }
  if (current.status === 'inconclusive') return result;
  const add = (signal: Signal) => { if (result.signals.length < 100) result.signals.push(signal); };
  const emit = (code: string, title: string, detail: string, examples: string[], samples: number) => {
    if (examples.length) add({ code, title, detail, count: examples.length, samples, examples: [...examples].sort().slice(0, 20) });
  };
  const paths = new Set(current.manifest.map(f => f.path));
  const context = prior.filter(e => e.status !== 'inconclusive' && sameContext(current, e));
  if (context.length) {
    const latest = context[0], previousPaths = new Set(latest.manifest.map(f => f.path)), frequency = new Map<string, number>();
    for (const e of context) for (const f of e.manifest) frequency.set(f.path, (frequency.get(f.path) ?? 0) + 1);
    const introduced = [...paths].filter(p => !previousPaths.has(p));
    emit('new_files', 'New exact file paths', 'Not observed in this compatible history window. New does not mean malicious.', introduced.filter(p => !frequency.has(p)), context.length);
    emit('returned_files', 'Previously seen paths returned', 'Absent from the immediately previous compatible release but present in older retained evidence.', introduced.filter(p => frequency.has(p)), context.length);
    if (context.length >= MIN_SAMPLES) emit('rare_files', 'Infrequent paths', 'Present in at most 20% of comparable retained releases. Review the release purpose before acting.', [...paths].filter(p => frequency.has(p) && frequency.get(p)! / context.length <= .2), context.length);
    const extensions = new Set(context.flatMap(e => e.manifest.map(f => extension(f.path))));
    emit('new_extension', 'New extension types', 'These extension types were not seen in the compatible window.', [...new Set(current.manifest.map(f => extension(f.path)))].filter(x => !extensions.has(x)), context.length);
    if (!context.some(e => metrics(e).maps)) emit('first_source_maps', 'Source maps appeared', 'No maps were observed in this window. A source map is not automatically an unintended disclosure.', current.manifest.filter(f => /\.map$/i.test(f.path)).map(f => f.path), context.length);
    emit('new_executable', 'New executable-like paths', 'Extension-based classification does not establish that a file is executable or malicious.', introduced.filter(p => /\.(exe|dll|so|dylib|wasm|sh|bat|ps1)$/i.test(p)), context.length);
    const previousFindings = new Set(latest.findings), allFindings = new Set(context.flatMap(e => e.findings));
    const changed = [...new Set(current.findings)].filter(f => !previousFindings.has(f));
    emit('finding_regression', 'New finding fingerprints', 'Not recorded in the compatible retained history. The original scanner policy remains authoritative.', changed.filter(f => !allFindings.has(f)), context.length);
    emit('finding_reappeared', 'Finding fingerprints returned', 'Absent from the previous comparable release. Absence alone is not proof of remediation.', changed.filter(f => allFindings.has(f)), context.length);
  }
  const changedContext = prior.filter(e => !sameContext(current, e)).length;
  if (changedContext) add({ code: 'context_changed', title: 'Analysis context changed', detail: 'Different engine or policy fingerprints are excluded from statistics and finding comparisons.', count: changedContext, samples: prior.length, examples: [] });
  const sizes = eligible.map(e => e.bytes).filter((n): n is number => n !== null);
  const size = current.bytes === null ? null : unusual(current.bytes, sizes, 1024 * 1024);
  if (size !== null) add({ code: 'size_drift', title: 'Unusual artefact size change', detail: `${current.bytes} bytes against median ${size}. Review threshold uses a 30%, 1 MiB and MAD floor.`, count: Math.abs(current.bytes! - size), samples: sizes.length, examples: [] });
  const files = unusual(current.manifest.length, eligible.map(e => e.manifest.length), 20);
  if (files !== null) add({ code: 'file_count_drift', title: 'Unusual file-count change', detail: `${current.manifest.length} manifest entries against median ${files}. Review threshold uses a 30%, 20-entry and MAD floor.`, count: Math.abs(current.manifest.length - files), samples: eligible.length, examples: [] });
  if (result.baseline.state === 'available' && baselineEvidence) {
    const old = new Map(baselineEvidence.manifest.map(f => [f.path, f]));
    const changed = current.manifest.filter(f => old.get(f.path)?.sha256 !== f.sha256 || old.get(f.path)?.size !== f.size).map(f => f.path);
    const removed = baselineEvidence.manifest.filter(f => !paths.has(f.path)).map(f => f.path);
    emit('baseline_drift', 'Changed from the approved reference', `${changed.length} added/modified and ${removed.length} removed paths. The reference is never replaced automatically.`, [...changed, ...removed], 1);
  }
  return result;
}
