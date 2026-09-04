import { useWatchScreenContext } from "@/components/watch/useWatchScreenContext";
import { useState } from "react";

type NotificationFlow = "email" | "slack" | "siem" | "jira" | "pagerduty" | "route" | "route-test";

const FLOWS: { value: NotificationFlow; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "slack", label: "Slack" },
  { value: "siem", label: "SIEM" },
  { value: "jira", label: "Jira" },
  { value: "pagerduty", label: "PagerDuty" },
  { value: "route", label: "Add route" },
  { value: "route-test", label: "Test routing" },
];

export function NotificationsScreen() {
  const [flow, setFlow] = useState<NotificationFlow | null>(null);
  const { Button, WatchNotificationSummary, WatchSectionError, WatchSkeleton, activeInstallId, beginConfirm, confirmBusy, confirmForm, confirming, datasetState, deliveries, deskCoverage, deskPackages, deskRepos, destinationKindLabel, destinations, emailAddress, ended, installAdmin, jiraEmail, jiraProjectKey, jiraSite, jiraToken, members, pagerDutyKey, previewing, refreshSignedIn, retryDeskSection, route, routeDestinationId, routeMinSeverity, routeMinSeverityLabel, routePackage, routeRepo, routeTeam, routeTestPackage, routeTestRepo, routeTestSeverity, routes, savingEmail, savingJira, savingPagerDuty, savingRoute, savingSiem, savingSlack, selectedInstallId, setEmailAddress, setJiraEmail, setJiraProjectKey, setJiraSite, setJiraToken, setPagerDutyKey, setRouteDestinationId, setRouteMinSeverity, setRoutePackage, setRouteRepo, setRouteTeam, setRouteTestPackage, setRouteTestRepo, setRouteTestSeverity, setSavingEmail, setSavingJira, setSavingPagerDuty, setSavingRoute, setSavingSiem, setSavingSlack, setSiemWebhook, setSlackError, setSlackWebhook, setTestingRoute, setTestingSlackId, siemWebhook, slackError, slackWebhook, testingRoute, testingSlackId } = useWatchScreenContext();
  return (
    <>
      {route.view === "notifications" && (
              <section className="mt-4">
                <h1 className="watch-page-title">Notifications</h1>
                <p className="watch-page-lede">Destinations and routing rules for real Watch alerts.</p>
                {datasetState.notifications.status === "loading" ? (
                  <WatchSkeleton variant="list" className="mt-6 overflow-hidden rounded-lg border border-white/8" />
                ) : datasetState.notifications.status === "error" ? (
                  <WatchSectionError
                    className="mt-6 max-w-2xl"
                    message={datasetState.notifications.message}
                    onRetry={() => void retryDeskSection("notifications")}
                  />
                ) : (
                <>
                <WatchNotificationSummary destinations={destinations} routes={routes} />
                <section id="watch-notification-config" className="mt-5 rounded-lg border border-white/8 bg-panel p-5">
                <h2 className="text-sm font-semibold text-snow">Add, edit, or test a destination</h2>
                <p className="watch-guidance mt-3 max-w-xl text-sm leading-relaxed text-mute">
                  Covered installs can send Watch alerts to email. Team and trial can also send Slack, a
                  SIEM HTTPS webhook, Jira Cloud, and PagerDuty. Secrets and the full email address are
                  encrypted and never shown again. A delivery test talks to the destination and never
                  creates a Watch alert. Jira tests never open a ticket. PagerDuty tests send a change
                  event and never open an incident. Email tests never invent an incident. Routes send a
                  real alert or a routed test to matching destinations by severity, repository, package,
                  and teammate. This host sends mail only when Resend keys are set.
                </p>
                {previewing ? (
                  <p className="mt-6 text-sm leading-relaxed text-mute">
                    Preview cannot send email, Slack, SIEM, Jira, or PagerDuty. Preview cannot route a
                    test. No invented incident.
                  </p>
                ) : (
                  <>
                    {destinations.length === 0 ? (
                      <p className="mt-6 text-sm leading-relaxed text-mute">
                        No email, Slack, SIEM, Jira, or PagerDuty destination saved on this install.
                      </p>
                    ) : (
                      <ul className="mt-6 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                        {destinations.map((destination) => (
                          <li key={destination.id} className="py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="font-mono text-sm text-snow">
                                {destinationKindLabel(destination.kind)} ·{" "}
                                {destination.kind === "email" && destination.projectKey
                                  ? destination.projectKey
                                  : destination.host}
                                {destination.kind === "jira" && destination.projectKey
                                  ? ` · ${destination.projectKey}`
                                  : ""}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={testingSlackId === destination.id}
                                  onClick={() => {
                                    setSlackError(null);
                                    setTestingSlackId(destination.id);
                                    void (async () => {
                                      try {
                                        const response = await fetch(`/api/destinations/${destination.id}/test`, {
                                          method: "POST",
                                          credentials: "include",
                                        });
                                        const body = (await response.json()) as {
                                          error?: string;
                                          inventedIncident?: boolean;
                                          detail?: string;
                                        };
                                        if (!response.ok || body.inventedIncident) {
                                          throw new Error(body.error ?? body.detail ?? "Could not test delivery.");
                                        }
                                        await refreshSignedIn(selectedInstallId);
                                      } catch (error) {
                                        setSlackError(
                                          error instanceof Error ? error.message : "Could not test Slack.",
                                        );
                                      } finally {
                                        setTestingSlackId(null);
                                      }
                                    })();
                                  }}
                                >
                                  {testingSlackId === destination.id ? "Testing…" : "Test delivery"}
                                </Button>
                                {installAdmin ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={confirmBusy}
                                  onClick={() =>
                                    beginConfirm({
                                      kind: "destination",
                                      id: destination.id,
                                      expected: destination.host,
                                    })
                                  }
                                >
                                  Remove
                                </Button>
                                ) : null}
                              </div>
                            </div>
                            {confirmForm(confirming?.kind === "destination" && confirming.id === destination.id)}
                            <p className="mt-2 text-xs text-dim">
                              {destination.lastDeliveryStatus
                                ? `${destination.lastDeliveryStatus}${
                                    destination.lastDeliveryAt
                                      ? ` · ${new Date(destination.lastDeliveryAt).toLocaleString()}`
                                      : ""
                                  }`
                                : "No delivery yet"}
                              {destination.lastDeliveryError ? ` · ${destination.lastDeliveryError}` : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!ended && installAdmin ? (
                      <div className="mt-6">
                        <p className="text-xs font-medium text-snow">Choose a focused flow</p>
                        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Notification configuration">
                          {FLOWS.map((item) => (
                            <Button
                              key={item.value}
                              type="button"
                              size="sm"
                              variant={flow === item.value ? "default" : "outline"}
                              role="tab"
                              aria-selected={flow === item.value}
                              onClick={() => setFlow(item.value)}
                            >
                              {item.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {!ended && installAdmin && flow === "email" ? (
<form
                        className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (savingEmail || !activeInstallId) return;
                          setSlackError(null);
                          setSavingEmail(true);
                          void (async () => {
                            try {
                              const response = await fetch("/api/destinations/email", {
                                method: "POST",
                                credentials: "include",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({
                                  email: emailAddress,
                                  installationId: activeInstallId,
                                }),
                              });
                              const body = (await response.json()) as { error?: string };
                              if (!response.ok) throw new Error(body.error ?? "Could not save email.");
                              setEmailAddress("");
                              await refreshSignedIn(selectedInstallId);
                            } catch (error) {
                              setSlackError(error instanceof Error ? error.message : "Could not save email.");
                            } finally {
                              setSavingEmail(false);
                            }
                          })();
                        }}
                      >
                        <label className="min-w-0 flex-1">
                          <span className="text-xs uppercase tracking-[0.16em] text-dim">
                            Alert email
                          </span>
                          <input
                            type="email"
                            autoComplete="off"
                            value={emailAddress}
                            onChange={(event) => setEmailAddress(event.target.value)}
                            placeholder="alerts@your-company.com"
                            className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                          />
                        </label>
                        <Button type="submit" size="sm" disabled={savingEmail || !emailAddress.trim()}>
                          {savingEmail ? "Saving…" : "Save email"}
                        </Button>
                      </form>
) : null}
                    {deskCoverage?.plan === "solo" ? (
                      <p className="mt-6 text-sm leading-relaxed text-mute">
                        Slack, SIEM, Jira, and PagerDuty are on Team.
                      </p>
                    ) : null}
                    {deskCoverage?.plan !== "solo" && !ended && installAdmin && flow === "slack" ? (
<form
                        className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (savingSlack || !activeInstallId) return;
                          setSlackError(null);
                          setSavingSlack(true);
                          void (async () => {
                            try {
                              const response = await fetch("/api/destinations/slack", {
                                method: "POST",
                                credentials: "include",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({
                                  webhookUrl: slackWebhook,
                                  installationId: activeInstallId,
                                }),
                              });
                              const body = (await response.json()) as { error?: string };
                              if (!response.ok) throw new Error(body.error ?? "Could not save Slack.");
                              setSlackWebhook("");
                              await refreshSignedIn(selectedInstallId);
                            } catch (error) {
                              setSlackError(error instanceof Error ? error.message : "Could not save Slack.");
                            } finally {
                              setSavingSlack(false);
                            }
                          })();
                        }}
                      >
                        <label className="min-w-0 flex-1">
                          <span className="text-xs uppercase tracking-[0.16em] text-dim">
                            Slack incoming webhook
                          </span>
                          <input
                            type="password"
                            autoComplete="off"
                            value={slackWebhook}
                            onChange={(event) => setSlackWebhook(event.target.value)}
                            placeholder="https://hooks.slack.com/services/…"
                            className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                          />
                        </label>
                        <Button type="submit" size="sm" disabled={savingSlack || !slackWebhook.trim()}>
                          {savingSlack ? "Saving…" : "Save Slack"}
                        </Button>
                      </form>
) : null}
                    {deskCoverage?.plan !== "solo" && !ended && installAdmin && flow === "siem" ? (
<form
                        className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (savingSiem || !activeInstallId) return;
                          setSlackError(null);
                          setSavingSiem(true);
                          void (async () => {
                            try {
                              const response = await fetch("/api/destinations/siem", {
                                method: "POST",
                                credentials: "include",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({
                                  webhookUrl: siemWebhook,
                                  installationId: activeInstallId,
                                }),
                              });
                              const body = (await response.json()) as { error?: string };
                              if (!response.ok) throw new Error(body.error ?? "Could not save SIEM.");
                              setSiemWebhook("");
                              await refreshSignedIn(selectedInstallId);
                            } catch (error) {
                              setSlackError(error instanceof Error ? error.message : "Could not save SIEM.");
                            } finally {
                              setSavingSiem(false);
                            }
                          })();
                        }}
                      >
                        <label className="min-w-0 flex-1">
                          <span className="text-xs uppercase tracking-[0.16em] text-dim">
                            SIEM HTTPS webhook
                          </span>
                          <input
                            type="password"
                            autoComplete="off"
                            value={siemWebhook}
                            onChange={(event) => setSiemWebhook(event.target.value)}
                            placeholder="https://siem.example.com/hooks/…"
                            className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                          />
                        </label>
                        <Button type="submit" size="sm" disabled={savingSiem || !siemWebhook.trim()}>
                          {savingSiem ? "Saving…" : "Save SIEM"}
                        </Button>
                      </form>
) : null}
                    {deskCoverage?.plan !== "solo" && !ended && installAdmin && flow === "jira" ? (
<form
                        className="mt-6 flex max-w-xl flex-col gap-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (
                            savingJira ||
                            !activeInstallId ||
                            !jiraSite.trim() ||
                            !jiraEmail.trim() ||
                            !jiraToken.trim() ||
                            !jiraProjectKey.trim()
                          ) {
                            return;
                          }
                          setSlackError(null);
                          setSavingJira(true);
                          void (async () => {
                            try {
                              const response = await fetch("/api/destinations/jira", {
                                method: "POST",
                                credentials: "include",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({
                                  site: jiraSite,
                                  email: jiraEmail,
                                  token: jiraToken,
                                  projectKey: jiraProjectKey,
                                  installationId: activeInstallId,
                                }),
                              });
                              const body = (await response.json()) as { error?: string };
                              if (!response.ok) throw new Error(body.error ?? "Could not save Jira.");
                              setJiraSite("");
                              setJiraEmail("");
                              setJiraToken("");
                              setJiraProjectKey("");
                              await refreshSignedIn(selectedInstallId);
                            } catch (error) {
                              setSlackError(error instanceof Error ? error.message : "Could not save Jira.");
                            } finally {
                              setSavingJira(false);
                            }
                          })();
                        }}
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="min-w-0">
                            <span className="text-xs uppercase tracking-[0.16em] text-dim">
                              Jira Cloud site
                            </span>
                            <input
                              type="text"
                              autoComplete="off"
                              value={jiraSite}
                              onChange={(event) => setJiraSite(event.target.value)}
                              placeholder="acme.atlassian.net"
                              className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                            />
                          </label>
                          <label className="min-w-0">
                            <span className="text-xs uppercase tracking-[0.16em] text-dim">
                              Project key
                            </span>
                            <input
                              type="text"
                              autoComplete="off"
                              value={jiraProjectKey}
                              onChange={(event) => setJiraProjectKey(event.target.value)}
                              placeholder="NOS"
                              className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                            />
                          </label>
                          <label className="min-w-0">
                            <span className="text-xs uppercase tracking-[0.16em] text-dim">Email</span>
                            <input
                              type="email"
                              autoComplete="off"
                              value={jiraEmail}
                              onChange={(event) => setJiraEmail(event.target.value)}
                              placeholder="bot@example.com"
                              className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                            />
                          </label>
                          <label className="min-w-0">
                            <span className="text-xs uppercase tracking-[0.16em] text-dim">
                              API token
                            </span>
                            <input
                              type="password"
                              autoComplete="off"
                              value={jiraToken}
                              onChange={(event) => setJiraToken(event.target.value)}
                              placeholder="encrypted after save"
                              className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                            />
                          </label>
                        </div>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={
                            savingJira ||
                            !jiraSite.trim() ||
                            !jiraEmail.trim() ||
                            !jiraToken.trim() ||
                            !jiraProjectKey.trim()
                          }
                        >
                          {savingJira ? "Saving…" : "Save Jira"}
                        </Button>
                      </form>
) : null}
                    {deskCoverage?.plan !== "solo" && !ended && installAdmin && flow === "pagerduty" ? (
<form
                        className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (savingPagerDuty || !activeInstallId || !pagerDutyKey.trim()) return;
                          setSlackError(null);
                          setSavingPagerDuty(true);
                          void (async () => {
                            try {
                              const response = await fetch("/api/destinations/pagerduty", {
                                method: "POST",
                                credentials: "include",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({
                                  routingKey: pagerDutyKey,
                                  installationId: activeInstallId,
                                }),
                              });
                              const body = (await response.json()) as { error?: string };
                              if (!response.ok) throw new Error(body.error ?? "Could not save PagerDuty.");
                              setPagerDutyKey("");
                              await refreshSignedIn(selectedInstallId);
                            } catch (error) {
                              setSlackError(
                                error instanceof Error ? error.message : "Could not save PagerDuty.",
                              );
                            } finally {
                              setSavingPagerDuty(false);
                            }
                          })();
                        }}
                      >
                        <label className="min-w-0 flex-1">
                          <span className="text-xs uppercase tracking-[0.16em] text-dim">
                            PagerDuty Events API routing key
                          </span>
                          <input
                            type="password"
                            autoComplete="off"
                            value={pagerDutyKey}
                            onChange={(event) => setPagerDutyKey(event.target.value)}
                            placeholder="32-character routing key"
                            className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                          />
                        </label>
                        <Button type="submit" size="sm" disabled={savingPagerDuty || !pagerDutyKey.trim()}>
                          {savingPagerDuty ? "Saving…" : "Save PagerDuty"}
                        </Button>
                      </form>
) : null}
                    {routes.length === 0 ? (
                      <p className="mt-6 text-sm leading-relaxed text-mute">
                        No routes yet. Destinations without a route still receive every Watch alert.
                      </p>
                    ) : (
                      <ul className="mt-6 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                        {routes.map((route) => {
                          const destination = destinations.find((row) => row.id === route.destinationId);
                          return (
                            <li key={route.id} className="py-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm text-snow">
                                  {destination
                                    ? `${destinationKindLabel(destination.kind)} · ${destination.host}`
                                    : "Destination"}
                                  {` · ${routeMinSeverityLabel(route.minSeverity)}`}
                                  {route.repoFullName ? ` · ${route.repoFullName}` : ""}
                                  {route.packageName ? ` · ${route.packageName}` : ""}
                                  {route.teamLogin ? ` · assign ${route.teamLogin}` : ""}
                                </p>
                                {installAdmin ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={confirmBusy}
                                    onClick={() =>
                                      beginConfirm({
                                        kind: "route",
                                        id: route.id,
                                        expected: destination?.host ?? "",
                                      })
                                    }
                                  >
                                    Remove
                                  </Button>
                                ) : null}
                              </div>
                              {confirmForm(confirming?.kind === "route" && confirming.id === route.id)}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {!ended && installAdmin && destinations.length > 0 && flow === "route" ? (
<form
                        className="mt-6 flex max-w-xl flex-col gap-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (savingRoute || !activeInstallId) return;
                          const destinationId = Number(routeDestinationId || destinations[0]?.id);
                          if (!Number.isFinite(destinationId) || destinationId <= 0) return;
                          setSlackError(null);
                          setSavingRoute(true);
                          void (async () => {
                            try {
                              const response = await fetch("/api/destinations/routes", {
                                method: "POST",
                                credentials: "include",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({
                                  installationId: activeInstallId,
                                  destinationId,
                                  minSeverity: routeMinSeverity,
                                  repoFullName: routeRepo,
                                  packageName: routePackage,
                                  teamLogin: routeTeam,
                                }),
                              });
                              const body = (await response.json()) as { error?: string };
                              if (!response.ok) throw new Error(body.error ?? "Could not save that route.");
                              setRouteRepo("");
                              setRoutePackage("");
                              setRouteTeam("");
                              setRouteMinSeverity("all");
                              await refreshSignedIn(selectedInstallId);
                            } catch (error) {
                              setSlackError(error instanceof Error ? error.message : "Could not save that route.");
                            } finally {
                              setSavingRoute(false);
                            }
                          })();
                        }}
                      >
                        <p className="text-xs uppercase tracking-[0.16em] text-dim">Route</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="min-w-0">
                            <span className="text-xs uppercase tracking-[0.16em] text-dim">Destination</span>
                            <select
                              value={routeDestinationId || String(destinations[0]?.id ?? "")}
                              onChange={(event) => setRouteDestinationId(event.target.value)}
                              className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                            >
                              {destinations.map((destination) => (
                                <option key={destination.id} value={destination.id}>
                                  {destinationKindLabel(destination.kind)} · {destination.host}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="min-w-0">
                            <span className="text-xs uppercase tracking-[0.16em] text-dim">Minimum severity</span>
                            <select
                              value={routeMinSeverity}
                              onChange={(event) =>
                                setRouteMinSeverity(event.target.value as "all" | "warn" | "critical")
                              }
                              className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                            >
                              <option value="all">All severities</option>
                              <option value="warn">Warn and critical</option>
                              <option value="critical">Critical only</option>
                            </select>
                          </label>
                          <label className="min-w-0">
                            <span className="text-xs uppercase tracking-[0.16em] text-dim">Repository</span>
                            <select
                              value={routeRepo}
                              onChange={(event) => setRouteRepo(event.target.value)}
                              className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                            >
                              <option value="">Any repository</option>
                              {deskRepos.map((repo) => (
                                <option key={repo.id} value={repo.full_name}>
                                  {repo.full_name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="min-w-0">
                            <span className="text-xs uppercase tracking-[0.16em] text-dim">Package</span>
                            <select
                              value={routePackage}
                              onChange={(event) => setRoutePackage(event.target.value)}
                              className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                            >
                              <option value="">Any package</option>
                              {deskPackages.map((pkg) => (
                                <option key={pkg.id} value={pkg.package_name}>
                                  {pkg.package_name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="min-w-0 sm:col-span-2">
                            <span className="text-xs uppercase tracking-[0.16em] text-dim">
                              Assign teammate
                            </span>
                            <select
                              value={routeTeam}
                              onChange={(event) => setRouteTeam(event.target.value)}
                              className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                            >
                              <option value="">No auto-assign</option>
                              {members.map((member) => (
                                <option key={member.userId} value={member.login}>
                                  {member.login}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <Button type="submit" size="sm" disabled={savingRoute}>
                          {savingRoute ? "Saving…" : "Save route"}
                        </Button>
                      </form>
) : null}
                    {!ended && destinations.length > 0 && flow === "route-test" ? (
<form
                        className="mt-6 flex max-w-xl flex-col gap-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (testingRoute || !activeInstallId) return;
                          setSlackError(null);
                          setTestingRoute(true);
                          void (async () => {
                            try {
                              const response = await fetch("/api/destinations/route-test", {
                                method: "POST",
                                credentials: "include",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({
                                  installationId: activeInstallId,
                                  severity: routeTestSeverity,
                                  repoFullName: routeTestRepo,
                                  packageName: routeTestPackage,
                                }),
                              });
                              const body = (await response.json()) as {
                                error?: string;
                                inventedIncident?: boolean;
                                detail?: string;
                              };
                              if (!response.ok || body.inventedIncident) {
                                throw new Error(body.error ?? body.detail ?? "Could not test routing.");
                              }
                              await refreshSignedIn(selectedInstallId);
                            } catch (error) {
                              setSlackError(
                                error instanceof Error ? error.message : "Could not test routing.",
                              );
                            } finally {
                              setTestingRoute(false);
                            }
                          })();
                        }}
                      >
                        <p className="text-xs uppercase tracking-[0.16em] text-dim">Routed test</p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="min-w-0">
                            <span className="text-xs uppercase tracking-[0.16em] text-dim">Severity</span>
                            <select
                              value={routeTestSeverity}
                              onChange={(event) =>
                                setRouteTestSeverity(event.target.value as "info" | "warn" | "critical")
                              }
                              className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                            >
                              <option value="critical">Critical</option>
                              <option value="warn">Warn</option>
                              <option value="info">Info</option>
                            </select>
                          </label>
                          <label className="min-w-0">
                            <span className="text-xs uppercase tracking-[0.16em] text-dim">Repository</span>
                            <select
                              value={routeTestRepo}
                              onChange={(event) => setRouteTestRepo(event.target.value)}
                              className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                            >
                              <option value="">Any</option>
                              {deskRepos.map((repo) => (
                                <option key={`test-${repo.id}`} value={repo.full_name}>
                                  {repo.full_name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="min-w-0">
                            <span className="text-xs uppercase tracking-[0.16em] text-dim">Package</span>
                            <select
                              value={routeTestPackage}
                              onChange={(event) => setRouteTestPackage(event.target.value)}
                              className="mt-1 h-10 w-full rounded-md border border-white/15 bg-ink px-3 text-sm text-snow outline-none focus:border-white/40"
                            >
                              <option value="">Any</option>
                              {deskPackages.map((pkg) => (
                                <option key={`test-pkg-${pkg.id}`} value={pkg.package_name}>
                                  {pkg.package_name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <Button type="submit" size="sm" variant="outline" disabled={testingRoute}>
                          {testingRoute ? "Testing…" : "Test routed delivery"}
                        </Button>
                      </form>
) : null}
                    {deliveries.length > 0 ? (
                      <ul className="mt-6 max-w-xl divide-y divide-white/5 rounded-lg border border-white/8 bg-panel px-4">
                        {deliveries.slice(0, 8).map((row) => (
                          <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                            <p className="text-sm text-snow">
                              {destinationKindLabel(row.kind)} · {row.status}
                            </p>
                            <p className="text-xs text-dim">
                              {new Date(row.createdAt).toLocaleString()}
                              {row.error ? ` · ${row.error}` : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {slackError ? <p className="mt-4 text-sm text-danger">{slackError}</p> : null}
                  </>
                )}
                </section>
                </>
                )}
              </section>
              )}
    </>
  );
}
