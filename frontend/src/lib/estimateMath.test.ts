import { describe, expect, it } from "vitest";
import {
  displayedRow,
  totalHoursForLines,
  totalCostForLines,
  onshoreHoursForLines,
  offshoreHoursForLines,
  multiplierFromMarginPct,
  marginPctFromMultiplier,
  effectiveMarginPct,
  formatMarginPct,
  linkedTmField,
} from "./estimateMath";
import type { EstimateRequestPhaseLineView } from "./api/estimates";

// ---------- helpers ---------------------------------------------------------

function line(
  overrides: Partial<EstimateRequestPhaseLineView> = {},
): EstimateRequestPhaseLineView {
  return {
    sdlcPhaseId: 1,
    sdlcPhaseName: "Discovery",
    displayOrder: 1,
    onshoreLow: 10,
    onshoreMed: 20,
    onshoreHigh: 30,
    offshoreLow: 5,
    offshoreMed: 10,
    offshoreHigh: 15,
    onshoreOverride: null,
    offshoreOverride: null,
    ...overrides,
  };
}

// ---------- displayedRow ----------------------------------------------------

describe("displayedRow", () => {
  it("returns 0/0 and no-override flags when complexity is null", () => {
    const result = displayedRow(line(), null);
    expect(result).toEqual({ onshore: 0, offshore: 0, onshoreOverridden: false, offshoreOverridden: false });
  });

  it("returns LOW snapshot values with no overrides", () => {
    const result = displayedRow(line(), "LOW");
    expect(result.onshore).toBe(10);
    expect(result.offshore).toBe(5);
    expect(result.onshoreOverridden).toBe(false);
    expect(result.offshoreOverridden).toBe(false);
  });

  it("returns MED snapshot values with no overrides", () => {
    const result = displayedRow(line(), "MED");
    expect(result.onshore).toBe(20);
    expect(result.offshore).toBe(10);
    expect(result.onshoreOverridden).toBe(false);
    expect(result.offshoreOverridden).toBe(false);
  });

  it("returns HIGH snapshot values with no overrides", () => {
    const result = displayedRow(line(), "HIGH");
    expect(result.onshore).toBe(30);
    expect(result.offshore).toBe(15);
    expect(result.onshoreOverridden).toBe(false);
    expect(result.offshoreOverridden).toBe(false);
  });

  it("onshoreOverride replaces snapshot onshore value", () => {
    const result = displayedRow(line({ onshoreOverride: 99 }), "LOW");
    expect(result.onshore).toBe(99);
    expect(result.onshoreOverridden).toBe(true);
    // offshore unchanged by onshore override
    expect(result.offshore).toBe(5);
    expect(result.offshoreOverridden).toBe(false);
  });

  it("offshoreOverride replaces snapshot offshore value", () => {
    const result = displayedRow(line({ offshoreOverride: 77 }), "HIGH");
    expect(result.offshore).toBe(77);
    expect(result.offshoreOverridden).toBe(true);
    // onshore unchanged by offshore override
    expect(result.onshore).toBe(30);
    expect(result.onshoreOverridden).toBe(false);
  });

  it("both overrides applied simultaneously", () => {
    const result = displayedRow(line({ onshoreOverride: 50, offshoreOverride: 25 }), "MED");
    expect(result.onshore).toBe(50);
    expect(result.offshore).toBe(25);
    expect(result.onshoreOverridden).toBe(true);
    expect(result.offshoreOverridden).toBe(true);
  });

  it("override of 0 is treated as a valid override (not null-ish)", () => {
    const result = displayedRow(line({ onshoreOverride: 0 }), "LOW");
    expect(result.onshore).toBe(0);
    expect(result.onshoreOverridden).toBe(true);
  });

  it("override replaces the value for the chosen complexity, not other complexities", () => {
    // Override is stored per-line (not per-complexity). At MED, onshoreOverride=42
    // replaces onshoreMed (20). At LOW it would replace onshoreLow (10). The
    // same override value applies regardless of which complexity is active.
    const l = line({ onshoreOverride: 42 });
    expect(displayedRow(l, "MED").onshore).toBe(42);
    expect(displayedRow(l, "LOW").onshore).toBe(42);
    expect(displayedRow(l, "HIGH").onshore).toBe(42);
  });
});

// ---------- totalHoursForLines ----------------------------------------------

describe("totalHoursForLines", () => {
  it("returns 0 when complexity is null", () => {
    expect(totalHoursForLines([line(), line()], null)).toBe(0);
  });

  it("returns 0 for an empty lines array", () => {
    expect(totalHoursForLines([], "MED")).toBe(0);
  });

  it("sums onshore + offshore for each line at LOW complexity", () => {
    // LOW: onshore=10, offshore=5  → per line = 15. Two lines → 30.
    expect(totalHoursForLines([line(), line()], "LOW")).toBe(30);
  });

  it("sums onshore + offshore for each line at MED complexity", () => {
    // MED: onshore=20, offshore=10 → per line = 30. Two lines → 60.
    expect(totalHoursForLines([line(), line()], "MED")).toBe(60);
  });

  it("applies overrides before summing", () => {
    // Line with onshoreOverride=100 at HIGH: onshore=100, offshore=15 → 115
    // Standard line at HIGH: onshore=30, offshore=15 → 45. Total: 160.
    const l1 = line({ onshoreOverride: 100 });
    const l2 = line();
    expect(totalHoursForLines([l1, l2], "HIGH")).toBe(160);
  });
});

// ---------- totalCostForLines -----------------------------------------------

describe("totalCostForLines", () => {
  const rate = { onshoreRate: "100.00", offshoreRate: "50.00" };

  it("returns 0 when complexity is null", () => {
    expect(totalCostForLines([line()], null, rate)).toBe(0);
  });

  it("returns 0 when rate is null", () => {
    expect(totalCostForLines([line()], "MED", null)).toBe(0);
  });

  it("computes correct cost for one line at LOW with no overrides", () => {
    // LOW: onshore=10 × $100 + offshore=5 × $50 = $1000 + $250 = $1250
    expect(totalCostForLines([line()], "LOW", rate)).toBe(1250);
  });

  it("computes correct cost for one line at HIGH with no overrides", () => {
    // HIGH: onshore=30 × $100 + offshore=15 × $50 = $3000 + $750 = $3750
    expect(totalCostForLines([line()], "HIGH", rate)).toBe(3750);
  });

  it("includes overrides in the cost calculation", () => {
    // onshoreOverride=50 at MED: onshore=50 × $100 + offshore=10 × $50 = $5000 + $500 = $5500
    const l = line({ onshoreOverride: 50 });
    expect(totalCostForLines([l], "MED", rate)).toBe(5500);
  });

  it("sums cost across multiple lines", () => {
    // Two LOW lines: (10×100 + 5×50) × 2 = 1250 × 2 = 2500
    expect(totalCostForLines([line(), line()], "LOW", rate)).toBe(2500);
  });

  it("rate strings are parsed correctly (BigDecimal-style strings)", () => {
    const stringRate = { onshoreRate: "125.50", offshoreRate: "45.75" };
    // LOW: onshore=10 × 125.50 + offshore=5 × 45.75 = 1255 + 228.75 = 1483.75
    expect(totalCostForLines([line()], "LOW", stringRate)).toBeCloseTo(1483.75, 5);
  });
});

// ---------- onshoreHoursForLines --------------------------------------------

describe("onshoreHoursForLines", () => {
  it("returns 0 when complexity is null", () => {
    expect(onshoreHoursForLines([line()], null)).toBe(0);
  });

  it("sums only onshore hours at MED with no overrides", () => {
    // Two lines: onshoreMed=20 each → 40
    expect(onshoreHoursForLines([line(), line()], "MED")).toBe(40);
  });

  it("applies onshoreOverride before summing", () => {
    const l = line({ onshoreOverride: 5 });
    // One overridden (5) + one not (10) at LOW → 15
    expect(onshoreHoursForLines([l, line()], "LOW")).toBe(15);
  });

  it("does not include offshore hours", () => {
    // Deliberately different onshore vs offshore values
    const l = line({ onshoreLow: 7, offshoreLow: 99 });
    expect(onshoreHoursForLines([l], "LOW")).toBe(7);
  });
});

// ---------- offshoreHoursForLines -------------------------------------------

describe("offshoreHoursForLines", () => {
  it("returns 0 when complexity is null", () => {
    expect(offshoreHoursForLines([line()], null)).toBe(0);
  });

  it("sums only offshore hours at HIGH with no overrides", () => {
    // Two lines: offshoreHigh=15 each → 30
    expect(offshoreHoursForLines([line(), line()], "HIGH")).toBe(30);
  });

  it("applies offshoreOverride before summing", () => {
    const l = line({ offshoreOverride: 3 });
    // One overridden (3) + one not (10) at MED → 13
    expect(offshoreHoursForLines([l, line()], "MED")).toBe(13);
  });

  it("does not include onshore hours", () => {
    const l = line({ offshoreMed: 7, onshoreMed: 99 });
    expect(offshoreHoursForLines([l], "MED")).toBe(7);
  });
});

// ---------- multiplierFromMarginPct -----------------------------------------

describe("multiplierFromMarginPct", () => {
  it("converts 20% margin to a 1.25 multiplier", () => {
    expect(multiplierFromMarginPct(20)).toBe(1.25);
  });

  it("converts 30% margin to ~1.4286 (rounded to 4dp)", () => {
    expect(multiplierFromMarginPct(30)).toBe(1.4286);
  });

  it("converts 50% margin to a 2.0 multiplier", () => {
    expect(multiplierFromMarginPct(50)).toBe(2);
  });

  it("treats 0% margin as a 1.0 multiplier (no markup)", () => {
    expect(multiplierFromMarginPct(0)).toBe(1);
  });

  it("returns null at 100% margin (divide by zero)", () => {
    expect(multiplierFromMarginPct(100)).toBeNull();
  });

  it("returns null above 100% margin", () => {
    expect(multiplierFromMarginPct(150)).toBeNull();
  });

  it("returns null for a negative margin", () => {
    expect(multiplierFromMarginPct(-5)).toBeNull();
  });

  it("returns null for non-finite input", () => {
    expect(multiplierFromMarginPct(NaN)).toBeNull();
    expect(multiplierFromMarginPct(Infinity)).toBeNull();
  });
});

// ---------- marginPctFromMultiplier -----------------------------------------

describe("marginPctFromMultiplier", () => {
  it("converts a 1.25 multiplier to 20% margin", () => {
    expect(marginPctFromMultiplier(1.25)).toBe(20);
  });

  it("converts a 2.0 multiplier to 50% margin", () => {
    expect(marginPctFromMultiplier(2)).toBe(50);
  });

  it("converts a 1.4286 multiplier back to ~30% (rounded to 2dp)", () => {
    expect(marginPctFromMultiplier(1.4286)).toBe(30);
  });

  it("treats a 1.0 multiplier as 0% margin", () => {
    expect(marginPctFromMultiplier(1)).toBe(0);
  });

  it("returns null below a 1.0 multiplier (zero/negative margin)", () => {
    expect(marginPctFromMultiplier(0.9)).toBeNull();
  });

  it("returns null for non-finite input", () => {
    expect(marginPctFromMultiplier(NaN)).toBeNull();
    expect(marginPctFromMultiplier(Infinity)).toBeNull();
  });

  it("round-trips with multiplierFromMarginPct for common values", () => {
    for (const m of [10, 20, 25, 40, 60]) {
      const mult = multiplierFromMarginPct(m)!;
      expect(marginPctFromMultiplier(mult)).toBe(m);
    }
  });
});

// ---------- effectiveMarginPct ----------------------------------------------

describe("effectiveMarginPct", () => {
  it("computes margin from cost and a higher client price", () => {
    // cost 800, price 1000 → (1 − 0.8) × 100 = 20%
    expect(effectiveMarginPct(800, 1000)).toBe(20);
  });

  it("computes a Target-Margin-derived price back to its margin", () => {
    // 30% margin on 700 cost → price 1000; effective margin reads back as 30%
    expect(effectiveMarginPct(700, 1000)).toBe(30);
  });

  it("returns 0 when price equals cost", () => {
    expect(effectiveMarginPct(500, 500)).toBe(0);
  });

  it("returns a negative margin when price is below cost", () => {
    // cost 1200, price 1000 → (1 − 1.2) × 100 = −20%
    expect(effectiveMarginPct(1200, 1000)).toBe(-20);
  });

  it("returns null when either input is null/undefined", () => {
    expect(effectiveMarginPct(null, 1000)).toBeNull();
    expect(effectiveMarginPct(800, null)).toBeNull();
    expect(effectiveMarginPct(undefined, undefined)).toBeNull();
  });

  it("returns null when the price is zero or negative", () => {
    expect(effectiveMarginPct(800, 0)).toBeNull();
    expect(effectiveMarginPct(800, -100)).toBeNull();
  });
});

// ---------- formatMarginPct -------------------------------------------------

describe("formatMarginPct", () => {
  it("formats a whole-number margin without decimals", () => {
    expect(formatMarginPct(30)).toBe("30%");
  });

  it("keeps one decimal place when non-integer", () => {
    expect(formatMarginPct(33.33)).toBe("33.3%");
  });

  it("trims a trailing .0", () => {
    expect(formatMarginPct(20.04)).toBe("20%");
  });

  it("formats a negative margin with a leading minus", () => {
    expect(formatMarginPct(-12.5)).toBe("-12.5%");
  });

  it("returns null for null/undefined/non-finite", () => {
    expect(formatMarginPct(null)).toBeNull();
    expect(formatMarginPct(undefined)).toBeNull();
    expect(formatMarginPct(Infinity)).toBeNull();
  });
});

// ---------- linkedTmField ---------------------------------------------------

describe("linkedTmField", () => {
  it("editing the multiplier derives the margin", () => {
    expect(linkedTmField("multiplier", "1.25")).toEqual({
      multiplier: "1.25",
      targetMarginPct: "20",
    });
  });

  it("editing the margin derives the multiplier", () => {
    expect(linkedTmField("margin", "30")).toEqual({
      multiplier: "1.4286",
      targetMarginPct: "30",
    });
  });

  it("preserves the edited field's raw text (in-progress typing)", () => {
    // "1." parses to 1 but should not be reformatted while typing
    expect(linkedTmField("multiplier", "1.")).toEqual({
      multiplier: "1.",
      targetMarginPct: "0",
    });
  });

  it("clearing either field clears both", () => {
    expect(linkedTmField("multiplier", "")).toEqual({ multiplier: "", targetMarginPct: "" });
    expect(linkedTmField("margin", "   ")).toEqual({ multiplier: "", targetMarginPct: "" });
  });

  it("blanks the mirror when the edited value is out of range", () => {
    // 100% margin has no finite multiplier
    expect(linkedTmField("margin", "100")).toEqual({ multiplier: "", targetMarginPct: "100" });
    // a below-1 multiplier has no non-negative margin
    expect(linkedTmField("multiplier", "0.5")).toEqual({ multiplier: "0.5", targetMarginPct: "" });
  });

  it("blanks the mirror and keeps raw text for non-numeric input", () => {
    expect(linkedTmField("multiplier", "abc")).toEqual({ multiplier: "abc", targetMarginPct: "" });
    expect(linkedTmField("margin", "x")).toEqual({ multiplier: "", targetMarginPct: "x" });
  });
});
