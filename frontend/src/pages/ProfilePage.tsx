import { useState } from "react";
import { useAuth } from "../lib/auth";
import { useChangePasswordMutation } from "../lib/queries/users";
import { useToast } from "../components/Toast";
import { ApiError } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { PrimaryButton } from "../components/buttons";
import { UserAvatar } from "../components/UserAvatar";
import { RoleBadge } from "../components/RoleBadge";

export function ProfilePage() {
  const { user } = useAuth();
  const toast = useToast();
  const changePasswordMutation = useChangePasswordMutation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    if (newPassword !== confirmPassword) {
      setValidationError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setValidationError("New password must be at least 8 characters.");
      return;
    }

    try {
      await changePasswordMutation.mutateAsync({ currentPassword, newPassword });
      toast.success("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? (err.body as { message?: string })?.message ?? ""
          : "";
      toast.error(msg || "Could not change password.");
    }
  }

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "My profile" }]}
        title="My profile"
        subtitle="View your account details and change your password."
      />

      <div className="max-w-xl space-y-6">
        {/* Identity card */}
        <div
          className="bg-white rounded-lg p-5"
          style={{ border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-4">
            <UserAvatar
              firstName={user.firstName}
              lastName={user.lastName}
              size={56}
              asButton={false}
            />
            <div className="min-w-0">
              <div className="font-semibold text-near-black" style={{ fontSize: 18 }}>
                {user.firstName} {user.lastName}
              </div>
              <div className="text-warm-gray-med" style={{ fontSize: 13 }}>
                {user.email}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {user.roles.map((r) => (
                  <RoleBadge key={r} role={r} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div
          className="bg-white rounded-lg"
          style={{ border: "1px solid var(--color-border)" }}
        >
          <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: "var(--color-warm-gray-light)" }}>
            <div className="font-semibold text-near-black" style={{ fontSize: 15 }}>
              Change password
            </div>
          </div>
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <PasswordField
              label="Current password"
              id="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
            <PasswordField
              label="New password"
              id="new-password"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              hint="At least 8 characters with one letter and one digit."
            />
            <PasswordField
              label="Confirm new password"
              id="confirm-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />

            {validationError && (
              <p className="text-cardinal-red" style={{ fontSize: 13 }}>
                {validationError}
              </p>
            )}

            <div className="pt-1">
              <PrimaryButton
                type="submit"
                disabled={
                  changePasswordMutation.isPending ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
              >
                {changePasswordMutation.isPending ? "Saving…" : "Change password"}
              </PrimaryButton>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function PasswordField({
  label,
  id,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-near-black font-medium" style={{ fontSize: 13 }}>
        {label}
      </label>
      <input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="w-full rounded border px-3 py-2 text-near-black outline-none focus:ring-2 focus:ring-offset-0"
        style={{
          fontSize: 14,
          borderColor: "var(--color-border)",
          // @ts-expect-error CSS custom property
          "--tw-ring-color": "var(--color-brand-primary)",
        }}
      />
      {hint && (
        <p className="text-warm-gray-med" style={{ fontSize: 12 }}>
          {hint}
        </p>
      )}
    </div>
  );
}
