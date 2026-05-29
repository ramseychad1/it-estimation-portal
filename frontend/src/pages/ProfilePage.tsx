import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { useChangePasswordMutation } from "../lib/queries/users";
import { useNotificationPrefsQuery, useUpdateNotificationPrefsMutation } from "../lib/queries/profile";
import { useToast } from "../components/Toast";
import { ApiError } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { PrimaryButton } from "../components/buttons";
import { UserAvatar } from "../components/UserAvatar";
import { RoleBadge } from "../components/RoleBadge";
import { Toggle } from "../components/Toggle";
import type { NotificationPrefsResponse } from "../lib/api/profile";

export function ProfilePage() {
  const { user } = useAuth();
  const toast = useToast();
  const changePasswordMutation = useChangePasswordMutation();
  const queryClient = useQueryClient();
  const notifQuery = useNotificationPrefsQuery();
  const updateNotifMutation = useUpdateNotificationPrefsMutation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!user) return null;

  function buildPrefsMap(prefs: NotificationPrefsResponse): Record<string, boolean> {
    return Object.fromEntries(prefs.preferences.map((p) => [p.type, p.enabled]));
  }

  async function handleToggleMaster(next: boolean) {
    if (!notifQuery.data) return;
    const optimistic: NotificationPrefsResponse = { ...notifQuery.data, masterEnabled: next };
    queryClient.setQueryData(["profile", "notifications"], optimistic);
    try {
      await updateNotifMutation.mutateAsync({
        masterEnabled: next,
        preferences: buildPrefsMap(notifQuery.data),
      });
    } catch {
      queryClient.invalidateQueries({ queryKey: ["profile", "notifications"] });
      toast.error("Could not save notification preference.");
    }
  }

  async function handleToggleType(type: string, next: boolean) {
    if (!notifQuery.data) return;
    const updatedPrefs = notifQuery.data.preferences.map((p) =>
      p.type === type ? { ...p, enabled: next } : p
    );
    const optimistic: NotificationPrefsResponse = { ...notifQuery.data, preferences: updatedPrefs };
    queryClient.setQueryData(["profile", "notifications"], optimistic);
    try {
      await updateNotifMutation.mutateAsync({
        masterEnabled: notifQuery.data.masterEnabled,
        preferences: buildPrefsMap(optimistic),
      });
    } catch {
      queryClient.invalidateQueries({ queryKey: ["profile", "notifications"] });
      toast.error("Could not save notification preference.");
    }
  }

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

        {/* Email notifications */}
        {notifQuery.data && (
          <NotificationPrefsCard
            data={notifQuery.data}
            onToggleMaster={handleToggleMaster}
            onToggleType={handleToggleType}
          />
        )}
      </div>
    </>
  );
}

function NotificationPrefsCard({
  data,
  onToggleMaster,
  onToggleType,
}: {
  data: NotificationPrefsResponse;
  onToggleMaster: (next: boolean) => void;
  onToggleType: (type: string, next: boolean) => void;
}) {
  const globalOff = !data.globalEmailEnabled;
  const masterOn = data.masterEnabled;

  return (
    <div
      className="bg-white rounded-lg"
      style={{ border: "1px solid var(--color-border)" }}
    >
      {/* Header row with master toggle */}
      <div
        className={`px-5 py-4 flex items-center justify-between border-b ${globalOff ? "opacity-50" : ""}`}
        style={{ borderColor: "var(--color-warm-gray-light)" }}
      >
        <div>
          <div className="font-semibold text-near-black" style={{ fontSize: 15 }}>
            Email notifications
          </div>
          <div className="text-warm-gray-med mt-0.5" style={{ fontSize: 13 }}>
            Receive email updates about activity in the portal.
          </div>
        </div>
        <Toggle
          checked={masterOn}
          onCheckedChange={onToggleMaster}
          disabled={globalOff}
          label="Toggle all email notifications"
        />
      </div>

      {/* Global-off banner */}
      {globalOff && (
        <div
          className="px-5 py-3 border-b"
          style={{
            borderColor: "var(--color-warm-gray-light)",
            background: "var(--color-warm-gray-light)",
          }}
        >
          <p className="text-warm-gray-med" style={{ fontSize: 13 }}>
            Email notifications are disabled system-wide. An administrator must enable email in Global Settings before individual preferences take effect.
          </p>
        </div>
      )}

      {/* Individual toggles — muted when master or global is off */}
      <div className={!globalOff && masterOn ? "" : "opacity-50 pointer-events-none"}>
        {!globalOff && !masterOn && (
          <div className="px-5 pt-4 pb-2">
            <p className="text-warm-gray-med" style={{ fontSize: 13 }}>
              Turn on email notifications above to manage individual types.
            </p>
          </div>
        )}
        <ul className="divide-y" style={{ borderColor: "var(--color-warm-gray-light)" }}>
          {data.preferences.map((pref) => (
            <li key={pref.type} className="px-5 py-3.5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-near-black font-medium" style={{ fontSize: 13 }}>
                  {pref.label}
                </div>
                <div className="text-warm-gray-med mt-0.5" style={{ fontSize: 12 }}>
                  {pref.description}
                </div>
                <div
                  className="inline-block mt-1 px-1.5 py-0.5 rounded text-warm-gray-med"
                  style={{ fontSize: 11, background: "var(--color-warm-gray-light)" }}
                >
                  {pref.roleNote}
                </div>
              </div>
              <Toggle
                checked={pref.enabled}
                onCheckedChange={(next) => onToggleType(pref.type, next)}
                label={pref.label}
                className="shrink-0 mt-0.5"
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
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
