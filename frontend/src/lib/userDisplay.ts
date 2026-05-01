/**
 * Display helpers for user IDs surfaced in audit columns.
 *
 * Phase 2 hard-codes the two seeded users (admin / estimator) because the
 * /api/users endpoints arrive in Phase 3. Once those exist, replace this
 * with a React Query lookup hook (`useUserNames(ids)`) and delete the map.
 */
const LOCAL_USER_NAMES: Record<number, string> = {
  1: "Local Admin",
  2: "Local Estimator",
};

export function userDisplayName(id: number | null | undefined): string {
  if (id == null) return "—";
  return LOCAL_USER_NAMES[id] ?? `User #${id}`;
}

export function userInitials(id: number | null | undefined): string {
  const name = userDisplayName(id);
  if (name === "—") return "·";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
