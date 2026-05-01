import { Check } from "lucide-react";
import { ROLE_CATALOG } from "../../lib/api/users";

interface RoleCheckboxListProps {
  selectedIds: number[];
  onChange: (next: number[]) => void;
  /** When true, the Admin checkbox is disabled with "(required)" annotation. */
  adminLocked?: boolean;
  disabled?: boolean;
}

/**
 * Renders the four canonical roles as full-width checkbox rows with a
 * description per role. Used by both the Invite User modal and the Edit
 * User drawer.
 *
 * When Admin is checked, an inline 12px Cardinal Red warning appears
 * beneath the checkbox row (per the design and the prompt).
 */
export function RoleCheckboxList({
  selectedIds,
  onChange,
  adminLocked = false,
  disabled = false,
}: RoleCheckboxListProps) {
  const adminChecked = selectedIds.includes(1);

  function toggle(roleId: number) {
    if (disabled) return;
    if (adminLocked && roleId === 1) return;
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
        const isAdminLocked = adminLocked && role.id === 1;
        const rowDisabled = disabled || isAdminLocked;
        return (
          <div key={role.id}>
            <label
              className={`flex items-start gap-2.5 py-2 ${rowDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={role.name}
                aria-disabled={rowDisabled || undefined}
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
                  {isAdminLocked && (
                    <span className="text-warm-gray-med ml-1.5" style={{ fontSize: 12, fontWeight: 400 }}>
                      (required)
                    </span>
                  )}
                </span>
                <span className="block text-warm-gray-med" style={{ fontSize: 12, marginTop: 2 }}>
                  {role.description}
                </span>
              </span>
            </label>
            {role.id === 1 && adminChecked && !isAdminLocked && (
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
