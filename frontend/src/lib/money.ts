/**
 * Small money helpers. We use plain JS numbers for delta math; rate values
 * are bounded to 9999.99 server-side so floating-point drift past two
 * decimal places never matters for display purposes.
 */

export function parseMoney(input: string): number | null {
  if (!input || !input.trim()) return null;
  const n = Number(input.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Returns formatted delta strings like "+$5.00" / "−$2.50" / "no change".
 */
export function formatDelta(prev: number, next: number): {
  sign: "up" | "down" | "flat";
  abs: string;
  pct: string;
  text: string;
} {
  const diff = next - prev;
  if (diff === 0) return { sign: "flat", abs: "$0.00", pct: "0%", text: "no change" };
  const abs = `$${formatMoney(Math.abs(diff))}`;
  const pct = prev === 0 ? "—" : `${((diff / prev) * 100).toFixed(1)}%`;
  if (diff > 0) {
    return { sign: "up", abs: `+${abs}`, pct, text: `+${abs} (${pct} increase)` };
  }
  return { sign: "down", abs: `−${abs}`, pct, text: `−${abs} (${pct} decrease)` };
}
