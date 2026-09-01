import { describe, expect, it } from "vitest";
import {
  SOLO_HEAVY_FAIR_USE,
  TEAM_HEAVY_FAIR_USE,
  heavyFairUseCap,
} from "../src/server/fair-use.ts";

describe("heavy fair-use cap", () => {
  it("gives Team and trial more concurrent unpacks than Solo, never a credit count", () => {
    expect(SOLO_HEAVY_FAIR_USE).toBe(1);
    expect(TEAM_HEAVY_FAIR_USE).toBeGreaterThan(SOLO_HEAVY_FAIR_USE);
    expect(heavyFairUseCap("solo", null)).toBe(SOLO_HEAVY_FAIR_USE);
    expect(heavyFairUseCap("team", null)).toBe(TEAM_HEAVY_FAIR_USE);
    expect(heavyFairUseCap("trial", new Date(Date.now() + 86_400_000).toISOString())).toBe(
      TEAM_HEAVY_FAIR_USE,
    );
    expect(heavyFairUseCap(null, "2000-01-01T00:00:00Z")).toBe(SOLO_HEAVY_FAIR_USE);
  });
});
