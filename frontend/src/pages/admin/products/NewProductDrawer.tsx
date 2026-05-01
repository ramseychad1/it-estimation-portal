import { Info } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../../lib/api";
import { useCreateProductMutation } from "../../../lib/queries/products";
import { useToast } from "../../../components/Toast";
import { Drawer } from "../../../components/Drawer";
import { PrimaryButton, SecondaryButton } from "../../../components/buttons";
import { TextInput, Textarea } from "../../../components/inputs";
import { Toggle } from "../../../components/Toggle";
import { FormField } from "../../../components/FormField";
import type { ProductMode } from "../../../lib/api/products";

interface NewProductDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface ModeCardConfig {
  value: ProductMode;
  title: string;
  description: string;
  example: string;
}

const MODE_CARDS: ModeCardConfig[] = [
  {
    value: "ATOMIC",
    title: "Atomic product",
    description:
      "This product has a single estimate template. Choose this if the work is one indivisible unit.",
    example: "e.g., Eligibility Verification API",
  },
  {
    value: "CONTAINER",
    title: "Container product",
    description:
      "This product has multiple sub-features, each with its own estimate template. Choose this when the product has variants or distinct work types.",
    example: "e.g., Digital Enrollment Portal",
  },
];

export function NewProductDrawer({ open, onClose }: NewProductDrawerProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const createMutation = useCreateProductMutation();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<ProductMode | null>(null);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<{ name?: string; mode?: string; form?: string }>({});

  function reset() {
    setName("");
    setDescription("");
    setMode(null);
    setActive(true);
    setError({});
  }

  function handleClose() {
    reset();
    onClose();
  }

  function validate(): boolean {
    const next: typeof error = {};
    if (!name.trim()) next.name = "Name is required.";
    if (!mode) next.mode = "Choose a mode for this product.";
    setError(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    try {
      const created = await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        mode: mode as ProductMode,
        active,
      });
      toast.success(`Product '${created.name}' created.`);
      reset();
      onClose();
      navigate(`/catalog/products/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError({ name: "An active product with this name already exists." });
      } else {
        setError({ form: "Could not create the product. Please try again." });
      }
    }
  }

  const isDirty =
    name.trim() !== "" || description.trim() !== "" || mode !== null || !active;

  const infoCopy =
    mode === "ATOMIC"
      ? "After saving, you'll be taken to the product's detail page where you can add a template and critical questions."
      : mode === "CONTAINER"
        ? "After saving, you'll be taken to the product's detail page where you can add sub-features and templates."
        : "After saving, you'll be taken to the product's detail page to continue setup.";

  const busy = createMutation.isPending;

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      isDirty={isDirty}
      title="New Product"
      footer={
        <>
          <div />
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={handleClose} disabled={busy}>Cancel</SecondaryButton>
            <PrimaryButton form="new-product-form" type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create & Continue"}
            </PrimaryButton>
          </div>
        </>
      }
    >
      <form id="new-product-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextInput
          label="Name"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error.name}
          placeholder="e.g., Eligibility Verification API"
          disabled={busy}
        />

        <Textarea
          label="Description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional. What kind of work does this product cover?"
          disabled={busy}
        />

        <fieldset className="border-0 p-0 m-0">
          <legend className="text-near-black font-medium" style={{ fontSize: 13 }}>
            Mode
            <span className="ml-1" style={{ color: "var(--color-cardinal-red)" }}>*</span>
          </legend>
          {error.mode && (
            <p
              className="m-0 mt-1"
              role="alert"
              style={{ fontSize: 12, color: "var(--color-cardinal-red)" }}
            >
              {error.mode}
            </p>
          )}
          <div role="radiogroup" aria-label="Mode" className="flex flex-col gap-2 mt-2">
            {MODE_CARDS.map((card) => (
              <ModeRadioCard
                key={card.value}
                config={card}
                checked={mode === card.value}
                onSelect={() => setMode(card.value)}
                disabled={busy}
              />
            ))}
          </div>
        </fieldset>

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

        <div
          className="flex items-start gap-2 rounded-md"
          style={{
            padding: "10px 12px",
            background: "var(--color-light-blue-soft)",
            border: "1px solid rgba(187,221,230,0.7)",
          }}
        >
          <Info className="w-4 h-4 mt-0.5 text-near-black flex-shrink-0" strokeWidth={1.5} />
          <p className="m-0 text-near-black" style={{ fontSize: 12 }}>{infoCopy}</p>
        </div>

        {error.form && (
          <p className="m-0" role="alert" style={{ fontSize: 12, color: "var(--color-cardinal-red)" }}>
            {error.form}
          </p>
        )}
      </form>
    </Drawer>
  );
}

function ModeRadioCard({
  config,
  checked,
  onSelect,
  disabled,
}: {
  config: ModeCardConfig;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      disabled={disabled}
      className="text-left bg-white rounded-md cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light-blue disabled:opacity-60 disabled:cursor-default"
      style={{
        padding: "12px 14px",
        border: checked
          ? "1px solid var(--color-light-blue)"
          : "1px solid var(--color-border-strong)",
        background: checked ? "var(--color-light-blue-soft)" : "var(--color-white)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center"
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: `2px solid ${checked ? "var(--color-near-black)" : "var(--color-border-strong)"}`,
          }}
        >
          {checked && (
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-near-black)" }} />
          )}
        </span>
        <span className="text-near-black font-semibold" style={{ fontSize: 14 }}>{config.title}</span>
      </div>
      <p className="m-0 mt-1 text-warm-gray-med" style={{ fontSize: 12, marginLeft: 24 }}>
        {config.description}
      </p>
      <p
        className="m-0 mt-1 text-warm-gray-med italic"
        style={{ fontSize: 11, marginLeft: 24 }}
      >
        {config.example}
      </p>
    </button>
  );
}
