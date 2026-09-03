import { describe, expect, it } from "vitest";
import { deniedMessage, VIS_FULL, webhookUrl } from "../scripts/phase1-visibility.ts";

describe("phase1 visibility proof", () => {
  it("builds the GitHub App webhook URL from APP_BASE_URL", () => {
    expect(webhookUrl("https://example.trycloudflare.com/")).toBe(
      "https://example.trycloudflare.com/api/webhooks/github",
    );
  });

  it("asks for a throwaway PAT, not App Administration", () => {
    const message = deniedMessage();
    expect(message).toContain(VIS_FULL);
    expect(message).toMatch(/GITHUB_PROOF_TOKEN/);
    expect(message).toMatch(/Do not grant the App Administration/);
    expect(message).toMatch(/Do not publicize a product repository/);
    expect(message).toMatch(/Do not transfer/);
  });
});
