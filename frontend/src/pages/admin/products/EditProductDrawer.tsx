import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { isAdmin } from "../../../lib/permissions";
import {
  useActivateProductMutation,
  useDeactivateProductMutation,
  useUpdateProductMutation,
} from "../../../lib/queries/products";
import { useTeamsQuery } from "../../../lib/queries/teams";
import { useToast } from "../../../components/Toast";
import { Drawer } from "../../../components/Drawer";
import { PrimaryButton, SecondaryButton, TertiaryButton } from "../../../components/buttons";
import { TextInput, Textarea } from "../../../components/inputs";
import { Toggle } from "../../../components/Toggle";
import { FormField } from "../../../components/FormField";
import { EntityHeader } from "../../../components/EntityHeader";
import type { ProductDetail } from "../../../lib/api/products";

interface EditProductDrawerProps {
  open: boolean;
  product: ProductDetail | null;
  onClose: () => void;
  onRequestDelete?: (product: ProductDetail) => void;
  onShowHistory?: (product: ProductDetail) => void;
}

interface FormValues {
  name: string;
  description: string;
  active: boolean;
  teamId: number | null;
}

function valuesFor(product: ProductDetail | null): FormValues {
  return {
    name: product?.name ?? "",
    description: product?.description ?? "",
    active: product?.active ?? true,
    teamId: product?.team?.id ?? null,
  };
}

export function EditProductDrawer({
  open,
  product,
  onClose,
  onRequestDelete,
  onShowHistory,
}: EditProductDrawerProps) {
  const initial = useMemo(() => valuesFor(product), [product]);
  const [values, setValues] = useState<FormValues>(initial);
  const [error, setError] = useState<{ name?: string; form?: string }>({});

  const { user } = useAuth();
  const updateMutation = useUpdateProductMutation();
  const activateMutation = useActivateProductMutation();
  const deactivateMutation = useDeactivateProductMutation();
  const teamsQuery = useTeamsQuery({ status: "ACTIVE", size: 100 });
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
    values.active !== initial.active ||
    values.teamId !== initial.teamId;

  const busy =
    updateMutation.isPending || activateMutation.isPending || deactivateMutation.isPending;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!product) return;
    if (!values.name.trim()) {
      setError({ name: "Name is required." });
      return;
    }
    try {
      // Active flips routed through dedicated endpoints — same UX rule the
      // server enforces. We do the activate/deactivate first so the audit
      // ordering reads as "ACTIVATED → UPDATED" (or vice versa).
      if (values.active !== initial.active) {
        if (values.active) await activateMutation.mutateAsync(product.id);
        else await deactivateMutation.mutateAsync(product.id);
      }
      const nameChanged = values.name.trim() !== initial.name;
      const descChanged = (values.description ?? "").trim() !== (initial.description ?? "");
      const teamChanged = values.teamId !== initial.teamId;
      if (nameChanged || descChanged || teamChanged) {
        await updateMutation.mutateAsync({
          id: product.id,
          body: {
            ...(nameChanged ? { name: values.name.trim() } : {}),
            ...(descChanged ? { description: values.description.trim() || null } : {}),
            ...(teamChanged && values.teamId ? { teamId: values.teamId } : {}),
          },
        });
      }
      toast.success("Product saved.");
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError({ name: "An active product with this name already exists." });
      } else {
        setError({ form: "Could not save changes." });
      }
    }
  }

  if (!product) return null;

  const allTeams = teamsQuery.data?.items ?? [];
  const activeTeams = isAdmin(user?.roles ?? [])
    ? allTeams
    : allTeams.filter((t) => (user?.teamIds ?? []).includes(t.id));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      isDirty={isDirty}
      title={`Edit Product: ${product.name}`}
      footer={
        <>
          <div>
            {onRequestDelete && (
              <TertiaryButton
                onClick={() => onRequestDelete(product)}
                className="text-cardinal-red hover:text-cardinal-red"
              >
                Delete product
              </TertiaryButton>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={onClose} disabled={busy}>Cancel</SecondaryButton>
            <PrimaryButton form="edit-product-form" type="submit" disabled={!isDirty || busy}>
              {busy ? "Saving…" : "Save"}
            </PrimaryButton>
          </div>
        </>
      }
    >
      <form id="edit-product-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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

        <FormField label="Team" helper="Which team owns this product?">
          {(field) => (
            <select
              id={field.id}
              value={values.teamId ?? ""}
              onChange={(e) => {
                const val = e.currentTarget.value;
                setValues((v) => ({ ...v, teamId: val ? Number(val) : null }));
              }}
              disabled={busy}
              className="w-full rounded-md border bg-white text-near-black h-8 px-2 disabled:bg-warm-gray-light disabled:text-warm-gray-med"
              style={{ borderColor: "var(--color-border-strong)", fontSize: 13 }}
            >
              <option value="">No team assigned</option>
              {activeTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </FormField>

        <FormField label="Type" helper="Mode is set at creation and cannot be changed.">
          {(field) => (
            <div id={field.id}>
              <ModePill mode={product.mode} />
            </div>
          )}
        </FormField>

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
          createdAt={product.createdAt}
          createdBy={product.createdBy}
          updatedAt={product.updatedAt}
          updatedBy={product.updatedBy}
          onViewHistory={onShowHistory ? () => onShowHistory(product) : undefined}
        />
      </div>
    </Drawer>
  );
}

function ModePill({ mode }: { mode: "ATOMIC" | "CONTAINER" }) {
  const isAtomic = mode === "ATOMIC";
  return (
    <span
      data-testid="mode-pill-readonly"
      className="inline-flex items-center text-near-black"
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        background: isAtomic ? "var(--color-warm-gray-light)" : "var(--color-light-blue-soft)",
        border: isAtomic
          ? "1px solid var(--color-border-strong)"
          : "1px solid rgba(187,221,230,0.7)",
      }}
    >
      {isAtomic ? "Atomic" : "Container"}
    </span>
  );
}
