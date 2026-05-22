import { useEffect } from "react";
import { PageHeader } from "../../components/PageHeader";
import { Toggle } from "../../components/Toggle";
import { useAppSettingsQuery, useUpdateAppSettingsMutation } from "../../lib/queries/pricingReview";
import { useToast } from "../../components/Toast";

export function GlobalSettingsPage() {
  useEffect(() => {
    document.title = "Global Settings — Estimator";
  }, []);

  const toast = useToast();
  const settingsQuery = useAppSettingsQuery();
  const updateMutation = useUpdateAppSettingsMutation();

  const settings = settingsQuery.data ?? {};
  const revenueReviewEnabled = settings["revenue_review_enabled"] === "true";

  function handleToggleRevenueReview(next: boolean) {
    updateMutation.mutate(
      { revenue_review_enabled: String(next) },
      {
        onSuccess: () => {
          toast.success(
            next
              ? "Revenue & Pricing Review is now enabled."
              : "Revenue & Pricing Review has been disabled.",
          );
        },
        onError: () => toast.error("Failed to update setting."),
      },
    );
  }

  return (
    <div>
      <PageHeader title="Global Settings" />

      <div style={{ maxWidth: 640, marginTop: 32 }}>
        <section>
          <h2
            className="font-semibold text-near-black"
            style={{ fontSize: 14, marginBottom: 16 }}
          >
            Workflow
          </h2>

          <SettingRow
            label="Revenue & Pricing Review"
            description="When enabled, every fully-approved estimate request is routed to a Revenue Manager for pricing review before it becomes visible to the requester as approved."
          >
            <Toggle
              checked={revenueReviewEnabled}
              onCheckedChange={handleToggleRevenueReview}
              disabled={settingsQuery.isLoading || updateMutation.isPending}
              label="Toggle Revenue & Pricing Review"
            />
          </SettingRow>
        </section>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-start justify-between gap-6"
      style={{
        padding: "16px 0",
        borderBottom: "1px solid var(--color-warm-gray-light)",
      }}
    >
      <div style={{ flex: 1 }}>
        <div className="font-medium text-near-black" style={{ fontSize: 14 }}>
          {label}
        </div>
        <div className="text-warm-gray-med" style={{ fontSize: 13, marginTop: 4 }}>
          {description}
        </div>
      </div>
      <div className="flex-none" style={{ paddingTop: 2 }}>
        {children}
      </div>
    </div>
  );
}
