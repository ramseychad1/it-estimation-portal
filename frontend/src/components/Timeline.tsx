import type { ReactNode } from "react";

interface TimelineProps {
  children: ReactNode;
}

/**
 * Vertical timeline wrapper used by the Change Log feed. Reserves a 24px
 * column on the left for avatars, with a 1px Warm-Gray-Light line passing
 * through it. Each child is responsible for placing its own avatar in
 * that column (see {@link TimelineItem}).
 */
export function Timeline({ children }: TimelineProps) {
  return (
    <ol
      className="relative m-0 p-0 list-none"
      style={{ paddingLeft: 0 }}
    >
      <span
        aria-hidden="true"
        className="absolute"
        style={{
          left: 11,
          top: 0,
          bottom: 0,
          width: 1,
          background: "var(--color-warm-gray-light)",
        }}
      />
      {children}
    </ol>
  );
}

/**
 * Single child slot. Renders the avatar in a fixed 24px gutter so the
 * connecting line passes cleanly through it, then defers all body
 * rendering to {@code children}.
 */
export function TimelineItem({
  avatar,
  children,
}: {
  avatar: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="relative" style={{ paddingLeft: 36 }}>
      <span
        className="absolute"
        style={{
          left: 0,
          top: 8,
          width: 24,
          height: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-page-bg, #fff)",
          zIndex: 1,
        }}
      >
        {avatar}
      </span>
      {children}
    </li>
  );
}
