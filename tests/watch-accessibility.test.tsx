// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { WatchAlertsWorkspace } from "../src/components/WatchAlertsWorkspace";
import { WatchCommandPalette } from "../src/components/WatchCommandPalette";

function PaletteHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open commands</button>
      <WatchCommandPalette
        open={open}
        search="?install=7"
        teamOnly={false}
        adminOnly={false}
        alerts={[{ id: 12, title: "Artifact exposed" }]}
        sources={[{ key: "npm-4", name: "artifact-kit" }]}
        releases={[{ id: 9, coordinate: "artifact-kit@1.2.0" }]}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

describe("Watch keyboard and dialog accessibility", () => {
  it("implements combobox/listbox keyboard semantics and restores focus on Escape", async () => {
    const user = userEvent.setup();
    render(<PaletteHarness />);
    const trigger = screen.getByRole("button", { name: "Open commands" });
    await user.click(trigger);

    const combobox = await screen.findByRole("combobox");
    expect(combobox.getAttribute("aria-controls")).toBeTruthy();
    expect(screen.getByRole("listbox")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(combobox));

    await user.keyboard("{End}");
    const endId = combobox.getAttribute("aria-activedescendant");
    expect(endId).toBeTruthy();
    expect(document.getElementById(endId!)?.getAttribute("aria-selected")).toBe("true");

    await user.keyboard("{Home}");
    expect(combobox.getAttribute("aria-activedescendant")).not.toBe(endId);
    expect(screen.queryByRole("option", { name: /Private registries/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Add a source/i })).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("combobox")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });

  it("traps assignment focus, closes with Escape, and restores the invoking control", async () => {
    const user = userEvent.setup();
    render(
      <WatchAlertsWorkspace
        alerts={[{
          id: 1,
          kind: "release_scan",
          title: "Artifact exposed",
          body: "A packed artifact exposed source.",
          findings: [{ rule: "SRC-001", path: "dist/app.js.map" }],
          created_at: "2026-09-03T10:00:00.000Z",
        }]}
        rows={[{
          id: 1,
          title: "Artifact exposed",
          coordinate: "acme/app",
          rule: "SRC-001",
          severity: "critical",
          status: "open",
          exposure: "2h",
        }]}
        selected={{
          id: 1,
          kind: "release_scan",
          title: "Artifact exposed",
          body: "A packed artifact exposed source.",
          findings: [{ rule: "SRC-001", path: "dist/app.js.map" }],
          created_at: "2026-09-03T10:00:00.000Z",
        }}
        events={[]}
        previewing={false}
        ended={false}
        busy={false}
        note=""
        assignee=""
        error={null}
        exportError={null}
        state={{ status: "ready" }}
        activityState={{ status: "ready" }}
        detailOpen
        tab="open"
        teamOnly
        onSelect={() => undefined}
        onBack={() => undefined}
        onRetry={() => undefined}
        onRetryActivity={() => undefined}
        onTab={() => undefined}
        onNote={() => undefined}
        onAssignee={() => undefined}
        onAction={() => undefined}
        onExport={() => undefined}
      />,
    );

    const assign = screen.getByRole("button", { name: "Assign" });
    await user.click(assign);
    const input = await screen.findByPlaceholderText("teammate");
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(screen.getByRole("dialog", { name: "Artifact exposed" })).toBeTruthy();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(assign);
  });
});
