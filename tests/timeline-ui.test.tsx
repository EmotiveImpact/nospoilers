// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TimelineScreen } from "../src/components/watch/screens/TimelineScreen";
import { radixUiTestSupport } from './helpers/radix-ui';
import { selectOption } from './helpers/select-option';

radixUiTestSupport();

const navigate = vi.hoisted(() => vi.fn());
vi.mock("../src/nav", () => ({ navigate }));

afterEach(() => {
  cleanup();
  navigate.mockClear();
});

const entries = [
  {
    type: "alert" as const,
    at: "2026-09-16T10:42:00.000Z",
    alertId: 23,
    title: "Release needs review",
    kind: "release_scan",
    fullName: "org/app",
    action: null,
    actorLogin: null,
    deliveryStatus: null,
    inventedIncident: null,
  },
  {
    type: "delivery" as const,
    at: "2026-09-16T10:43:00.000Z",
    alertId: null,
    title: null,
    kind: "email",
    fullName: null,
    action: null,
    actorLogin: null,
    deliveryStatus: "sent" as const,
    inventedIncident: false as const,
  },
];

it("filters retained activity, supports keyboard tabs, and opens the exact linked alert", () => {
  render(
    <TimelineScreen
      previewing={false}
      timeline={{ status: "ready", entries, days: 90 }}
      alerts={[]}
      alertState={{ status: "ready" }}
      search="?workspace=workspace&install=7"
      onRetryTimeline={() => undefined}
      onRetryAlerts={() => undefined}
    />,
  );

  expect(screen.getByRole("heading", { name: "The story behind each release." })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Open alert" }));
  expect(navigate).toHaveBeenCalledWith("/watch/alerts?workspace=workspace&install=7&alert=23");

  const allTab = screen.getByRole("tab", { name: "All activity" });
  allTab.focus();
  fireEvent.keyDown(allTab, { key: "ArrowRight" });
  expect(screen.getByRole("tab", { name: "Alerts" }).getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(screen.getByRole("tab", { name: "Alerts" }), { key: "End" });
  expect(screen.getByRole("tab", { name: "Deliveries" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe("timeline-filter-deliveries");
  expect(screen.queryByText("Release needs review")).toBeNull();
  expect(screen.getByText("Email sent")).toBeTruthy();
  expect(screen.getByText("Recorded delivery")).toBeTruthy();
});

it("groups repeated incomplete checks by day while preserving every exact alert link", () => {
  const missing = (id: number, repo: string, at: string) => ({
    type: "alert" as const,
    at,
    alertId: id,
    repoId: id + 100,
    title: `No release on ${repo}`,
    kind: "scan_latest_release",
    fullName: repo,
    action: null,
    actorLogin: null,
    deliveryStatus: null,
    inventedIncident: null,
  });
  render(
    <TimelineScreen
      previewing={false}
      timeline={{ status: "ready", entries: [
        missing(31, "org/first", "2026-09-16T10:42:00.000Z"),
        entries[0],
        missing(32, "org/second", "2026-09-16T10:40:00.000Z"),
        missing(33, "org/third", "2026-09-15T10:40:00.000Z"),
      ], days: 90 }}
      alerts={[]}
      alertState={{ status: "ready" }}
      search="?workspace=workspace&install=7&tab=open&alert=55&before=4&mine=1"
      onRetryTimeline={() => undefined}
      onRetryAlerts={() => undefined}
    />,
  );

  expect(screen.getByText("2 checks")).toBeTruthy();
  expect(screen.getByText("org/third")).toBeTruthy();
  expect(screen.queryByText("org/first")).toBeNull();
  const toggle = screen.getByRole("button", { name: "Show checks" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  expect(screen.getByText("org/first")).toBeTruthy();
  expect(screen.getByText("org/second")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Open source" })).toHaveLength(3);
  fireEvent.click(screen.getAllByRole("button", { name: "Open source" })[1]);
  expect(navigate).toHaveBeenCalledWith("/watch/sources?workspace=workspace&install=7&sourceType=github&configure=github&source=repo-132");

  fireEvent.change(screen.getByRole("searchbox", { name: "Search source or event" }), { target: { value: "org/first" } });
  expect(screen.getByText("org/first")).toBeTruthy();
  expect(screen.queryByText("org/second")).toBeNull();
  expect(screen.queryByText("2 checks")).toBeNull();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search source or event" }), { target: { value: "not-a-source" } });
  expect(screen.getByText("No activity matches this search and tab.")).toBeTruthy();
});

const timelineProps = {
  previewing: false,
  alerts: [],
  alertState: { status: 'ready' as const },
  search: '?workspace=one&install=7',
  onRetryTimeline: () => undefined,
  onRetryAlerts: () => undefined,
};
function activity(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    ...entries[0],
    alertId: index + 1,
    title: `Review item ${index + 1}`,
    fullName: `org/item-${index + 1}`,
  }));
}

it('paginates retained activity with 10, 30 and 60 events and clamps after its window shrinks', async () => {
  const view = render(<TimelineScreen {...timelineProps} timeline={{ status: 'ready', entries: activity(65), days: 90 }} />);
  expect(screen.getAllByRole('button', { name: 'Open alert' })).toHaveLength(10);
  expect(screen.queryByText('Review item 11')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Review item 11')).toBeTruthy();
  await selectOption(screen.getByRole('combobox', { name: 'Timeline activity per page' }), '30');
  expect(screen.getAllByRole('button', { name: 'Open alert' })).toHaveLength(30);
  expect(screen.getByText('Review item 1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Review item 31')).toBeTruthy();
  await selectOption(screen.getByRole('combobox', { name: 'Timeline activity per page' }), '60');
  expect(screen.getAllByRole('button', { name: 'Open alert' })).toHaveLength(60);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getAllByRole('button', { name: 'Open alert' })).toHaveLength(5);
  view.rerender(<TimelineScreen {...timelineProps} timeline={{ status: 'ready', entries: activity(35), days: 90 }} />);
  expect(screen.getByText('Review item 1')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'Open alert' })).toHaveLength(35);
  expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
});

it('filters and searches all returned events before pagination and resets when tab or installation changes', () => {
  const retained = [...activity(24), ...activity(12).map((entry, index) => ({ ...entry, type: 'alert_event' as const, action: `response_${index + 1}`, fullName: `org/response-${index + 1}` }))];
  const view = render(<TimelineScreen {...timelineProps} timeline={{ status: 'ready', entries: retained, days: 90 }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search source or event' }), { target: { value: 'org/item-24' } });
  expect(screen.getByText('Review item 24')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'Open alert' })).toHaveLength(1);
  expect(screen.queryByRole('combobox')).toBeNull();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search source or event' }), { target: { value: '' } });
  expect(screen.getByText('Review item 1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Responses' }));
  expect(screen.getByText('response 1')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'Open response' })).toHaveLength(10);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('response 11')).toBeTruthy();
  view.rerender(<TimelineScreen {...timelineProps} search="?workspace=one&install=8" timeline={{ status: 'ready', entries: retained, days: 90 }} />);
  expect(screen.getByText('response 1')).toBeTruthy();
});

it('keeps repeated-check groups scoped to each page and preserves exact source links', () => {
  const checks = activity(24).map((entry, index) => ({ ...entry, title: `No release on org/item-${index + 1}`, kind: 'scan_latest_release', repoId: 300 + index + 1 }));
  render(<TimelineScreen {...timelineProps} timeline={{ status: 'ready', entries: checks, days: 90 }} />);
  expect(screen.getByText('10 checks')).toBeTruthy();
  expect(screen.getByText(/Across connected repositories on this page/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('4 checks')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Show checks' }));
  expect(screen.getAllByRole('button', { name: 'Open source' })).toHaveLength(4);
  fireEvent.click(screen.getAllByRole('button', { name: 'Open source' })[3]);
  expect(navigate).toHaveBeenLastCalledWith('/watch/sources?workspace=one&install=7&sourceType=github&configure=github&source=repo-324');
});
