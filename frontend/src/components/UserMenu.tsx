import { useNavigate } from "react-router-dom";
import { LogOut, UserCircle } from "lucide-react";
import { useAuth } from "../lib/auth";
import { ROLE_CATALOG } from "../lib/api/users";
import { UserAvatar } from "./UserAvatar";

interface UserMenuProps {
  onClose: () => void;
}

/**
 * Canonical role order for display (Admin → SO → Estimator → Requester).
 * Matches {@link ROLE_CATALOG} so a single source of truth governs the
 * order everywhere — Edit User drawer badges, Invite User checkbox list,
 * here.
 */
function orderedRoles(roles: string[]): string[] {
  const order = ROLE_CATALOG.map((r) => r.name);
  return [...roles].sort(
    (a, b) =>
      (order.indexOf(a) === -1 ? Number.MAX_SAFE_INTEGER : order.indexOf(a)) -
      (order.indexOf(b) === -1 ? Number.MAX_SAFE_INTEGER : order.indexOf(b)),
  );
}

export function UserMenu({ onClose }: UserMenuProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleSignOut = async () => {
    onClose();
    await signOut();
    navigate("/login", { replace: true });
  };

  // Phase 7.6: read-only roles display. Replaces the prior "Switch role"
  // menu item, which promised a role-switching feature we never built and
  // shouldn't — Phase 7.5 settled the model on "Admin implies everything,
  // multi-role users see every surface their roles unlock simultaneously."
  // No active-role context exists to switch.
  const roles = orderedRoles(user.roles);
  const rolesLabel = roles.length === 1 ? "Role" : "Roles";
  const rolesText = roles.length === 0 ? "—" : roles.join(", ");

  return (
    <div
      role="menu"
      aria-label="User menu"
      className="absolute right-4 top-12 w-60 bg-white rounded-lg overflow-hidden z-50"
      style={{
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-popover)",
      }}
    >
      <div className="flex items-center gap-3 px-3.5 pt-3.5 pb-3 border-b border-warm-gray-light">
        <UserAvatar firstName={user.firstName} lastName={user.lastName} asButton={false} />
        <div className="min-w-0">
          <div className="text-small font-semibold text-near-black truncate">
            {user.firstName} {user.lastName}
          </div>
          <div className="text-small text-warm-gray-med truncate" style={{ fontSize: 12 }}>
            {user.email}
          </div>
          <div
            className="text-warm-gray-med truncate"
            style={{ fontSize: 12, marginTop: 2 }}
            title={`${rolesLabel}: ${rolesText}`}
          >
            {rolesLabel}: {rolesText}
          </div>
        </div>
      </div>

      <button
        type="button"
        role="menuitem"
        onClick={() => { onClose(); navigate("/profile"); }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-small text-near-black hover:bg-warm-gray-light text-left"
      >
        <UserCircle className="w-3.5 h-3.5 text-warm-gray-med" strokeWidth={1.5} />
        My profile
      </button>

      <div className="h-px bg-warm-gray-light my-1" />

      <button
        type="button"
        role="menuitem"
        onClick={handleSignOut}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-small text-near-black hover:bg-warm-gray-light text-left"
      >
        <LogOut className="w-3.5 h-3.5 text-warm-gray-med" strokeWidth={1.5} />
        Sign out
      </button>
    </div>
  );
}
