import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HoursGrid, applyPasteAt } from "./HoursGrid";
import { EMPTY_ROW, type RowValues } from "./columns";
import type { PhaseMeta } from "./HoursRow";

const PHASES: PhaseMeta[] = [
  { id: 1, name: "Discovery", displayOrder: 1, active: true },
  { id: 2, name: "Build",     displayOrder: 2, active: true },
  { id: 3, name: "Hypercare", displayOrder: 3, active: false }, // inactive
];

function valuesFor(rows: { phaseId: number; v: Partial<RowValues> }[]): Map<number, RowValues> {
  const out = new Map<number, RowValues>();
  for (const { phaseId, v } of rows) {
    out.set(phaseId, { ...EMPTY_ROW, ...v });
  }
  return out;
}

describe("<HoursGrid>", () => {
  it("renders one row per phase", () => {
    render(
      <HoursGrid phases={PHASES} values={new Map()} onChange={vi.fn()} />,
    );
    // Phase names appear in the row header column.
    expect(screen.getByText("Discovery")).toBeInTheDocument();
    expect(screen.getByText("Build")).toBeInTheDocument();
    expect(screen.getByText("Hypercare")).toBeInTheDocument();
  });

  it("renders the inactive treatment for deactivated phases", () => {
    render(
      <HoursGrid phases={PHASES} values={new Map()} onChange={vi.fn()} />,
    );
    // The "Inactive" pill renders only on the inactive phase row.
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("Grand total row sums all six columns correctly", () => {
    const values = valuesFor([
      { phaseId: 1, v: { onshoreLow: 10, onshoreMed: 20, onshoreHigh: 30,
                         offshoreLow:  4, offshoreMed:  5, offshoreHigh:  6 } },
      { phaseId: 2, v: { onshoreLow:  1, onshoreMed:  2, onshoreHigh:  3,
                         offshoreLow:  4, offshoreMed:  5, offshoreHigh:  6 } },
    ]);
    render(<HoursGrid phases={PHASES} values={values} onChange={vi.fn()} />);

    // Onshore L column = 10 + 1 = 11; Onshore M = 22; etc.
    expect(screen.getByLabelText("Onshore L total")).toHaveTextContent("11");
    expect(screen.getByLabelText("Onshore M total")).toHaveTextContent("22");
    expect(screen.getByLabelText("Onshore H total")).toHaveTextContent("33");
    expect(screen.getByLabelText("Offshore L total")).toHaveTextContent("8");
    expect(screen.getByLabelText("Offshore M total")).toHaveTextContent("10");
    expect(screen.getByLabelText("Offshore H total")).toHaveTextContent("12");
    // Grid grand total = 11+22+33+8+10+12 = 96.
    expect(screen.getByLabelText("Grid total")).toHaveTextContent("96");
  });
});

describe("applyPasteAt", () => {
  it("fills 6×2 TSV starting at the focused cell", () => {
    const values = new Map<number, RowValues>();
    const pasted = [
      [10, 20, 30, 40, 50, 60],
      [11, 21, 31, 41, 51, 61],
    ];
    const next = applyPasteAt(
      { phaseId: 1, colIndex: 0 },
      pasted,
      PHASES,
      values,
    );

    expect(next.get(1)).toMatchObject({
      onshoreLow: 10, onshoreMed: 20, onshoreHigh: 30,
      offshoreLow: 40, offshoreMed: 50, offshoreHigh: 60,
    });
    expect(next.get(2)).toMatchObject({
      onshoreLow: 11, onshoreMed: 21, onshoreHigh: 31,
      offshoreLow: 41, offshoreMed: 51, offshoreHigh: 61,
    });
  });

  it("silently drops out-of-range cells", () => {
    const values = new Map<number, RowValues>();
    // 4-row paste anchored at the third (last) phase: rows 2 and 3 fall off.
    const pasted = [
      [1, 2, 3, 4, 5, 6],
      [7, 8, 9, 10, 11, 12],
      [13, 14, 15, 16, 17, 18],
    ];
    const next = applyPasteAt(
      { phaseId: 3, colIndex: 0 },
      pasted,
      PHASES,
      values,
    );
    expect(next.get(3)?.onshoreLow).toBe(1);
    // Phases 1 and 2 should not have been written by this paste.
    expect(next.has(1)).toBe(false);
    expect(next.has(2)).toBe(false);
  });

  it("skips null cells (non-numeric pastes preserve previous values)", () => {
    const values = valuesFor([{ phaseId: 1, v: { onshoreLow: 99 } }]);
    const pasted = [[null, 2, 3, 4, 5, 6]];
    const next = applyPasteAt(
      { phaseId: 1, colIndex: 0 },
      pasted,
      PHASES,
      values,
    );
    // null at col 0 → onshoreLow stays at 99.
    expect(next.get(1)?.onshoreLow).toBe(99);
    expect(next.get(1)?.onshoreMed).toBe(2);
  });

  it("respects the column-index anchor (paste at col 3 only fills offshore cols)", () => {
    const values = new Map<number, RowValues>();
    const pasted = [[7, 8, 9]];
    const next = applyPasteAt(
      { phaseId: 1, colIndex: 3 },
      pasted,
      PHASES,
      values,
    );
    expect(next.get(1)).toMatchObject({
      onshoreLow: 0, onshoreMed: 0, onshoreHigh: 0,
      offshoreLow: 7, offshoreMed: 8, offshoreHigh: 9,
    });
  });
});
