/**
 * Cardinal Red brand mark — 24px square with the CSS-drawn striped pattern
 * from the App Shell handoff. Decorative; aria-hidden by default.
 */
export function BrandMark({ size = 24 }: { size?: number }) {
  const inset = Math.max(4, Math.round(size * 0.21));
  return (
    <span
      aria-hidden="true"
      style={{
        position: "relative",
        display: "inline-flex",
        width: size,
        height: size,
        borderRadius: 5,
        background: "var(--color-cardinal-red)",
      }}
    >
      <span
        style={{
          position: "absolute",
          inset,
          borderRadius: 2,
          background:
            "linear-gradient(to right, transparent 0, transparent 18%, rgba(255,255,255,.92) 18%, rgba(255,255,255,.92) 32%, transparent 32%, transparent 50%, rgba(255,255,255,.92) 50%, rgba(255,255,255,.92) 64%, transparent 64%)",
        }}
      />
    </span>
  );
}
