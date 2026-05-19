import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError } from "../../lib/api";
import {
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
} from "../../lib/queries/categories";
import { useToast } from "../../components/Toast";
import { Drawer } from "../../components/Drawer";
import { PrimaryButton, SecondaryButton, TertiaryButton } from "../../components/buttons";
import { TextInput } from "../../components/inputs";
import { Toggle } from "../../components/Toggle";
import { FormField } from "../../components/FormField";
import type { CategoryDto } from "../../lib/api/categories";

interface Props {
  open: boolean;
  category: CategoryDto | null;
  onClose: () => void;
  onRequestDelete?: (cat: CategoryDto) => void;
}

interface FormValues {
  name: string;
  active: boolean;
}

function valuesFor(cat: CategoryDto | null): FormValues {
  return { name: cat?.name ?? "", active: cat?.active ?? true };
}

export function CategoryFormDrawer({ open, category, onClose, onRequestDelete }: Props) {
  const isEdit = !!category;
  const initial = useMemo(() => valuesFor(category), [category]);
  const [values, setValues] = useState<FormValues>(initial);
  const [fieldError, setFieldError] = useState<{ name?: string; form?: string }>({});

  const createMutation = useCreateCategoryMutation();
  const updateMutation = useUpdateCategoryMutation();
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
        toast.success("Category created.");
      } else {
        await updateMutation.mutateAsync({
          id: category!.id,
          body: { name: values.name.trim(), active: values.active },
        });
        toast.success("Category saved.");
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFieldError({ name: "A category with that name already exists." });
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
      title={isEdit ? `Edit: ${category!.name}` : "New category"}
      footer={
        <>
          <div>
            {isEdit && onRequestDelete && (
              <TertiaryButton
                onClick={() => onRequestDelete(category!)}
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
            <PrimaryButton form="category-form" type="submit" disabled={!canSave}>
              {busy ? "Saving…" : isEdit ? "Save" : "Create"}
            </PrimaryButton>
          </div>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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
