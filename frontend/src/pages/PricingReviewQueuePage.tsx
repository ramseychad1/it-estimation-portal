import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleDollarSign } from "lucide-react";
import { DataTable, type DataTableColumn } from "../components/data-table/DataTable";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import { SecondaryButton } from "../components/buttons";
import { StatusBadge, estimateStatusBadge } from "../components/StatusBadge";
import { usePricingReviewQueueQuery } from "../lib/queries/pricingReview";
import type { EstimateRequestListItem } from "../lib/api/estimates";

const PAGE_SIZE = 25;

const COLUMNS: DataTableColumn<EstimateRequestListItem>[] = [
  {
    key: "title",
    header: "Title",
    render: (row) => (
      <span className="font-medium text-near-black">{row.title}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: 160,
    render: (row) => {
      const { variant, label } = estimateStatusBadge(row.derivedStatus);
      return <StatusBadge variant={variant}>{label}</StatusBadge>;
    },
  },
  {
    key: "items",
    header: "Items",
    width: 70,
    render: (row) => (
      <span className="text-warm-gray-med tabular-nums">{row.itemCount}</span>
    ),
  },
  {
    key: "requester",
    header: "Requester",
    width: 180,
    render: (row) => (
      <span className="text-warm-gray-med">{row.requesterName ?? "—"}</span>
    ),
  },
  {
    key: "updatedAt",
    header: "Last updated",
    width: 140,
    render: (row) =>
      row.updatedAt ? (
        <span className="text-warm-gray-med tabular-nums">
          {new Date(row.updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ) : (
        <span className="text-warm-gray-med">—</span>
      ),
  },
];

export function PricingReviewQueuePage() {
  useEffect(() => {
    document.title = "Pricing Review — Estimator";
  }, []);

  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const queueQuery = usePricingReviewQueueQuery(page, PAGE_SIZE);

  const items = queueQuery.data?.items ?? [];
  const totalPages = queueQuery.data?.totalPages ?? 1;
  const totalElements = queueQuery.data?.totalElements ?? 0;

  return (
    <div>
      <PageHeader title="Pricing Review" />

      <div style={{ marginTop: 24 }}>
        {!queueQuery.isLoading && totalElements === 0 ? (
          <EmptyState
            icon={CircleDollarSign}
            title="No estimates pending pricing review"
            description="Fully-approved estimates will appear here when Revenue & Pricing Review is enabled."
          />
        ) : (
          <>
            <DataTable
              columns={COLUMNS}
              rows={items}
              rowKey={(r) => r.id}
              loading={queueQuery.isLoading}
              onRowClick={(row) => navigate(`/pricing-review/${row.id}`)}
            />

            {totalPages > 1 && (
              <div
                className="flex items-center justify-between mt-3"
                style={{
                  padding: "10px 14px",
                  borderTop: "1px solid var(--color-warm-gray-light)",
                  background: "#FBFBFA",
                  fontSize: 12,
                }}
              >
                <span className="text-warm-gray-med">
                  Page {page + 1} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <SecondaryButton
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </SecondaryButton>
                  <SecondaryButton
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </SecondaryButton>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
