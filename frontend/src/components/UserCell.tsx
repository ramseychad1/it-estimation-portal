import { useUserDisplay } from "../lib/userDisplay";

interface UserCellProps {
  userId: number | null | undefined;
  size?: number;
}

/**
 * Avatar + name cell for table columns like updated_by / changed_by.
 * Async — renders a skeleton bar (Warm Gray Light, 80×12) and a Warm Gray
 * Light avatar circle while the lookup is in flight, then swaps in the
 * resolved name. The Phase 4 Change Log will render many of these per
 * page, so the loading state has to read as "loading" rather than as
 * placeholder content.
 */
export function UserCell({ userId, size = 20 }: UserCellProps) {
  const { data, loading } = useUserDisplay(userId);

  if (userId == null) {
    return <span className="text-warm-gray-med" style={{ fontSize: 12 }}>—</span>;
  }

  if (loading || !data) {
    return (
      <span
        aria-label="Loading user"
        className="inline-flex items-center gap-2"
        style={{ fontSize: 12 }}
      >
        <span
          aria-hidden="true"
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: "var(--color-warm-gray-light)",
          }}
        />
        <span
          aria-hidden="true"
          style={{
            width: 80,
            height: 12,
            borderRadius: 4,
            background: "var(--color-warm-gray-light)",
            display: "inline-block",
          }}
        />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-near-black" style={{ fontSize: 12 }}>
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center text-white"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: data.avatarColor,
          fontSize: 10,
          fontWeight: 600,
        }}
      >
        {data.initials}
      </span>
      {data.name}
    </span>
  );
}
