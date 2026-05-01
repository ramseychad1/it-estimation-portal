interface CountPillProps {
  count: number;
}

/**
 * Small numeric badge used inline in section titles ("Sub-features (3)").
 * Light Blue tint background, Near-Black text. Carries no semantic state —
 * just a count.
 */
export function CountPill({ count }: CountPillProps) {
  return (
    <span
      className="inline-flex items-center justify-center text-near-black tabular-nums"
      style={{
        minWidth: 22,
        height: 20,
        padding: "0 6px",
        borderRadius: 999,
        background: "var(--color-light-blue-soft)",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {count}
    </span>
  );
}
