/**
 * "12 min ago" / "Yesterday" / "3 days ago" formatting using the platform's
 * Intl.RelativeTimeFormat. Reused everywhere we render an updated_at column.
 *
 * Returns "—" for null/empty inputs so callers don't have to guard.
 */
const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

interface Threshold {
  unit: Intl.RelativeTimeFormatUnit;
  seconds: number;
}

const THRESHOLDS: Threshold[] = [
  { unit: "year", seconds: 60 * 60 * 24 * 365 },
  { unit: "month", seconds: 60 * 60 * 24 * 30 },
  { unit: "day", seconds: 60 * 60 * 24 },
  { unit: "hour", seconds: 60 * 60 },
  { unit: "minute", seconds: 60 },
  { unit: "second", seconds: 1 },
];

export function relativeTime(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "—";

  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  for (const t of THRESHOLDS) {
    if (Math.abs(diffSec) >= t.seconds || t.unit === "second") {
      const value = Math.round(diffSec / t.seconds);
      return formatter.format(value, t.unit);
    }
  }
  return formatter.format(diffSec, "second");
}
