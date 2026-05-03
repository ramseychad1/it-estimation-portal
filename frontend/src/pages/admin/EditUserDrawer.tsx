import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { ApiError } from "../../lib/api";
import {
  useUpdateUserMutation,
  useDeactivateUserMutation,
  useActivateUserMutation,
} from "../../lib/queries/users";
import { useTeamsQuery } from "../../lib/queries/teams";
import { useToast } from "../../components/Toast";
import { Drawer } from "../../components/Drawer";
import {
  PrimaryButton,
  SecondaryButton,
  TertiaryButton,
} from "../../components/buttons";
import { TextInput } from "../../components/inputs";
import { UserAvatar } from "../../components/UserAvatar";
import { StatusBadge } from "../../components/StatusBadge";
import { RoleBadge } from "../../components/RoleBadge";
import { relativeTime } from "../../lib/relativeTime";
import { ROLE_CATALOG, type UserDetail } from "../../lib/api/users";
import { RoleCheckboxList } from "./RoleCheckboxList";

interface EditUserDrawerProps {
  open: boolean;
  user: UserDetail | null;
  /** Number of currently-active Admins (server-truth). When 1 and the user is the only one, the banner shows. */
  activeAdminCount: number;
  onClose: () => void;
  onShowHistory?: (user: UserDetail) => void;
  onRequestDelete?: (user: UserDetail) => void;
  /** "Invite another Admin →" handoff: closes this drawer + opens the Invite User modal with Admin pre-checked. */
  onInviteAdmin?: () => void;
}

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  roleIds: number[];
  teamIds: number[];
}

function valuesFor(user: UserDetail | null): FormValues {
  return {
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    roleIds: user
      ? user.roles
          .map((name) => ROLE_CATALOG.find((r) => r.name === name)?.id)
          .filter((id): id is number => id !== undefined)
      : [],
    teamIds: user?.teams?.map((t) => t.id) ?? [],
  };
}

export function EditUserDrawer({
  open,
  user,
  activeAdminCount,
  onClose,
  onShowHistory,
  onRequestDelete,
  onInviteAdmin,
}: EditUserDrawerProps) {
  const initial = useMemo(() => valuesFor(user), [user]);
  const [values, setValues] = useState<FormValues>(initial);
  const [fieldError, setFieldError] = useState<{ email?: string; form?: string }>({});

  const teamsQuery = useTeamsQuery({ status: "ACTIVE", size: 100 });

  const updateMutation = useUpdateUserMutation();
  const activateMutation = useActivateUserMutation();
  const deactivateMutation = useDeactivateUserMutation();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setValues(initial);
      setFieldError({});
    }
  }, [open, initial]);

  if (!user) {
    return <Drawer open={open} onClose={onClose} title="Edit user">{null}</Drawer>;
  }

  const isLastAdmin =
    user.invitationStatus === "ACTIVE"
    && user.roles.includes("Admin")
    && activeAdminCount <= 1;

  const isInactive = user.invitationStatus === "INACTIVE";

  const isDirty =
    values.firstName !== initial.firstName ||
    values.lastName !== initial.lastName ||
    values.email !== initial.email ||
    JSON.stringify([...values.roleIds].sort()) !== JSON.stringify([...initial.roleIds].sort()) ||
    JSON.stringify([...values.teamIds].sort()) !== JSON.stringify([...initial.teamIds].sort());

  const busy =
    updateMutation.isPending
    || activateMutation.isPending
    || deactivateMutation.isPending;

  const canSave = !busy && isDirty && values.firstName.trim() && values.lastName.trim() && values.email.trim();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setFieldError({});
    try {
      const body: {
        firstName?: string;
        lastName?: string;
        email?: string;
        roleIds?: number[];
        teamIds?: number[];
      } = {};
      if (values.firstName.trim() !== initial.firstName) body.firstName = values.firstName.trim();
      if (values.lastName.trim() !== initial.lastName) body.lastName = values.lastName.trim();
      if (values.email.trim() !== initial.email) body.email = values.email.trim();
      const sortedNew = [...values.roleIds].sort();
      const sortedOld = [...initial.roleIds].sort();
      if (JSON.stringify(sortedNew) !== JSON.stringify(sortedOld)) body.roleIds = values.roleIds;
      const sortedTeamsNew = [...values.teamIds].sort();
      const sortedTeamsOld = [...initial.teamIds].sort();
      if (JSON.stringify(sortedTeamsNew) !== JSON.stringify(sortedTeamsOld)) body.teamIds = values.teamIds;

      await updateMutation.mutateAsync({ id: user.id, body });
      toast.success("User saved.");
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const errBody = err.body as { error?: string; message?: string };
        if (errBody?.error === "LAST_ADMIN_PROTECTION") {
          setFieldError({ form: errBody.message ?? "Cannot change role: this is the only Admin." });
        } else {
          setFieldError({ email: errBody.message ?? "Email already in use." });
        }
      } else if (err instanceof ApiError) {
        setFieldError({ form: (err.body as { message?: string })?.message ?? "Could not save." });
      } else {
        setFieldError({ form: "Could not save." });
      }
    }
  }

  async function handleDeactivate() {
    if (!user) return;
    try {
      await deactivateMutation.mutateAsync(user.id);
      toast.success(`${user.firstName} ${user.lastName} deactivated.`);
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? (err.body as { message?: string })?.message ?? "" : "";
      toast.error(msg || "Could not deactivate that user.");
    }
  }

  async function handleActivate() {
    if (!user) return;
    try {
      await activateMutation.mutateAsync(user.id);
      toast.success(`${user.firstName} ${user.lastName} activated.`);
    } catch {
      toast.error("Could not activate that user.");
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      isDirty={isDirty}
      title={`Edit user: ${user.firstName} ${user.lastName}`}
      footer={
        <>
          <div>
            {isInactive && onRequestDelete && (
              <TertiaryButton
                onClick={() => onRequestDelete(user)}
                className="text-cardinal-red hover:text-cardinal-red"
              >
                Permanently delete user
              </TertiaryButton>
            )}
            {!isInactive && (
              <TertiaryButton
                onClick={handleDeactivate}
                disabled={busy || isLastAdmin}
                title={isLastAdmin ? "Cannot deactivate the only active Admin. Promote another user to Admin first." : undefined}
                className="text-cardinal-red hover:text-cardinal-red"
              >
                Deactivate user
              </TertiaryButton>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton type="button" onClick={onClose} disabled={busy}>
              Cancel
            </SecondaryButton>
            <PrimaryButton form="edit-user-form" type="submit" disabled={!canSave}>
              {busy ? "Saving…" : "Save changes"}
            </PrimaryButton>
          </div>
        </>
      }
    >
      {/* ---- header card -------------------------------------------- */}
      <div className="flex items-center gap-3 mb-4">
        <UserAvatar firstName={user.firstName} lastName={user.lastName} size={64} asButton={false} />
        <div className="min-w-0">
          <div className="font-semibold text-near-black truncate" style={{ fontSize: 18 }}>
            {user.firstName} {user.lastName}
          </div>
          <div className="text-warm-gray-med truncate" style={{ fontSize: 13 }}>
            {user.email}
          </div>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {user.invitationStatus === "ACTIVE" && <StatusBadge variant="active">Active</StatusBadge>}
            {user.invitationStatus === "INACTIVE" && <StatusBadge variant="inactive">Inactive</StatusBadge>}
            {user.invitationStatus === "PENDING_INVITE" && <StatusBadge variant="warning">Pending invite</StatusBadge>}
            {user.roles.map((r) => <RoleBadge key={r} role={r} />)}
          </div>
          <div className="text-warm-gray-med mt-2" style={{ fontSize: 12 }}>
            {user.lastActiveAt ? `Last active ${relativeTime(user.lastActiveAt)}` : "Never signed in."}
          </div>
        </div>
      </div>

      <hr style={{ height: 1, background: "var(--color-warm-gray-light)", border: 0 }} />

      {/* ---- last-admin banner -------------------------------------- */}
      {isLastAdmin && (
        <div
          role="note"
          className="flex items-start gap-2 mt-4"
          style={{
            background: "rgba(184,134,11,0.10)",
            border: "1px solid rgba(184,134,11,0.30)",
            borderRadius: 6,
            padding: "10px 12px",
            color: "var(--fg-1)",
            fontSize: 13,
            lineHeight: "18px",
          }}
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-none" strokeWidth={1.5} style={{ color: "var(--color-warning)" }} />
          <span>
            <strong>Last Admin in this workspace.</strong>{" "}
            You can't remove the Admin role or deactivate this user until another Admin is added.{" "}
            {onInviteAdmin && (
              <button
                type="button"
                onClick={onInviteAdmin}
                className="text-near-black font-medium bg-transparent border-0 cursor-pointer hover:underline"
                style={{ fontSize: 13 }}
              >
                Invite another Admin →
              </button>
            )}
          </span>
        </div>
      )}

      {/* ---- form ---------------------------------------------------- */}
      <form id="edit-user-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 mt-5">
        <div
          className="text-warm-gray-med uppercase font-medium"
          style={{ fontSize: 11, letterSpacing: "0.06em" }}
        >
          Profile
        </div>
        <div className="grid grid-cols-2 gap-4">
          <TextInput
            label="First name"
            required
            value={values.firstName}
            onChange={(e) => setValues((v) => ({ ...v, firstName: e.target.value }))}
            disabled={busy}
          />
          <TextInput
            label="Last name"
            required
            value={values.lastName}
            onChange={(e) => setValues((v) => ({ ...v, lastName: e.target.value }))}
            disabled={busy}
          />
        </div>
        <TextInput
          label="Email"
          required
          type="email"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          error={fieldError.email}
          disabled={busy}
        />

        <div className="mt-2">
          <div
            className="text-warm-gray-med uppercase font-medium"
            style={{ fontSize: 11, letterSpacing: "0.06em" }}
          >
            Roles
          </div>
          <RoleCheckboxList
            selectedIds={values.roleIds}
            onChange={(next) => setValues((v) => ({ ...v, roleIds: next }))}
            adminLocked={isLastAdmin}
            disabled={busy}
          />
        </div>

        <div className="mt-5">
          <div
            className="text-warm-gray-med uppercase font-medium mb-2"
            style={{ fontSize: 11, letterSpacing: "0.06em" }}
          >
            Teams
          </div>
          <p className="text-warm-gray-med mt-0 mb-2" style={{ fontSize: 12 }}>
            Assign this user to one or more teams for organizational reporting.
          </p>
          {teamsQuery.data?.items.length === 0 && (
            <p className="text-warm-gray-med italic" style={{ fontSize: 12 }}>No active teams configured.</p>
          )}
          <div className="flex flex-col gap-1">
            {(teamsQuery.data?.items ?? []).map((team) => {
              const checked = values.teamIds.includes(team.id);
              return (
                <label
                  key={team.id}
                  className="flex items-center gap-2 cursor-pointer"
                  style={{ fontSize: 13 }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy}
                    onChange={() => {
                      setValues((v) => ({
                        ...v,
                        teamIds: checked
                          ? v.teamIds.filter((id) => id !== team.id)
                          : [...v.teamIds, team.id],
                      }));
                    }}
                    className="accent-near-black"
                  />
                  <span className="text-near-black">{team.name}</span>
                </label>
              );
            })}
          </div>
        </div>

        {fieldError.form && (
          <p className="text-small text-cardinal-red" role="alert">{fieldError.form}</p>
        )}
      </form>

      {/* ---- inactive → activate quick-action ----------------------- */}
      {isInactive && (
        <div
          className="mt-5 p-3 flex items-center justify-between"
          style={{ border: "1px solid var(--color-border)", borderRadius: 6 }}
        >
          <div>
            <div className="font-medium text-near-black" style={{ fontSize: 13 }}>This user is inactive.</div>
            <div className="text-warm-gray-med" style={{ fontSize: 12 }}>Re-activate to restore access.</div>
          </div>
          <SecondaryButton onClick={handleActivate} disabled={busy}>
            Reactivate
          </SecondaryButton>
        </div>
      )}

      {/* ---- audit footer ------------------------------------------- */}
      <div className="mt-8 pt-4" style={{ borderTop: "1px solid var(--color-warm-gray-light)" }}>
        <div
          className="text-warm-gray-med uppercase font-medium mb-2"
          style={{ fontSize: 11, letterSpacing: "0.06em" }}
        >
          Audit
        </div>
        <div className="flex flex-col gap-1 text-warm-gray-med" style={{ fontSize: 12 }}>
          {user.invitedAt && (
            <div>Invited {relativeTime(user.invitedAt)}</div>
          )}
          {user.invitationAcceptedAt && (
            <div>Accepted invite {relativeTime(user.invitationAcceptedAt)}</div>
          )}
          <div>Last updated {relativeTime(user.updatedAt)}</div>
          {onShowHistory && (
            <button
              type="button"
              onClick={() => onShowHistory(user)}
              className="self-start mt-1 text-near-black font-medium bg-transparent border-0 cursor-pointer hover:underline"
              style={{ fontSize: 12 }}
            >
              View change history →
            </button>
          )}
        </div>
      </div>
    </Drawer>
  );
}
