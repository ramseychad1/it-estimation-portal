import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { relativeTime } from "../lib/relativeTime";
import { useTeamWorkloadDetailQuery } from "../lib/queries/reporting";

export function TeamWorkloadDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const id = teamId ? Number(teamId) : null;
  const navigate = useNavigate();
  const detailQuery = useTeamWorkloadDetailQuery(id);

  const detail = detailQuery.data;

  useEffect(() => {
    document.title = detail
      ? `${detail.teamName} — Team workload — Estimator`
      : "Team workload — Estimator";
  }, [detail]);

  if (detailQuery.isLoading) {
    return (
      <div className="text-warm-gray-med" style={{ fontSize: 13, padding: "32px 0" }}>
        Loading…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-warm-gray-med" style={{ fontSize: 13, padding: "32px 0" }}>
        Team not found.
      </div>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Reports" },
          { label: "Team workload", to: "/reports/team-workload" },
          { label: detail.teamName },
        ]}
        title={detail.teamName}
        subtitle="Team members, owned products, and recent approved estimates."
        actions={
          <button
            type="button"
            onClick={() => navigate("/reports/team-workload")}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md font-medium text-near-black bg-white hover:bg-warm-gray-light"
            style={{ border: "1px solid var(--color-border-strong)", fontSize: 13 }}
          >
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
            All teams
          </button>
        }
      />

      <div className="flex flex-col gap-6 mt-6">
        {/* Members */}
        <Section title="Members" count={detail.members.length}>
          {detail.members.length === 0 ? (
            <p className="text-warm-gray-med m-0" style={{ fontSize: 13 }}>No members assigned.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {detail.members.map((m) => (
                <div
                  key={m.id}
                  className="inline-flex items-center gap-1.5"
                  style={{
                    padding: "4px 10px",
                    borderRadius: 4,
                    background: "var(--color-warm-gray-light)",
                    fontSize: 13,
                    color: "var(--color-near-black)",
                  }}
                >
                  <span className="font-medium">{m.firstName} {m.lastName}</span>
                  <span className="text-warm-gray-med" style={{ fontSize: 11 }}>{m.email}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Products */}
        <Section title="Active products" count={detail.products.length}>
          {detail.products.length === 0 ? (
            <p className="text-warm-gray-med m-0" style={{ fontSize: 13 }}>No active products assigned.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {detail.products.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid var(--color-warm-gray-light)",
                    borderRadius: 6,
                  }}
                >
                  <div>
                    <span className="font-medium text-near-black" style={{ fontSize: 13 }}>{p.name}</span>
                    {p.description && (
                      <span className="text-warm-gray-med ml-2" style={{ fontSize: 12 }}>{p.description}</span>
                    )}
                  </div>
                  <StatusBadge variant={p.active ? "active" : "inactive"}>
                    {p.active ? "Active" : "Inactive"}
                  </StatusBadge>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Recent approved estimates */}
        <Section title="Recent approved estimates" count={detail.recentApprovedEstimates.length}>
          {detail.recentApprovedEstimates.length === 0 ? (
            <p className="text-warm-gray-med m-0" style={{ fontSize: 13 }}>No approved estimates yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-warm-gray-light)" }}>
                  {["Title", "Product", "Complexity", "Onshore hrs", "Offshore hrs", "Cost", "Approved"].map((h) => (
                    <th
                      key={h}
                      className="text-warm-gray-med font-medium text-left"
                      style={{ fontSize: 11, letterSpacing: "0.04em", padding: "6px 8px" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.recentApprovedEstimates.map((e) => (
                  <tr
                    key={e.id}
                    style={{ borderBottom: "1px solid var(--color-warm-gray-light)" }}
                  >
                    <td className="text-near-black font-medium" style={{ fontSize: 13, padding: "8px 8px" }}>
                      {e.title}
                    </td>
                    <td className="text-warm-gray-med" style={{ fontSize: 12, padding: "8px 8px" }}>
                      {e.productName}
                    </td>
                    <td style={{ padding: "8px 8px" }}>
                      {e.complexity ? (
                        <ComplexityPill complexity={e.complexity} />
                      ) : (
                        <span className="text-warm-gray-med" style={{ fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td className="tabular-nums text-near-black" style={{ fontSize: 12, padding: "8px 8px", textAlign: "right" }}>
                      {e.totalOnshoreHours != null
                        ? e.totalOnshoreHours.toLocaleString(undefined, { maximumFractionDigits: 1 })
                        : "—"}
                    </td>
                    <td className="tabular-nums text-near-black" style={{ fontSize: 12, padding: "8px 8px", textAlign: "right" }}>
                      {e.totalOffshoreHours != null
                        ? e.totalOffshoreHours.toLocaleString(undefined, { maximumFractionDigits: 1 })
                        : "—"}
                    </td>
                    <td className="tabular-nums text-near-black" style={{ fontSize: 12, padding: "8px 8px", textAlign: "right" }}>
                      {e.cost != null
                        ? `$${e.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : "—"}
                    </td>
                    <td className="text-warm-gray-med" style={{ fontSize: 12, padding: "8px 8px" }}>
                      {e.reviewedAt ? relativeTime(e.reviewedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="bg-white rounded-lg"
      style={{ border: "1px solid var(--color-warm-gray-light)" }}
    >
      <header
        className="flex items-center gap-2"
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--color-warm-gray-light)",
        }}
      >
        <h2 className="text-near-black font-semibold m-0" style={{ fontSize: 14 }}>
          {title}
        </h2>
        <span
          className="text-warm-gray-med tabular-nums"
          style={{
            fontSize: 11,
            background: "var(--color-warm-gray-light)",
            padding: "1px 6px",
            borderRadius: 10,
          }}
        >
          {count}
        </span>
      </header>
      <div style={{ padding: "14px 16px" }}>{children}</div>
    </section>
  );
}

function ComplexityPill({ complexity }: { complexity: "LOW" | "MED" | "HIGH" }) {
  const map = {
    LOW: { label: "Low", bg: "var(--color-warm-gray-light)", color: "var(--color-near-black)" },
    MED: { label: "Med", bg: "var(--color-light-blue-soft)", color: "var(--color-near-black)" },
    HIGH: { label: "High", bg: "rgba(184,134,11,0.12)", color: "var(--color-near-black)" },
  };
  const s = map[complexity];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        background: s.bg,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
}
