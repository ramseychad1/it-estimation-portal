import { useEffect, useState, type FormEvent } from "react";
import { Settings, SlidersHorizontal } from "lucide-react";
import { ApiError } from "../../lib/api";
import { PageHeader } from "../../components/PageHeader";
import { PrimaryButton, SecondaryButton } from "../../components/buttons";
import { TextInput } from "../../components/inputs";
import { useToast } from "../../components/Toast";
import { StatusBadge } from "../../components/StatusBadge";
import {
  useClientPricingDefaultsQuery,
  useCategoryPricingConfigsQuery,
  useUpdateClientPricingDefaultsMutation,
} from "../../lib/queries/clientPricing";
import type { CategoryPricingConfigDto } from "../../lib/api/clientPricing";
import { formatMarginPct, linkedTmField, marginPctFromMultiplier } from "../../lib/estimateMath";
import { CategoryPricingOverrideDrawer } from "./CategoryPricingOverrideDrawer";

interface DefaultsFormValues {
  tmMultiplier: string;
  tmTargetMarginPct: string;
  matBillableRate: string;
  matDiscountPct: string;
}

function parseOptionalNum(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  const n = parseFloat(trimmed);
  return isNaN(n) ? null : n;
}

function toFormValues(data: {
  tmMultiplier: number | null;
  tmTargetMarginPct: number | null;
  matBillableRate: number | null;
  matDiscountPct: number | null;
} | undefined): DefaultsFormValues {
  return {
    tmMultiplier: data?.tmMultiplier != null ? String(data.tmMultiplier) : "",
    tmTargetMarginPct: data?.tmTargetMarginPct != null ? String(data.tmTargetMarginPct) : "",
    matBillableRate: data?.matBillableRate != null ? String(data.matBillableRate) : "",
    matDiscountPct: data?.matDiscountPct != null ? String(data.matDiscountPct) : "",
  };
}

const MODEL_LABELS: Record<string, string> = {
  TARGET_MARGIN: "Target Margin",
  TIME_AND_MATERIALS: "Time & Materials",
};

export function ClientPricingPage() {
  useEffect(() => {
    document.title = "Client Pricing — Estimator";
  }, []);

  const defaultsQuery = useClientPricingDefaultsQuery();
  const categoriesQuery = useCategoryPricingConfigsQuery();
  const updateDefaultsMutation = useUpdateClientPricingDefaultsMutation();
  const toast = useToast();

  const [form, setForm] = useState<DefaultsFormValues>({
    tmMultiplier: "",
    tmTargetMarginPct: "",
    matBillableRate: "",
    matDiscountPct: "",
  });
  const [formDirty, setFormDirty] = useState(false);
  const [formError, setFormError] = useState("");

  const [overrideTarget, setOverrideTarget] = useState<CategoryPricingConfigDto | null>(null);

  // Sync form when defaults load
  useEffect(() => {
    if (defaultsQuery.data && !formDirty) {
      setForm(toFormValues(defaultsQuery.data));
    }
  }, [defaultsQuery.data, formDirty]);

  function handleFieldChange(field: keyof DefaultsFormValues, value: string) {
    // Multiplier and Target margin % are one value expressed two ways — editing
    // either derives the other so they can never silently disagree.
    if (field === "tmMultiplier" || field === "tmTargetMarginPct") {
      const linked = linkedTmField(field === "tmMultiplier" ? "multiplier" : "margin", value);
      setForm((prev) => ({
        ...prev,
        tmMultiplier: linked.multiplier,
        tmTargetMarginPct: linked.targetMarginPct,
      }));
      setFormDirty(true);
      return;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormDirty(true);
  }

  async function handleDefaultsSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    try {
      await updateDefaultsMutation.mutateAsync({
        tmMultiplier: parseOptionalNum(form.tmMultiplier),
        tmTargetMarginPct: parseOptionalNum(form.tmTargetMarginPct),
        matBillableRate: parseOptionalNum(form.matBillableRate),
        matDiscountPct: parseOptionalNum(form.matDiscountPct),
      });
      toast.success("Pricing defaults saved.");
      setFormDirty(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save defaults.");
    }
  }

  const busy = updateDefaultsMutation.isPending;

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Client Pricing" }]}
        title="Client Pricing"
        subtitle="Configure pricing model defaults and assign models to categories."
      />

      <hr className="my-6" style={{ height: 1, background: "var(--color-warm-gray-light)", border: 0 }} />

      {/* ── Pricing Model Defaults ───────────────────────────────────── */}
      <form onSubmit={handleDefaultsSubmit} noValidate>
        <SectionHeader icon={<Settings className="w-4 h-4" strokeWidth={1.5} />}>
          Pricing model defaults
        </SectionHeader>
        <p className="text-warm-gray-med mt-1 mb-5" style={{ fontSize: 13 }}>
          These values apply to all categories unless overridden at the category level.
        </p>

        <div
          className="bg-white"
          style={{ border: "1px solid var(--color-border)", borderRadius: 6, overflow: "hidden" }}
        >
          <div className="flex" style={{ borderBottom: "1px solid var(--color-warm-gray-light)" }}>
            {/* Target Margin section */}
            <div className="flex-1 p-5" style={{ borderRight: "1px solid var(--color-warm-gray-light)" }}>
              <p className="font-semibold text-near-black m-0 mb-4" style={{ fontSize: 13 }}>
                Target Margin
              </p>
              <div className="flex flex-col gap-3">
                <TextInput
                  label="Multiplier"
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="e.g. 1.25"
                  value={form.tmMultiplier}
                  onChange={(e) => handleFieldChange("tmMultiplier", e.target.value)}
                  disabled={busy}
                />
                <TextInput
                  label="Target margin %"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="e.g. 30"
                  value={form.tmTargetMarginPct}
                  onChange={(e) => handleFieldChange("tmTargetMarginPct", e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            {/* Time & Materials section */}
            <div className="flex-1 p-5">
              <p className="font-semibold text-near-black m-0 mb-4" style={{ fontSize: 13 }}>
                Time &amp; Materials
              </p>
              <div className="flex flex-col gap-3">
                <TextInput
                  label="Billable rate ($/hr)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 185.00"
                  value={form.matBillableRate}
                  onChange={(e) => handleFieldChange("matBillableRate", e.target.value)}
                  disabled={busy}
                />
                <TextInput
                  label="Discount %"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="e.g. 10"
                  value={form.matDiscountPct}
                  onChange={(e) => handleFieldChange("matDiscountPct", e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-3">
            {formError ? (
              <p className="text-small text-cardinal-red m-0" role="alert">{formError}</p>
            ) : <span />}
            <div className="flex items-center gap-2">
              {formDirty && (
                <SecondaryButton
                  type="button"
                  onClick={() => {
                    setForm(toFormValues(defaultsQuery.data));
                    setFormDirty(false);
                    setFormError("");
                  }}
                  disabled={busy}
                >
                  Discard
                </SecondaryButton>
              )}
              <PrimaryButton type="submit" disabled={busy || !formDirty}>
                {busy ? "Saving…" : "Save defaults"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      </form>

      {/* ── Category Pricing Models ──────────────────────────────────── */}
      <div className="mt-8">
        <SectionHeader icon={<SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />}>
          Category pricing models
        </SectionHeader>
        <p className="text-warm-gray-med mt-1 mb-5" style={{ fontSize: 13 }}>
          Assign a pricing model to each category. Optionally override the defaults per category.
        </p>

        <div
          className="bg-white overflow-hidden"
          style={{ border: "1px solid var(--color-border)", borderRadius: 6 }}
        >
          <table
            aria-label="Category pricing models"
            className="w-full"
            style={{ borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <Th>Category</Th>
                <Th width={160}>Status</Th>
                <Th width={200}>Pricing model</Th>
                <Th width={120}>Overrides</Th>
                <Th width={80} />
              </tr>
            </thead>
            <tbody>
              {categoriesQuery.isLoading && (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--fg-2)" }}>
                    Loading…
                  </td>
                </tr>
              )}
              {!categoriesQuery.isLoading &&
                (categoriesQuery.data ?? []).map((cat) => (
                  <tr
                    key={cat.categoryId}
                    style={{ borderBottom: "1px solid var(--color-warm-gray-light)" }}
                  >
                    <td style={cellStyle({})}>
                      <span className="font-semibold text-near-black">{cat.categoryName}</span>
                    </td>
                    <td style={cellStyle({ width: 160 })}>
                      {cat.categoryActive ? (
                        <StatusBadge variant="active">Active</StatusBadge>
                      ) : (
                        <StatusBadge variant="inactive">Inactive</StatusBadge>
                      )}
                    </td>
                    <td style={cellStyle({ width: 200 })}>
                      {cat.pricingModel ? (
                        <div className="flex items-center gap-2">
                          <ModelBadge model={cat.pricingModel} />
                          {(() => {
                            const m = formatMarginPct(
                              configuredMarginPct(cat, defaultsQuery.data),
                            );
                            return m ? (
                              <span className="text-warm-gray-med tabular-nums" style={{ fontSize: 12 }}>
                                {m} margin
                              </span>
                            ) : null;
                          })()}
                        </div>
                      ) : (
                        <span className="text-warm-gray-med" style={{ fontSize: 13 }}>
                          — Unassigned —
                        </span>
                      )}
                    </td>
                    <td style={cellStyle({ width: 120 })}>
                      <OverrideIndicator cat={cat} />
                    </td>
                    <td style={cellStyle({ width: 80, textAlign: "right" })}>
                      <button
                        type="button"
                        onClick={() => setOverrideTarget(cat)}
                        className="text-near-black hover:underline bg-transparent border-0 cursor-pointer"
                        style={{ fontSize: 13 }}
                      >
                        Configure
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <CategoryPricingOverrideDrawer
        open={!!overrideTarget}
        category={overrideTarget}
        defaults={defaultsQuery.data ?? null}
        onClose={() => setOverrideTarget(null)}
      />
    </>
  );
}

function SectionHeader({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-warm-gray-med">{icon}</span>
      <h2 className="m-0 text-near-black font-semibold" style={{ fontSize: 15 }}>
        {children}
      </h2>
    </div>
  );
}

/**
 * Effective configured Target-Margin % for a category row: the category's own
 * override (its margin, or derived from its multiplier) if set, else the global
 * default (its margin, or derived from its multiplier). Null for T&M / unset —
 * those have no fixed margin. Mirrors the resolution order in
 * ClientPricingService.getEffectivePricingForCategory.
 */
function configuredMarginPct(
  cat: CategoryPricingConfigDto,
  defaults: { tmMultiplier: number | null; tmTargetMarginPct: number | null } | null | undefined,
): number | null {
  if (cat.pricingModel !== "TARGET_MARGIN") return null;
  const overridePct =
    cat.overrideTmTargetMarginPct ??
    (cat.overrideTmMultiplier != null ? marginPctFromMultiplier(cat.overrideTmMultiplier) : null);
  if (overridePct != null) return overridePct;
  if (!defaults) return null;
  return (
    defaults.tmTargetMarginPct ??
    (defaults.tmMultiplier != null ? marginPctFromMultiplier(defaults.tmMultiplier) : null)
  );
}

function ModelBadge({ model }: { model: string }) {
  const isTm = model === "TARGET_MARGIN";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        background: isTm ? "var(--color-blue-tint, #EBF3FF)" : "var(--color-purple-tint, #F3EEFF)",
        color: isTm ? "var(--color-blue, #1D6FD1)" : "var(--color-purple, #7C3AED)",
      }}
    >
      {MODEL_LABELS[model] ?? model}
    </span>
  );
}

function OverrideIndicator({ cat }: { cat: CategoryPricingConfigDto }) {
  const hasOverride =
    cat.overrideTmMultiplier != null ||
    cat.overrideTmTargetMarginPct != null ||
    cat.overrideMatBillableRate != null ||
    cat.overrideMatDiscountPct != null;

  if (!hasOverride) {
    return <span className="text-warm-gray-med" style={{ fontSize: 13 }}>Using defaults</span>;
  }
  return (
    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg-1)" }}>
      Custom
    </span>
  );
}

function Th({ children, width }: { children?: React.ReactNode; width?: number }) {
  return (
    <th
      scope="col"
      style={{
        width,
        padding: "10px 14px",
        textAlign: "left",
        borderBottom: "1px solid var(--color-warm-gray-light)",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--fg-2)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function cellStyle(extra: React.CSSProperties): React.CSSProperties {
  return {
    padding: "0 14px",
    height: 52,
    fontSize: 14,
    color: "var(--fg-1)",
    verticalAlign: "middle",
    ...extra,
  };
}
