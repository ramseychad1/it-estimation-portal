import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable, type DataTableColumn } from "../components/data-table/DataTable";
import { EmptyState } from "../components/EmptyState";
import type { TeamWorkloadRow } from "../lib/api/reporting";
import { useTeamWorkloadSummaryQuery } from "../lib/queries/reporting";

const fmtHours = (n: number) =>
  n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 1 });

const fmtCost = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export function TeamWorkloadPage() {
  useEffect(() => {
    document.title = "Team workload — Estimator";
  }, []);

  const navigate = useNavigate();
  const summaryQuery = useTeamWorkloadSummaryQuery();

  const rows = summaryQuery.data ?? [];

  const columns: DataTableColumn<TeamWorkloadRow>[] = [
    {
      key: "teamName",
      header: "Team",
      sortable: false,
      render: (r) => (
        <span className="font-semibold text-near-black" style={{ fontSize: 14 }}>
          {r.teamName}
        </span>
      ),
    },
    {
      key: "memberCount",
      header: "Members",
      align: "right",
      width: 90,
      render: (r) => <span className="tabular-nums text-near-black">{r.memberCount}</span>,
    },
    {
      key: "activeProductCount",
      header: "Active products",
      align: "right",
      width: 130,
      render: (r) => <span className="tabular-nums text-near-black">{r.activeProductCount}</span>,
    },
    {
      key: "totalEstimateRequests",
      // Counts estimate items (product line items), not whole requests —
      // the UX-3 reporting rebuild aggregates per-item state.
      header: "Total items",
      align: "right",
      width: 120,
      render: (r) => <span className="tabular-nums text-near-black">{r.totalEstimateRequests}</span>,
    },
    {
      key: "submittedCount",
      header: "Submitted",
      align: "right",
      width: 100,
      render: (r) => (
        <span className="tabular-nums" style={{ color: r.submittedCount > 0 ? "var(--color-near-black)" : "var(--color-warm-gray-med)" }}>
          {r.submittedCount}
        </span>
      ),
    },
    {
      key: "inReviewCount",
      header: "In review",
      align: "right",
      width: 100,
      render: (r) => (
        <span className="tabular-nums" style={{ color: r.inReviewCount > 0 ? "var(--color-near-black)" : "var(--color-warm-gray-med)" }}>
          {r.inReviewCount}
        </span>
      ),
    },
    {
      key: "approvedCount",
      header: "Approved",
      align: "right",
      width: 100,
      render: (r) => (
        <span className="tabular-nums" style={{ color: r.approvedCount > 0 ? "var(--color-near-black)" : "var(--color-warm-gray-med)" }}>
          {r.approvedCount}
        </span>
      ),
    },
    {
      key: "totalApprovedOnshoreHours",
      header: "Onshore hrs",
      align: "right",
      width: 110,
      render: (r) => (
        <span className="tabular-nums text-near-black" style={{ fontSize: 12 }}>
          {fmtHours(r.totalApprovedOnshoreHours)}
        </span>
      ),
    },
    {
      key: "totalApprovedOffshoreHours",
      header: "Offshore hrs",
      align: "right",
      width: 110,
      render: (r) => (
        <span className="tabular-nums text-near-black" style={{ fontSize: 12 }}>
          {fmtHours(r.totalApprovedOffshoreHours)}
        </span>
      ),
    },
    {
      key: "totalApprovedCost",
      header: "Approved cost",
      align: "right",
      width: 130,
      render: (r) => (
        <span className="tabular-nums font-medium text-near-black" style={{ fontSize: 12 }}>
          {fmtCost(r.totalApprovedCost)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Reports" }, { label: "Team workload" }]}
        title="Team workload"
        subtitle="Estimate request volume and approved cost by team."
      />

      <div className="mt-6">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.teamId}
          loading={summaryQuery.isLoading}
          ariaLabel="Team workload"
          onRowClick={(r) => navigate(`/reports/team-workload/${r.teamId}`)}
          emptyState={
            <EmptyState
              icon={BarChart3}
              title="No team data yet"
              description="Teams with assigned products and submitted estimates will appear here."
            />
          }
        />
      </div>
    </>
  );
}
