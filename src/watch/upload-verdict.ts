import type { ScanReport } from '../report-types.ts';

/** A completed job is not itself evidence of a passing policy decision. */
export function uploadVerdict(status:string, report:ScanReport|null) {
  if(status==='queued') return 'Queued';
  if(status==='running') return 'Inspecting artifact';
  if(status==='failed') return 'Scan failed';
  if(status!=='done' || !report) return 'Result unavailable';
  if(report.status==='inconclusive') return 'Inconclusive';
  if(report.status!=null && report.status!=='passed' && report.status!=='failed-policy') return 'Result unavailable';
  if(report.status==='failed-policy' || !report.ok) return 'Review findings';
  if(report.suppressed?.length) return 'Policy passed with exceptions';
  return 'Policy passed';
}
