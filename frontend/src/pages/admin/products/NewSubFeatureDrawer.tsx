import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../../lib/api";
import { useCreateSubFeatureMutation } from "../../../lib/queries/subFeatures";
import { useToast } from "../../../components/Toast";
import { Drawer } from "../../../components/Drawer";
import { PrimaryButton, SecondaryButton } from "../../../components/buttons";
import { TextInput, Textarea } from "../../../components/inputs";
import { Toggle } from "../../../components/Toggle";
import { FormField } from "../../../components/FormField";

interface NewSubFeatureDrawerProps {
  open: boolean;
  productId: number;
  productName: string;
  onClose: () => void;
}

export function NewSubFeatureDrawer({ open, productId, productName, onClose }: NewSubFeatureDrawerProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const createMutation = useCreateSubFeatureMutation();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<{ name?: string; form?: string }>({});

  function reset() {
    setName("");
    setDescription("");
    setActive(true);
    setError({});
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError({ name: "Name is required." });
      return;
    }
    try {
      const created = await createMutation.mutateAsync({
        productId,
        body: {
          name: name.trim(),
          description: description.trim() || null,
          active,
        },
      });
      toast.success(`Sub-feature '${created.name}' created.`);
      reset();
      onClose();
      navigate(`/catalog/products/${productId}/sub-features/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError({ name: "An active sub-feature with this name already exists on this product." });
      } else {
        setError({ form: "Could not create the sub-feature. Please try again." });
      }
    }
  }

  const isDirty = name.trim() !== "" || description.trim() !== "" || !active;
  const busy = createMutation.isPending;

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      isDirty={isDirty}
      title={`New sub-feature for ${productName}`}
      footer={
        <>
          <div />
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={handleClose} disabled={busy}>Cancel</SecondaryButton>
            <PrimaryButton form="new-sub-feature-form" type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create & Continue"}
            </PrimaryButton>
          </div>
        </>
      }
    >
      <form id="new-sub-feature-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextInput
          label="Name"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error.name}
          placeholder="e.g., iOS"
          disabled={busy}
        />

        <Textarea
          label="Description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional. What's distinct about this sub-feature?"
          disabled={busy}
        />

        <FormField label="Status">
          {(field) => (
            <div id={field.id}>
              <Toggle
                checked={active}
                onCheckedChange={setActive}
                label={active ? "Active" : "Inactive"}
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
    </Drawer>
  );
}
