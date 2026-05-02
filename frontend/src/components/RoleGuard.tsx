import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { hasPermission } from "../lib/permissions";
import { PageHeader } from "./PageHeader";

interface RoleGuardProps {
  /** Role required to view the wrapped content. Admins inherit every role. */
  requires: string;
  children: React.ReactNode;
}

/**
 * Phase 7.5: route-level role gate. Renders children when the current
 * user has the required role (or Admin); otherwise renders a small
 * "no access" panel with a "Return to dashboard" link.
 *
 * <p>Composes with {@code AuthGuard} — wrap a route as
 * {@code <AuthGuard><RoleGuard requires="REQUESTER"><Page /></RoleGuard></AuthGuard>}.
 * AuthGuard handles "not signed in" (redirect to /login); RoleGuard
 * handles "signed in but lacks permission" (in-place no-access panel,
 * not a redirect — a hard redirect would lose the URL the user was
 * trying to share).
 *
 * <p>Defers to {@code lib/permissions.hasPermission} so the Admin
 * implication holds. The required role is whatever string the
 * navigation/route config uses (e.g. "Solution Owner") — same shape
 * the existing {@code requiresRole} fields use.
 */
export function RoleGuard({ requires, children }: RoleGuardProps) {
  const { user } = useAuth();
  if (!user) return null; // AuthGuard should have caught this; defensive.
  if (hasPermission(requires, user.roles)) {
    return <>{children}</>;
  }
  return <NoAccessPanel requiredRole={requires} />;
}

function NoAccessPanel({ requiredRole }: { requiredRole: string }) {
  return (
    <>
      <PageHeader title="Access denied" subtitle="You don't have permission to view this page." />
      <div
        className="rounded-lg text-warm-gray-med text-small"
        data-testid="no-access-panel"
        style={{
          marginTop: 24,
          padding: "48px 24px",
          background: "#FBFBFA",
          border: "1px dashed var(--color-border-strong)",
          textAlign: "center",
        }}
      >
        <p className="m-0 text-near-black font-semibold" style={{ fontSize: 14 }}>
          This page is restricted to {requiredRole}s.
        </p>
        <p className="m-0 mt-1" style={{ fontSize: 13 }}>
          Ask an admin to grant you the {requiredRole} role if you need access.
        </p>
        <Link
          to="/dashboard"
          className="inline-block mt-4 text-near-black hover:underline"
          style={{ fontSize: 13 }}
        >
          Return to dashboard →
        </Link>
      </div>
    </>
  );
}
