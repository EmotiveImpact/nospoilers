import { describe, expect, it } from "vitest";
import { DOCS_PATH, DOCS_SECTIONS, docsText } from "../src/docs.ts";
import { SUPPORT_EMAIL, legalSlugFromPath } from "../src/legal.ts";

describe("public documentation", () => {
  it("covers packed scans, GitHub Watch, and what we never do", () => {
    expect(DOCS_PATH).toBe("/docs");
    expect(legalSlugFromPath("/docs")).toBeNull();
    expect(DOCS_SECTIONS.length).toBeGreaterThan(3);
    const text = docsText();
    expect(text).toMatch(/never execute/i);
    expect(text).toMatch(/never retain source/i);
    expect(text).toMatch(/do not quote secrets/i);
    expect(text).toMatch(/GitHub App/i);
    expect(text).toMatch(/14-day/);
    expect(text).toContain("$29");
    expect(text).toContain("$99");
    expect(text).toMatch(/not live yet/i);
    expect(text).toMatch(/Electron/);
    expect(text).toMatch(/rate-limited/i);
    expect(text).toMatch(/webhooks are not/i);
    expect(text).toMatch(/Administration/);
    expect(text).toMatch(/make-private, delete assets, disable workflows/);
    expect(text).toMatch(/signed receipt/i);
    expect(text).toMatch(/hashed in the browser/i);
    expect(text).toMatch(/Watch lists the linked receipt status/i);
    expect(text).toMatch(/Watch lists the linked receipt status on Releases and downloads the signed JSON/i);
    expect(text).toMatch(/Scan latest release unpacks that repository/i);
    expect(text).toMatch(/not the git tree/i);
    expect(text).toMatch(/failed-policy/i);
    expect(text).toMatch(/renamed/i);
    expect(text).toContain(SUPPORT_EMAIL);
    expect(text).not.toMatch(/postgres(?:ql)?:\/\//i);
  });
});
