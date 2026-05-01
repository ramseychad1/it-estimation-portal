import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError } from "../../lib/api";
import {
  useActivateTeamMutation,
  useCreateTeamMutation,
  useDeactivateTeamMutation,
  useUpdateTeamMutation,
} from "../../lib/queries/teams";
import { useToast } from "../../components/Toast";
import { Drawer } from "../../components/Drawer";
import {
  PrimaryButton,
  SecondaryButton,
  TertiaryButton,
} from "../../components/buttons";
import { TextInput, Textarea } from "../../components/inputs";
import { Toggle } from "../../components/Toggle";
import { FormField } from "../../components/FormField";
import { UserCell } from "../../components/UserCell";
import { relativeTime } from "../../lib/relativeTime";
import type { TeamDto } from "../../lib/api/teams";

interface TeamFormDrawerProps {
  open: boolean;
  /** When set, the drawer opens in edit mode for the given team. */
  team: TeamDto | null;
  onClose: () => void;
  /** Called when the user clicks "View change history →". */
  onShowHistory?: (team: TeamDto) => void;
  /** Called when the user clicks the destructive "Delete team" link. */
  onRequestDelete?: (team: TeamDto) => void;
}

interface FormValues {
  name: string;
  description: string;
  active: boolean;
}

function valuesFor(team: TeamDto | null): FormValues {
  return {
    name: team?.name ?? "",
    description: team?.description ?? "",
    active: team?.active ?? true,
  };
}

export function TeamFormDrawer({
  open,
  team,
  onClose,
  onShowHistory,
  onRequestDelete,
}: TeamFormDrawerProps) {
  const isEdit = !!team;
  const initial = useMemo(() => valuesFor(team), [team]);
  const [values, setValues] = useState<FormValues>(initial);
  const [fieldError, setFieldError] = useState<{ name?: string; form?: string }>({});

  const createMutation = useCreateTeamMutation();
  const updateMutation = useUpdateTeamMutation();
  const activateMutation = useActivateTeamMutation();
  const deactivateMutation = useDeactivateTeamMutation();
  const toast = useToast();

  // Reset form when the drawer opens / changes target.
  useEffect(() => {
    if (open) {
      setValues(initial);
      setFieldError({});
    }
  }, [open, initial]);

  const isDirty =
    values.name !== initial.name ||
    values.description !== initial.description ||
    values.active !== initial.active;

  const busy =
    createMutation.isPending ||
    updateMutation.isPending ||
    activateMutation.isPending ||
    deactivateMutation.isPending;

  const canSave = !busy && values.name.trim().length > 0 && (!isEdit || isDirty);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldError({});
    try {
      if (!isEdit) {
        await createMutation.mutateAsync({
          name: values.name.trim(),
          description: values.description.trim() || null,
          active: values.active,
        });
        toast.success("Team created.");
      } else {
        // Active flip goes through the dedicated endpoint so the audit row
        // records ACTIVATED / DEACTIVATED, not an UPDATED row on `active`.
        if (values.active !== initial.active) {
          if (values.active) await activateMutation.mutateAsync(team!.id);
          else await deactivateMutation.mutateAsync(team!.id);
        }
        const nameChanged = values.name.trim() !== initial.name;
        const descChanged = (values.description || "").trim() !== (initial.description || "");
        if (nameChanged || descChanged) {
          await updateMutation.mutateAsync({
            id: team!.id,
            body: {
              ...(nameChanged ? { name: values.name.trim() } : {}),
              ...(descChanged ? { description: values.description.trim() || null } : {}),
            },
          });
        }
        toast.success("Team saved.");
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFieldError({ name: "A team with that name already exists." });
      } else if (err instanceof Error) {
        setFieldError({ form: err.message });
      } else {
        setFieldError({ form: "Could not save changes." });
      }
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      isDirty={isDirty}
      title={isEdit ? `Edit team: ${team!.name}` : "New team"}
      subtitle={isEdit ? undefined : "Add a team that contributes hours to estimates."}
      footer={
        <>
          <div>
            {isEdit && onRequestDelete && (
              <TertiaryButton
                onClick={() => onRequestDelete(team!)}
                className="text-cardinal-red hover:text-cardinal-red"
              >
                Delete team
              </TertiaryButton>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={onClose} disabled={busy}>
              Cancel
            </SecondaryButton>
            <PrimaryButton form="team-form" type="submit" disabled={!canSave}>
              {busy ? "Saving…" : isEdit ? "Save" : "Create team"}
            </PrimaryButton>
          </div>
        </>
      }
    >
      <form id="team-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextInput
          label="Name"
          required
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          error={fieldError.name}
          disabled={busy}
        />
        <Textarea
          label="Description"
          helper="Optional. Used as a hint when picking teams in an estimate."
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          rows={3}
          disabled={busy}
        />
        <FormField label="Status">
          {(field) => (
            <div id={field.id} className="flex items-center justify-between mt-1">
              <Toggle
                checked={values.active}
                onCheckedChange={(next) => setValues((v) => ({ ...v, active: next }))}
                label={values.active ? "Active" : "Inactive"}
                disabled={busy}
              />
            </div>
          )}
        </FormField>
        {fieldError.form && (
          <p className="text-small text-cardinal-red" role="alert">
            {fieldError.form}
          </p>
        )}
      </form>

      {isEdit && team && (
        <div className="mt-8 pt-4" style={{ borderTop: "1px solid var(--color-warm-gray-light)" }}>
          <div
            className="text-warm-gray-med uppercase font-medium mb-2"
            style={{ fontSize: 11, letterSpacing: "0.06em" }}
          >
            Audit
          </div>
          <div className="flex flex-col gap-1 text-warm-gray-med" style={{ fontSize: 12 }}>
            <div className="inline-flex items-center gap-2">
              <span>Created by</span>
              <UserCell userId={team.createdBy} />
              <span>· {relativeTime(team.createdAt)}</span>
            </div>
            <div className="inline-flex items-center gap-2">
              <span>Last updated by</span>
              <UserCell userId={team.updatedBy} />
              <span>· {relativeTime(team.updatedAt)}</span>
            </div>
            {onShowHistory && (
              <button
                type="button"
                onClick={() => onShowHistory(team)}
                className="self-start mt-1 text-near-black font-medium bg-transparent border-0 cursor-pointer hover:underline"
                style={{ fontSize: 12 }}
              >
                View change history →
              </button>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
