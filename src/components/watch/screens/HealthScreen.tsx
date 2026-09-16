import { useEffect, useRef } from "react";
import { WatchPageHeader } from "@/components/watch/WatchPageHeader";
import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import "../design/journey-administration.css";
import {GitBranch} from "lucide-react";
import type { PermissionTest } from "@/watch/types";

function webhookStat(githubPaused: boolean, test?: PermissionTest | null) {
  if (githubPaused) {
    return { value: "paused", tone: "text-danger", note: "GitHub suspended the App" };
  }
  const delivery = test?.lastDelivery;
  if (!delivery) {
    return { value: "check needed", tone: "text-mute", note: "No invented delivery proof" };
  }
  const failed = delivery.status === "failed";
  return {
    value: delivery.status,
    tone: failed ? "text-danger" : "text-ok",
    note: `${delivery.kind} · ${new Date(delivery.at).toLocaleString()}`,
  };
}

function permissionStat(test?: PermissionTest | null) {
  if (!test) {
    return { value: "unknown", tone: "text-mute", note: "Run the live install test" };
  }
  if (test.administrationGranted) {
    return { value: test.ok ? "pass" : "fail", tone: "text-warn", note: "Administration granted — remove it" };
  }
  if (test.ok) {
    return { value: "pass", tone: "text-ok", note: "Administration off" };
  }
  return { value: "fail", tone: "text-danger", note: test.detail };
}

function fairUseStat(fairUse: { exhausted?: boolean; warning?: boolean } | null | undefined) {
  if (fairUse?.exhausted) return { value: "paused", tone: "text-danger", note: "Hosted unpacks · not scan credits" };
  if (fairUse?.warning) return { value: "near cap", tone: "text-warn", note: "Hosted unpacks · not scan credits" };
  if (fairUse) return { value: "ok", tone: "text-ok", note: "Hosted unpacks · not scan credits" };
  return { value: "unknown", tone: "text-mute", note: "Hosted unpacks · not scan credits" };
}

export function HealthScreen() {
  const {
    Button,
    FAIR_USE_EXHAUSTED,
    FAIR_USE_WARNING,
    activeInstallId,
    fairUse,
    githubPaused,
    installations,
    jobSummary,
    jobs,
    kindLabel,
    previewing,
    route,
    selectedInstall,
    setMe,
    setTestError,
    setTestingInstallId,
    testError,
    testingInstallId,
  } = useWatchScreenContext();
  const failureRef = useRef<HTMLParagraphElement>(null);
  const initiatingFocus = useRef<Element | null>(null);
  useEffect(() => {
    if (testError && initiatingFocus.current === document.activeElement) failureRef.current?.focus();
    if (testError) initiatingFocus.current = null;
  }, [testError]);
  if (route.view !== "health") return null;

  const visibleInstalls = installations.filter((row) => !activeInstallId || row.id === activeInstallId);
  const usage = fairUseStat(fairUse);

  async function testInstall(installId: number) {
    initiatingFocus.current = document.activeElement;
    setTestError(null);
    setTestingInstallId(installId);
    try {
      const response = await fetch(`/api/installations/${installId}/test`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await response.json()) as {
        error?: string;
        inventedIncident?: boolean;
        test?: PermissionTest;
      };
      if (!response.ok || !body.test || body.inventedIncident) {
        throw new Error(body.error ?? "Could not test this install.");
      }
      const result = body.test;
      setMe((current) => {
        if (current.status !== "ready") return current;
        return {
          status: "ready",
          data: {
            ...current.data,
            installations: current.data.installations.map((row) =>
              row.id === installId
                ? {
                    ...row,
                    lastPermissionTest: result,
                    lastPermissionTestAt: result.testedAt,
                  }
                : row,
            ),
          },
        };
      });
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "Could not test this install.");
    } finally {
      setTestingInstallId(null);
    }
  }

  return (
    <section className="journey-administration min-w-0 [overflow-wrap:anywhere]">
      <WatchPageHeader title="Connection health." lede="Repair a specific connection without guessing from a score."/>
      {githubPaused?<p className="journey-admin-notice text-danger">GitHub suspended the NoSpoilers App{selectedInstall?` on ${selectedInstall.account_login}`:''}. This is not a billing change.</p>:null}
      {!previewing&&fairUse?.exhausted?<p className="journey-admin-notice text-danger">{FAIR_USE_EXHAUSTED}</p>:!previewing&&fairUse?.warning?<p className="journey-admin-notice">{FAIR_USE_WARNING}</p>:null}
      {previewing?<p className="journey-admin-notice">Preview cannot reach GitHub. No invented incident.</p>:visibleInstalls.length===0?<div className="watch-empty">Nothing on this install yet. Health fills in after the GitHub app can see a repo.</div>:<div className="journey-admin-table"><table aria-label="Connection health"><thead><tr><th>Connection</th><th>Access</th><th>Last event</th><th>Action</th></tr></thead><tbody>{visibleInstalls.map(install=>{
        const test=install.lastPermissionTest,permission=permissionStat(test),delivery=webhookStat(githubPaused,test);
        return <tr key={install.id}><td><div className="journey-admin-entity"><span className="journey-admin-icon"><GitBranch size={18} aria-hidden="true"/></span><div><strong>GitHub · {install.account_login}</strong><small>Repository access</small></div></div></td><td><span className={permission.tone}>{githubPaused?'Suspended':!test?'Not tested':test.administrationGranted?'Review permissions':test.ok?'Available':'Check failed'}</span><small>{permission.note}</small>{test?<small>{test.detail}</small>:null}{test?.pendingAccepts&&test.pendingAccepts.length>0&&test.installUrl?<a href={test.installUrl} target="_blank" rel="noreferrer" className="journey-admin-link">Accept requested permissions</a>:null}</td><td>{test?.lastDelivery?<><span className={delivery.tone}>{test.lastDelivery.status}</span><small>{delivery.note}</small></>:<span>No delivery recorded</span>}{test?<small>Tested {new Date(test.testedAt).toLocaleString()}</small>:null}</td><td><Button type="button" size="sm" variant="outline" disabled={testingInstallId===install.id} onClick={()=>void testInstall(install.id)}>{testingInstallId===install.id?'Testing…':'Test install'}</Button></td></tr>;
      })}</tbody></table></div>}
      {testError?<p ref={failureRef} tabIndex={-1} role="alert" className="journey-admin-notice text-danger">{testError}</p>:null}
      <section className="journey-admin-section"><h2>What these states mean</h2><div className="journey-admin-columns"><div><h3>Connected</h3><p>Access is configured. This does not mean a release has been inspected. Live permission tests check GitHub access without creating alerts.</p></div><div><h3>Checked</h3><p>A recorded check exists. Open its result to see scope, findings and limitations. New permissions require acceptance in GitHub; Administration should remain off.</p></div></div></section>
      <section className="journey-admin-section"><div className="journey-admin-section-heading"><h2>Recent work</h2><span>{jobSummary.queued+jobSummary.running} queued or running · {jobSummary.done} done · {jobSummary.failed} failed</span></div>{previewing||jobs.length===0?<p className="journey-admin-note">No jobs on this install yet. The list fills after a real scan or webhook.</p>:<div className="journey-admin-table"><table aria-label="Recent connection work"><thead><tr><th>Work</th><th>Started</th><th>Attempt</th><th>Status</th></tr></thead><tbody>{jobs.map(job=><tr key={job.id}><td><strong>{kindLabel(job.kind)}</strong>{job.error?<small>{job.error}</small>:null}</td><td>{job.createdAt?new Date(job.createdAt).toLocaleString():'Not recorded'}</td><td>{job.attempts}</td><td className={job.status==='failed'?'text-danger':'text-mute'}>{job.status}</td></tr>)}</tbody></table></div>}<p className="journey-admin-note">Hosted unpack allowance: <span className={usage.tone}>{usage.value}</span>. This is separate from scan credits. Global queues remain owner-only.</p></section>
    </section>
  );
}
