import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError } from "../../../lib/api";
import {
  useActivateSubFeatureMutation,
  useDeactivateSubFeatureMutation,
  useUpdateSubFeatureMutation,
} from "../../../lib/queries/subFeatures";
import { useToast } from "../../../components/Toast";
import { Drawer } from "../../../components/Drawer";
import { PrimaryButton, SecondaryButton, TertiaryButton } from "../../../components/buttons";
import { TextInput, Textarea } from "../../../components/inputs";
import { Toggle } from "../../../components/Toggle";
import { FormField } from "../../../components/FormField";
import { EntityHeader } from "../../../components/EntityHeader";
import type { SubFeatureDetail } from "../../../lib/api/subFeatures";

interface EditSubFeatureDrawerProps {
  open: boolean;
  subFeature: SubFeatureDetail | null;
  onClose: () => void;
  onRequestDelete?: (sub: SubFeatureDetail) => void;
}

interface FormValues {
  name: string;
  description: string;
  active: boolean;
}

function valuesFor(s: SubFeatureDetail | null): FormValues {
  return {
    name: s?.name ?? "",
    description: s?.description ?? "",
    active: s?.active ?? true,
  };
}

export function EditSubFeatureDrawer({
  open,
  subFeature,
  onClose,
  onRequestDelete,
}: EditSubFeatureDrawerProps) {
  const initial = useMemo(() => valuesFor(subFeature), [subFeature]);
  const [values, setValues] = useState<FormValues>(initial);
  const [error, setError] = useState<{ name?: string; form?: string }>({});

  const updateMutation = useUpdateSubFeatureMutation();
  const activateMutation = useActivateSubFeatureMutation();
  const deactivateMutation = useDeactivateSubFeatureMutation();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setValues(initial);
      setError({});
    }
  }, [open, initial]);

  const isDirty =
    values.name !== initial.name ||
    values.description !== initial.description ||
    values.active !== initial.active;

  const busy =
    updateMutation.isPending || activateMutation.isPending || deactivateMutation.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!subFeature) return;
    if (!values.name.trim()) {
      setError({ name: "Name is required." });
      return;
    }
    try {
      if (values.active !== initial.active) {
        if (values.active) await activateMutation.mutateAsync(subFeature.id);
        else await deactivateMutation.mutateAsync(subFeature.id);
      }
      const nameChanged = values.name.trim() !== initial.name;
      const descChanged = (values.description ?? "").trim() !== (initial.description ?? "");
      if (nameChanged || descChanged) {
        await updateMutation.mutateAsync({
          id: subFeature.id,
          body: {
            ...(nameChanged ? { name: values.name.trim() } : {}),
            ...(descChanged ? { description: values.description.trim() || null } : {}),
          },
        });
      }
      toast.success("Sub-feature saved.");
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError({ name: "An active sub-feature with this name already exists on this product." });
      } else {
        setError({ form: "Could not save changes." });
      }
    }
  }

  if (!subFeature) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      isDirty={isDirty}
      title={`Edit Sub-feature: ${subFeature.name}`}
      footer={
        <>
          <div>
            {onRequestDelete && (
              <TertiaryButton
                onClick={() => onRequestDelete(subFeature)}
                className="text-cardinal-red hover:text-cardinal-red"
              >
                Delete sub-feature
              </TertiaryButton>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={onClose} disabled={busy}>Cancel</SecondaryButton>
            <PrimaryButton form="edit-sub-feature-form" type="submit" disabled={!isDirty || busy}>
              {busy ? "Saving…" : "Save"}
            </PrimaryButton>
          </div>
        </>
      }
    >
      <form id="edit-sub-feature-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextInput
          label="Name"
          required
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          error={error.name}
          disabled={busy}
        />

        <Textarea
          label="Description"
          rows={3}
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          disabled={busy}
        />

        <FormField label="Status">
          {(field) => (
            <div id={field.id}>
              <Toggle
                checked={values.active}
                onCheckedChange={(next) => setValues((v) => ({ ...v, active: next }))}
                label={values.active ? "Active" : "Inactive"}
                disabled={busy}
              />
            </div>
          )}
        </FormField>

        {error.form && (
          <p className="m-0" role="alert" style={{ fontSize: 12, color: "var(--color-cardinal-red)" }}>
            {error.form}
          </p>
        )}
      </form>

      <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--color-warm-gray-light)" }}>
        <EntityHeader.AuditFooter
          createdAt={subFeature.createdAt}
          createdBy={subFeature.createdBy}
          updatedAt={subFeature.updatedAt}
          updatedBy={subFeature.updatedBy}
        />
      </div>
    </Drawer>
  );
}
