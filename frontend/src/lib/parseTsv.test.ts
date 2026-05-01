import { describe, expect, it } from "vitest";
import { parseTsv } from "./parseTsv";

describe("parseTsv", () => {
  it("returns [] for empty / whitespace input", () => {
    expect(parseTsv("")).toEqual([]);
    expect(parseTsv("\n")).toEqual([]);
  });

  it("parses a single cell as a 1×1 grid", () => {
    expect(parseTsv("42")).toEqual([[42]]);
  });

  it("parses 6×2 TSV from a spreadsheet copy", () => {
    // 2 rows × 6 cols (the canonical "all six hour columns" paste shape).
    const tsv =
      "10\t20\t30\t40\t50\t60\n" +
      "11\t21\t31\t41\t51\t61\n";
    expect(parseTsv(tsv)).toEqual([
      [10, 20, 30, 40, 50, 60],
      [11, 21, 31, 41, 51, 61],
    ]);
  });

  it("normalises Windows \\r\\n line endings (Excel)", () => {
    expect(parseTsv("1\t2\r\n3\t4\r\n")).toEqual([[1, 2], [3, 4]]);
  });

  it("returns null for non-numeric cells (caller decides skip vs zero)", () => {
    expect(parseTsv("1\tfoo\t3")).toEqual([[1, null, 3]]);
  });

  it("returns null for empty cells (caller decides skip vs zero)", () => {
    expect(parseTsv("1\t\t3")).toEqual([[1, null, 3]]);
  });
});
