import { describe, it, expect } from "vitest";
import { computeEstimate, type EstimatorPhaseInput } from "./estimatorMath";

const DD: EstimatorPhaseInput = { phaseId: 2, midPct: 0.35, offshorePct: 0.1, isAnchor: true };
const REQ: EstimatorPhaseInput = { phaseId: 1, midPct: 0.15, offshorePct: 0, isAnchor: false };

describe("computeEstimate", () => {
  it("reproduces the workbook distribution from dev hours", () => {
    // dev 80/120/200, anchor Mid 35%, 10% contingency.
    const r = computeEstimate({
      devLow: 80,
      devMid: 120,
      devHigh: 200,
      contingencyPct: 0.1,
      phases: [REQ, DD],
    });
    expect(r.ok).toBe(true);

    // Design & Develop (anchor): input 120 → 132 with contingency, split 90/10.
    const dd = r.values.get(2)!;
    expect(dd.onshoreLow).toBe(79.2);
    expect(dd.onshoreMed).toBe(118.8);
    expect(dd.onshoreHigh).toBe(198);
    expect(dd.offshoreMed).toBe(13.2);

    // Requirements: 15% of the total, fully onshore.
    const req = r.values.get(1)!;
    expect(req.onshoreMed).toBe(56.6);
    expect(req.offshoreMed).toBe(0);

    expect(r.totals.mid).toBe(188.6);
  });

  it("returns ok=false when there is no usable anchor", () => {
    const r = computeEstimate({
      devLow: 80,
      devMid: 120,
      devHigh: 200,
      contingencyPct: 0.1,
      phases: [{ ...DD, isAnchor: false }, REQ],
    });
    expect(r.ok).toBe(false);
    expect(r.values.size).toBe(0);
  });

  it("skips phases without a benchmark Mid %", () => {
    const r = computeEstimate({
      devLow: 100,
      devMid: 100,
      devHigh: 100,
      contingencyPct: 0,
      phases: [DD, { phaseId: 9, midPct: null, offshorePct: 0.5, isAnchor: false }],
    });
    expect(r.values.has(2)).toBe(true);
    expect(r.values.has(9)).toBe(false);
  });

  it("applies each phase's offshore split independently", () => {
    // total = 100/0.5 = 200; phase hrs = 100; split 75/25.
    const r = computeEstimate({
      devLow: 100,
      devMid: 100,
      devHigh: 100,
      contingencyPct: 0,
      phases: [{ phaseId: 2, midPct: 0.5, offshorePct: 0.25, isAnchor: true }],
    });
    const row = r.values.get(2)!;
    expect(row.onshoreMed).toBe(75);
    expect(row.offshoreMed).toBe(25);
  });
});
