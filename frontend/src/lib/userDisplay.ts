import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { ApiError } from "./api";
import { getUser, type UserDetail } from "./api/users";

/**
 * Display info for a user id surfaced in audit columns / history feeds.
 *
 * Resolved via /api/admin/users/{id}, cached forever per id (names rarely
 * change; mutating a user's name elsewhere invalidates ["users"] which
 * cascades to ["user-display"] via the same key prefix).
 *
 * Edge cases:
 *   - Server returns 404 → "Deleted user"
 *   - userId is null/undefined → no query is fired; consumer renders "—"
 *
 * Replaces the Phase 2 hard-coded map. Consumers stay sync-friendly via
 * {@link useUserDisplay} which exposes a {@code loading} flag for the
 * skeleton placeholder.
 */
export interface UserDisplay {
  name: string;
  initials: string;
  /** Background color for the avatar bubble. Single near-black tone for now. */
  avatarColor: string;
}

const DELETED_USER: UserDisplay = {
  name: "Deleted user",
  initials: "—",
  avatarColor: "var(--color-warm-gray-med)",
};

const SYSTEM_USER: UserDisplay = {
  name: "System",
  initials: "S",
  avatarColor: "var(--color-warm-gray-med)",
};

function fromDetail(detail: UserDetail): UserDisplay {
  const first = detail.firstName?.[0] ?? "";
  const last = detail.lastName?.[0] ?? "";
  const initials = (first + last).toUpperCase() || "?";
  return {
    name: `${detail.firstName} ${detail.lastName}`.trim() || detail.email,
    initials,
    avatarColor: "var(--color-near-black)",
  };
}

export function useUserDisplay(
  userId: number | null | undefined,
): { data: UserDisplay | null; loading: boolean } {
  const result: UseQueryResult<UserDisplay> = useQuery({
    // Use the same prefix as listUsers so user mutations cascade.
    queryKey: ["users", "display", userId ?? -1],
    enabled: userId != null,
    staleTime: Infinity,
    retry: (failureCount, err) => {
      if (err instanceof ApiError && err.status === 404) return false;
      return failureCount < 2;
    },
    queryFn: async () => {
      try {
        const detail = await getUser(userId as number);
        return fromDetail(detail);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return DELETED_USER;
        throw err;
      }
    },
  });

  if (userId == null) return { data: null, loading: false };
  if (userId === 0) return { data: SYSTEM_USER, loading: false };
  return { data: result.data ?? null, loading: result.isLoading };
}
