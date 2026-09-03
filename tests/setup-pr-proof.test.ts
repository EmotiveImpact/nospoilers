import { describe, expect, it } from "vitest";
import {
  SETUP_APP_SLUG,
  SETUP_FULL,
  SETUP_INSTALL_ID,
  SETUP_REPO,
  appPermissionsUrl,
  deniedMessage,
  installAcceptUrl,
  setupPrWriteReady,
} from "../scripts/phase1-setup-pr.ts";

describe("phase1 setup PR proof", () => {
  it("names the existing throwaway and refuses product repos", () => {
    expect(SETUP_REPO).toBe("nospoilers-throwaway");
    expect(SETUP_FULL).toBe("EmotiveImpact/nospoilers-throwaway");
    expect(SETUP_INSTALL_ID).toBe(158159401);
    expect(SETUP_APP_SLUG).toBe("nospoilers-dev");
  });

  it("tells the owner to request Pull requests write, then Accept", () => {
    const message = deniedMessage();
    expect(message).toContain(SETUP_FULL);
    expect(message).toContain(appPermissionsUrl());
    expect(message).toContain(installAcceptUrl());
    expect(message).toMatch(/Pull requests: Read and write/);
    expect(message).toMatch(/npm run phase1:setup-pr/);
    expect(message).toMatch(/Do not grant Administration/);
    expect(message).toMatch(/Do not request Workflows write/);
    expect(message).toMatch(/never merges/i);
    expect(message).toMatch(/Do not invent nospoilers-throwaway-vis/);
    expect(message).toMatch(/Do not publicize a product repository/);
    expect(message).toMatch(/Do not transfer/);
  });

  it("is ready only when the App requested and the install accepted PR write", () => {
    expect(
      setupPrWriteReady(
        { contents: "write", metadata: "read" },
        { contents: "write", metadata: "read" },
      ),
    ).toBe(false);
    expect(
      setupPrWriteReady(
        { contents: "write", pull_requests: "write", metadata: "read" },
        { contents: "write", metadata: "read" },
      ),
    ).toBe(false);
    expect(
      setupPrWriteReady(
        { contents: "write", pull_requests: "write", metadata: "read" },
        { contents: "write", pull_requests: "write", metadata: "read" },
      ),
    ).toBe(true);
  });
});
