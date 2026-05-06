import { describe, expect, it } from "vitest";
import { parseMoney, formatMoney, formatDelta } from "./money";

// ---------- parseMoney ------------------------------------------------------

describe("parseMoney", () => {
  it("returns null for empty string", () => {
    expect(parseMoney("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(parseMoney("   ")).toBeNull();
  });

  it("parses a plain number string", () => {
    expect(parseMoney("100")).toBe(100);
  });

  it("strips leading $ prefix", () => {
    expect(parseMoney("$125.00")).toBe(125);
  });

  it("strips commas", () => {
    expect(parseMoney("1,250.50")).toBe(1250.5);
  });

  it("strips both $ and commas together", () => {
    expect(parseMoney("$1,250.00")).toBe(1250);
  });

  it("strips whitespace inside the string", () => {
    expect(parseMoney(" 99.99 ")).toBe(99.99);
  });

  it("returns null for a non-numeric string after stripping", () => {
    // "abc" → Number("abc") = NaN → null
    expect(parseMoney("abc")).toBeNull();
  });

  it("handles zero correctly", () => {
    expect(parseMoney("0")).toBe(0);
  });

  it("handles $0.00 correctly", () => {
    expect(parseMoney("$0.00")).toBe(0);
  });
});

// ---------- formatMoney -----------------------------------------------------

describe("formatMoney", () => {
  it("returns em-dash for null", () => {
    expect(formatMoney(null)).toBe("—");
  });

  it("returns em-dash for undefined", () => {
    expect(formatMoney(undefined)).toBe("—");
  });

  it("returns em-dash for empty string", () => {
    expect(formatMoney("")).toBe("—");
  });

  it("formats zero with two decimal places", () => {
    expect(formatMoney(0)).toBe("0.00");
  });

  it("formats a plain integer with two decimal places", () => {
    expect(formatMoney(125)).toBe("125.00");
  });

  it("formats a decimal with two decimal places", () => {
    expect(formatMoney(1250.5)).toBe("1,250.50");
  });

  it("formats a large number with thousands separator", () => {
    expect(formatMoney(1000000)).toBe("1,000,000.00");
  });

  it("accepts a numeric string and formats it", () => {
    expect(formatMoney("99.9")).toBe("99.90");
  });

  it("returns em-dash for a non-numeric string", () => {
    expect(formatMoney("abc")).toBe("—");
  });

  it("returns em-dash for Infinity", () => {
    expect(formatMoney(Infinity)).toBe("—");
  });

  it("returns em-dash for NaN passed as string 'NaN'", () => {
    expect(formatMoney("NaN")).toBe("—");
  });
});

// ---------- formatDelta -----------------------------------------------------

describe("formatDelta", () => {
  it("returns flat shape when prev equals next", () => {
    const result = formatDelta(100, 100);
    expect(result.sign).toBe("flat");
    expect(result.abs).toBe("$0.00");
    expect(result.pct).toBe("0%");
    expect(result.text).toBe("no change");
  });

  it("returns up shape when next > prev", () => {
    const result = formatDelta(100, 105);
    expect(result.sign).toBe("up");
    expect(result.abs).toBe("+$5.00");
    expect(result.pct).toBe("5.0%");
    expect(result.text).toContain("+$5.00");
    expect(result.text).toContain("increase");
  });

  it("returns down shape when next < prev", () => {
    const result = formatDelta(100, 95);
    expect(result.sign).toBe("down");
    expect(result.abs).toContain("5.00");
    expect(result.text).toContain("decrease");
  });

  it("handles fractional deltas correctly", () => {
    const result = formatDelta(200, 202.5);
    expect(result.sign).toBe("up");
    expect(result.abs).toBe("+$2.50");
  });

  it("returns em-dash percentage when prev is 0 (division by zero guard)", () => {
    const result = formatDelta(0, 50);
    expect(result.sign).toBe("up");
    expect(result.pct).toBe("—");
  });

  it("formats a large absolute increase", () => {
    const result = formatDelta(1000, 11000);
    expect(result.sign).toBe("up");
    expect(result.abs).toBe("+$10,000.00");
    expect(result.pct).toBe("1000.0%");
  });
});
