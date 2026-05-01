import { userDisplayName, userInitials } from "../lib/userDisplay";

interface UserCellProps {
  userId: number | null | undefined;
  size?: number;
}

/**
 * Small avatar + name cell for table columns like updated_by / changed_by.
 * Uses {@link userDisplayName} which currently hard-codes the seeded users
 * and falls back to "User #{id}" — replace with a real lookup in Phase 3.
 */
export function UserCell({ userId, size = 20 }: UserCellProps) {
  if (userId == null) {
    return <span className="text-warm-gray-med" style={{ fontSize: 12 }}>—</span>;
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
          background: "var(--color-near-black)",
          fontSize: 10,
          fontWeight: 600,
        }}
      >
        {userInitials(userId)}
      </span>
      {userDisplayName(userId)}
    </span>
  );
}
