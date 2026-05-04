import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ExternalLink, Info, MoreVertical } from "lucide-react";
import { ComplexitySelector } from "../components/ComplexitySelector";
import { ConfirmModal } from "../components/ConfirmModal";
import { EntityHeader } from "../components/EntityHeader";
import { JustificationField } from "../components/JustificationField";
import { KebabMenu, type KebabMenuItem } from "../components/KebabMenu";
import { Textarea } from "../components/inputs";
import {
  DestructiveButton,
  PrimaryButton,
  SecondaryButton,
  TertiaryButton,
} from "../components/buttons";
import { StatusBadge, estimateStatusBadge } from "../components/StatusBadge";
import { Timeline, TimelineItem } from "../components/Timeline";
import { UserCell } from "../components/UserCell";
import { useToast } from "../components/Toast";
import { useAuth } from "../lib/auth";
import { ROLE_ADMIN } from "../lib/types";
import { ApiError } from "../lib/api";
import { relativeTime } from "../lib/relativeTime";
import { useRatesPageQuery } from "../lib/queries/rates";
import { useMyRequestHistoryQuery } from "../lib/queries/estimates";
import {
  useStartItemReviewMutation,
  useReleaseItemReviewMutation,
  useApproveItemMutation,
  useRejectItemMutation,
  useSendBackItemMutation,
  useReviewDetailQuery,
} from "../lib/queries/reviews";
import type {
  Complexity,
  EstimateRequestAnswerView,
  EstimateRequestItemDto,
  EstimateRequestPhaseLineView,
} from "../lib/api/estimates";
import type { LineOverrideInput } from "../lib/api/reviews";
import { HoursGrid } from "../components/hours/HoursGrid";
import {
  editableKeysForComplexity,
  type RowKey,
  type RowValues,
} from "../components/hours/columns";
import type { PhaseMeta } from "../components/hours/HoursRow";

export function ReviewScreenPage() {
  const { id } = useParams<{ id: string }>();
  const numericId = id ? Number(id) : null;

  const detailQuery = useReviewDetailQuery(numericId);
  const historyQuery = useMyRequestHistoryQuery(numericId);
  const ratesQuery = useRatesPageQuery({ size: 1 });

  const { user } = useAuth();
  const isAdmin = !!user && user.roles.includes(ROLE_ADMIN);

  useEffect(() => {
    document.title = detailQuery.data?.title
      ? `${detailQuery.data.title} — Review`
      : "Review — Estimator";
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
  const currentRate = ratesQuery.data?.current ?? null;

  const subtitle = (
    <span>
      <RequesterName userId={detail.requesterId} /> · {detail.items.length}{" "}
      {detail.items.length === 1 ? "item" : "items"}
    </span>
  );

  const headerKebabItems: KebabMenuItem[] = [
    {
      label: "Open requester's view",
      icon: <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />,
      onSelect: () => window.open(`/requests/${detail.id}`, "_blank", "noopener"),
    },
  ];

  return (
    <>
      <EntityHeader
        breadcrumb={[
          { label: "Workspace" },
          { label: "Review queue", to: "/review" },
          { label: detail.title },
        ]}
        title={detail.title}
        titleSuffix={<StatusBadge variant={variant}>{label}</StatusBadge>}
        subtitle={subtitle}
        actions={<KebabMenu items={headerKebabItems} ariaLabel="Review actions" />}
      />

      <div className="flex flex-col" style={{ gap: 16, marginTop: 24 }}>
        {(detail.description || detail.goLiveDate !== undefined) && (
          <RequestContextCard
            description={detail.description ?? null}
            goLiveDate={detail.goLiveDate ?? null}
          />
        )}
        {detail.items.map((item) => (
          <ItemReviewCard
            key={item.id}
            requestId={detail.id}
            requestTitle={detail.title}
            item={item}
            effectiveRate={currentRate}
            isAdmin={isAdmin}
          />
        ))}

        <ActivityCard
          history={historyQuery.data ?? []}
          loading={historyQuery.isLoading}
        />
      </div>
    </>
  );
}

// ====================================================================
// ItemReviewCard — self-contained per-item review component
// ====================================================================

function ItemReviewCard({
  requestId,
  requestTitle,
  item,
  effectiveRate,
  isAdmin,
}: {
  requestId: number;
  requestTitle: string;
  item: EstimateRequestItemDto;
  effectiveRate: { onshoreRate: string; offshoreRate: string; effectiveDate: string } | null;
  isAdmin: boolean;
}) {
  const navigate = useNavigate();
  const toast = useToast();

  const [complexity, setComplexity] = useState<Complexity | null>(item.complexity);
  const [justification, setJustification] = useState(item.justification ?? "");
  const [overrides, setOverrides] = useState<Map<number, Partial<RowValues>>>(
    () => buildInitialOverrides(item.phaseLines, item.complexity),
  );

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectText, setRejectText] = useState("");
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [sendBackReason, setSendBackReason] = useState("");

  // Re-hydrate local state when the item's status changes (e.g., after start/release).
  useEffect(() => {
    setComplexity(item.complexity);
    setJustification(item.justification ?? "");
    setOverrides(buildInitialOverrides(item.phaseLines, item.complexity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.status]);

  const startMutation = useStartItemReviewMutation();
  const releaseMutation = useReleaseItemReviewMutation();
  const approveMutation = useApproveItemMutation();
  const rejectMutation = useRejectItemMutation();
  const sendBackMutation = useSendBackItemMutation();

  const isMyReview = item.status === "IN_REVIEW" && item.reviewerStatus === "you";
  const claimedByOther = item.status === "IN_REVIEW" && item.reviewerStatus === "other-so";

  const snapshot = phaseLinesToSnapshot(item.phaseLines);
  const phases = phaseLinesToPhases(item.phaseLines);

  function changeComplexity(next: Complexity | null) {
    setComplexity(next);
  }
  function changeJustification(next: string) {
    setJustification(next);
  }
  function changeOverride(phaseId: number, key: RowKey, next: number | null) {
    setOverrides((prev) => {
      const out = new Map(prev);
      const row = { ...(out.get(phaseId) ?? {}) };
      if (next == null) delete row[key];
      else row[key] = next;
      if (Object.keys(row).length === 0) out.delete(phaseId);
      else out.set(phaseId, row);
      return out;
    });
  }
  function resetOverrides() {
    setOverrides(new Map());
  }

  function performStart() {
    startMutation.mutate(
      { requestId, itemId: item.id },
      {
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) {
            toast.error(err.message);
          } else {
            toast.error("Couldn't start the review.");
          }
        },
      },
    );
  }

  function performRelease() {
    releaseMutation.mutate(
      { requestId, itemId: item.id },
      {
        onSuccess: () => {
          toast.success("Review released back to the queue.");
          navigate("/review");
        },
        onError: () => toast.error("Couldn't release the review."),
      },
    );
  }

  function performApprove() {
    if (!complexity) return;
    approveMutation.mutate(
      {
        requestId,
        itemId: item.id,
        body: {
          complexity,
          justification: justification.trim() || null,
          lineOverrides: buildLineOverrides(overrides, complexity),
        },
      },
      {
        onSuccess: () => {
          toast.success(`Approved "${requestTitle}".`);
          navigate("/review");
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't approve."),
      },
    );
  }

  function performReject() {
    rejectMutation.mutate(
      { requestId, itemId: item.id, body: { rejectionReason: rejectText.trim() } },
      {
        onSuccess: () => {
          toast.success(`Rejected "${requestTitle}".`);
          setRejectOpen(false);
          navigate("/review");
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't reject."),
      },
    );
  }

  function performSendBack() {
    sendBackMutation.mutate(
      { requestId, itemId: item.id, body: { reason: sendBackReason.trim() } },
      {
        onSuccess: () => {
          toast.success(`Sent back for re-review.`);
          setSendBackOpen(false);
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't send back."),
      },
    );
  }

  const productLabel = item.subFeatureName
    ? `${item.productName} · ${item.subFeatureName}`
    : item.productName;

  const kebabItems: KebabMenuItem[] = [];
  if (isMyReview) {
    kebabItems.push({
      label: "Release review",
      destructive: false,
      onSelect: performRelease,
    });
  }
  if (isAdmin && (item.status === "APPROVED" || item.status === "REJECTED")) {
    kebabItems.push({
      label: "Send back for re-review",
      destructive: true,
      onSelect: () => setSendBackOpen(true),
    });
  }

  const { variant: itemVariant, label: itemLabel } = estimateStatusBadge(item.status);

  return (
    <>
      <Card
        title={productLabel}
        headerRight={
          <div className="flex items-center" style={{ gap: 8 }}>
            <StatusBadge variant={itemVariant}>{itemLabel}</StatusBadge>
            {kebabItems.length > 0 && (
              <KebabMenu items={kebabItems} ariaLabel={`Actions for ${productLabel}`} />
            )}
          </div>
        }
      >
        {claimedByOther && (
          <ClaimedBanner reviewerName={item.reviewerName ?? "Another SO"} />
        )}

        {item.answers.length > 0 && (
          <QuestionsSection answers={item.answers} />
        )}

        {item.status === "SUBMITTED" && item.isReviewable && (
          <SubmittedCTA onStart={performStart} isStarting={startMutation.isPending} />
        )}

        {item.status === "SUBMITTED" && !item.isReviewable && (
          <OtherTeamNotice teamName={item.teamName} />
        )}

        {item.status === "IN_REVIEW" && (
          <InReviewPanel
            item={item}
            phases={phases}
            snapshot={snapshot}
            overrides={overrides}
            complexity={complexity}
            justification={justification}
            onComplexityChange={changeComplexity}
            onJustificationChange={changeJustification}
            onOverrideChange={changeOverride}
            onResetOverrides={resetOverrides}
            effectiveRate={effectiveRate}
            isMyReview={isMyReview}
            onApproveClick={() => setApproveOpen(true)}
            onRejectClick={() => {
              setRejectText(justification);
              setRejectOpen(true);
            }}
          />
        )}

        {(item.status === "APPROVED" || item.status === "REJECTED") && (
          <TerminalItemPanel item={item} effectiveRate={effectiveRate} />
        )}
      </Card>

      {/* Approve confirmation */}
      <ConfirmModal
        open={approveOpen}
        title="Approve this estimate?"
        body={
          <p className="text-body text-warm-gray-med m-0">
            Once approved, the requester can view the final estimate. Estimated
            total: {fmtHours(totalHours(snapshot, overrides, complexity))} hours
            {effectiveRate && complexity ? (
              <>, ${fmtMoney(totalCost(snapshot, overrides, complexity, effectiveRate))}</>
            ) : null}.
          </p>
        }
        confirmLabel="Approve"
        cancelLabel="Keep editing"
        onCancel={() => setApproveOpen(false)}
        onConfirm={performApprove}
      />

      {/* Reject confirmation */}
      <ConfirmModal
        open={rejectOpen}
        title="Reject this request?"
        body={
          <div>
            <p className="text-body text-warm-gray-med m-0 mb-3">
              Add a final note before sending back to the requester. They can
              resubmit with adjustments.
            </p>
            <Textarea
              label="Rejection reason"
              rows={4}
              value={rejectText}
              onChange={(e) => setRejectText(e.currentTarget.value)}
              maxLength={4000}
            />
          </div>
        }
        confirmLabel="Reject"
        cancelLabel="Keep editing"
        destructive
        onCancel={() => setRejectOpen(false)}
        onConfirm={performReject}
      />

      {/* Admin send-back confirmation */}
      <ConfirmModal
        open={sendBackOpen}
        title="Send back for re-review?"
        body={
          <div>
            <p className="text-body text-warm-gray-med m-0 mb-3">
              Returns this item to the queue. Reviewer assignment, complexity,
              justification, and any per-cell overrides will be cleared. The
              snapshot itself stays intact.
            </p>
            <Textarea
              label="Reason"
              rows={3}
              value={sendBackReason}
              onChange={(e) => setSendBackReason(e.currentTarget.value)}
              maxLength={4000}
            />
          </div>
        }
        confirmLabel="Send back"
        cancelLabel="Keep editing"
        destructive
        onCancel={() => setSendBackOpen(false)}
        onConfirm={performSendBack}
      />
    </>
  );
}

// ====================================================================
// Sub-components
// ====================================================================

function RequestContextCard({
  description,
  goLiveDate,
}: {
  description: string | null;
  goLiveDate: string | null;
}) {
  const formattedDate = goLiveDate
    ? new Date(goLiveDate + "T00:00:00").toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <section
      className="bg-white rounded-lg"
      style={{ border: "1px solid var(--color-warm-gray-light)", padding: "14px 16px" }}
    >
      <div className="flex flex-wrap items-start" style={{ gap: 24 }}>
        {description && (
          <div style={{ flex: "1 1 300px" }}>
            <div
              className="text-warm-gray-med uppercase font-medium"
              style={{ fontSize: 11, letterSpacing: "0.04em", marginBottom: 4 }}
            >
              Description
            </div>
            <p className="m-0 text-near-black" style={{ fontSize: 13 }}>
              {description}
            </p>
          </div>
        )}
        <div>
          <div
            className="text-warm-gray-med uppercase font-medium"
            style={{ fontSize: 11, letterSpacing: "0.04em", marginBottom: 4 }}
          >
            Go Live Date
          </div>
          <div className="text-near-black" style={{ fontSize: 13 }}>
            {formattedDate ?? (
              <span className="text-warm-gray-med italic">Unknown</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

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

function QuestionsSection({ answers }: { answers: EstimateRequestAnswerView[] }) {
  return (
    <div className="mb-4">
      <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
        <SectionLabel>Questions and answers</SectionLabel>
        <CountPill count={answers.length} />
      </div>
      <ul className="m-0 p-0 list-none flex flex-col" style={{ gap: 14 }}>
        {answers.map((a) => (
          <li key={a.questionId}>
            <div className="flex items-baseline" style={{ gap: 8 }}>
              <span className="text-near-black font-semibold" style={{ fontSize: 14 }}>
                {a.questionText}
              </span>
              {a.required && <RequiredPill />}
            </div>
            <p
              className="m-0 mt-1"
              style={{
                fontSize: 14,
                color: a.answerText ? "var(--fg-1)" : "var(--color-warm-gray-med)",
                fontStyle: a.answerText ? undefined : "italic",
                whiteSpace: "pre-wrap",
              }}
            >
              {a.answerText || "Not answered"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SubmittedCTA({
  onStart,
  isStarting,
}: {
  onStart: () => void;
  isStarting: boolean;
}) {
  return (
    <div
      className="rounded-md text-center"
      style={{
        border: "1px dashed var(--color-warm-gray-light)",
        padding: "24px 16px",
        marginTop: 8,
      }}
    >
      <h3 className="text-near-black font-semibold m-0" style={{ fontSize: 15 }}>
        Ready to review?
      </h3>
      <p
        className="m-0 mt-2 text-warm-gray-med"
        style={{ fontSize: 14, maxWidth: 480, marginInline: "auto" }}
      >
        Starting the review claims this item for you. Other SOs can still view
        it but only you can approve or reject.
      </p>
      <div className="mt-4">
        <PrimaryButton onClick={onStart} disabled={isStarting}>
          {isStarting ? "Starting…" : "Start review"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function OtherTeamNotice({ teamName }: { teamName: string | null }) {
  return (
    <div
      className="rounded-md mt-2"
      style={{
        background: "var(--color-warm-gray-light)",
        border: "1px solid var(--color-border-strong)",
        padding: "10px 12px",
        fontSize: 13,
        color: "var(--fg-1)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Info className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
      <span>
        This item is owned by{" "}
        <strong>{teamName ?? "another team"}</strong>. Their SO will handle
        the review.
      </span>
    </div>
  );
}

function InReviewPanel({
  item,
  phases,
  snapshot,
  overrides,
  complexity,
  justification,
  onComplexityChange,
  onJustificationChange,
  onOverrideChange,
  onResetOverrides,
  effectiveRate,
  isMyReview,
  onApproveClick,
  onRejectClick,
}: {
  item: EstimateRequestItemDto;
  phases: PhaseMeta[];
  snapshot: Map<number, RowValues>;
  overrides: Map<number, Partial<RowValues>>;
  complexity: Complexity | null;
  justification: string;
  onComplexityChange: (next: Complexity | null) => void;
  onJustificationChange: (next: string) => void;
  onOverrideChange: (phaseId: number, key: RowKey, next: number | null) => void;
  onResetOverrides: () => void;
  effectiveRate: { onshoreRate: string; offshoreRate: string; effectiveDate: string } | null;
  isMyReview: boolean;
  onApproveClick: () => void;
  onRejectClick: () => void;
}) {
  const disabled = !isMyReview;
  const totalHrs = totalHours(snapshot, overrides, complexity);
  const totalCst = effectiveRate && complexity
    ? totalCost(snapshot, overrides, complexity, effectiveRate)
    : null;
  const approveDisabled = !isMyReview || complexity === null || justification.trim() === "";

  return (
    <div className="flex flex-col" style={{ gap: 16, marginTop: 8 }}>
      <div>
        <SectionLabel>Complexity</SectionLabel>
        <div className="mt-2">
          <ComplexitySelector
            value={complexity}
            onChange={onComplexityChange}
            disabled={disabled}
          />
        </div>
        <p className="m-0 mt-2 text-warm-gray-med" style={{ fontSize: 12 }}>
          The chosen column drives which hours cells are editable. You can
          override individual cells before approving.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <SectionLabel>
            Hours
            {item.templateVersionNumber != null && (
              <span className="ml-2 text-warm-gray-med tabular-nums" style={{ fontSize: 11 }}>
                Template v{item.templateVersionNumber}
              </span>
            )}
          </SectionLabel>
        </div>
        <HoursGrid
          mode="reviewer"
          phases={phases}
          snapshot={snapshot}
          overrides={overrides}
          chosenComplexity={complexity}
          onOverrideChange={onOverrideChange}
          disabled={disabled}
        />
        <div className="flex items-center justify-between mt-3" style={{ gap: 16 }}>
          <button
            type="button"
            onClick={onResetOverrides}
            disabled={disabled || overrides.size === 0}
            className="text-near-black bg-transparent border-0 cursor-pointer hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontSize: 12 }}
          >
            Reset overrides
          </button>
          <div className="text-right">
            <div
              className="text-warm-gray-med"
              style={{ fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}
            >
              Estimated total
            </div>
            <div
              className="text-near-black font-semibold tabular-nums"
              style={{ fontSize: 18, marginTop: 2 }}
            >
              {fmtHours(totalHrs)} hours
              {totalCst != null && (
                <span className="text-warm-gray-med" style={{ marginLeft: 12, fontSize: 14, fontWeight: 400 }}>
                  ${fmtMoney(totalCst)}
                </span>
              )}
            </div>
            {effectiveRate && !disabled && (
              <div className="text-warm-gray-med mt-1" style={{ fontSize: 11 }}>
                Current rates: ${effectiveRate.onshoreRate} onshore · ${effectiveRate.offshoreRate} offshore.
                Snapshotted on approval.
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <SectionLabel>Justification</SectionLabel>
        <div className="mt-2">
          <JustificationField
            value={justification}
            onChange={onJustificationChange}
            disabled={disabled}
            helper="Required. Explain how the question answers led to your complexity pick and any cell overrides. This is part of the audit record and visible to the requester."
          />
        </div>
      </div>

      <div className="flex items-center justify-end" style={{ gap: 8 }}>
        <DestructiveButton onClick={onRejectClick} disabled={disabled}>
          Reject
        </DestructiveButton>
        <PrimaryButton onClick={onApproveClick} disabled={approveDisabled}>
          Approve
        </PrimaryButton>
      </div>
    </div>
  );
}

function TerminalItemPanel({
  item,
  effectiveRate,
}: {
  item: EstimateRequestItemDto;
  effectiveRate: { onshoreRate: string; offshoreRate: string; effectiveDate: string } | null;
}) {
  const isApproved = item.status === "APPROVED";
  const snapshot = phaseLinesToSnapshot(item.phaseLines);
  const overrides = phaseLinesToOverrides(item.phaseLines, item.complexity);
  const totalHrs = totalHours(snapshot, overrides, item.complexity);
  const totalCst = effectiveRate && item.complexity
    ? totalCost(snapshot, overrides, item.complexity, effectiveRate)
    : null;

  return (
    <div className="flex flex-col" style={{ gap: 14, marginTop: 8 }}>
      {/* Info banner */}
      <div
        className="rounded-md"
        style={{
          background: isApproved ? "var(--color-light-blue-soft)" : "rgba(247, 228, 173, 0.4)",
          border: isApproved
            ? "1px solid rgba(187,221,230,0.7)"
            : "1px solid rgba(212, 167, 44, 0.3)",
          padding: "10px 12px",
          fontSize: 13,
          color: "var(--fg-1)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Info className="w-3.5 h-3.5" strokeWidth={1.5} />
        <span>
          {isApproved ? "Approved" : "Rejected"} by{" "}
          {item.reviewerName ?? "the reviewer"}
          {item.reviewedAt && <> on {new Date(item.reviewedAt).toLocaleDateString()}</>}.
        </span>
      </div>

      {isApproved && (
        <>
          {item.complexity && (
            <div>
              <SectionLabel>Complexity</SectionLabel>
              <div className="mt-1">
                <StatusBadge variant="approved">{complexityLabel(item.complexity)}</StatusBadge>
              </div>
            </div>
          )}

          {item.justification && (
            <div>
              <SectionLabel>Reviewer's justification</SectionLabel>
              <blockquote
                className="m-0 mt-1"
                style={{
                  borderLeft: "4px solid var(--color-light-blue)",
                  paddingLeft: 12,
                  fontStyle: "italic",
                  fontSize: 14,
                  color: "var(--fg-1)",
                }}
              >
                {item.justification}
              </blockquote>
            </div>
          )}

          <HoursGrid
            mode="reviewer"
            phases={phaseLinesToPhases(item.phaseLines)}
            snapshot={snapshot}
            overrides={overrides}
            chosenComplexity={item.complexity}
            onOverrideChange={() => undefined}
            disabled
          />
          <div className="flex items-center justify-end" style={{ gap: 16 }}>
            <div className="text-right">
              <div
                className="text-warm-gray-med"
                style={{ fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}
              >
                Estimated total
              </div>
              <div
                className="text-near-black font-semibold tabular-nums"
                style={{ fontSize: 18, marginTop: 2 }}
              >
                {fmtHours(totalHrs)} hours
                {totalCst != null && (
                  <span className="text-warm-gray-med" style={{ marginLeft: 12, fontSize: 14, fontWeight: 400 }}>
                    ${fmtMoney(totalCst)}
                  </span>
                )}
              </div>
              {effectiveRate && (
                <div className="text-warm-gray-med mt-1" style={{ fontSize: 11 }}>
                  This estimate uses blended rates effective {effectiveRate.effectiveDate}.
                  Future rate changes do not affect this estimate.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!isApproved && (
        <>
          {item.rejectionReason && (
            <div>
              <SectionLabel>Rejection reason</SectionLabel>
              <blockquote
                className="m-0 mt-1"
                style={{
                  borderLeft: "4px solid var(--color-warm-gray-med)",
                  paddingLeft: 12,
                  fontStyle: "italic",
                  fontSize: 14,
                  color: "var(--fg-1)",
                }}
              >
                {item.rejectionReason}
              </blockquote>
            </div>
          )}

          {item.complexity && (
            <div>
              <SectionLabel>Complexity at rejection</SectionLabel>
              <div className="mt-1">
                <StatusBadge variant="approved">{complexityLabel(item.complexity)}</StatusBadge>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ActivityCard({
  history,
  loading,
}: {
  history: { id: number; action: string; notes: string | null; changedBy: number | null; changedAt: string }[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card title="Activity">
        <p className="m-0 text-warm-gray-med" style={{ fontSize: 13 }}>Loading…</p>
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
            avatar={
              <span
                className="inline-flex items-center justify-center"
                style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: "var(--color-warm-gray-med)", color: "var(--color-white)",
                  fontSize: 10, fontWeight: 600,
                }}
              >
                {(entry.changedBy ?? 0) === 0 ? "S" : "•"}
              </span>
            }
          >
            <div className="pb-4">
              <div className="text-near-black" style={{ fontSize: 13 }}>
                <strong>{actionLabel(entry.action)}</strong>
                {entry.notes ? <> · {entry.notes}</> : null}
              </div>
              <div className="text-warm-gray-med mt-0.5 flex items-center" style={{ fontSize: 12, gap: 4 }}>
                <UserCell userId={entry.changedBy} size={14} />
                <span>· {relativeTime(entry.changedAt)}</span>
              </div>
            </div>
          </TimelineItem>
        ))}
      </Timeline>
    </Card>
  );
}

function ClaimedBanner({ reviewerName }: { reviewerName: string }) {
  return (
    <div
      className="rounded-md mb-4"
      style={{
        background: "var(--color-warm-gray-light)",
        border: "1px solid var(--color-border-strong)",
        padding: "10px 12px",
        fontSize: 13,
        color: "var(--fg-1)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Info className="w-3.5 h-3.5" strokeWidth={1.5} />
      <span>
        <strong>{reviewerName}</strong> is reviewing this request. You can view
        the snapshot but only the reviewer can change complexity or approve.
      </span>
    </div>
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
      <p className="m-0 text-near-black font-semibold" style={{ fontSize: 18 }}>
        Request not found
      </p>
      <p className="m-0 mt-2 text-warm-gray-med" style={{ fontSize: 14, maxWidth: 380, marginInline: "auto" }}>
        This estimate request doesn't exist, isn't yet submitted, or you don't have access to it.
      </p>
      <div className="mt-4 flex justify-center">
        <SecondaryButton onClick={() => navigate("/review")}>
          Back to review queue
        </SecondaryButton>
      </div>
    </div>
  );
}

function RequesterName({ userId }: { userId: number | null }) {
  return (
    <span style={{ display: "inline-flex", verticalAlign: "middle" }}>
      <UserCell userId={userId} size={14} />
    </span>
  );
}

function CountPill({ count }: { count: number }) {
  return (
    <span
      className="inline-flex items-center justify-center text-warm-gray-med tabular-nums"
      style={{
        minWidth: 22, height: 18, padding: "0 6px",
        borderRadius: 9, fontSize: 11, fontWeight: 600,
        background: "var(--color-warm-gray-light)",
      }}
    >
      {count}
    </span>
  );
}

function RequiredPill() {
  return (
    <span
      className="inline-flex items-center text-near-black"
      style={{
        padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
        background: "var(--color-warm-gray-light)",
        border: "1px solid var(--color-border-strong)",
        textTransform: "uppercase", letterSpacing: "0.06em",
      }}
    >
      Required
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-warm-gray-med uppercase font-medium"
      style={{ fontSize: 11, letterSpacing: "0.04em" }}
    >
      {children}
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="text-near-black mt-1" style={{ fontSize: 14 }}>
        {children}
      </div>
    </div>
  );
}

// ====================================================================
// Pure helpers
// ====================================================================

function pickKey(keys: ReadonlySet<RowKey>, group: "onshore" | "offshore"): RowKey | null {
  for (const k of keys) {
    if (k.startsWith(group)) return k;
  }
  return null;
}

function buildInitialOverrides(
  lines: EstimateRequestPhaseLineView[],
  complexity: Complexity | null,
): Map<number, Partial<RowValues>> {
  const out = new Map<number, Partial<RowValues>>();
  if (!complexity) return out;
  const keys = editableKeysForComplexity(complexity);
  const onshoreKey = pickKey(keys, "onshore");
  const offshoreKey = pickKey(keys, "offshore");
  for (const l of lines) {
    const partial: Partial<RowValues> = {};
    if (onshoreKey && l.onshoreOverride != null) partial[onshoreKey] = l.onshoreOverride;
    if (offshoreKey && l.offshoreOverride != null) partial[offshoreKey] = l.offshoreOverride;
    if (Object.keys(partial).length > 0) out.set(l.sdlcPhaseId, partial);
  }
  return out;
}

function phaseLinesToSnapshot(lines: EstimateRequestPhaseLineView[]): Map<number, RowValues> {
  const out = new Map<number, RowValues>();
  for (const l of lines) {
    out.set(l.sdlcPhaseId, {
      onshoreLow: l.onshoreLow,
      onshoreMed: l.onshoreMed,
      onshoreHigh: l.onshoreHigh,
      offshoreLow: l.offshoreLow,
      offshoreMed: l.offshoreMed,
      offshoreHigh: l.offshoreHigh,
    });
  }
  return out;
}

function phaseLinesToOverrides(
  lines: EstimateRequestPhaseLineView[],
  complexity: Complexity | null,
): Map<number, Partial<RowValues>> {
  return buildInitialOverrides(lines, complexity);
}

function phaseLinesToPhases(lines: EstimateRequestPhaseLineView[]): PhaseMeta[] {
  return lines.map((l) => ({
    id: l.sdlcPhaseId,
    name: l.sdlcPhaseName,
    displayOrder: l.displayOrder,
    active: true, // snapshot treats all phases as active for display
  }));
}

/**
 * Build the LineOverrideInput[] payload for approve. Sends all overrides
 * currently in the map, keyed by the chosen complexity's editable columns.
 */
function buildLineOverrides(
  overrides: Map<number, Partial<RowValues>>,
  complexity: Complexity,
): LineOverrideInput[] {
  const keys = editableKeysForComplexity(complexity);
  const onshoreKey = pickKey(keys, "onshore");
  const offshoreKey = pickKey(keys, "offshore");
  const out: LineOverrideInput[] = [];
  for (const [phaseId, row] of overrides.entries()) {
    out.push({
      sdlcPhaseId: phaseId,
      onshoreOverride: onshoreKey && row[onshoreKey] != null ? row[onshoreKey]! : null,
      offshoreOverride: offshoreKey && row[offshoreKey] != null ? row[offshoreKey]! : null,
    });
  }
  return out;
}

/**
 * Sum of onshore + offshore hours for the chosen complexity, applying
 * any overrides. Null complexity → 0.
 */
function totalHours(
  snapshot: Map<number, RowValues>,
  overrides: Map<number, Partial<RowValues>>,
  complexity: Complexity | null,
): number {
  if (!complexity) return 0;
  const keys = editableKeysForComplexity(complexity);
  let sum = 0;
  for (const [phaseId, snap] of snapshot.entries()) {
    const ov = overrides.get(phaseId) ?? {};
    for (const k of keys) sum += ov[k] ?? snap[k] ?? 0;
  }
  return sum;
}

function totalCost(
  snapshot: Map<number, RowValues>,
  overrides: Map<number, Partial<RowValues>>,
  complexity: Complexity | null,
  rate: { onshoreRate: string; offshoreRate: string },
): number {
  if (!complexity) return 0;
  const keys = editableKeysForComplexity(complexity);
  const onshoreKey = pickKey(keys, "onshore");
  const offshoreKey = pickKey(keys, "offshore");
  let onsHrs = 0;
  let offsHrs = 0;
  for (const [phaseId, snap] of snapshot.entries()) {
    const ov = overrides.get(phaseId) ?? {};
    if (onshoreKey) onsHrs += ov[onshoreKey] ?? snap[onshoreKey] ?? 0;
    if (offshoreKey) offsHrs += ov[offshoreKey] ?? snap[offshoreKey] ?? 0;
  }
  return onsHrs * Number(rate.onshoreRate) + offsHrs * Number(rate.offshoreRate);
}

function fmtHours(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function complexityLabel(c: Complexity): string {
  return c === "MED" ? "Medium" : c === "LOW" ? "Low" : "High";
}

function actionLabel(action: string): string {
  switch (action) {
    case "CREATED":         return "Created";
    case "UPDATED":         return "Updated";
    case "SUBMITTED":       return "Submitted";
    case "REVIEW_STARTED":  return "Review started";
    case "REVIEW_RELEASED": return "Review released";
    case "APPROVED":        return "Approved";
    case "REJECTED":        return "Rejected";
    case "SENT_BACK":       return "Sent back";
    case "DELETED":         return "Discarded";
    default:                return action;
  }
}

// Silence unused-import linter for items kept for future variations.
void TertiaryButton;
void MoreVertical;
void KV;
