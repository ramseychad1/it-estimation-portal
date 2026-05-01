import { useNavigate } from "react-router-dom";
import { LogOut, RefreshCw, UserCircle } from "lucide-react";
import { useAuth } from "../lib/auth";
import { UserAvatar } from "./UserAvatar";

interface UserMenuProps {
  onClose: () => void;
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

  // Phase 1: the user can hold multiple roles in theory, but role switching
  // arrives with the multi-role flows. Show whichever role they currently have
  // (alphabetical; admin@local has only Admin).
  const activeRole = user.roles[0] ?? "—";

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
        </div>
      </div>

      <button
        type="button"
        role="menuitem"
        onClick={onClose}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-small text-near-black hover:bg-warm-gray-light text-left"
      >
        <UserCircle className="w-3.5 h-3.5 text-warm-gray-med" strokeWidth={1.5} />
        My profile
      </button>

      <button
        type="button"
        role="menuitem"
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-small text-near-black hover:bg-warm-gray-light text-left"
        disabled
        title="Role switching arrives once users hold multiple roles"
      >
        <RefreshCw className="w-3.5 h-3.5 text-warm-gray-med" strokeWidth={1.5} />
        Switch role
        <span
          className="ml-auto text-warm-gray-med font-medium"
          style={{
            fontSize: 11,
            padding: "1px 6px",
            borderRadius: 3,
            background: "var(--color-warm-gray-light)",
            border: "1px solid var(--color-border-strong)",
          }}
        >
          {activeRole}
        </span>
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
