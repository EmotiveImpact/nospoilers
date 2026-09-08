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
    await user.keyboard("{ArrowUp}");
    expect(combobox.getAttribute("aria-activedescendant")).toBe(endId);
    expect(screen.queryByRole("option", { name: /Private registries/i })).toBeNull();
    expect(screen.queryByRole("option", { name: /Add a source/i })).toBeNull();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
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
        canRespond
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
    await screen.findByRole('combobox',{name:'Workspace member'});
    const dialog = screen.getByRole("dialog", { name: "Artifact exposed" });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    for (let index = 0; index < 6; index += 1) await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(assign);
  });

  it("renders alert detail when findings is digest metadata instead of an array", () => {
    render(
      <WatchAlertsWorkspace
        alerts={[{
          id: 9,
          kind: "release_digest_mismatch",
          title: "Digest changed",
          body: "The served bytes no longer match the last known digest.",
          findings: { coordinate: "web:https://app.example.com/", previousSha256: "old" } as never,
          created_at: "2026-09-03T10:00:00.000Z",
        }]}
        rows={[{
          id: 9,
          title: "Digest changed",
          coordinate: "https://app.example.com/",
          rule: "digest",
          severity: "warning",
          status: "open",
          exposure: "2h",
        }]}
        selected={{
          id: 9,
          kind: "release_digest_mismatch",
          title: "Digest changed",
          body: "The served bytes no longer match the last known digest.",
          findings: { coordinate: "web:https://app.example.com/", previousSha256: "old" } as never,
          full_name: "https://app.example.com/",
          created_at: "2026-09-03T10:00:00.000Z",
        }}
        events={[]}
        previewing
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
        teamOnly={false}
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
    expect(screen.getAllByRole("heading", { name: "Digest changed" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("https://app.example.com/").length).toBeGreaterThan(0);
  });
});
