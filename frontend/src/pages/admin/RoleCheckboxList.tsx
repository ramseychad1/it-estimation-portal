import { Check } from "lucide-react";
import { useEffect, useRef } from "react";
import { ROLE_CATALOG } from "../../lib/api/users";

interface RoleCheckboxListProps {
  selectedIds: number[];
  onChange: (next: number[]) => void;
  /** When true, the Admin checkbox is disabled with "(required)" annotation. */
  adminLocked?: boolean;
  disabled?: boolean;
}

const ADMIN_ROLE_ID = 1;

/**
 * Renders the four canonical roles as full-width checkbox rows with a
 * description per role. Used by both the Invite User modal and the Edit
 * User drawer.
 *
 * <p><b>Phase 7.5 — Admin auto-check + lock.</b> When Admin is selected,
 * the other role checkboxes auto-check AND lock (disabled with
 * "Admin role includes all permissions" tooltip). When Admin is
 * unchecked, the others restore to whatever they were before Admin was
 * checked. This makes the "Admin implies all roles" rule visually
 * legible — the user can't miss that those roles are now in play.
 *
 * <p>The locking is purely visual; the backend doesn't enforce role
 * augmentation on save. The {@code @PreAuthorize} layer already gives
 * Admins access to every role-gated endpoint regardless of which other
 * roles they hold.
 *
 * <p>{@code adminLocked} is the existing last-admin-protection rule
 * (the only Admin can't be demoted). It takes precedence over the
 * auto-check behavior — when {@code adminLocked} is true, Admin stays
 * checked and disabled with "(required)" annotation; the implication
 * behavior still applies (other roles auto-checked + locked).
 */
export function RoleCheckboxList({
  selectedIds,
  onChange,
  adminLocked = false,
  disabled = false,
}: RoleCheckboxListProps) {
  const adminChecked = selectedIds.includes(ADMIN_ROLE_ID);

  // Capture the non-Admin selection that was in place when Admin
  // last became checked, so unchecking Admin restores it. Stored in
  // a ref (no re-renders) and recomputed only when Admin transitions
  // off → on.
  const prevNonAdminRef = useRef<number[]>(selectedIds.filter((id) => id !== ADMIN_ROLE_ID));
  const wasAdminChecked = useRef<boolean>(adminChecked);
  useEffect(() => {
    if (!wasAdminChecked.current && adminChecked) {
      // Admin just transitioned off → on. The pre-Admin selection has
      // already been overwritten by the auto-augment in the click
      // handler — capture happens at click time below, not here.
    }
    wasAdminChecked.current = adminChecked;
  }, [adminChecked]);

  function toggle(roleId: number) {
    if (disabled) return;
    // Last-admin protection: the only Admin can never be unchecked,
    // and the other roles cannot be unchecked while Admin is locked
    // either (Admin still implies them). Skip silently.
    if (adminLocked && roleId === ADMIN_ROLE_ID) return;
    if (adminChecked && roleId !== ADMIN_ROLE_ID) return; // implication-locked

    if (roleId === ADMIN_ROLE_ID) {
      if (!adminChecked) {
        // Admin off → on: capture the current non-Admin selection so
        // the inverse toggle restores it, then auto-check every role.
        prevNonAdminRef.current = selectedIds.filter((id) => id !== ADMIN_ROLE_ID);
        const allRoleIds = ROLE_CATALOG.map((r) => r.id);
        onChange(allRoleIds);
        return;
      }
      // Admin on → off: restore the saved non-Admin selection.
      onChange(prevNonAdminRef.current);
      return;
    }

    // Non-Admin checkbox toggled while Admin is unchecked.
    onChange(
      selectedIds.includes(roleId)
        ? selectedIds.filter((id) => id !== roleId)
        : [...selectedIds, roleId],
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {ROLE_CATALOG.map((role) => {
        const checked = selectedIds.includes(role.id);
        const isLastAdminLocked = adminLocked && role.id === ADMIN_ROLE_ID;
        // Admin-implication lock applies to NON-Admin roles whenever
        // Admin is checked (with or without last-admin protection).
        const impliedLock = adminChecked && role.id !== ADMIN_ROLE_ID;
        const rowDisabled = disabled || isLastAdminLocked || impliedLock;
        const tooltip = impliedLock
          ? "Admin role includes all permissions."
          : isLastAdminLocked
            ? "Cannot remove — last active Admin."
            : undefined;
        return (
          <div key={role.id}>
            <label
              className={`flex items-start gap-2.5 py-2 ${rowDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
              title={tooltip}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={role.name}
                aria-disabled={rowDisabled || undefined}
                title={tooltip}
                onClick={() => toggle(role.id)}
                className="inline-flex items-center justify-center bg-transparent border-0 mt-0.5"
                style={{ width: 16, height: 16 }}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: checked ? "var(--color-near-black)" : "#fff",
                    border: `1px solid ${checked ? "var(--color-near-black)" : "var(--color-border-strong)"}`,
                    opacity: rowDisabled ? 0.6 : 1,
                  }}
                >
                  {checked && <Check className="w-3 h-3" strokeWidth={3} color="#fff" />}
                </span>
              </button>
              <span className="flex-1">
                <span className="font-medium text-near-black" style={{ fontSize: 13 }}>
                  {role.name}
                  {isLastAdminLocked && (
                    <span className="text-warm-gray-med ml-1.5" style={{ fontSize: 12, fontWeight: 400 }}>
                      (required)
                    </span>
                  )}
                  {impliedLock && (
                    <span className="text-warm-gray-med ml-1.5 italic" style={{ fontSize: 12, fontWeight: 400 }}>
                      (included with Admin)
                    </span>
                  )}
                </span>
                <span className="block text-warm-gray-med" style={{ fontSize: 12, marginTop: 2 }}>
                  {role.description}
                </span>
              </span>
            </label>
            {role.id === ADMIN_ROLE_ID && adminChecked && !isLastAdminLocked && (
              <p
                className="text-cardinal-red"
                style={{ fontSize: 12, marginLeft: 26, marginTop: -4, marginBottom: 4 }}
              >
                Admin grants full access to this workspace, including the ability to change rates,
                manage users, and view all estimates.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
