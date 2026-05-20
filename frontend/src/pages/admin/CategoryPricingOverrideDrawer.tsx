import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError } from "../../lib/api";
import { useUpdateCategoryPricingMutation } from "../../lib/queries/clientPricing";
import { useToast } from "../../components/Toast";
import { Drawer } from "../../components/Drawer";
import { PrimaryButton, SecondaryButton } from "../../components/buttons";
import { TextInput } from "../../components/inputs";
import { FormField } from "../../components/FormField";
import type {
  CategoryPricingConfigDto,
  ClientPricingDefaultsDto,
  PricingModel,
} from "../../lib/api/clientPricing";

interface Props {
  open: boolean;
  category: CategoryPricingConfigDto | null;
  defaults: ClientPricingDefaultsDto | null;
  onClose: () => void;
}

interface FormValues {
  pricingModel: PricingModel | "";
  overrideTmMultiplier: string;
  overrideTmTargetMarginPct: string;
  overrideMatBillableRate: string;
  overrideMatDiscountPct: string;
}

function valuesFor(cat: CategoryPricingConfigDto | null): FormValues {
  return {
    pricingModel: cat?.pricingModel ?? "",
    overrideTmMultiplier: cat?.overrideTmMultiplier != null ? String(cat.overrideTmMultiplier) : "",
    overrideTmTargetMarginPct:
      cat?.overrideTmTargetMarginPct != null ? String(cat.overrideTmTargetMarginPct) : "",
    overrideMatBillableRate:
      cat?.overrideMatBillableRate != null ? String(cat.overrideMatBillableRate) : "",
    overrideMatDiscountPct:
      cat?.overrideMatDiscountPct != null ? String(cat.overrideMatDiscountPct) : "",
  };
}

function parseOptionalNum(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  const n = parseFloat(trimmed);
  return isNaN(n) ? null : n;
}

export function CategoryPricingOverrideDrawer({ open, category, defaults, onClose }: Props) {
  const initial = useMemo(() => valuesFor(category), [category]);
  const [values, setValues] = useState<FormValues>(initial);
  const [error, setError] = useState<string>("");

  const mutation = useUpdateCategoryPricingMutation();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setValues(initial);
      setError("");
    }
  }, [open, initial]);

  const model = values.pricingModel;
  const busy = mutation.isPending;

  const isDirty =
    values.pricingModel !== initial.pricingModel ||
    values.overrideTmMultiplier !== initial.overrideTmMultiplier ||
    values.overrideTmTargetMarginPct !== initial.overrideTmTargetMarginPct ||
    values.overrideMatBillableRate !== initial.overrideMatBillableRate ||
    values.overrideMatDiscountPct !== initial.overrideMatDiscountPct;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!category) return;
    try {
      await mutation.mutateAsync({
        id: category.categoryId,
        body: {
          pricingModel: values.pricingModel || null,
          overrideTmMultiplier: parseOptionalNum(values.overrideTmMultiplier),
          overrideTmTargetMarginPct: parseOptionalNum(values.overrideTmTargetMarginPct),
          overrideMatBillableRate: parseOptionalNum(values.overrideMatBillableRate),
          overrideMatDiscountPct: parseOptionalNum(values.overrideMatDiscountPct),
        },
      });
      toast.success("Category pricing saved.");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      isDirty={isDirty}
      title={category ? `Pricing: ${category.categoryName}` : "Category Pricing"}
      footer={
        <div className="flex items-center gap-2 justify-end w-full">
          <SecondaryButton onClick={onClose} disabled={busy}>
            Cancel
          </SecondaryButton>
          <PrimaryButton form="cat-pricing-form" type="submit" disabled={busy || !isDirty}>
            {busy ? "Saving…" : "Save"}
          </PrimaryButton>
        </div>
      }
    >
      <form id="cat-pricing-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <FormField label="Pricing model">
          {(field) => (
            <select
              id={field.id}
              value={values.pricingModel}
              onChange={(e) =>
                setValues((v) => ({ ...v, pricingModel: e.target.value as PricingModel | "" }))
              }
              disabled={busy}
              style={{
                width: "100%",
                height: 36,
                padding: "0 10px",
                border: "1px solid var(--color-border)",
                borderRadius: 5,
                fontSize: 14,
                background: "white",
                color: "var(--fg-1)",
              }}
            >
              <option value="">— Unassigned —</option>
              <option value="TARGET_MARGIN">Target Margin</option>
              <option value="TIME_AND_MATERIALS">Time &amp; Materials</option>
            </select>
          )}
        </FormField>

        {(model === "TARGET_MARGIN" || model === "") && model === "TARGET_MARGIN" && (
          <div>
            <p
              className="font-semibold text-near-black m-0 mb-3"
              style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}
            >
              Target Margin overrides
            </p>
            <div className="flex flex-col gap-3">
              <TextInput
                label={`Multiplier${defaults?.tmMultiplier != null ? ` (default: ${defaults.tmMultiplier})` : ""}`}
                type="number"
                step="0.0001"
                min="0"
                placeholder="Use default"
                value={values.overrideTmMultiplier}
                onChange={(e) =>
                  setValues((v) => ({ ...v, overrideTmMultiplier: e.target.value }))
                }
                disabled={busy}
              />
              <TextInput
                label={`Target margin %${defaults?.tmTargetMarginPct != null ? ` (default: ${defaults.tmTargetMarginPct}%)` : ""}`}
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="Use default"
                value={values.overrideTmTargetMarginPct}
                onChange={(e) =>
                  setValues((v) => ({ ...v, overrideTmTargetMarginPct: e.target.value }))
                }
                disabled={busy}
              />
            </div>
          </div>
        )}

        {model === "TIME_AND_MATERIALS" && (
          <div>
            <p
              className="font-semibold text-near-black m-0 mb-3"
              style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}
            >
              Time &amp; Materials overrides
            </p>
            <div className="flex flex-col gap-3">
              <TextInput
                label={`Billable rate ($/hr)${defaults?.matBillableRate != null ? ` (default: $${defaults.matBillableRate})` : ""}`}
                type="number"
                step="0.01"
                min="0"
                placeholder="Use default"
                value={values.overrideMatBillableRate}
                onChange={(e) =>
                  setValues((v) => ({ ...v, overrideMatBillableRate: e.target.value }))
                }
                disabled={busy}
              />
              <TextInput
                label={`Discount %${defaults?.matDiscountPct != null ? ` (default: ${defaults.matDiscountPct}%)` : ""}`}
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="Use default"
                value={values.overrideMatDiscountPct}
                onChange={(e) =>
                  setValues((v) => ({ ...v, overrideMatDiscountPct: e.target.value }))
                }
                disabled={busy}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-small text-cardinal-red m-0" role="alert">
            {error}
          </p>
        )}
      </form>
    </Drawer>
  );
}
