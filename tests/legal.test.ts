import { describe, expect, it } from "vitest";
import {
  LEGAL_NAV,
  LEGAL_PAGES,
  SUPPORT_EMAIL,
  legalSlugFromPath,
} from "../src/legal.ts";

function textOf(
  slug: keyof typeof LEGAL_PAGES,
): string {
  return LEGAL_PAGES[slug].sections.flatMap((section) => section.paragraphs).join("\n");
}

describe("legal pages", () => {
  it("exposes privacy, terms, retention, disclosure, support, and refunds", () => {
    const slugs = LEGAL_NAV.map((item) => item.slug).sort();
    expect(slugs).toEqual(
      ["disclosure", "privacy", "refunds", "retention", "support", "terms"].sort(),
    );
    for (const item of LEGAL_NAV) {
      expect(LEGAL_PAGES[item.slug].path).toBe(item.href);
      expect(legalSlugFromPath(item.href)).toBe(item.slug);
      expect(legalSlugFromPath(`${item.href}/`)).toBe(item.slug);
      expect(LEGAL_PAGES[item.slug].sections.length).toBeGreaterThan(0);
    }
    expect(legalSlugFromPath("/watch")).toBeNull();
  });

  it("states source is never retained and hosted coverage can end unpaid", () => {
    const privacy = textOf("privacy");
    expect(privacy).toMatch(/never retain customer source/i);
    expect(privacy).toMatch(/never store credential values/i);
    expect(privacy).toContain(SUPPORT_EMAIL);

    const terms = textOf("terms");
    expect(terms).toContain("$29");
    expect(terms).toContain("$99");
    expect(terms).toMatch(/14-day/);
    expect(terms).toMatch(/do not execute customer packages/i);
    expect(terms).toMatch(/do not enqueue hosted work/i);

    const retention = textOf("retention");
    expect(retention).toMatch(/deleted in a finally path/i);
    expect(retention).toMatch(/not an archive of customer source/i);
    expect(retention).toMatch(/append-only evidence/i);
    expect(retention).toMatch(/90 days/);

    const disclosure = textOf("disclosure");
    expect(disclosure).toMatch(/do not automatically email maintainers/i);
    expect(disclosure).toContain(SUPPORT_EMAIL);

    const refunds = textOf("refunds");
    expect(refunds).toMatch(/card-on-file checkout is not live yet/i);
    expect(refunds).toMatch(/cancelled at any time/i);
  });
});
