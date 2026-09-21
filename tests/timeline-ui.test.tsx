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
  fireEvent.click(screen.getByRole("button", { name: /^View/ }));
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
