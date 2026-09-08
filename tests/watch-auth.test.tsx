// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WatchWorkspace } from "../src/pages/WatchWorkspace.tsx";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Watch authentication", () => {
  it.each(["", "?as=trial", "?as=ended"])(
    "requires a GitHub session for legacy query state %s",
    async (search) => {
      const fetchMock = vi.fn(async (input: string | URL | Request) => {
        expect(String(input)).toBe("/api/me");
        return new Response(
          JSON.stringify({
            user: null,
            installations: [],
            githubApp: true,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<WatchWorkspace path="/watch" search={search} />);

      expect(await screen.findByRole("heading", { name: "Sign in and get to work." })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Sign in with GitHub" }).getAttribute("href")).toBe(
        "/api/auth/github",
      );
      expect(screen.queryByText("Preview workspace", { exact: false })).toBeNull();
      // The workspace entry resolver and login shell may each inspect the session;
      // neither may fetch protected workspace/evidence datasets before sign-in.
      expect(fetchMock.mock.calls.every(call=>call[0]==='/api/me')).toBe(true);
    },
  );

  it("offers an explicitly local review session when GitHub OAuth is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            user: null,
            installations: [],
            githubApp: false,
            developmentLogin: true,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    render(<WatchWorkspace path="/watch" search="" />);

    expect(
      (await screen.findByRole("link", { name: "Open local review workspace" })).getAttribute("href"),
    ).toBe("/api/auth/development");
  });
});
