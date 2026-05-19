import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError } from "../../lib/api";
import {
  useCreateProgramTypeMutation,
  useUpdateProgramTypeMutation,
} from "../../lib/queries/programTypes";
import { useToast } from "../../components/Toast";
import { Drawer } from "../../components/Drawer";
import { PrimaryButton, SecondaryButton, TertiaryButton } from "../../components/buttons";
import { TextInput } from "../../components/inputs";
import { Toggle } from "../../components/Toggle";
import { FormField } from "../../components/FormField";
import type { ProgramTypeDto } from "../../lib/api/programTypes";

interface Props {
  open: boolean;
  programType: ProgramTypeDto | null;
  onClose: () => void;
  onRequestDelete?: (pt: ProgramTypeDto) => void;
}

interface FormValues {
  name: string;
  active: boolean;
}

function valuesFor(pt: ProgramTypeDto | null): FormValues {
  return { name: pt?.name ?? "", active: pt?.active ?? true };
}

export function ProgramTypeFormDrawer({ open, programType, onClose, onRequestDelete }: Props) {
  const isEdit = !!programType;
  const initial = useMemo(() => valuesFor(programType), [programType]);
  const [values, setValues] = useState<FormValues>(initial);
  const [fieldError, setFieldError] = useState<{ name?: string; form?: string }>({});

  const createMutation = useCreateProgramTypeMutation();
  const updateMutation = useUpdateProgramTypeMutation();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setValues(initial);
      setFieldError({});
    }
  }, [open, initial]);

  const isDirty = values.name !== initial.name || values.active !== initial.active;
  const busy = createMutation.isPending || updateMutation.isPending;
  const canSave = !busy && values.name.trim().length > 0 && (!isEdit || isDirty);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldError({});
    try {
      if (!isEdit) {
        await createMutation.mutateAsync({ name: values.name.trim(), active: values.active });
        toast.success("Program type created.");
      } else {
        await updateMutation.mutateAsync({
          id: programType!.id,
          body: { name: values.name.trim(), active: values.active },
        });
        toast.success("Program type saved.");
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFieldError({ name: "A program type with that name already exists." });
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
      title={isEdit ? `Edit: ${programType!.name}` : "New program type"}
      footer={
        <>
          <div>
            {isEdit && onRequestDelete && (
              <TertiaryButton
                onClick={() => onRequestDelete(programType!)}
                className="text-cardinal-red hover:text-cardinal-red"
              >
                Delete
              </TertiaryButton>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={onClose} disabled={busy}>
              Cancel
            </SecondaryButton>
            <PrimaryButton form="program-type-form" type="submit" disabled={!canSave}>
              {busy ? "Saving…" : isEdit ? "Save" : "Create"}
            </PrimaryButton>
          </div>
        </>
      }
    >
      <form id="program-type-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextInput
          label="Name"
          required
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          error={fieldError.name}
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
    </Drawer>
  );
}
