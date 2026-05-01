import { useEffect, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ApiError } from "../../lib/api";
import { useInviteUserMutation } from "../../lib/queries/users";
import { useToast } from "../../components/Toast";
import { PrimaryButton, SecondaryButton } from "../../components/buttons";
import { TextInput, Textarea } from "../../components/inputs";
import { FormField } from "../../components/FormField";
import { RoleCheckboxList } from "./RoleCheckboxList";
import type { InvitationResult } from "../../lib/api/invitations";

interface InviteUserModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the API response so the parent can open the InviteCreatedModal. */
  onCreated: (result: InvitationResult) => void;
  /** When true, the Admin role is pre-checked (used by the last-admin banner CTA). */
  prefillAdmin?: boolean;
}

interface FormValues {
  email: string;
  firstName: string;
  lastName: string;
  roleIds: number[];
  expiresInDays: number;
  personalNote: string;
}

const INITIAL: FormValues = {
  email: "",
  firstName: "",
  lastName: "",
  roleIds: [],
  expiresInDays: 14,
  personalNote: "",
};

export function InviteUserModal({ open, onClose, onCreated, prefillAdmin = false }: InviteUserModalProps) {
  const [values, setValues] = useState<FormValues>(INITIAL);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fieldError, setFieldError] = useState<{ email?: string; form?: string }>({});
  // Local-only — the user/team join table doesn't exist yet (Phase 5).
  // The select renders for visual completeness but is never submitted.
  const [teamIds, setTeamIds] = useState<number[]>([]);

  const inviteMutation = useInviteUserMutation();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setValues({ ...INITIAL, roleIds: prefillAdmin ? [1] : [] });
    setTeamIds([]);
    setAdvancedOpen(false);
    setFieldError({});
  }, [open, prefillAdmin]);

  const showsTeamSelect = values.roleIds.includes(2) || values.roleIds.includes(3);

  const isValid =
    values.email.trim().length > 0 &&
    values.firstName.trim().length > 0 &&
    values.lastName.trim().length > 0 &&
    values.roleIds.length > 0;
  const busy = inviteMutation.isPending;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldError({});
    if (!isValid) return;
    try {
      const result = await inviteMutation.mutateAsync({
        email: values.email.trim(),
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        roleIds: values.roleIds,
        expiresInDays: values.expiresInDays,
        personalNote: values.personalNote.trim() || undefined,
      });
      toast.success("Invitation created.");
      onCreated(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFieldError({
          email:
            (err.body as { message?: string })?.message
            ?? "An account with that email already exists.",
        });
      } else if (err instanceof ApiError) {
        setFieldError({ form: (err.body as { message?: string })?.message ?? "Could not send invite." });
      } else {
        setFieldError({ form: "Could not send invite." });
      }
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(39,37,31,0.40)" }}
      />
      <div className="fixed inset-0 z-50 flex items-start justify-center pointer-events-none" style={{ paddingTop: 64 }}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Invite user"
          className="bg-white rounded-lg overflow-hidden flex flex-col pointer-events-auto"
          style={{ width: 560, boxShadow: "var(--shadow-modal)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <header style={{ padding: "20px 24px 8px" }} className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-near-black" style={{ fontSize: 18, letterSpacing: "-0.005em" }}>
                Invite user
              </div>
              <div className="text-warm-gray-med mt-1" style={{ fontSize: 13, lineHeight: "18px" }}>
                Send an invitation link. The invitee sets their own password.
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="bg-transparent border-0 cursor-pointer text-warm-gray-med hover:text-near-black hover:bg-warm-gray-light rounded"
              style={{ width: 28, height: 28, fontSize: 18, lineHeight: "20px" }}
            >
              ×
            </button>
          </header>

          <form id="invite-user-form" onSubmit={handleSubmit} noValidate>
            <div style={{ padding: "0 24px 16px" }}>
              <TextInput
                label="Email"
                required
                type="email"
                value={values.email}
                onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
                error={fieldError.email}
                disabled={busy}
                helper="Workspace invitation will be sent to this address."
              />

              <div className="grid grid-cols-2 gap-4 mt-3">
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

              <div className="mt-5">
                <div className="text-near-black font-medium mb-1" style={{ fontSize: 13 }}>
                  Roles
                  <span aria-hidden="true" className="text-cardinal-red ml-0.5">*</span>
                </div>
                <RoleCheckboxList
                  selectedIds={values.roleIds}
                  onChange={(next) => setValues((v) => ({ ...v, roleIds: next }))}
                  disabled={busy}
                />
              </div>

              {showsTeamSelect && (
                <div className="mt-5">
                  <div className="text-near-black font-medium mb-1" style={{ fontSize: 13 }}>
                    Teams
                  </div>
                  <p className="text-warm-gray-med m-0" style={{ fontSize: 12 }}>
                    Estimators see estimate requests for their teams. Solution Owners aren't restricted by team — assignment helps reporting.
                  </p>
                  <p
                    className="text-warm-gray-med italic mt-2 mb-0"
                    style={{ fontSize: 12 }}
                  >
                    Team assignment is wired up in a later phase. Selections here are not saved yet.
                  </p>
                  <div className="text-warm-gray-med mt-2" style={{ fontSize: 12 }}>
                    {/* Placeholder — local-only state to keep UI parity with the design. */}
                    {teamIds.length === 0 ? "No teams selected." : `${teamIds.length} teams selected.`}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setAdvancedOpen((o) => !o)}
                className="inline-flex items-center gap-1 mt-5 bg-transparent border-0 text-near-black cursor-pointer"
                style={{ fontSize: 12, fontWeight: 500 }}
              >
                {advancedOpen ? <ChevronDown className="w-3 h-3" strokeWidth={1.5} /> : <ChevronRight className="w-3 h-3" strokeWidth={1.5} />}
                Advanced
              </button>
              {advancedOpen && (
                <div className="mt-3 flex flex-col gap-3">
                  <FormField label="Personal note (optional)" helper="Included in the invitation copy.">
                    {(field) => (
                      <Textarea
                        {...field}
                        value={values.personalNote}
                        onChange={(e) => setValues((v) => ({ ...v, personalNote: e.target.value }))}
                        rows={2}
                        disabled={busy}
                      />
                    )}
                  </FormField>
                  <FormField label="Expires in (days)" helper="Default 14 days.">
                    {(field) => (
                      <input
                        {...field}
                        type="number"
                        min={1}
                        max={90}
                        value={values.expiresInDays}
                        onChange={(e) => setValues((v) => ({ ...v, expiresInDays: Number(e.target.value) || 14 }))}
                        className="w-24 h-8 px-3 rounded-md border border-border-strong text-body text-near-black tabular focus:outline-none focus:ring-2 focus:ring-light-blue"
                        disabled={busy}
                      />
                    )}
                  </FormField>
                </div>
              )}

              {fieldError.form && (
                <p className="text-small text-cardinal-red mt-3" role="alert">
                  {fieldError.form}
                </p>
              )}
            </div>

            <div className="text-warm-gray-med" style={{ fontSize: 12, padding: "0 24px 12px" }}>
              {values.email
                ? <>An email will be sent to <strong className="text-near-black">{values.email}</strong>.</>
                : "An invitation will be created. Email sending isn't wired up yet — you'll get a link to copy."}
            </div>

            <footer
              className="flex items-center justify-end gap-2"
              style={{
                padding: "14px 24px",
                borderTop: "1px solid var(--color-warm-gray-light)",
                background: "#FBFBFA",
              }}
            >
              <SecondaryButton type="button" onClick={onClose} disabled={busy}>
                Cancel
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={busy || !isValid}>
                {busy ? "Sending…" : "Send Invite"}
              </PrimaryButton>
            </footer>
          </form>
        </div>
      </div>
    </>
  );
}
