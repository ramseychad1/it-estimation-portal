/**
 * Phase 7.5 — single source of truth for role-based access checks on
 * the frontend. Mirrors the backend's `hasAnyRole('ADMIN', X)` rule:
 * a user with the Admin role is treated as having every other role
 * for authorization purposes.
 *
 * <p>Functions are pure and take a {@code string[]} of role names so
 * the file has no React or import dependencies. Call sites resolve
 * the user's roles via {@code useAuth()} (or whatever produces them)
 * and pass the array.
 *
 * <p>The implication is at the authorization-check layer — actual
 * role assignment in the database does NOT change. See
 * {@code User.isAdmin()} on the backend for the same rule.
 *
 * <p><b>Comparing role names:</b> the backend stores titles like
 * "Admin" and "Solution Owner"; constants in {@code lib/types.ts} use
 * those exact strings. {@code hasPermission} compares
 * case-insensitively so "ADMIN" / "Admin" / "admin" all work.
 */

const ADMIN_ROLE = "Admin";

function eq(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;
}

/**
 * Does the actor have the given role, either explicitly or via the
 * Admin implication?
 *
 * @param role         the role name to check (e.g. "Requester")
 * @param userRoles    the actor's actual roles (from /api/auth/me)
 */
export function hasPermission(role: string | string[], userRoles: string[]): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  const required = Array.isArray(role) ? role : [role];
  if (userRoles.some((r) => required.some((req) => eq(r, req)))) return true;
  // Implication: Admin satisfies every role check.
  return userRoles.some((r) => eq(r, ADMIN_ROLE));
}

/**
 * Does the actor literally have the Admin role? Use this when a check
 * specifically depends on "is the user an Admin" — e.g. showing the
 * admin-only "Send back" button on an Approved request, where the
 * affordance only makes sense for actual Admins.
 */
export function isAdmin(userRoles: string[]): boolean {
  return !!userRoles && userRoles.some((r) => eq(r, ADMIN_ROLE));
}
