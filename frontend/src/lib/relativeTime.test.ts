import { describe, expect, it } from "vitest";
import { relativeTime } from "./relativeTime";

/**
 * relativeTime tests.
 *
 * Strategy: pass Date objects constructed relative to `Date.now()` so the
 * tests do not depend on wall-clock date. Each test constructs a date at
 * a specific offset to exercise each THRESHOLDS band.
 *
 * Note: Intl.RelativeTimeFormat uses "numeric: auto", so some values render
 * as natural-language strings ("yesterday", "last year") rather than
 * "-1 day". We assert on the returned string value from the formatter so
 * the tests pin real output rather than guessing format strings.
 */

function secondsAgo(n: number): Date {
  return new Date(Date.now() - n * 1000);
}
function secondsFromNow(n: number): Date {
  return new Date(Date.now() + n * 1000);
}

// ---------- null / invalid guards -------------------------------------------

describe("relativeTime — null/invalid guards", () => {
  it("returns em-dash for null", () => {
    expect(relativeTime(null)).toBe("—");
  });

  it("returns em-dash for undefined", () => {
    expect(relativeTime(undefined)).toBe("—");
  });

  it("returns em-dash for empty string", () => {
    expect(relativeTime("")).toBe("—");
  });

  it("returns em-dash for an invalid date string", () => {
    expect(relativeTime("not-a-date")).toBe("—");
  });
});

// ---------- recent past (seconds) -------------------------------------------

describe("relativeTime — seconds threshold", () => {
  it("returns a seconds-relative string for an event 5 seconds ago", () => {
    const result = relativeTime(secondsAgo(5));
    // Intl.RelativeTimeFormat("en", {numeric: "auto"}) for -5 seconds returns
    // "5 seconds ago"
    expect(result).toContain("second");
  });

  it("returns a seconds-relative string for an event 30 seconds ago", () => {
    const result = relativeTime(secondsAgo(30));
    expect(result).toContain("second");
  });
});

// ---------- minutes ---------------------------------------------------------

describe("relativeTime — minutes threshold", () => {
  it("returns a minutes-relative string for an event 2 minutes ago", () => {
    const result = relativeTime(secondsAgo(2 * 60));
    expect(result).toContain("minute");
  });

  it("returns a minutes-relative string for an event 45 minutes ago", () => {
    const result = relativeTime(secondsAgo(45 * 60));
    expect(result).toContain("minute");
  });
});

// ---------- hours -----------------------------------------------------------

describe("relativeTime — hours threshold", () => {
  it("returns an hours-relative string for an event 2 hours ago", () => {
    const result = relativeTime(secondsAgo(2 * 60 * 60));
    expect(result).toContain("hour");
  });

  it("returns an hours-relative string for an event 23 hours ago", () => {
    const result = relativeTime(secondsAgo(23 * 60 * 60));
    expect(result).toContain("hour");
  });
});

// ---------- days ------------------------------------------------------------

describe("relativeTime — days threshold", () => {
  it("returns a days-relative string for an event 2 days ago", () => {
    const result = relativeTime(secondsAgo(2 * 24 * 60 * 60));
    expect(result).toContain("day");
  });

  it("returns a days-relative string for an event 10 days ago", () => {
    const result = relativeTime(secondsAgo(10 * 24 * 60 * 60));
    expect(result).toContain("day");
  });
});

// ---------- months ----------------------------------------------------------

describe("relativeTime — months threshold", () => {
  it("returns a months-relative string for an event 2 months ago", () => {
    const result = relativeTime(secondsAgo(60 * 24 * 60 * 60));
    expect(result).toContain("month");
  });

  it("returns a months-relative string for an event 11 months ago", () => {
    const result = relativeTime(secondsAgo(335 * 24 * 60 * 60));
    expect(result).toContain("month");
  });
});

// ---------- years -----------------------------------------------------------

describe("relativeTime — years threshold", () => {
  it("returns a years-relative string for an event 2 years ago", () => {
    const result = relativeTime(secondsAgo(2 * 365 * 24 * 60 * 60));
    expect(result).toContain("year");
  });
});

// ---------- future dates ----------------------------------------------------

describe("relativeTime — future dates", () => {
  it("handles a date 5 minutes in the future", () => {
    const result = relativeTime(secondsFromNow(5 * 60));
    expect(result).toContain("minute");
  });

  it("handles a date 3 days in the future", () => {
    const result = relativeTime(secondsFromNow(3 * 24 * 60 * 60));
    expect(result).toContain("day");
  });
});

// ---------- Date object input -----------------------------------------------

describe("relativeTime — Date object input", () => {
  it("accepts a Date object directly", () => {
    const d = secondsAgo(10 * 60);
    const result = relativeTime(d);
    expect(result).toContain("minute");
  });
});

// ---------- ISO string input ------------------------------------------------

describe("relativeTime — ISO string input", () => {
  it("parses an ISO string correctly", () => {
    const iso = secondsAgo(90 * 60).toISOString();
    const result = relativeTime(iso);
    expect(result).toContain("hour");
  });
});
