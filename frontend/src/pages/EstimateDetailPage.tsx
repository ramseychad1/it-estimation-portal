import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle, ChevronDown, Clock, Download, FileText, Info, Pencil, Trash2 } from "lucide-react";
import { downloadAttachment } from "../lib/api/documents";
import { ConfirmModal } from "../components/ConfirmModal";
import { EntityHeader } from "../components/EntityHeader";
import { KebabMenu, type KebabMenuItem } from "../components/KebabMenu";
import { PrimaryButton, SecondaryButton } from "../components/buttons";
import { StatusBadge, estimateStatusBadge } from "../components/StatusBadge";
import { Timeline, TimelineItem } from "../components/Timeline";
import { UserCell } from "../components/UserCell";
import { useToast } from "../components/Toast";
import { ApiError } from "../lib/api";
import {
  type AnswerInput,
  type EstimateRequestAnswerView,
  type EstimateRequestDetail,
  type EstimateRequestHistoryItem,
  type EstimateRequestItemDto,
  type EstimateRequestPhaseLineView,
  type ReviseAndResubmitRequest,
} from "../lib/api/estimates";
import type { ProductListItem } from "../lib/api/products";
import {
  useDiscardDraftMutation,
  useDropItemMutation,
  useMyRequestHistoryQuery,
  useMyRequestQuery,
  useReviseAndResubmitMutation,
} from "../lib/queries/estimates";
import { useProductsQuery } from "../lib/queries/products";
import { useSubFeaturesForProductQuery } from "../lib/queries/subFeatures";
import { useRatesPageQuery } from "../lib/queries/rates";
import { useUserDisplay } from "../lib/userDisplay";
import { relativeTime } from "../lib/relativeTime";
import {
  displayedRow,
  offshoreHoursForLines,
  onshoreHoursForLines,
  totalCostForLines,
  totalHoursForLines,
} from "../lib/estimateMath";

export function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const numericId = id ? Number(id) : null;
  const navigate = useNavigate();
  const toast = useToast();

  const detailQuery = useMyRequestQuery(numericId);
  const historyQuery = useMyRequestHistoryQuery(numericId);
  const ratesQuery = useRatesPageQuery({ size: 1 });
  const discardMutation = useDiscardDraftMutation();
  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    document.title = detailQuery.data?.title
      ? `${detailQuery.data.title} — Estimator`
      : "Estimate request — Estimator";
  }, [detailQuery.data?.title]);

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
  const { variant, label } = estimateStatusBadge(detail.derivedStatus);

  const isDraft = detail.derivedStatus === "DRAFT";
  const isSubmitted = detail.derivedStatus === "SUBMITTED";
  const isInReview = detail.derivedStatus === "IN_REVIEW";
  const isNeedsRevision = detail.derivedStatus === "NEEDS_REVISION";
  const isApproved = detail.derivedStatus === "APPROVED";
  const isPartiallyApproved = detail.derivedStatus === "PARTIALLY_APPROVED";

  // Subtitle: first product + overflow count + requester name
  const firstItem = detail.items[0];
  const subtitle = (
    <span>
      {firstItem?.subFeatureName
        ? `${firstItem.productName} · ${firstItem.subFeatureName}`
        : firstItem?.productName ?? ""}
      {detail.items.length > 1 && ` (+${detail.items.length - 1} more)`}
      {" · "}
      <RequesterDisplay userId={detail.requesterId} />
    </span>
  );

  function buildKebab(): KebabMenuItem[] {
    if (!isDraft && !isNeedsRevision) return [];
    return [
      {
        label: "Discard",
        icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
        destructive: true,
        onSelect: () => setDiscardOpen(true),
      },
    ];
  }

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

  const header = (
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
        buildKebab().length > 0 ? (
          <KebabMenu items={buildKebab()} ariaLabel="Request actions" />
        ) : undefined
      }
    />
  );

  const discardModal = (
    <ConfirmModal
      open={discardOpen}
      title={isDraft ? "Discard this draft?" : "Discard this request?"}
      body={
        <p className="text-body text-warm-gray-med m-0">
          "{detail.title}" will be permanently deleted. This can't be undone.
        </p>
      }
      confirmLabel="Discard"
      cancelLabel="Cancel"
      destructive
      onCancel={() => setDiscardOpen(false)}
      onConfirm={confirmDiscard}
    />
  );

  const currentRate = ratesQuery.data?.current ?? null;

  // ── NEEDS_REVISION ─────────────────────────────────────────────────────────
  if (isNeedsRevision) {
    return (
      <>
        {header}
        <div className="flex flex-col" style={{ gap: 16, marginTop: 24 }}>
          {detail.description && (
            <Card title="Description">
              <p className="m-0 text-near-black" style={{ fontSize: 14 }}>
                {detail.description}
              </p>
            </Card>
          )}
          {detail.items.map((it) => (
            <ItemRevisionCard
              key={it.id}
              item={it}
              requestId={detail.id}
              currentRate={currentRate}
              onDiscardRequested={() => setDiscardOpen(true)}
            />
          ))}
          <ActivityCard history={historyQuery.data ?? []} loading={historyQuery.isLoading} />
        </div>
        {discardModal}
      </>
    );
  }

  // ── SUBMITTED / IN_REVIEW — confirmation view, no estimate grid ────────────
  if (isSubmitted || isInReview) {
    return (
      <>
        {header}
        <div className="flex flex-col" style={{ gap: 16, marginTop: 24 }}>
          <RequestSummaryCard detail={detail} />
          <PendingReviewPanel status={detail.derivedStatus} />
          {detail.items.map((it) => (
            <SubmittedItemCard key={it.id} item={it} />
          ))}
          <ActivityCard history={historyQuery.data ?? []} loading={historyQuery.isLoading} />
        </div>
        {discardModal}
      </>
    );
  }

  // ── APPROVED / PARTIALLY_APPROVED / REJECTED ──────────────────────────────
  if (isApproved || isPartiallyApproved || detail.derivedStatus === "REJECTED") {
    const rateHasChanged = currentRate != null && detail.items.some(
      (it) => it.status === "APPROVED" &&
              it.approvedBlendedRateId != null &&
              it.approvedBlendedRateId !== currentRate.id,
    );
    return (
      <>
        {header}
        <div className="flex flex-col" style={{ gap: 16, marginTop: 24 }}>
          <RequestSummaryCard detail={detail} />
          {rateHasChanged && (
            <div
              className="rounded-lg flex items-start"
              style={{
                background: "rgba(247, 228, 173, 0.4)",
                border: "1px solid rgba(212, 167, 44, 0.3)",
                padding: "12px 16px",
                gap: 10,
                fontSize: 13,
                color: "var(--fg-1)",
              }}
            >
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              <span>
                Rates have changed since this estimate was approved — costs shown reflect the current rate and may differ from the approved amount.
              </span>
            </div>
          )}
          <EstimateRollupCard items={detail.items} currentRate={currentRate} />
          {detail.items.map((it) => (
            <CollapsibleApprovedItemCard key={it.id} item={it} currentRate={currentRate} />
          ))}
          <ActivityCard history={historyQuery.data ?? []} loading={historyQuery.isLoading} />
        </div>
        {discardModal}
      </>
    );
  }

  // ── DRAFT ─────────────────────────────────────────────────────────────────
  return (
    <>
      {header}
      <div className="flex flex-col" style={{ gap: 16, marginTop: 24 }}>
        <RequestSummaryCard detail={detail} />
        {detail.items.map((it) => (
          <DraftItemCard
            key={it.id}
            item={it}
            onEditAnswers={() => navigate(`/requests/new?step=2&id=${detail.id}`)}
          />
        ))}
        <ActivityCard history={historyQuery.data ?? []} loading={historyQuery.isLoading} />
      </div>
      {discardModal}
    </>
  );
}

// ── Shared card shell ──────────────────────────────────────────────────────

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

// ── Request-level summary (metadata only, no per-item product info) ────────

function RequestSummaryCard({ detail }: { detail: EstimateRequestDetail }) {
  const allSubmitted = detail.items
    .map((it) => it.submittedAt)
    .filter(Boolean)
    .sort()
    .at(0);

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
          <KV label="Products">
            {detail.items.length === 1
              ? (detail.items[0].subFeatureName
                  ? `${detail.items[0].productName} · ${detail.items[0].subFeatureName}`
                  : detail.items[0].productName)
              : (
                <ul className="m-0 p-0 list-none flex flex-col" style={{ gap: 2 }}>
                  {detail.items.map((it) => (
                    <li key={it.id} style={{ fontSize: 14 }}>
                      {it.subFeatureName ? `${it.productName} · ${it.subFeatureName}` : it.productName}
                      {it.teamName && (
                        <span className="text-warm-gray-med" style={{ fontSize: 12, marginLeft: 6 }}>
                          ({it.teamName})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )
            }
          </KV>
          <KV label="Go Live Date">
            {detail.goLiveDate
              ? new Date(detail.goLiveDate + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
              : <span className="text-warm-gray-med italic">Unknown</span>
            }
          </KV>
          {allSubmitted && (
            <KV label="Submitted">{relativeTime(allSubmitted)}</KV>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Pending review panel (SUBMITTED / IN_REVIEW) ──────────────────────────

function PendingReviewPanel({ status }: { status: string }) {
  const isInReview = status === "IN_REVIEW";
  return (
    <div
      className="rounded-lg flex items-start"
      style={{
        background: "var(--color-light-blue-soft)",
        border: "1px solid rgba(187,221,230,0.7)",
        padding: "14px 16px",
        gap: 12,
      }}
    >
      <Clock
        className="flex-shrink-0 mt-0.5"
        style={{ width: 16, height: 16, color: "var(--fg-1)" }}
        strokeWidth={1.5}
      />
      <div>
        <p className="m-0 text-near-black font-semibold" style={{ fontSize: 14 }}>
          {isInReview ? "Under review" : "Awaiting review"}
        </p>
        <p className="m-0 mt-1 text-near-black" style={{ fontSize: 13 }}>
          {isInReview
            ? "A Solution Owner has started reviewing this request. You'll be notified when a decision is made."
            : "Your request has been submitted and is in the review queue. A Solution Owner will claim and review each item."}
        </p>
      </div>
    </div>
  );
}

// ── Per-item card: SUBMITTED / IN_REVIEW (read-only confirmation) ──────────

function SubmittedItemCard({ item }: { item: EstimateRequestItemDto }) {
  const title = item.subFeatureName
    ? `${item.productName} · ${item.subFeatureName}`
    : item.productName;

  const { variant, label } = estimateStatusBadge(item.status);

  return (
    <Card
      title={title}
      headerRight={
        <div className="flex items-center" style={{ gap: 8 }}>
          {item.teamName && (
            <span className="text-warm-gray-med" style={{ fontSize: 12 }}>{item.teamName}</span>
          )}
          <StatusBadge variant={variant}>{label}</StatusBadge>
        </div>
      }
    >
      <ItemAnswerList answers={item.answers} />
    </Card>
  );
}

// ── Per-item card: DRAFT ───────────────────────────────────────────────────

function DraftItemCard({
  item,
  onEditAnswers,
}: {
  item: EstimateRequestItemDto;
  onEditAnswers: () => void;
}) {
  const title = item.subFeatureName
    ? `${item.productName} · ${item.subFeatureName}`
    : item.productName;

  const answerCount = item.answers.length;

  return (
    <Card
      title={title}
      headerRight={
        <div className="flex items-center" style={{ gap: 12 }}>
          <CountPill count={answerCount} />
          <button
            type="button"
            onClick={onEditAnswers}
            className="inline-flex items-center text-near-black bg-transparent border-0 cursor-pointer hover:underline"
            style={{ fontSize: 12, gap: 4 }}
          >
            <Pencil className="w-3 h-3" strokeWidth={1.5} />
            Edit answers
          </button>
        </div>
      }
    >
      <ItemAnswerList answers={item.answers} />
    </Card>
  );
}

// ── Invoice-style rollup table (APPROVED items only) ──────────────────────

function EstimateRollupCard({
  items,
  currentRate,
}: {
  items: EstimateRequestItemDto[];
  currentRate: { onshoreRate: string; offshoreRate: string; effectiveDate: string } | null;
}) {
  const approvedRows = items.filter(
    (it) => it.status === "APPROVED" && it.complexity != null,
  );
  if (approvedRows.length === 0) return null;

  const rowData = approvedRows.map((it) => ({
    it,
    ons: onshoreHoursForLines(it.phaseLines, it.complexity),
    offs: offshoreHoursForLines(it.phaseLines, it.complexity),
    total: totalHoursForLines(it.phaseLines, it.complexity),
    cost: totalCostForLines(it.phaseLines, it.complexity, currentRate),
  }));

  const sumOns = rowData.reduce((s, r) => s + r.ons, 0);
  const sumOffs = rowData.reduce((s, r) => s + r.offs, 0);
  const sumTotal = rowData.reduce((s, r) => s + r.total, 0);
  const sumCost = rowData.reduce((s, r) => s + r.cost, 0);

  const footerStyle = {
    background: "var(--color-warm-gray-light)",
    borderTop: "2px solid var(--color-border-strong)",
  };

  return (
    <Card title="Estimate Summary">
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-warm-gray-light)" }}>
              <Th>Product / Sub-feature</Th>
              <Th align="right">Onshore Hrs</Th>
              <Th align="right">Offshore Hrs</Th>
              <Th align="right">Total Hrs</Th>
              {currentRate && <Th align="right">Total Estimate</Th>}
            </tr>
          </thead>
          <tbody>
            {rowData.map(({ it, ons, offs, total, cost }) => (
              <tr key={it.id} style={{ borderBottom: "1px solid var(--color-warm-gray-light)" }}>
                <Td>
                  <span className="font-medium text-near-black">
                    {it.subFeatureName ? `${it.productName} · ${it.subFeatureName}` : it.productName}
                  </span>
                  {it.teamName && (
                    <span className="text-warm-gray-med" style={{ fontSize: 12, marginLeft: 6 }}>
                      ({it.teamName})
                    </span>
                  )}
                </Td>
                <Td align="right"><span className="tabular-nums">{fmtHrs(ons)}</span></Td>
                <Td align="right"><span className="tabular-nums">{fmtHrs(offs)}</span></Td>
                <Td align="right"><span className="tabular-nums">{fmtHrs(total)}</span></Td>
                {currentRate && (
                  <Td align="right"><span className="tabular-nums">${fmtMoney(cost)}</span></Td>
                )}
              </tr>
            ))}
            <tr style={footerStyle}>
              <Td>
                <span className="uppercase font-semibold text-near-black" style={{ fontSize: 11, letterSpacing: "0.06em" }}>
                  Total
                </span>
              </Td>
              <Td align="right"><span className="font-semibold tabular-nums">{fmtHrs(sumOns)}</span></Td>
              <Td align="right"><span className="font-semibold tabular-nums">{fmtHrs(sumOffs)}</span></Td>
              <Td align="right"><span className="font-semibold tabular-nums">{fmtHrs(sumTotal)}</span></Td>
              {currentRate && (
                <Td align="right">
                  <span className="font-semibold tabular-nums">${fmtMoney(sumCost)}</span>
                </Td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
      {currentRate && (
        <p className="m-0 mt-3 text-warm-gray-med" style={{ fontSize: 11 }}>
          Based on blended rates effective {currentRate.effectiveDate}.
        </p>
      )}
    </Card>
  );
}

// ── Collapsible per-item card: APPROVED / PARTIALLY_APPROVED / REJECTED ────

function CollapsibleApprovedItemCard({
  item,
  currentRate,
}: {
  item: EstimateRequestItemDto;
  currentRate: { onshoreRate: string; offshoreRate: string; effectiveDate: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const title = item.subFeatureName
    ? `${item.productName} · ${item.subFeatureName}`
    : item.productName;
  const { variant, label } = estimateStatusBadge(item.status);
  const isApproved = item.status === "APPROVED";
  const isRejected = item.status === "REJECTED";

  return (
    <section
      className="bg-white rounded-lg"
      style={{ border: "1px solid var(--color-warm-gray-light)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left bg-transparent border-0 cursor-pointer"
        style={{
          padding: "12px 16px",
          borderBottom: open ? "1px solid var(--color-warm-gray-light)" : "none",
          borderRadius: open ? 0 : undefined,
        }}
      >
        <div className="flex items-center" style={{ gap: 8 }}>
          <span className="text-near-black font-semibold" style={{ fontSize: 14 }}>
            {title}
          </span>
          {item.teamName && (
            <span className="text-warm-gray-med" style={{ fontSize: 12 }}>{item.teamName}</span>
          )}
          <StatusBadge variant={variant}>{label}</StatusBadge>
        </div>
        <ChevronDown
          className="text-warm-gray-med flex-shrink-0"
          style={{
            width: 16,
            height: 16,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 150ms ease",
          }}
          strokeWidth={1.5}
        />
      </button>
      {open && (
        <div style={{ padding: "16px 16px 18px" }}>
          {isApproved && (
            <div
              className="rounded-md mb-4 flex items-center"
              style={{ background: "var(--color-light-blue-soft)", border: "1px solid rgba(187,221,230,0.7)", padding: "10px 12px", fontSize: 13, color: "var(--fg-1)", gap: 8 }}
            >
              <CheckCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>
                Approved by <strong>{item.reviewerName ?? "the reviewer"}</strong>
                {item.reviewedAt && <> on {new Date(item.reviewedAt).toLocaleDateString()}</>}.
              </span>
            </div>
          )}
          {isRejected && (
            <div
              className="rounded-md mb-4 flex items-start"
              style={{ background: "rgba(247, 228, 173, 0.4)", border: "1px solid rgba(212, 167, 44, 0.3)", padding: "10px 12px", fontSize: 13, color: "var(--fg-1)", gap: 8 }}
            >
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              <span>
                Rejected by <strong>{item.reviewerName ?? "the reviewer"}</strong>
                {item.reviewedAt && <> on {new Date(item.reviewedAt).toLocaleDateString()}</>}.
                {item.rejectionReason && <> <span className="italic">{item.rejectionReason}</span></>}
              </span>
            </div>
          )}
          {!isApproved && !isRejected && (
            <div
              className="rounded-md mb-4 flex items-center"
              style={{ background: "var(--color-light-blue-soft)", border: "1px solid rgba(187,221,230,0.7)", padding: "10px 12px", fontSize: 13, color: "var(--fg-1)", gap: 8 }}
            >
              <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>This item is still awaiting review.</span>
            </div>
          )}
          {isApproved && item.complexity && (
            <div className="mb-4">
              <SectionLabel>Complexity</SectionLabel>
              <div className="mt-1">
                <StatusBadge variant="approved">{complexityLabel(item.complexity)}</StatusBadge>
              </div>
            </div>
          )}
          {item.justification && (
            <div className="mb-4">
              <SectionLabel>{isRejected ? "Rejection reason" : "Reviewer's justification"}</SectionLabel>
              <blockquote
                className="m-0 mt-1"
                style={{ borderLeft: "4px solid var(--color-light-blue)", paddingLeft: 12, fontStyle: "italic", fontSize: 14, color: "var(--fg-1)" }}
              >
                {item.justification}
              </blockquote>
            </div>
          )}
          {isApproved && item.complexity && item.phaseLines.length > 0 && (
            <PhaseLineTable lines={item.phaseLines} complexity={item.complexity} currentRate={currentRate} />
          )}
          {isApproved && item.complexity && currentRate && (
            <CostSummary lines={item.phaseLines} complexity={item.complexity} currentRate={currentRate} />
          )}
        </div>
      )}
    </section>
  );
}

// ── Shared answer list ─────────────────────────────────────────────────────

function ItemAnswerList({ answers }: { answers: EstimateRequestAnswerView[] }) {
  if (answers.length === 0) {
    return (
      <p className="m-0 text-warm-gray-med" style={{ fontSize: 13 }}>
        No questions for this item.
      </p>
    );
  }
  return (
    <ul className="m-0 p-0 list-none flex flex-col" style={{ gap: 14 }}>
      {answers.map((a) => (
        <li key={a.questionId}>
          <div className="flex items-baseline" style={{ gap: 8 }}>
            <span className="text-near-black font-semibold" style={{ fontSize: 13 }}>
              {a.questionText}
            </span>
            {a.required && <RequiredPill />}
          </div>
          <p
            className="m-0 mt-1"
            style={{
              fontSize: 13,
              color: a.answerText ? "var(--fg-1)" : "var(--color-warm-gray-med)",
              fontStyle: a.answerText ? undefined : "italic",
              whiteSpace: "pre-wrap",
            }}
          >
            {a.answerText || "Not answered"}
          </p>
          {a.attachment && (
            <button
              type="button"
              onClick={() => void downloadAttachment(a.attachment!.id, a.attachment!.originalFilename)}
              className="flex items-center gap-1.5 mt-1.5 hover:underline"
              style={{ fontSize: 12, color: "var(--fg-2)", background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              <Download className="w-3 h-3" strokeWidth={2} />
              {a.attachment.originalFilename}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

// ── Phase line table ───────────────────────────────────────────────────────

function PhaseLineTable({
  lines,
  complexity,
  currentRate,
}: {
  lines: EstimateRequestPhaseLineView[];
  complexity: import("../lib/api/estimates").Complexity | null;
  currentRate: { onshoreRate: string; offshoreRate: string } | null;
}) {
  if (lines.length === 0) return null;
  if (complexity == null) return null;

  const onsRate = currentRate ? Number(currentRate.onshoreRate) : 0;
  const offsRate = currentRate ? Number(currentRate.offshoreRate) : 0;
  const showCost = currentRate != null;

  const rows = lines.map((line) => {
    const d = displayedRow(line, complexity);
    const snap = {
      onshore: complexity === "LOW" ? line.onshoreLow : complexity === "MED" ? line.onshoreMed : line.onshoreHigh,
      offshore: complexity === "LOW" ? line.offshoreLow : complexity === "MED" ? line.offshoreMed : line.offshoreHigh,
    };
    return { line, d, snap };
  });

  const totalOnshore = rows.reduce((s, r) => s + r.d.onshore, 0);
  const totalOffshore = rows.reduce((s, r) => s + r.d.offshore, 0);
  const grandHrs = Math.ceil(totalOnshore + totalOffshore);
  const grandCost = Math.ceil(totalOnshore * onsRate + totalOffshore * offsRate);
  const totalOnshoreCost = Math.ceil(totalOnshore * onsRate);
  const totalOffshoreCost = Math.ceil(totalOffshore * offsRate);

  const footerStyle = { background: "var(--color-warm-gray-light)", borderTop: "1px solid var(--color-border-strong)" };
  const footerLabel = { fontSize: 11 as const, letterSpacing: "0.06em" };

  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--color-warm-gray-light)" }}>
            <Th>Phase</Th>
            <Th align="right">Onshore Hours</Th>
            <Th align="right">Offshore Hours</Th>
            <Th align="right">Total Hrs</Th>
            {showCost && <Th align="right">Total $</Th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ line, d, snap }) => {
            const rowHrs = Math.ceil(d.onshore + d.offshore);
            const rowCost = Math.ceil(d.onshore * onsRate + d.offshore * offsRate);
            return (
              <tr key={line.sdlcPhaseId} style={{ borderBottom: "1px solid var(--color-warm-gray-light)" }}>
                <Td>{line.sdlcPhaseName}</Td>
                <Td align="right">
                  <OverrideCell value={d.onshore} overridden={d.onshoreOverridden} snapshotValue={snap.onshore} />
                </Td>
                <Td align="right">
                  <OverrideCell value={d.offshore} overridden={d.offshoreOverridden} snapshotValue={snap.offshore} />
                </Td>
                <Td align="right"><span className="tabular-nums">{rowHrs}</span></Td>
                {showCost && (
                  <Td align="right"><span className="tabular-nums">${rowCost.toLocaleString()}</span></Td>
                )}
              </tr>
            );
          })}
          <tr style={footerStyle}>
            <Td><span className="uppercase font-medium text-warm-gray-med" style={footerLabel}>Grand total</span></Td>
            <Td align="right"><span className="font-semibold tabular-nums">{Math.ceil(totalOnshore)}</span></Td>
            <Td align="right"><span className="font-semibold tabular-nums">{Math.ceil(totalOffshore)}</span></Td>
            <Td align="right"><span className="font-semibold tabular-nums">{grandHrs}</span></Td>
            {showCost && <Td align="right"><span className="font-semibold tabular-nums">${grandCost.toLocaleString()}</span></Td>}
          </tr>
          {showCost && (
            <tr style={footerStyle}>
              <Td><span className="uppercase font-medium text-warm-gray-med" style={footerLabel}>Estimate Total $</span></Td>
              <Td align="right"><span className="font-semibold tabular-nums">${totalOnshoreCost.toLocaleString()}</span></Td>
              <Td align="right"><span className="font-semibold tabular-nums">${totalOffshoreCost.toLocaleString()}</span></Td>
              <Td align="right"><span className="font-semibold tabular-nums">{grandHrs}</span></Td>
              <Td align="right"><span className="font-semibold tabular-nums">${grandCost.toLocaleString()}</span></Td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function OverrideCell({ value, overridden, snapshotValue }: { value: number; overridden: boolean; snapshotValue: number }) {
  return (
    <span className="inline-flex items-center justify-end tabular-nums" style={{ gap: 4 }} title={overridden ? `Original: ${fmt(snapshotValue)}` : undefined}>
      {fmt(value)}
      {overridden && (
        <span
          className="inline-flex items-center text-near-black"
          style={{ padding: "0 4px", borderRadius: 3, fontSize: 9, fontWeight: 600, background: "var(--color-light-blue-soft)", border: "1px solid rgba(187,221,230,0.7)", textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.2 }}
        >
          Override
        </span>
      )}
    </span>
  );
}

function CostSummary({
  lines,
  complexity,
  currentRate,
}: {
  lines: EstimateRequestPhaseLineView[];
  complexity: import("../lib/api/estimates").Complexity | null;
  currentRate: { onshoreRate: string; offshoreRate: string; effectiveDate: string } | null;
}) {
  if (!currentRate || !complexity) return null;
  const onsHrs = onshoreHoursForLines(lines, complexity);
  const offsHrs = offshoreHoursForLines(lines, complexity);
  const totalHrs = totalHoursForLines(lines, complexity);
  const totalCst = totalCostForLines(lines, complexity, currentRate);
  return (
    <div className="mt-4 rounded-md" style={{ background: "#FBFBFA", border: "1px solid var(--color-warm-gray-light)", padding: "14px 16px" }}>
      <div className="flex flex-col" style={{ gap: 6, fontSize: 13 }}>
        <div className="flex items-baseline justify-between">
          <span className="text-warm-gray-med">Onshore total</span>
          <span className="text-near-black tabular-nums">
            {fmtHrs(onsHrs)} hrs × ${currentRate.onshoreRate} = ${fmtMoney(onsHrs * Number(currentRate.onshoreRate))}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-warm-gray-med">Offshore total</span>
          <span className="text-near-black tabular-nums">
            {fmtHrs(offsHrs)} hrs × ${currentRate.offshoreRate} = ${fmtMoney(offsHrs * Number(currentRate.offshoreRate))}
          </span>
        </div>
        <div className="flex items-baseline justify-between" style={{ borderTop: "1px solid var(--color-warm-gray-light)", paddingTop: 6, marginTop: 4 }}>
          <span className="text-near-black font-semibold">Estimated total</span>
          <span className="text-near-black font-semibold tabular-nums" style={{ fontSize: 16 }}>
            {fmtHrs(totalHrs)} hours
            <span className="text-warm-gray-med" style={{ marginLeft: 12, fontSize: 13, fontWeight: 400 }}>
              ${fmtMoney(totalCst)}
            </span>
          </span>
        </div>
        <p className="m-0 text-warm-gray-med" style={{ fontSize: 11, marginTop: 6 }}>
          This estimate uses blended rates effective {currentRate.effectiveDate}.
          Future rate changes do not affect this estimate.
        </p>
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className="text-warm-gray-med uppercase font-medium" style={{ textAlign: align, padding: "8px 10px", fontSize: 11, letterSpacing: "0.04em" }}>
      {children}
    </th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td className="text-near-black tabular-nums" style={{ textAlign: align, padding: "8px 10px" }}>
      {children}
    </td>
  );
}

// ── Activity card ──────────────────────────────────────────────────────────

function ActivityCard({ history, loading }: { history: EstimateRequestHistoryItem[]; loading: boolean }) {
  if (loading) {
    return <Card title="Activity"><p className="m-0 text-warm-gray-med" style={{ fontSize: 13 }}>Loading…</p></Card>;
  }
  if (history.length === 0) {
    return <Card title="Activity"><p className="m-0 text-warm-gray-med" style={{ fontSize: 13 }}>No activity recorded yet.</p></Card>;
  }
  return (
    <Card title="Activity">
      <Timeline>
        {history.map((entry) => (
          <TimelineItem key={entry.id} avatar={<TimelineAvatar userId={entry.changedBy} />}>
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
      style={{ width: 20, height: 20, borderRadius: "50%", background: data?.avatarColor ?? "var(--color-warm-gray-med)", color: "var(--color-white)", fontSize: 10, fontWeight: 600 }}
    >
      {data?.initials ?? "?"}
    </span>
  );
}

// ── NEEDS_REVISION per-item card (Phase 9b — unchanged) ───────────────────

interface ItemRevisionCardProps {
  item: EstimateRequestItemDto;
  requestId: number;
  currentRate: { onshoreRate: string; offshoreRate: string; effectiveDate: string } | null;
  onDiscardRequested: () => void;
}

function ItemRevisionCard({ item, requestId, currentRate, onDiscardRequested }: ItemRevisionCardProps) {
  const toast = useToast();
  const reviseMutation = useReviseAndResubmitMutation();
  const dropMutation = useDropItemMutation();

  const [editMode, setEditMode] = useState(false);
  const [localAnswers, setLocalAnswers] = useState<Map<number, string>>(() =>
    new Map(item.answers.map((a) => [a.questionId, a.answerText])),
  );
  const [changeProductOpen, setChangeProductOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number>(item.productId);
  const [selectedSubFeatureId, setSelectedSubFeatureId] = useState<number | null>(item.subFeatureId);
  const [dropConfirmOpen, setDropConfirmOpen] = useState(false);
  const [lastItemError, setLastItemError] = useState(false);

  useEffect(() => {
    if (!editMode) {
      setLocalAnswers(new Map(item.answers.map((a) => [a.questionId, a.answerText])));
      setSelectedProductId(item.productId);
      setSelectedSubFeatureId(item.subFeatureId);
    }
  }, [item.id, item.status, editMode]);

  const isRejected = item.status === "REJECTED";
  const { variant: statusVariant, label: statusLabel } = estimateStatusBadge(item.status);
  const itemTitle = item.subFeatureName ? `${item.productName} · ${item.subFeatureName}` : item.productName;

  function submitRevision() {
    const answers: AnswerInput[] = item.answers.map((a) => ({
      questionId: a.questionId,
      answerText: localAnswers.get(a.questionId) ?? "",
    }));
    const body: ReviseAndResubmitRequest = {
      ...(selectedProductId !== item.productId && { productId: selectedProductId }),
      ...(selectedSubFeatureId !== item.subFeatureId && { subFeatureId: selectedSubFeatureId }),
      answers,
    };
    reviseMutation.mutate(
      { id: requestId, itemId: item.id, body },
      {
        onSuccess: () => { setEditMode(false); toast.success("Revision submitted."); },
        onError: () => toast.error("Could not submit revision."),
      },
    );
  }

  function confirmDrop() {
    dropMutation.mutate(
      { id: requestId, itemId: item.id },
      {
        onSuccess: () => { setDropConfirmOpen(false); toast.success("Item dropped."); },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) {
            setLastItemError(true);
          } else {
            toast.error("Could not drop that item.");
            setDropConfirmOpen(false);
          }
        },
      },
    );
  }

  const kebabItems: KebabMenuItem[] = [
    {
      label: "Drop item",
      icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
      destructive: true,
      onSelect: () => { setLastItemError(false); setDropConfirmOpen(true); },
    },
  ];

  return (
    <Card title={itemTitle} headerRight={<StatusBadge variant={statusVariant}>{statusLabel}</StatusBadge>}>
      {isRejected && !editMode && (
        <div
          className="rounded-md mb-4 flex items-start"
          style={{ background: "rgba(247, 228, 173, 0.4)", border: "1px solid rgba(212, 167, 44, 0.3)", padding: "10px 12px", fontSize: 13, color: "var(--fg-1)", gap: 8 }}
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <div>
            <span>Rejected by <strong>{item.reviewerName ?? "the reviewer"}</strong>. </span>
            {item.rejectionReason && <span className="italic">{item.rejectionReason}</span>}
          </div>
        </div>
      )}
      {item.status === "APPROVED" && (
        <div
          className="rounded-md mb-4 flex items-center"
          style={{ background: "var(--color-light-blue-soft)", border: "1px solid rgba(187,221,230,0.7)", padding: "10px 12px", fontSize: 13, color: "var(--fg-1)", gap: 8 }}
        >
          <Info className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>Approved by <strong>{item.reviewerName ?? "the reviewer"}</strong>.</span>
        </div>
      )}
      {!editMode ? (
        <ItemAnswerList answers={item.answers} />
      ) : (
        <ItemAnswerEditor
          answers={item.answers}
          localAnswers={localAnswers}
          onChange={(qid, text) => setLocalAnswers((prev) => new Map(prev).set(qid, text))}
        />
      )}
      {isRejected && !editMode && (
        <div className="flex items-center mt-4" style={{ gap: 8 }}>
          <PrimaryButton onClick={() => { setLocalAnswers(new Map(item.answers.map((a) => [a.questionId, a.answerText]))); setEditMode(true); }}>Revise & resubmit</PrimaryButton>
          <KebabMenu items={kebabItems} ariaLabel="Item actions" />
        </div>
      )}
      {editMode && (
        <div className="flex items-center mt-4" style={{ gap: 8 }}>
          <PrimaryButton onClick={submitRevision} disabled={reviseMutation.isPending}>
            {reviseMutation.isPending ? "Submitting…" : "Submit revision"}
          </PrimaryButton>
          <SecondaryButton onClick={() => setChangeProductOpen(true)}>Change product</SecondaryButton>
          <SecondaryButton onClick={() => setEditMode(false)} disabled={reviseMutation.isPending}>Cancel</SecondaryButton>
        </div>
      )}
      {item.status === "APPROVED" && item.complexity && (
        <div className="mt-4">
          <PhaseLineTable lines={item.phaseLines} complexity={item.complexity} currentRate={currentRate} />
        </div>
      )}
      <ProductPickerModal
        open={changeProductOpen}
        currentProductId={selectedProductId}
        currentSubFeatureId={selectedSubFeatureId}
        onConfirm={(productId, subFeatureId) => { setSelectedProductId(productId); setSelectedSubFeatureId(subFeatureId); setChangeProductOpen(false); }}
        onCancel={() => setChangeProductOpen(false)}
      />
      <ConfirmModal
        open={dropConfirmOpen}
        title={lastItemError ? "Cannot drop last item" : "Drop this item?"}
        body={
          <p className="m-0 text-warm-gray-med" style={{ fontSize: 13 }}>
            {lastItemError
              ? "This is the only remaining item. Discard the entire request instead?"
              : "This item will be permanently removed from the request. This can't be undone."}
          </p>
        }
        confirmLabel={lastItemError ? "Discard request" : "Drop item"}
        cancelLabel={lastItemError ? "Keep item" : "Cancel"}
        destructive
        onCancel={() => { setDropConfirmOpen(false); setLastItemError(false); }}
        onConfirm={lastItemError ? () => { setDropConfirmOpen(false); setLastItemError(false); onDiscardRequested(); } : confirmDrop}
        width={440}
      />
    </Card>
  );
}

function ItemAnswerEditor({
  answers,
  localAnswers,
  onChange,
}: {
  answers: EstimateRequestAnswerView[];
  localAnswers: Map<number, string>;
  onChange: (questionId: number, text: string) => void;
}) {
  if (answers.length === 0) {
    return <p className="m-0 text-warm-gray-med" style={{ fontSize: 13 }}>No questions for this item.</p>;
  }
  return (
    <div className="flex flex-col" style={{ gap: 14 }}>
      {answers.map((a) => (
        <div key={a.questionId}>
          <label htmlFor={`answer-${a.questionId}`} className="flex items-baseline text-near-black font-semibold" style={{ fontSize: 13, gap: 8 }}>
            {a.questionText}
            {a.required && <RequiredPill />}
          </label>
          <textarea
            id={`answer-${a.questionId}`}
            value={localAnswers.get(a.questionId) ?? ""}
            onChange={(e) => onChange(a.questionId, e.target.value)}
            rows={3}
            className="w-full mt-1 rounded-md text-near-black focus:outline-none focus:ring-2 focus:ring-light-blue resize-y"
            style={{ fontSize: 13, padding: "8px 10px", border: "1px solid var(--color-border-strong)", lineHeight: 1.5 }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Product picker (used in ItemRevisionCard) ──────────────────────────────

function ProductPickerModal({
  open,
  currentProductId,
  currentSubFeatureId,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  currentProductId: number;
  currentSubFeatureId: number | null;
  onConfirm: (productId: number, subFeatureId: number | null) => void;
  onCancel: () => void;
}) {
  const productsQuery = useProductsQuery({ status: "ACTIVE", size: 200 });
  const products: ProductListItem[] = productsQuery.data?.items ?? [];
  const [pickedProductId, setPickedProductId] = useState<number>(currentProductId);
  const [pickedSubFeatureId, setPickedSubFeatureId] = useState<number | null>(currentSubFeatureId);
  const pickedProduct = products.find((p) => p.id === pickedProductId) ?? null;
  const isContainer = pickedProduct?.mode === "CONTAINER";
  const subFeaturesQuery = useSubFeaturesForProductQuery(isContainer ? pickedProductId : null);
  const subFeatures = subFeaturesQuery.data ?? [];

  useEffect(() => {
    if (open) { setPickedProductId(currentProductId); setPickedSubFeatureId(currentSubFeatureId); }
  }, [open, currentProductId, currentSubFeatureId]);
  useEffect(() => { setPickedSubFeatureId(null); }, [pickedProductId]);

  const canConfirm = !isContainer || pickedSubFeatureId != null;
  if (!open) return null;

  return (
    <>
      <div onClick={onCancel} className="fixed inset-0 z-40" style={{ background: "rgba(39,37,31,0.40)" }} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div role="dialog" aria-modal="true" aria-label="Change product" className="bg-white rounded-lg overflow-hidden flex flex-col pointer-events-auto" style={{ width: 440, boxShadow: "var(--shadow-modal)" }}>
          <header style={{ padding: "20px 24px 12px" }}>
            <div className="font-semibold text-near-black" style={{ fontSize: 18, letterSpacing: "-0.005em" }}>Change product</div>
          </header>
          <div style={{ padding: "0 24px 20px", fontSize: 14 }}>
            <label className="flex flex-col" style={{ gap: 6 }}>
              <span className="text-warm-gray-med uppercase font-medium" style={{ fontSize: 11, letterSpacing: "0.04em" }}>Product</span>
              <div className="relative">
                <select value={pickedProductId} onChange={(e) => setPickedProductId(Number(e.target.value))} className="w-full h-9 rounded-md text-near-black appearance-none focus:outline-none focus:ring-2 focus:ring-light-blue" style={{ fontSize: 13, padding: "0 32px 0 10px", border: "1px solid var(--color-border-strong)", background: "white" }}>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.mode === "CONTAINER" ? " (container)" : ""}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-warm-gray-med pointer-events-none" style={{ width: 14, height: 14 }} strokeWidth={1.5} />
              </div>
            </label>
            {isContainer && (
              <label className="flex flex-col mt-4" style={{ gap: 6 }}>
                <span className="text-warm-gray-med uppercase font-medium" style={{ fontSize: 11, letterSpacing: "0.04em" }}>Sub-feature</span>
                <div className="relative">
                  <select value={pickedSubFeatureId ?? ""} onChange={(e) => setPickedSubFeatureId(e.target.value ? Number(e.target.value) : null)} className="w-full h-9 rounded-md text-near-black appearance-none focus:outline-none focus:ring-2 focus:ring-light-blue" style={{ fontSize: 13, padding: "0 32px 0 10px", border: "1px solid var(--color-border-strong)", background: "white" }}>
                    <option value="">Select a sub-feature…</option>
                    {subFeatures.map((sf) => <option key={sf.id} value={sf.id}>{sf.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-warm-gray-med pointer-events-none" style={{ width: 14, height: 14 }} strokeWidth={1.5} />
                </div>
              </label>
            )}
          </div>
          <footer className="flex items-center justify-end gap-2" style={{ padding: "14px 24px", borderTop: "1px solid var(--color-warm-gray-light)", background: "#FBFBFA" }}>
            <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
            <PrimaryButton disabled={!canConfirm} onClick={() => onConfirm(pickedProductId, isContainer ? pickedSubFeatureId : null)}>Confirm</PrimaryButton>
          </footer>
        </div>
      </div>
    </>
  );
}

// ── Misc UI primitives ─────────────────────────────────────────────────────

function NotFoundPanel() {
  const navigate = useNavigate();
  return (
    <div className="rounded-lg text-center" style={{ border: "1px dashed var(--color-border-strong)", background: "#FBFBFA", padding: "80px 24px", marginTop: 24 }}>
      <FileText className="mx-auto mb-3 text-warm-gray-med" style={{ width: 32, height: 32 }} strokeWidth={1.5} />
      <p className="m-0 text-near-black font-semibold" style={{ fontSize: 18 }}>Request not found</p>
      <p className="m-0 mt-2 text-warm-gray-med" style={{ fontSize: 14, maxWidth: 380, marginInline: "auto" }}>
        This estimate request doesn't exist or you don't have access to it.
      </p>
      <div className="mt-4 flex justify-center">
        <SecondaryButton onClick={() => navigate("/requests")}>Back to my requests</SecondaryButton>
      </div>
    </div>
  );
}

function RequiredPill() {
  return (
    <span className="inline-flex items-center text-near-black" style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: "var(--color-warm-gray-light)", border: "1px solid var(--color-border-strong)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      Required
    </span>
  );
}

function CountPill({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center justify-center text-warm-gray-med tabular-nums" style={{ minWidth: 22, height: 18, padding: "0 6px", borderRadius: 9, fontSize: 11, fontWeight: 600, background: "var(--color-warm-gray-light)" }}>
      {count}
    </span>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-warm-gray-med uppercase font-medium" style={{ fontSize: 11, letterSpacing: "0.04em" }}>{label}</div>
      <div className="text-near-black mt-1" style={{ fontSize: 14 }}>{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-warm-gray-med uppercase font-medium" style={{ fontSize: 11, letterSpacing: "0.04em" }}>
      {children}
    </div>
  );
}

function RequesterDisplay({ userId }: { userId: number | null }) {
  const { data } = useUserDisplay(userId);
  return <span>{data?.name ?? "Requester"}</span>;
}

function fmt(n: number | null): string {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function fmtHrs(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
