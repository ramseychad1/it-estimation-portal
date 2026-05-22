import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Info } from "lucide-react";
import { EntityHeader } from "../components/EntityHeader";
import { PrimaryButton, SecondaryButton, TertiaryButton } from "../components/buttons";
import { StatusBadge, estimateStatusBadge } from "../components/StatusBadge";
import { UserCell } from "../components/UserCell";
import { useToast } from "../components/Toast";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import { ROLE_ADMIN } from "../lib/types";
import { useRatesPageQuery } from "../lib/queries/rates";
import { useMyRequestHistoryQuery } from "../lib/queries/estimates";
import {
  useApprovePricingReviewMutation,
  useClaimPricingReviewMutation,
  usePricingReviewDetailQuery,
  useReleasePricingReviewMutation,
  useSavePricingReviewMutation,
} from "../lib/queries/pricingReview";
import type { EstimateRequestItemDto } from "../lib/api/estimates";
import type { RmItemOverrideInput } from "../lib/api/pricingReview";
import {
  computeClientPrice,
  onshoreHoursForLines,
  offshoreHoursForLines,
  pricingModelLabel,
  totalCostForLines,
  totalHoursForLines,
} from "../lib/estimateMath";

type PricingModel = "TARGET_MARGIN" | "TIME_AND_MATERIALS";

export function PricingReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const numericId = id ? Number(id) : null;

  const detailQuery = usePricingReviewDetailQuery(numericId);
  const historyQuery = useMyRequestHistoryQuery(numericId);
  const ratesQuery = useRatesPageQuery({ size: 1 });
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const isUserAdmin = !!user && user.roles.includes(ROLE_ADMIN);

  const claimMutation = useClaimPricingReviewMutation(numericId ?? 0);
  const releaseMutation = useReleasePricingReviewMutation(numericId ?? 0);
  const saveMutation = useSavePricingReviewMutation(numericId ?? 0);
  const approveMutation = useApprovePricingReviewMutation(numericId ?? 0);

  // Local form state (discount, notes, per-item overrides)
  const [discountPct, setDiscountPct] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [itemOverrides, setItemOverrides] = useState<Map<number, Partial<RmItemOverrideInput>>>(new Map());

  useEffect(() => {
    document.title = detailQuery.data?.title
      ? `${detailQuery.data.title} — Pricing Review`
      : "Pricing Review — Estimator";
  }, [detailQuery.data?.title]);

  // Populate form from server data when first loaded.
  useEffect(() => {
    if (!detailQuery.data) return;
    const d = detailQuery.data;
    setDiscountPct(d.rmDiscountPct != null ? String(d.rmDiscountPct) : "");
    setNotes(d.rmNotes ?? "");
    const overrides = new Map<number, Partial<RmItemOverrideInput>>();
    for (const item of d.items) {
      if (item.rmPricingModel != null) {
        overrides.set(item.id, {
          itemId: item.id,
          pricingModel: item.rmPricingModel,
          tmMultiplier: item.rmTmMultiplier,
          tmTargetMarginPct: item.rmTmTargetMarginPct,
          matBillableRate: item.rmMatBillableRate,
          matDiscountPct: item.rmMatDiscountPct,
        });
      }
    }
    setItemOverrides(overrides);
  // Only run on initial load, not on every refetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQuery.data?.id]);

  if (detailQuery.isError) {
    const status = detailQuery.error instanceof ApiError ? detailQuery.error.status : null;
    if (status === 404) return <NotFoundPanel />;
  }
  if (detailQuery.isLoading || !detailQuery.data) {
    return (
      <div className="text-warm-gray-med" style={{ fontSize: 13, padding: "32px 0" }}>
        Loading…
      </div>
    );
  }

  const detail = detailQuery.data;
  const currentRate = ratesQuery.data?.current ?? null;
  const prs = detail.pricingReviewStatus;
  const isClaimedByMe = prs === "IN_REVIEW" &&
    (detail.rmReviewerId === user?.id || isUserAdmin);
  const isPending = prs === "PENDING";
  const isApprovedByRm = prs === "APPROVED";
  const canEdit = isClaimedByMe;

  const { variant, label } = estimateStatusBadge(detail.derivedStatus);

  function buildPayload() {
    const parsed = parseFloat(discountPct);
    return {
      discountPct: isNaN(parsed) ? null : parsed,
      notes: notes.trim() || null,
      itemOverrides: Array.from(itemOverrides.values()).map((ov) => ({
        itemId: ov.itemId!,
        pricingModel: ov.pricingModel ?? null,
        tmMultiplier: ov.tmMultiplier ?? null,
        tmTargetMarginPct: ov.tmTargetMarginPct ?? null,
        matBillableRate: ov.matBillableRate ?? null,
        matDiscountPct: ov.matDiscountPct ?? null,
      })),
    };
  }

  function handleClaim() {
    claimMutation.mutate(undefined, {
      onError: () => toast.error("Could not claim this request."),
    });
  }

  function handleRelease() {
    releaseMutation.mutate(undefined, {
      onSuccess: () => navigate("/pricing-review"),
      onError: () => toast.error("Could not release this request."),
    });
  }

  function handleSave() {
    saveMutation.mutate(buildPayload(), {
      onSuccess: () => toast.success("Draft saved."),
      onError: () => toast.error("Could not save draft."),
    });
  }

  function handleApprove() {
    approveMutation.mutate(buildPayload(), {
      onSuccess: () => {
        toast.success("Pricing review approved.");
        navigate("/pricing-review");
      },
      onError: () => toast.error("Could not approve pricing review."),
    });
  }

  function setItemOverride(itemId: number, patch: Partial<RmItemOverrideInput>) {
    setItemOverrides((prev) => {
      const next = new Map(prev);
      const existing = next.get(itemId) ?? { itemId };
      next.set(itemId, { ...existing, ...patch });
      return next;
    });
  }

  const approvedItems = detail.items.filter(
    (it) => it.status === "APPROVED" && it.complexity != null,
  );

  return (
    <div>
      <EntityHeader
        breadcrumb={[
          { label: "Workspace" },
          { label: "Pricing Review", to: "/pricing-review" },
          { label: detail.title },
        ]}
        eyebrow={`EST-${detail.id}`}
        title={detail.title}
        titleSuffix={<StatusBadge variant={variant}>{label}</StatusBadge>}
        subtitle={
          <span>
            Requester: <UserCell userId={detail.requesterId} size={18} />
            {detail.rmReviewerId && (
              <> · RM: <UserCell userId={detail.rmReviewerId} size={18} /></>
            )}
          </span>
        }
        actions={
          canEdit ? (
            <>
              <TertiaryButton onClick={handleRelease} disabled={releaseMutation.isPending}>
                Release
              </TertiaryButton>
              <SecondaryButton onClick={handleSave} disabled={saveMutation.isPending}>
                Save draft
              </SecondaryButton>
              <PrimaryButton onClick={handleApprove} disabled={approveMutation.isPending}>
                {approveMutation.isPending ? "Approving…" : "Approve"}
              </PrimaryButton>
            </>
          ) : isPending ? (
            <PrimaryButton onClick={handleClaim} disabled={claimMutation.isPending}>
              {claimMutation.isPending ? "Claiming…" : "Claim for review"}
            </PrimaryButton>
          ) : undefined
        }
      />

      <div className="flex flex-col" style={{ gap: 16, marginTop: 24 }}>

        {/* Status banner */}
        {isPending && (
          <InfoBanner>
            This estimate is pending pricing review. Claim it to begin.
          </InfoBanner>
        )}
        {isApprovedByRm && (
          <div
            className="rounded-lg flex items-start"
            style={{
              background: "var(--color-light-blue-soft)",
              border: "1px solid rgba(187,221,230,0.7)",
              padding: "12px 16px",
              gap: 10,
              fontSize: 13,
            }}
          >
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <span>
              Pricing review approved
              {detail.rmReviewedAt
                ? ` on ${new Date(detail.rmReviewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : ""}.
              {detail.rmDiscountPct != null && <> A <strong>{detail.rmDiscountPct}% discount</strong> was applied.</>}
            </span>
          </div>
        )}

        {/* Global discount + notes */}
        <div
          className="bg-white"
          style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: "16px 20px" }}
        >
          <div className="font-semibold text-near-black" style={{ fontSize: 14, marginBottom: 14 }}>
            Pricing Adjustments
          </div>
          <div className="flex flex-col" style={{ gap: 16 }}>
            <div className="flex gap-8">
              <div style={{ flex: "0 0 200px" }}>
                <label className="block font-medium text-near-black" style={{ fontSize: 13, marginBottom: 6 }}>
                  Global Discount (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)}
                  disabled={!canEdit}
                  placeholder="e.g. 10"
                  className="w-full rounded border text-near-black"
                  style={{
                    padding: "7px 10px",
                    fontSize: 13,
                    borderColor: "var(--color-border-strong)",
                    background: canEdit ? "white" : "var(--color-warm-gray-light)",
                  }}
                />
                <p className="m-0 mt-1 text-warm-gray-med" style={{ fontSize: 11 }}>
                  Applied to the total client price
                </p>
              </div>
            </div>
            <div>
              <label className="block font-medium text-near-black" style={{ fontSize: 13, marginBottom: 6 }}>
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!canEdit}
                rows={3}
                placeholder="Optional notes for the requester or internal record…"
                className="w-full rounded border text-near-black"
                style={{
                  padding: "7px 10px",
                  fontSize: 13,
                  borderColor: "var(--color-border-strong)",
                  resize: "vertical",
                  background: canEdit ? "white" : "var(--color-warm-gray-light)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Per-item pricing overrides */}
        {approvedItems.map((item) => (
          <PricingItemCard
            key={item.id}
            item={item}
            currentRate={currentRate}
            override={itemOverrides.get(item.id)}
            canEdit={canEdit}
            onOverrideChange={(patch) => setItemOverride(item.id, patch)}
          />
        ))}

        {/* Activity */}
        {historyQuery.data && historyQuery.data.length > 0 && (
          <div
            className="bg-white"
            style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: "16px 20px" }}
          >
            <div className="font-semibold text-near-black" style={{ fontSize: 14, marginBottom: 14 }}>
              Activity
            </div>
            <div className="flex flex-col" style={{ gap: 8 }}>
              {historyQuery.data.slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex gap-3 items-start" style={{ fontSize: 13 }}>
                  <span className="text-warm-gray-med tabular-nums" style={{ minWidth: 100 }}>
                    {new Date(entry.changedAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </span>
                  <span className="text-near-black">{entry.notes ?? entry.action}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Per-item pricing override card ────────────────────────────────────────────

function PricingItemCard({
  item,
  currentRate,
  override,
  canEdit,
  onOverrideChange,
}: {
  item: EstimateRequestItemDto;
  currentRate: { onshoreRate: string; offshoreRate: string; effectiveDate: string } | null;
  override: Partial<RmItemOverrideInput> | undefined;
  canEdit: boolean;
  onOverrideChange: (patch: Partial<RmItemOverrideInput>) => void;
}) {
  const ons = onshoreHoursForLines(item.phaseLines, item.complexity);
  const offs = offshoreHoursForLines(item.phaseLines, item.complexity);
  const total = totalHoursForLines(item.phaseLines, item.complexity);
  const cost = totalCostForLines(item.phaseLines, item.complexity, currentRate);

  const effectiveModel = (override?.pricingModel ?? item.rmPricingModel ?? item.pricingModel) as PricingModel | null;
  const effectiveTmMultiplier = override?.tmMultiplier ?? item.rmTmMultiplier ?? item.tmMultiplier;
  const effectiveTmTargetMarginPct = override?.tmTargetMarginPct ?? item.rmTmTargetMarginPct ?? item.tmTargetMarginPct;
  const effectiveMatBillableRate = override?.matBillableRate ?? item.rmMatBillableRate ?? item.matBillableRate;
  const effectiveMatDiscountPct = override?.matDiscountPct ?? item.rmMatDiscountPct ?? item.matDiscountPct;

  const clientPrice = computeClientPrice(
    effectiveModel, currentRate ? cost : null, total,
    effectiveTmMultiplier, effectiveTmTargetMarginPct,
    effectiveMatBillableRate, effectiveMatDiscountPct,
  );

  const title = item.subFeatureName
    ? `${item.productName} · ${item.subFeatureName}`
    : item.productName;

  return (
    <div
      className="bg-white"
      style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: "16px 20px" }}
    >
      <div className="font-semibold text-near-black" style={{ fontSize: 14, marginBottom: 14 }}>
        {title}
      </div>
      <div className="flex flex-col" style={{ gap: 12 }}>
        {/* Hours summary */}
        <div className="flex gap-6" style={{ fontSize: 13 }}>
          <Stat label="Onshore Hrs" value={Math.ceil(ons).toLocaleString()} />
          <Stat label="Offshore Hrs" value={Math.ceil(offs).toLocaleString()} />
          <Stat label="Total Hrs" value={Math.ceil(total).toLocaleString()} />
          {currentRate && (
            <Stat label="Internal Cost" value={`$${Math.ceil(cost).toLocaleString()}`} />
          )}
          {clientPrice != null && (
            <Stat label="Client Price" value={`$${Math.ceil(clientPrice).toLocaleString()}`} emphasis />
          )}
        </div>

        {/* Pricing model override */}
        <div
          style={{
            borderTop: "1px solid var(--color-warm-gray-light)",
            paddingTop: 12,
          }}
        >
          <p className="m-0 mb-2 font-medium text-near-black" style={{ fontSize: 13 }}>
            Pricing Model Override
          </p>
          <div className="flex gap-4 flex-wrap items-end">
            <div>
              <label className="block text-warm-gray-med" style={{ fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Model
              </label>
              <select
                value={effectiveModel ?? ""}
                onChange={(e) =>
                  onOverrideChange({ pricingModel: (e.target.value || null) as PricingModel | null })
                }
                disabled={!canEdit}
                className="rounded border text-near-black"
                style={{
                  padding: "6px 10px",
                  fontSize: 13,
                  borderColor: "var(--color-border-strong)",
                  background: canEdit ? "white" : "var(--color-warm-gray-light)",
                  minWidth: 180,
                }}
              >
                <option value="">(no override)</option>
                <option value="TARGET_MARGIN">Target Margin (T&M)</option>
                <option value="TIME_AND_MATERIALS">Time & Materials</option>
              </select>
            </div>

            {effectiveModel === "TARGET_MARGIN" && (
              <>
                <NumericField
                  label="Multiplier"
                  value={effectiveTmMultiplier}
                  disabled={!canEdit}
                  onChange={(v) => onOverrideChange({ tmMultiplier: v })}
                />
                <NumericField
                  label="Target Margin %"
                  value={effectiveTmTargetMarginPct}
                  disabled={!canEdit}
                  onChange={(v) => onOverrideChange({ tmTargetMarginPct: v })}
                />
              </>
            )}

            {effectiveModel === "TIME_AND_MATERIALS" && (
              <>
                <NumericField
                  label="Billable Rate"
                  value={effectiveMatBillableRate}
                  disabled={!canEdit}
                  onChange={(v) => onOverrideChange({ matBillableRate: v })}
                />
                <NumericField
                  label="Discount %"
                  value={effectiveMatDiscountPct}
                  disabled={!canEdit}
                  onChange={(v) => onOverrideChange({ matDiscountPct: v })}
                />
              </>
            )}

            {item.pricingModel && (
              <span className="text-warm-gray-med" style={{ fontSize: 12, paddingBottom: 6 }}>
                Approved: {pricingModelLabel(item.pricingModel)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div
        className="uppercase text-warm-gray-med font-medium"
        style={{ fontSize: 11, letterSpacing: "0.04em", marginBottom: 2 }}
      >
        {label}
      </div>
      <div
        className={emphasis ? "font-semibold text-near-black" : "text-near-black"}
        style={{ fontSize: 14 }}
      >
        {value}
      </div>
    </div>
  );
}

function NumericField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  disabled: boolean;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <label
        className="block text-warm-gray-med"
        style={{ fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}
      >
        {label}
      </label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          onChange(isNaN(parsed) ? null : parsed);
        }}
        className="rounded border text-near-black"
        style={{
          padding: "6px 10px",
          fontSize: 13,
          borderColor: "var(--color-border-strong)",
          width: 120,
          background: disabled ? "var(--color-warm-gray-light)" : "white",
        }}
      />
    </div>
  );
}

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg flex items-start"
      style={{
        background: "rgba(184, 134, 11, 0.07)",
        border: "1px solid rgba(184, 134, 11, 0.35)",
        padding: "12px 16px",
        gap: 10,
        fontSize: 13,
        color: "var(--fg-1)",
      }}
    >
      <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
      <span>{children}</span>
    </div>
  );
}

function NotFoundPanel() {
  return (
    <div className="text-warm-gray-med" style={{ fontSize: 14, padding: "32px 0" }}>
      This request is not available for pricing review.
    </div>
  );
}
