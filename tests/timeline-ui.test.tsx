// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TimelineScreen } from "../src/components/watch/screens/TimelineScreen";

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
