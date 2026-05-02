import { useEffect, useRef, useState } from "react";
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
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { useUnsavedChangesGuard } from "../lib/useUnsavedChangesGuard";
import { relativeTime } from "../lib/relativeTime";
import { useRatesPageQuery } from "../lib/queries/rates";
import { useMyRequestHistoryQuery } from "../lib/queries/estimates";
import {
  useApproveReviewMutation,
  useRejectReviewMutation,
  useReleaseReviewMutation,
  useReviewDetailQuery,
  useSaveReviewStateMutation,
  useSendBackMutation,
  useStartReviewMutation,
} from "../lib/queries/reviews";
import type {
  Complexity,
  EstimateRequestAnswerView,
  EstimateRequestDetail,
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

const AUTOSAVE_DEBOUNCE_MS = 1000;

export function ReviewScreenPage() {
  const { id } = useParams<{ id: string }>();
  const numericId = id ? Number(id) : null;
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const detailQuery = useReviewDetailQuery(numericId);
  const historyQuery = useMyRequestHistoryQuery(numericId);
  const ratesQuery = useRatesPageQuery({ size: 1 });

  const startMutation = useStartReviewMutation();
  const releaseMutation = useReleaseReviewMutation();
  const saveMutation = useSaveReviewStateMutation();
  const approveMutation = useApproveReviewMutation();
  const rejectMutation = useRejectReviewMutation();
  const sendBackMutation = useSendBackMutation();

  // Local edit state — only meaningful when In Review by you. Initialised
  // from the loaded detail; debounced down to autosaved PUT /state.
  const [complexity, setComplexity] = useState<Complexity | null>(null);
  const [justification, setJustification] = useState("");
  // Per-phase override deltas keyed by phase id. Mirrors the backend's
  // (onshoreOverride, offshoreOverride) pair via RowKey lookups.
  const [overrides, setOverrides] = useState<Map<number, Partial<RowValues>>>(new Map());
  // Track which fields the user has actually edited locally — only those
  // get sent to autosave. Avoids triggering a PUT on first load.
  const dirty = useRef<{ fields: Set<"complexity" | "justification">; overridePhases: Set<number> }>(
    { fields: new Set(), overridePhases: new Set() }
  );

  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectText, setRejectText] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [sendBackReason, setSendBackReason] = useState("");

  // Hydrate local state from loaded detail. Done once per detail.id; the
  // dirty refs are reset so the effect doesn't fight against a fresh load
  // after a successful autosave.
  useEffect(() => {
    if (!detailQuery.data) return;
    const d = detailQuery.data;
    setComplexity(d.complexity);
    setJustification(d.justification ?? "");
    const ov = new Map<number, Partial<RowValues>>();
    for (const line of d.phaseLines) {
      const partial: Partial<RowValues> = {};
      const keys = editableKeysForComplexity(d.complexity);
      const onshoreKey = pickKey(keys, "onshore");
      const offshoreKey = pickKey(keys, "offshore");
      if (onshoreKey && line.onshoreOverride != null) partial[onshoreKey] = line.onshoreOverride;
      if (offshoreKey && line.offshoreOverride != null) partial[offshoreKey] = line.offshoreOverride;
      if (Object.keys(partial).length > 0) ov.set(line.sdlcPhaseId, partial);
    }
    setOverrides(ov);
    dirty.current = { fields: new Set(), overridePhases: new Set() };
    setSavedAt(d.updatedAt ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQuery.data?.id, detailQuery.data?.status]);

  // Debounce + autosave. Fires whenever the local edit state changes
  // AND the user has touched at least one field. The mutation hook does
  // optimistic cache updates with rollback on error.
  const debouncedComplexity = useDebouncedValue(complexity, AUTOSAVE_DEBOUNCE_MS);
  const debouncedJustification = useDebouncedValue(justification, AUTOSAVE_DEBOUNCE_MS);
  const debouncedOverrides = useDebouncedValue(overrides, AUTOSAVE_DEBOUNCE_MS);

  useEffect(() => {
    if (!detailQuery.data || numericId == null) return;
    if (detailQuery.data.status !== "IN_REVIEW") return;
    if (detailQuery.data.reviewerStatus !== "you") return;
    const d = dirty.current;
    if (d.fields.size === 0 && d.overridePhases.size === 0) return;

    // Per-field "has my debounce settled" gate. Without this, the
    // hydration effect's setOverrides(new Map()) creates a new Map
    // reference whose debounced settle 1s later can fire the autosave
    // BEFORE the user's complexity click has debounced through —
    // sending a stale {complexity: null} PUT. Each field only contributes
    // to the body once its debounced value has caught up to the live one.
    const complexitySettled = complexity === debouncedComplexity;
    const justificationSettled = justification === debouncedJustification;
    const overridesSettled = overrides === debouncedOverrides;

    const body: {
      complexity?: Complexity | null;
      justification?: string | null;
      lineOverrides?: LineOverrideInput[];
    } = {};
    if (d.fields.has("complexity") && complexitySettled) {
      body.complexity = debouncedComplexity;
    }
    if (d.fields.has("justification") && justificationSettled) {
      const trimmed = debouncedJustification.trim();
      body.justification = trimmed.length === 0 ? null : trimmed;
    }
    if (d.overridePhases.size > 0 && overridesSettled) {
      body.lineOverrides = buildLineOverrides(
        debouncedOverrides,
        d.overridePhases,
        debouncedComplexity,
      );
    }
    // If no field has settled yet, skip — the next debounce tick picks it up.
    if (Object.keys(body).length === 0) return;

    saveMutation.mutate(
      { id: numericId, body },
      {
        onSuccess: () => {
          setSavedAt(new Date().toISOString());
          dirty.current = { fields: new Set(), overridePhases: new Set() };
        },
        onError: () => {
          toast.error("Couldn't autosave. Your changes are still here — try again.");
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedComplexity, debouncedJustification, debouncedOverrides]);

  // SPA-side guard: tab close / refresh while a save is in flight.
  useUnsavedChangesGuard(saveMutation.isPending);

  useEffect(() => {
    document.title = detailQuery.data?.title
      ? `${detailQuery.data.title} — Review`
      : "Review — Estimator";
  }, [detailQuery.data?.title]);

  // ---- early returns -----------------------------------------------------

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
  const isMyReview = detail.status === "IN_REVIEW" && detail.reviewerStatus === "you";
  const claimedByOther = detail.status === "IN_REVIEW" && detail.reviewerStatus === "other-so";
  const isAdmin = !!user && user.roles.includes(ROLE_ADMIN);
  const { variant, label } = estimateStatusBadge(detail.status);

  // Snapshot + override → editable cell hash for the grid.
  const snapshot = phaseLinesToSnapshot(detail.phaseLines);
  const phases = phaseLinesToPhases(detail.phaseLines);

  function changeComplexity(next: Complexity | null) {
    setComplexity(next);
    dirty.current.fields.add("complexity");
  }
  function changeJustification(next: string) {
    setJustification(next);
    dirty.current.fields.add("justification");
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
    dirty.current.overridePhases.add(phaseId);
  }
  function resetOverrides() {
    setOverrides(new Map());
    // Mark every phase that previously had an override as dirty so the
    // PUT clears each one.
    for (const line of detail.phaseLines) {
      if (line.onshoreOverride != null || line.offshoreOverride != null) {
        dirty.current.overridePhases.add(line.sdlcPhaseId);
      }
    }
  }

  function performStart() {
    if (numericId == null) return;
    startMutation.mutate(numericId, {
      onError: (err) => {
        // Race condition: another SO claimed the request between page
        // render and click. Surface the backend's race message and
        // re-fetch the detail so the page rerenders in claimed-by-other
        // mode.
        if (err instanceof ApiError && err.status === 409) {
          toast.error(err.message);
          detailQuery.refetch();
        } else {
          toast.error("Couldn't start the review.");
        }
      },
    });
  }

  function performRelease() {
    if (numericId == null) return;
    releaseMutation.mutate(numericId, {
      onSuccess: () => {
        toast.success("Review released back to the queue.");
        navigate("/review");
      },
      onError: () => toast.error("Couldn't release the review."),
    });
  }

  function performApprove() {
    if (numericId == null) return;
    approveMutation.mutate(numericId, {
      onSuccess: () => {
        toast.success(`Approved "${detail.title}".`);
        navigate("/review");
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Couldn't approve."),
    });
  }

  function performReject() {
    if (numericId == null) return;
    rejectMutation.mutate(
      { id: numericId, body: { justification: rejectText.trim() } },
      {
        onSuccess: () => {
          toast.success(`Rejected "${detail.title}".`);
          setRejectOpen(false);
          navigate("/review");
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't reject."),
      },
    );
  }

  function performSendBack() {
    if (numericId == null) return;
    sendBackMutation.mutate(
      { id: numericId, body: { reason: sendBackReason.trim() } },
      {
        onSuccess: () => {
          toast.success(`Sent "${detail.title}" back for re-review.`);
          setSendBackOpen(false);
          navigate("/review");
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't send back."),
      },
    );
  }

  // Cost preview — current rate for In Review, snapshot-id rate for
  // Approved (falls back to current if the snapshot id is missing).
  const currentRate = ratesQuery.data?.current ?? null;
  const effectiveRate = currentRate; // backend doesn't yet ship the snapshot rate body; current is fine for In Review preview

  // Header kebab. Always carries "Open requester's view"; In Review by
  // you adds Release; Admin viewing terminal state adds Send back.
  const kebabItems: KebabMenuItem[] = [
    {
      label: "Open requester's view",
      icon: <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />,
      onSelect: () => window.open(`/requests/${detail.id}`, "_blank", "noopener"),
    },
  ];
  if (isMyReview) {
    kebabItems.push({
      label: "Release review",
      destructive: false,
      onSelect: performRelease,
    });
  }
  if (isAdmin && (detail.status === "APPROVED" || detail.status === "REJECTED")) {
    kebabItems.push({
      label: "Send back for re-review",
      destructive: true,
      onSelect: () => setSendBackOpen(true),
    });
  }

  const subtitle = (
    <span>
      <RequesterName userId={detail.requesterId} /> ·{" "}
      {detail.subFeatureName
        ? `${detail.productName} · ${detail.subFeatureName}`
        : detail.productName}
      {detail.submittedAt && <> · submitted {relativeTime(detail.submittedAt)}</>}
    </span>
  );

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
        actions={<KebabMenu items={kebabItems} ariaLabel="Review actions" />}
      />

      {claimedByOther && (
        <ClaimedBanner reviewerName={detail.reviewerName ?? "Another SO"} />
      )}

      <div className="flex flex-col" style={{ gap: 16, marginTop: 24 }}>
        <SummaryCard detail={detail} />

        <QuestionsCard answers={detail.answers} />

        {detail.status === "SUBMITTED" && (
          <SubmittedActionCard
            onStart={performStart}
            isStarting={startMutation.isPending}
          />
        )}

        {detail.status === "IN_REVIEW" && (
          <ReviewPanel
            detail={detail}
            phases={phases}
            snapshot={snapshot}
            overrides={overrides}
            complexity={complexity}
            justification={justification}
            onComplexityChange={changeComplexity}
            onJustificationChange={changeJustification}
            onOverrideChange={changeOverride}
            onResetOverrides={resetOverrides}
            isAutosaving={saveMutation.isPending}
            savedAt={savedAt}
            disabled={!isMyReview}
            onApproveClick={() => setApproveOpen(true)}
            onRejectClick={() => {
              setRejectText(justification);
              setRejectOpen(true);
            }}
            effectiveRate={effectiveRate}
            isMyReview={isMyReview}
          />
        )}

        {(detail.status === "APPROVED" || detail.status === "REJECTED") && (
          <TerminalPanel detail={detail} effectiveRate={effectiveRate} />
        )}

        <ActivityCard
          history={historyQuery.data ?? []}
          loading={historyQuery.isLoading}
        />
      </div>

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

      {/* Reject confirmation with final-justification field */}
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
              Returns this request to the queue. Reviewer assignment, complexity,
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
    <Card title="Request">
      <div className="flex flex-col" style={{ gap: 14 }}>
        {detail.description && (
          <div>
            <SectionLabel>Description</SectionLabel>
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
          {detail.templateVersionNumber != null && (
            <KV label="Template version">v{detail.templateVersionNumber}</KV>
          )}
          {detail.submittedAt && (
            <KV label="Submitted">{relativeTime(detail.submittedAt)}</KV>
          )}
        </div>
      </div>
    </Card>
  );
}

function QuestionsCard({ answers }: { answers: EstimateRequestAnswerView[] }) {
  return (
    <Card
      title="Questions and answers"
      headerRight={<CountPill count={answers.length} />}
    >
      {answers.length === 0 ? (
        <p className="m-0 text-warm-gray-med" style={{ fontSize: 13 }}>
          No questions on this product.
        </p>
      ) : (
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
      )}
    </Card>
  );
}

function SubmittedActionCard({
  onStart,
  isStarting,
}: {
  onStart: () => void;
  isStarting: boolean;
}) {
  return (
    <section
      className="bg-white rounded-lg text-center"
      style={{
        border: "1px solid var(--color-warm-gray-light)",
        padding: "32px 24px",
      }}
    >
      <h3
        className="text-near-black font-semibold m-0"
        style={{ fontSize: 16 }}
      >
        Ready to review?
      </h3>
      <p
        className="m-0 mt-2 text-warm-gray-med"
        style={{ fontSize: 14, maxWidth: 480, marginInline: "auto" }}
      >
        Starting the review claims this request for you. Other SOs can still
        view it but only you can approve or reject.
      </p>
      <div className="mt-4">
        <PrimaryButton onClick={onStart} disabled={isStarting}>
          {isStarting ? "Starting…" : "Start review"}
        </PrimaryButton>
      </div>
    </section>
  );
}

function ReviewPanel({
  detail,
  phases,
  snapshot,
  overrides,
  complexity,
  justification,
  onComplexityChange,
  onJustificationChange,
  onOverrideChange,
  onResetOverrides,
  isAutosaving,
  savedAt,
  disabled,
  onApproveClick,
  onRejectClick,
  effectiveRate,
  isMyReview,
}: {
  detail: EstimateRequestDetail;
  phases: PhaseMeta[];
  snapshot: Map<number, RowValues>;
  overrides: Map<number, Partial<RowValues>>;
  complexity: Complexity | null;
  justification: string;
  onComplexityChange: (next: Complexity | null) => void;
  onJustificationChange: (next: string) => void;
  onOverrideChange: (phaseId: number, key: RowKey, next: number | null) => void;
  onResetOverrides: () => void;
  isAutosaving: boolean;
  savedAt: string | null;
  disabled: boolean;
  onApproveClick: () => void;
  onRejectClick: () => void;
  effectiveRate: { onshoreRate: string; offshoreRate: string; effectiveDate: string } | null;
  isMyReview: boolean;
}) {
  const totalHrs = totalHours(snapshot, overrides, complexity);
  const totalCst = effectiveRate && complexity
    ? totalCost(snapshot, overrides, complexity, effectiveRate)
    : null;

  const approveDisabled =
    !isMyReview || complexity === null || justification.trim() === "";

  return (
    <>
      <Card title="Choose complexity for this estimate">
        <ComplexitySelector
          value={complexity}
          onChange={onComplexityChange}
          disabled={disabled}
        />
        <p
          className="m-0 mt-3 text-warm-gray-med"
          style={{ fontSize: 12 }}
        >
          The chosen column from the template applies to all phases. You can
          override individual cells below if needed.
        </p>
      </Card>

      <Card
        title="Hours"
        headerRight={
          detail.templateVersionNumber != null ? (
            <span
              className="text-warm-gray-med tabular-nums"
              style={{ fontSize: 12 }}
            >
              Template v{detail.templateVersionNumber}
            </span>
          ) : null
        }
      >
        <HoursGrid
          mode="reviewer"
          phases={phases}
          snapshot={snapshot}
          overrides={overrides}
          chosenComplexity={complexity}
          onOverrideChange={onOverrideChange}
          disabled={disabled}
        />
        <div
          className="flex items-center justify-between mt-3"
          style={{ gap: 16 }}
        >
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
            <div className="text-warm-gray-med" style={{ fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>
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
              <div
                className="text-warm-gray-med mt-1"
                style={{ fontSize: 11 }}
              >
                Current rates: ${effectiveRate.onshoreRate} onshore · ${effectiveRate.offshoreRate} offshore.
                Snapshotted on approval.
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card title="Justification">
        <JustificationField
          value={justification}
          onChange={onJustificationChange}
          isAutosaving={isAutosaving}
          savedAt={savedAt}
          disabled={disabled}
          helper="Required. Explain how the question answers led to your complexity pick and any cell overrides. This is part of the audit record and visible to the requester."
        />
      </Card>

      <div
        className="flex items-center justify-between"
        style={{ marginTop: 8 }}
      >
        <div />
        <div className="flex items-center" style={{ gap: 8 }}>
          <DestructiveButton onClick={onRejectClick} disabled={disabled}>
            Reject
          </DestructiveButton>
          <PrimaryButton onClick={onApproveClick} disabled={approveDisabled}>
            Approve
          </PrimaryButton>
        </div>
      </div>
    </>
  );
}

function TerminalPanel({
  detail,
  effectiveRate,
}: {
  detail: EstimateRequestDetail;
  effectiveRate: { onshoreRate: string; offshoreRate: string; effectiveDate: string } | null;
}) {
  const isApproved = detail.status === "APPROVED";
  const snapshot = phaseLinesToSnapshot(detail.phaseLines);
  const overrides = phaseLinesToOverrides(detail.phaseLines, detail.complexity);
  const totalHrs = totalHours(snapshot, overrides, detail.complexity);
  const totalCst = effectiveRate && detail.complexity
    ? totalCost(snapshot, overrides, detail.complexity, effectiveRate)
    : null;
  return (
    <Card title={isApproved ? "Approved estimate" : "Rejected request"}>
      <div
        className="rounded-md mb-4"
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
          {isApproved ? "Approved" : "Rejected"} by {detail.reviewerName ?? "the reviewer"}
          {detail.reviewedAt && <> on {new Date(detail.reviewedAt).toLocaleDateString()}</>}.
        </span>
      </div>

      {detail.complexity && (
        <div className="mb-3">
          <SectionLabel>Complexity</SectionLabel>
          <div className="mt-1">
            <StatusBadge variant="approved">{complexityLabel(detail.complexity)}</StatusBadge>
          </div>
        </div>
      )}

      {detail.justification && (
        <div className="mb-4">
          <SectionLabel>{isApproved ? "Reviewer's justification" : "Rejection reason"}</SectionLabel>
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
            {detail.justification}
          </blockquote>
        </div>
      )}

      {isApproved && (
        <>
          <HoursGrid
            mode="reviewer"
            phases={phaseLinesToPhases(detail.phaseLines)}
            snapshot={snapshot}
            overrides={overrides}
            chosenComplexity={detail.complexity}
            onOverrideChange={() => undefined}
            disabled
          />
          <div
            className="flex items-center justify-end mt-3"
            style={{ gap: 16 }}
          >
            <div className="text-right">
              <div className="text-warm-gray-med" style={{ fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>
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
                <div
                  className="text-warm-gray-med mt-1"
                  style={{ fontSize: 11 }}
                >
                  This estimate uses blended rates effective {effectiveRate.effectiveDate}.
                  Future rate changes do not affect this estimate.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </Card>
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
      className="rounded-md mt-4"
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
  // Reuses the UserCell display name lookup but inline to avoid the
  // avatar — the EntityHeader subtitle wants text-only.
  return <UserCellInline userId={userId} />;
}

function UserCellInline({ userId }: { userId: number | null }) {
  // Cheap inline render of the display name. UserCell renders avatar +
  // name; this strips to name only by relying on its skeleton path
  // returning text. Wraps in a span so the parent can compose it.
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

function phaseLinesToPhases(lines: EstimateRequestPhaseLineView[]): PhaseMeta[] {
  return lines.map((l) => ({
    id: l.sdlcPhaseId,
    name: l.sdlcPhaseName,
    displayOrder: l.displayOrder,
    active: true, // snapshot treats all phases as active for display
  }));
}

/**
 * Build the LineOverrideInput[] payload for autosave. Sends one entry
 * per dirty phase; the on/off override values come from the current
 * overrides map for the chosen-complexity keys. Null override = "clear
 * this side."
 */
function buildLineOverrides(
  overrides: Map<number, Partial<RowValues>>,
  dirtyPhases: Set<number>,
  complexity: Complexity | null,
): LineOverrideInput[] {
  const keys = editableKeysForComplexity(complexity);
  const onshoreKey = pickKey(keys, "onshore");
  const offshoreKey = pickKey(keys, "offshore");
  const out: LineOverrideInput[] = [];
  for (const phaseId of dirtyPhases) {
    const row = overrides.get(phaseId) ?? {};
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
 * any overrides. Null complexity → 0 (no column picked yet).
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

// Silence unused-import linter for TertiaryButton + MoreVertical (kept
// for future variations: Tertiary buttons may appear in the action bar
// on certain states; MoreVertical is the icon used by KebabMenu's
// trigger but we route through KebabMenu directly).
void TertiaryButton;
void MoreVertical;
