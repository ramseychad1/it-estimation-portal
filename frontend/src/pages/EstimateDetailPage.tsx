import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText, Pencil, Trash2 } from "lucide-react";
import { ConfirmModal } from "../components/ConfirmModal";
import { EntityHeader } from "../components/EntityHeader";
import { KebabMenu, type KebabMenuItem } from "../components/KebabMenu";
import { SecondaryButton } from "../components/buttons";
import { StatusBadge, estimateStatusBadge } from "../components/StatusBadge";
import { Timeline, TimelineItem } from "../components/Timeline";
import { UserCell } from "../components/UserCell";
import { useToast } from "../components/Toast";
import { ApiError } from "../lib/api";
import {
  type EstimateRequestAnswerView,
  type EstimateRequestDetail,
  type EstimateRequestHistoryItem,
  type EstimateRequestPhaseLineView,
} from "../lib/api/estimates";
import {
  useDiscardDraftMutation,
  useMyRequestHistoryQuery,
  useMyRequestQuery,
} from "../lib/queries/estimates";
import { useUserDisplay } from "../lib/userDisplay";
import { relativeTime } from "../lib/relativeTime";

export function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const numericId = id ? Number(id) : null;
  const navigate = useNavigate();
  const toast = useToast();

  const detailQuery = useMyRequestQuery(numericId);
  const historyQuery = useMyRequestHistoryQuery(numericId);
  const discardMutation = useDiscardDraftMutation();
  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    document.title = detailQuery.data?.title
      ? `${detailQuery.data.title} — Estimator`
      : "Estimate request — Estimator";
  }, [detailQuery.data?.title]);

  // 404 from /api/estimates/my/:id is the privacy posture for both
  // "doesn't exist" and "owned by someone else" — show one banner that
  // doesn't disambiguate.
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
  const { variant, label } = estimateStatusBadge(detail.status);
  const isDraft = detail.status === "DRAFT";
  const isRejected = detail.status === "REJECTED";
  const subtitle = (
    <span>
      {detail.subFeatureName
        ? `${detail.productName} · ${detail.subFeatureName}`
        : detail.productName}
      {" · "}
      <RequesterDisplay userId={detail.requesterId} />
    </span>
  );

  function buildKebab(): KebabMenuItem[] {
    if (!isDraft && !isRejected) return [];
    return [
      {
        label: "Discard",
        icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
        destructive: true,
        onSelect: () => setDiscardOpen(true),
      },
    ];
  }

  const kebabItems = buildKebab();

  function confirmDiscard() {
    if (numericId == null) return;
    discardMutation.mutate(numericId, {
      onSuccess: () => {
        toast.success(`Discarded "${detail.title}".`);
        navigate("/requests");
      },
      onError: () => toast.error("Could not discard that request."),
    });
  }

  return (
    <>
      <EntityHeader
        breadcrumb={[
          { label: "Workspace" },
          { label: "Estimate requests", to: "/requests" },
          { label: detail.title },
        ]}
        title={detail.title}
        titleSuffix={<StatusBadge variant={variant}>{label}</StatusBadge>}
        subtitle={subtitle}
        actions={
          kebabItems.length > 0 ? (
            <KebabMenu items={kebabItems} ariaLabel="Request actions" />
          ) : undefined
        }
      />

      <div className="flex flex-col" style={{ gap: 16, marginTop: 24 }}>
        <SummaryCard detail={detail} />
        <QuestionsCard detail={detail} onEditAnswers={() =>
          navigate(`/requests/new?step=2&id=${detail.id}`)
        } />
        {detail.status !== "DRAFT" && <EstimateCard detail={detail} />}
        <ActivityCard
          history={historyQuery.data ?? []}
          loading={historyQuery.isLoading}
        />
      </div>

      <ConfirmModal
        open={discardOpen}
        title="Discard this draft?"
        body={
          <p className="text-body text-warm-gray-med m-0">
            "{detail.title}" will be permanently deleted. This can't be undone.
          </p>
        }
        confirmLabel="Discard"
        cancelLabel="Keep draft"
        destructive
        onCancel={() => setDiscardOpen(false)}
        onConfirm={confirmDiscard}
      />
    </>
  );
}

// ---- Sub-components ---------------------------------------------------

function Card({
  title,
  headerRight,
  children,
}: {
  title: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="bg-white rounded-lg"
      style={{ border: "1px solid var(--color-warm-gray-light)" }}
    >
      <header
        className="flex items-center justify-between"
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--color-warm-gray-light)",
        }}
      >
        <h2 className="text-near-black font-semibold m-0" style={{ fontSize: 14 }}>
          {title}
        </h2>
        {headerRight}
      </header>
      <div style={{ padding: "16px 16px 18px" }}>{children}</div>
    </section>
  );
}

function SummaryCard({ detail }: { detail: EstimateRequestDetail }) {
  return (
    <Card title="Summary">
      <div className="flex flex-col" style={{ gap: 14 }}>
        {detail.description && (
          <div>
            <div className="text-warm-gray-med uppercase font-medium" style={{ fontSize: 11, letterSpacing: "0.04em" }}>
              Description
            </div>
            <p className="m-0 mt-1 text-near-black" style={{ fontSize: 14 }}>
              {detail.description}
            </p>
          </div>
        )}
        <div className="flex flex-wrap" style={{ gap: 24 }}>
          <KV label="Product">
            {detail.productName}
            {detail.subFeatureName && <> · {detail.subFeatureName}</>}
          </KV>
          {detail.submittedAt && (
            <KV label="Submitted">{relativeTime(detail.submittedAt)}</KV>
          )}
          {detail.templateVersionNumber != null && (
            <KV label="Template version">v{detail.templateVersionNumber}</KV>
          )}
        </div>
      </div>
    </Card>
  );
}

function QuestionsCard({
  detail,
  onEditAnswers,
}: {
  detail: EstimateRequestDetail;
  onEditAnswers: () => void;
}) {
  const isDraft = detail.status === "DRAFT";
  return (
    <Card
      title="Critical questions"
      headerRight={
        <span className="flex items-center" style={{ gap: 12 }}>
          <CountPill count={detail.answers.length} />
          {isDraft && (
            <button
              type="button"
              onClick={onEditAnswers}
              className="inline-flex items-center text-near-black bg-transparent border-0 cursor-pointer hover:underline"
              style={{ fontSize: 12, gap: 4 }}
            >
              <Pencil className="w-3 h-3" strokeWidth={1.5} />
              Edit answers
            </button>
          )}
        </span>
      }
    >
      {detail.answers.length === 0 ? (
        <p className="m-0 text-warm-gray-med" style={{ fontSize: 13 }}>
          No questions for this {detail.subFeatureId ? "sub-feature" : "product"}.
        </p>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col" style={{ gap: 16 }}>
          {detail.answers.map((a) => (
            <AnswerRow key={a.questionId} answer={a} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function AnswerRow({ answer }: { answer: EstimateRequestAnswerView }) {
  return (
    <li>
      <div className="flex items-baseline" style={{ gap: 8 }}>
        <span className="text-near-black font-semibold" style={{ fontSize: 14 }}>
          {answer.questionText}
        </span>
        {answer.required && <RequiredPill />}
      </div>
      <p
        className="m-0 mt-1"
        style={{
          fontSize: 14,
          color: answer.answerText ? "var(--fg-1)" : "var(--color-warm-gray-med)",
          fontStyle: answer.answerText ? undefined : "italic",
          whiteSpace: "pre-wrap",
        }}
      >
        {answer.answerText || "Not answered"}
      </p>
    </li>
  );
}

function EstimateCard({ detail }: { detail: EstimateRequestDetail }) {
  const isAwaitingReview =
    detail.status === "SUBMITTED" || detail.status === "IN_REVIEW";
  return (
    <Card title="Estimate">
      {isAwaitingReview && (
        <div
          className="rounded-md mb-4"
          style={{
            background: "var(--color-light-blue-soft)",
            padding: "10px 12px",
            border: "1px solid rgba(187,221,230,0.7)",
            fontSize: 13,
            color: "var(--fg-1)",
          }}
        >
          This request is awaiting review. The Solution Owner will choose
          complexity and approve.
        </div>
      )}
      {detail.status === "REJECTED" && detail.justification && (
        <RejectionBlock justification={detail.justification} />
      )}
      {detail.status === "APPROVED" && <ApprovedBlock detail={detail} />}
      <PhaseLineTable
        lines={detail.phaseLines}
        complexity={detail.complexity}
      />
    </Card>
  );
}

function RejectionBlock({ justification }: { justification: string }) {
  return (
    <blockquote
      className="m-0 mb-4"
      style={{
        borderLeft: "4px solid var(--color-light-blue)",
        paddingLeft: 12,
        fontStyle: "italic",
        fontSize: 14,
        color: "var(--fg-1)",
      }}
    >
      {justification}
    </blockquote>
  );
}

function ApprovedBlock({ detail }: { detail: EstimateRequestDetail }) {
  // NOTE: This branch is populated by Phase 6b's Reviewer surface — when
  // an SO picks complexity, writes justification, and approves. Phase 6a
  // tests don't exercise this code path because no UI populates the
  // upstream data; the test coverage lives in Phase 6b's page tests.
  // Rendering the block "graceful when data is present" is the contract.
  return (
    <div className="flex flex-col mb-4" style={{ gap: 10 }}>
      {detail.complexity && (
        <div>
          <StatusBadge variant="approved">
            Complexity: {complexityLabel(detail.complexity)}
          </StatusBadge>
        </div>
      )}
      {detail.justification && <RejectionBlock justification={detail.justification} />}
    </div>
  );
}

function PhaseLineTable({
  lines,
  complexity,
}: {
  lines: EstimateRequestPhaseLineView[];
  complexity: EstimateRequestDetail["complexity"];
}) {
  if (lines.length === 0) return null;
  const onCol = complexity === "LOW" ? "onshoreLow" : complexity === "HIGH" ? "onshoreHigh" : "onshoreMed";
  const offCol = complexity === "LOW" ? "offshoreLow" : complexity === "HIGH" ? "offshoreHigh" : "offshoreMed";
  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-warm-gray-light)" }}>
            <Th>Phase</Th>
            <Th align="right" highlight={complexity === "LOW"}>ONS Low</Th>
            <Th align="right" highlight={complexity === "MED"}>ONS Med</Th>
            <Th align="right" highlight={complexity === "HIGH"}>ONS High</Th>
            <Th align="right" highlight={complexity === "LOW"}>OFF Low</Th>
            <Th align="right" highlight={complexity === "MED"}>OFF Med</Th>
            <Th align="right" highlight={complexity === "HIGH"}>OFF High</Th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr
              key={line.sdlcPhaseId}
              style={{ borderBottom: "1px solid var(--color-warm-gray-light)" }}
            >
              <Td>{line.sdlcPhaseName}</Td>
              <Td align="right" highlight={complexity === "LOW"}>{fmt(line.onshoreLow)}</Td>
              <Td align="right" highlight={complexity === "MED"}>{fmt(line.onshoreMed)}</Td>
              <Td align="right" highlight={complexity === "HIGH"}>{fmt(line.onshoreHigh)}</Td>
              <Td align="right" highlight={complexity === "LOW"}>{fmt(line.offshoreLow)}</Td>
              <Td align="right" highlight={complexity === "MED"}>{fmt(line.offshoreMed)}</Td>
              <Td align="right" highlight={complexity === "HIGH"}>{fmt(line.offshoreHigh)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Reference unused col vars so the linter sees them — they're the
          contract for future Phase 6b code that totals the chosen column. */}
      <span hidden data-on={onCol} data-off={offCol} />
    </div>
  );
}

function Th({ children, align = "left", highlight = false }: { children: React.ReactNode; align?: "left" | "right"; highlight?: boolean }) {
  return (
    <th
      className="text-warm-gray-med uppercase font-medium"
      style={{
        textAlign: align,
        padding: "8px 10px",
        fontSize: 11,
        letterSpacing: "0.04em",
        background: highlight ? "var(--color-light-blue-soft)" : undefined,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left", highlight = false }: { children: React.ReactNode; align?: "left" | "right"; highlight?: boolean }) {
  return (
    <td
      className="text-near-black tabular-nums"
      style={{
        textAlign: align,
        padding: "8px 10px",
        background: highlight ? "var(--color-light-blue-soft)" : undefined,
      }}
    >
      {children}
    </td>
  );
}

function ActivityCard({
  history,
  loading,
}: {
  history: EstimateRequestHistoryItem[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card title="Activity">
        <p className="m-0 text-warm-gray-med" style={{ fontSize: 13 }}>
          Loading…
        </p>
      </Card>
    );
  }
  if (history.length === 0) {
    return (
      <Card title="Activity">
        <p className="m-0 text-warm-gray-med" style={{ fontSize: 13 }}>
          No activity recorded yet.
        </p>
      </Card>
    );
  }
  return (
    <Card title="Activity">
      <Timeline>
        {history.map((entry) => (
          <TimelineItem
            key={entry.id}
            avatar={<TimelineAvatar userId={entry.changedBy} />}
          >
            <div className="pb-4">
              <div className="text-near-black" style={{ fontSize: 13 }}>
                <strong>{actionLabel(entry.action)}</strong>
                {entry.notes ? <> · {entry.notes}</> : null}
              </div>
              <div className="text-warm-gray-med mt-0.5" style={{ fontSize: 12 }}>
                <UserCell userId={entry.changedBy} size={14} />
                <span style={{ marginLeft: 4 }}>· {relativeTime(entry.changedAt)}</span>
              </div>
            </div>
          </TimelineItem>
        ))}
      </Timeline>
    </Card>
  );
}

function TimelineAvatar({ userId }: { userId: number | null }) {
  const { data } = useUserDisplay(userId);
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: data?.avatarColor ?? "var(--color-warm-gray-med)",
        color: "var(--color-white)",
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      {data?.initials ?? "?"}
    </span>
  );
}

function NotFoundPanel() {
  const navigate = useNavigate();
  return (
    <div
      className="rounded-lg text-center"
      style={{
        border: "1px dashed var(--color-border-strong)",
        background: "#FBFBFA",
        padding: "80px 24px",
        marginTop: 24,
      }}
    >
      <FileText
        className="mx-auto mb-3 text-warm-gray-med"
        style={{ width: 32, height: 32 }}
        strokeWidth={1.5}
      />
      <p className="m-0 text-near-black font-semibold" style={{ fontSize: 18 }}>
        Request not found
      </p>
      <p className="m-0 mt-2 text-warm-gray-med" style={{ fontSize: 14, maxWidth: 380, marginInline: "auto" }}>
        This estimate request doesn't exist or you don't have access to it.
      </p>
      <div className="mt-4 flex justify-center">
        <SecondaryButton onClick={() => navigate("/requests")}>
          Back to my requests
        </SecondaryButton>
      </div>
    </div>
  );
}

function RequiredPill() {
  return (
    <span
      className="inline-flex items-center text-near-black"
      style={{
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        background: "var(--color-warm-gray-light)",
        border: "1px solid var(--color-border-strong)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      Required
    </span>
  );
}

function CountPill({ count }: { count: number }) {
  return (
    <span
      className="inline-flex items-center justify-center text-warm-gray-med tabular-nums"
      style={{
        minWidth: 22,
        height: 18,
        padding: "0 6px",
        borderRadius: 9,
        fontSize: 11,
        fontWeight: 600,
        background: "var(--color-warm-gray-light)",
      }}
    >
      {count}
    </span>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-warm-gray-med uppercase font-medium" style={{ fontSize: 11, letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div className="text-near-black mt-1" style={{ fontSize: 14 }}>
        {children}
      </div>
    </div>
  );
}

function RequesterDisplay({ userId }: { userId: number | null }) {
  const { data } = useUserDisplay(userId);
  return <span>{data?.name ?? "Requester"}</span>;
}

function fmt(n: number | null): string {
  if (n == null) return "—";
  // tabular-nums + a sane decimal display: drop trailing .00 for whole numbers.
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function complexityLabel(c: "LOW" | "MED" | "HIGH"): string {
  return c === "MED" ? "Medium" : c === "LOW" ? "Low" : "High";
}

function actionLabel(action: string): string {
  switch (action) {
    case "CREATED": return "Created";
    case "UPDATED": return "Updated";
    case "DELETED": return "Discarded";
    default: return action;
  }
}

