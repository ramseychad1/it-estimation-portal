import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronRight, Download, ExternalLink, Info, MoreVertical, Plus, Search } from "lucide-react";
import { downloadAttachment } from "../lib/api/documents";
import { ComplexitySelector } from "../components/ComplexitySelector";
import { AnswerValue } from "../components/AnswerValue";
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
import { actionLabel } from "../lib/activityLabels";
import { useRatesPageQuery } from "../lib/queries/rates";
import { useMyRequestHistoryQuery } from "../lib/queries/estimates";
import {
  useStartItemReviewMutation,
  useReleaseItemReviewMutation,
  useTakeOverItemReviewMutation,
  useApproveItemMutation,
  useRejectItemMutation,
  useRequestClarificationMutation,
  useSendBackItemMutation,
  useReviewDetailQuery,
  useAddScopeItemMutation,
} from "../lib/queries/reviews";
import { useProductsQuery } from "../lib/queries/products";
import { useSubFeaturesForProductQuery } from "../lib/queries/subFeatures";
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
  fmtCost,
  fmtHrs,
  type RowKey,
  type RowValues,
} from "../components/hours/columns";
import type { PhaseMeta } from "../components/hours/HoursRow";
import { computeClientPrice, pricingModelLabel } from "../lib/estimateMath";

export function ReviewScreenPage() {
  const { id } = useParams<{ id: string }>();
  const numericId = id ? Number(id) : null;

  const detailQuery = useReviewDetailQuery(numericId);
  const historyQuery = useMyRequestHistoryQuery(numericId);
  const ratesQuery = useRatesPageQuery({ size: 1 });

  const { user } = useAuth();
  const isAdmin = !!user && user.roles.includes(ROLE_ADMIN);

  const [addScopeOpen, setAddScopeOpen] = useState(false);

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
  const isIntake = detail.requestType === "INTAKE";

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
        eyebrow={`EST-${detail.id}`}
        title={detail.title}
        titleSuffix={
          <div className="flex items-center" style={{ gap: 6 }}>
            <StatusBadge variant={variant}>{label}</StatusBadge>
            {isIntake && (
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 7px",
                  borderRadius: 4,
                  background: "rgba(187, 221, 230, 0.35)",
                  border: "1px solid rgba(44, 86, 102, 0.30)",
                  color: "#2C5666",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Intake
              </span>
            )}
          </div>
        }
        subtitle={subtitle}
        actions={<KebabMenu items={headerKebabItems} ariaLabel="Review actions" />}
      />

      <div className="flex flex-col" style={{ gap: 16, marginTop: 24 }}>
        {(detail.description || detail.goLiveDate !== undefined || detail.categoryName || (detail.programTypeNames?.length ?? 0) > 0 || detail.clientName || detail.programName) && (
          <RequestContextCard
            description={detail.description ?? null}
            goLiveDate={detail.goLiveDate ?? null}
            categoryName={detail.categoryName ?? null}
            programTypeNames={detail.programTypeNames ?? []}
            clientName={detail.clientName ?? null}
            programName={detail.programName ?? null}
          />
        )}

        {/* INTAKE scoping banner */}
        {isIntake && (
          <div
            className="rounded-lg flex items-start"
            style={{
              padding: "14px 16px",
              gap: 12,
              background: "rgba(187, 221, 230, 0.18)",
              border: "1px solid rgba(44, 86, 102, 0.25)",
            }}
          >
            <div style={{ flex: 1 }}>
              <div className="text-near-black font-semibold" style={{ fontSize: 14, marginBottom: 3 }}>
                Intake request — scoping required
              </div>
              <div className="text-warm-gray-med" style={{ fontSize: 13, lineHeight: "18px" }}>
                Review the requester's requirements below, then add catalog products your
                team will estimate. Each product you add is immediately assigned to you
                for review.
              </div>
            </div>
            {detail.derivedStatus !== "APPROVED" && (
              <PrimaryButton onClick={() => setAddScopeOpen(true)}>
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                Add scope item
              </PrimaryButton>
            )}
          </div>
        )}

        {/* UX-3: multi-item requests get a sticky rail so the SO sees
            per-item progress at a glance and can jump between items. */}
        <div
          style={
            detail.items.length > 1
              ? { display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, alignItems: "start" }
              : undefined
          }
        >
          {detail.items.length > 1 && <ItemRail items={detail.items} />}
          <div className="flex flex-col" style={{ gap: 16, minWidth: 0 }}>
            {detail.items.map((item) => {
              const openSiblings = detail.items.filter(
                (i) => i.id !== item.id && i.status !== "APPROVED" && i.status !== "REJECTED",
              ).length;
              return (
                <div key={item.id} id={`item-card-${item.id}`} style={{ scrollMarginTop: 16 }}>
                  <ItemReviewCard
                    requestId={detail.id}
                    requestTitle={detail.title}
                    item={item}
                    effectiveRate={currentRate}
                    isAdmin={isAdmin}
                    openSiblingCount={openSiblings}
                    totalItemCount={detail.items.length}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <ActivityCard
          history={historyQuery.data ?? []}
          loading={historyQuery.isLoading}
        />
      </div>

      {isIntake && (
        <AddScopeItemDialog
          open={addScopeOpen}
          requestId={detail.id}
          userTeamIds={user?.teamIds ?? []}
          onClose={() => setAddScopeOpen(false)}
        />
      )}
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
  openSiblingCount = 0,
  totalItemCount = 1,
}: {
  requestId: number;
  requestTitle: string;
  item: EstimateRequestItemDto;
  effectiveRate: { onshoreRate: string; offshoreRate: string; effectiveDate: string } | null;
  isAdmin: boolean;
  /** Items on this request (excluding this one) not yet in a terminal state. */
  openSiblingCount?: number;
  totalItemCount?: number;
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
  const [takeOverOpen, setTakeOverOpen] = useState(false);
  const [sendBackReason, setSendBackReason] = useState("");
  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [clarifyNote, setClarifyNote] = useState("");

  // Re-hydrate local state when the item's status changes (e.g., after start/release).
  useEffect(() => {
    setComplexity(item.complexity);
    setJustification(item.justification ?? "");
    setOverrides(buildInitialOverrides(item.phaseLines, item.complexity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.status]);

  const startMutation = useStartItemReviewMutation();
  const releaseMutation = useReleaseItemReviewMutation();
  const takeOverMutation = useTakeOverItemReviewMutation();
  const approveMutation = useApproveItemMutation();
  const rejectMutation = useRejectItemMutation();
  const clarifyMutation = useRequestClarificationMutation();
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

  function performTakeOver() {
    takeOverMutation.mutate(
      { requestId, itemId: item.id },
      {
        onSuccess: () => {
          setTakeOverOpen(false);
          toast.success(`You are now the reviewer for "${item.productName}".`);
        },
        onError: (err) => {
          setTakeOverOpen(false);
          toast.error(err instanceof ApiError ? err.message : "Couldn't take over the review.");
        },
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
          setApproveOpen(false);
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
          toast.success(
            openSiblingCount > 0
              ? `Rejected "${item.productName}" — ${openSiblingCount} of ${totalItemCount} items still open.`
              : `Rejected "${item.productName}".`,
          );
          setRejectOpen(false);
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

  function performClarify() {
    clarifyMutation.mutate(
      { requestId, itemId: item.id, body: { clarificationNote: clarifyNote.trim() } },
      {
        onSuccess: () => {
          toast.success("Clarification request sent to the requester.");
          setClarifyOpen(false);
          setClarifyNote("");
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't send clarification request."),
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
          <ClaimedBanner
            reviewerName={item.reviewerName ?? "Another SO"}
            onTakeOver={isAdmin ? () => setTakeOverOpen(true) : undefined}
          />
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
            onClarifyClick={() => setClarifyOpen(true)}
          />
        )}

        {item.status === "NEEDS_CLARIFICATION" && (
          <AwaitingClarificationPanel clarificationNote={item.clarificationNote ?? ""} item={item} />
        )}

        {item.status === "RECALLED" && (
          <RecalledByRequesterPanel />
        )}

        {(item.status === "APPROVED" || item.status === "REJECTED") && (
          <TerminalItemPanel item={item} effectiveRate={effectiveRate} />
        )}
      </Card>

      {/* Admin take-over confirmation */}
      <ConfirmModal
        open={takeOverOpen}
        title="Take over this review?"
        body={
          <p className="text-body text-warm-gray-med m-0">
            You become the reviewer for <strong>{productLabel}</strong>.{" "}
            {item.reviewerName ?? "The current reviewer"}'s in-progress work
            (complexity, overrides, justification) is kept, and the change is
            recorded in the change log.
          </p>
        }
        confirmLabel="Take over review"
        cancelLabel="Cancel"
        onCancel={() => setTakeOverOpen(false)}
        onConfirm={performTakeOver}
      />

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
        title="Reject this item?"
        body={
          <div>
            <p className="text-body text-warm-gray-med m-0 mb-3">
              Rejects <strong>{productLabel}</strong> only — other items on
              this request are not affected. Add a final note before sending
              it back to the requester; they can revise and resubmit.
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

      {/* Request clarification */}
      <ConfirmModal
        open={clarifyOpen}
        title="Request clarification?"
        body={
          <div>
            <p className="text-body text-warm-gray-med m-0 mb-3">
              The requester will see your note and be prompted to update their
              answers before resubmitting. The item comes back to you once they respond.
            </p>
            <Textarea
              label="What do you need from the requester?"
              rows={4}
              value={clarifyNote}
              onChange={(e) => setClarifyNote(e.currentTarget.value)}
              maxLength={2000}
            />
          </div>
        }
        confirmLabel="Send"
        cancelLabel="Cancel"
        onCancel={() => { setClarifyOpen(false); setClarifyNote(""); }}
        onConfirm={performClarify}
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
  categoryName,
  programTypeNames,
  clientName,
  programName,
}: {
  description: string | null;
  goLiveDate: string | null;
  categoryName: string | null;
  programTypeNames: string[];
  clientName: string | null;
  programName: string | null;
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
        {categoryName && (
          <div>
            <div
              className="text-warm-gray-med uppercase font-medium"
              style={{ fontSize: 11, letterSpacing: "0.04em", marginBottom: 4 }}
            >
              Category
            </div>
            <div className="text-near-black" style={{ fontSize: 13 }}>{categoryName}</div>
          </div>
        )}
        {programTypeNames.length > 0 && (
          <div>
            <div
              className="text-warm-gray-med uppercase font-medium"
              style={{ fontSize: 11, letterSpacing: "0.04em", marginBottom: 4 }}
            >
              Program Type
            </div>
            <div className="text-near-black" style={{ fontSize: 13 }}>{programTypeNames.join(", ")}</div>
          </div>
        )}
        {clientName && (
          <div>
            <div
              className="text-warm-gray-med uppercase font-medium"
              style={{ fontSize: 11, letterSpacing: "0.04em", marginBottom: 4 }}
            >
              Client
            </div>
            <div className="text-near-black" style={{ fontSize: 13 }}>{clientName}</div>
          </div>
        )}
        {programName && (
          <div>
            <div
              className="text-warm-gray-med uppercase font-medium"
              style={{ fontSize: 11, letterSpacing: "0.04em", marginBottom: 4 }}
            >
              Program
            </div>
            <div className="text-near-black" style={{ fontSize: 13 }}>{programName}</div>
          </div>
        )}
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
            <AnswerValue questionType={a.questionType} answerText={a.answerText} />
            {a.attachments.length > 0 && (
              <div className="flex flex-col mt-1.5" style={{ gap: 4 }}>
                {a.attachments.map((att) => (
                  <button
                    key={att.id}
                    type="button"
                    onClick={() => void downloadAttachment(att.id, att.originalFilename)}
                    className="flex items-center gap-1.5 hover:underline"
                    style={{ fontSize: 12, color: "var(--color-accent)", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                  >
                    <Download className="w-3 h-3 shrink-0" strokeWidth={2} />
                    {att.originalFilename}
                  </button>
                ))}
              </div>
            )}
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
  onClarifyClick,
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
  onClarifyClick: () => void;
}) {
  const disabled = !isMyReview;
  const totalHrs = totalHours(snapshot, overrides, complexity);
  const totalCst = effectiveRate && complexity
    ? totalCost(snapshot, overrides, complexity, effectiveRate)
    : null;
  const clientPrice = computeClientPrice(
    item.pricingModel, totalCst, totalHrs,
    item.tmMultiplier, item.tmTargetMarginPct,
    item.matBillableRate, item.matDiscountPct,
  );
  const approveDisabled = !isMyReview || complexity === null || justification.trim() === "";

  // UX-3 progressive disclosure: after a complexity pick the grid collapses
  // to the chosen pair; reviewers can expand for cross-complexity comparison.
  const [showAllColumns, setShowAllColumns] = useState(false);
  // Pre-pick, the full template hides behind a compact per-complexity
  // preview unless explicitly expanded.
  const [showFullTemplate, setShowFullTemplate] = useState(false);

  return (
    <div className="flex flex-col" style={{ gap: 16, marginTop: 8 }}>
      {item.clarificationResponse && (
        <div
          className="rounded-md flex flex-col"
          style={{
            background: "rgba(184, 134, 11, 0.07)",
            border: "1px solid rgba(184, 134, 11, 0.3)",
            padding: "12px 16px",
            fontSize: 13,
            gap: 12,
          }}
        >
          {item.clarificationNote && (
            <div>
              <div className="font-semibold mb-1" style={{ color: "var(--color-warning)" }}>
                Your clarification note
              </div>
              <p className="m-0" style={{ color: "var(--fg-2)", fontStyle: "italic", whiteSpace: "pre-wrap" }}>
                {item.clarificationNote}
              </p>
            </div>
          )}
          <div>
            <div className="font-semibold mb-1" style={{ color: "var(--color-warning)" }}>
              Requester's response
            </div>
            <p className="m-0" style={{ color: "var(--fg-1)", whiteSpace: "pre-wrap" }}>
              {item.clarificationResponse}
            </p>
          </div>
        </div>
      )}
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
          Pick the complexity that matches the answers above — the estimate
          uses that column. You can override individual cells before approving.
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
        {complexity === null ? (
          <>
            <ComplexityPreviewTable
              phases={phases}
              snapshot={snapshot}
              effectiveRate={effectiveRate}
            />
            <button
              type="button"
              onClick={() => setShowFullTemplate((v) => !v)}
              className="bg-transparent border-0 p-0 cursor-pointer hover:underline mt-2"
              style={{ fontSize: 12, color: "var(--color-accent)" }}
            >
              {showFullTemplate ? "Hide full template" : "Show full template"}
            </button>
            {showFullTemplate && (
              <div className="mt-2">
                <HoursGrid
                  mode="reviewer"
                  phases={phases}
                  snapshot={snapshot}
                  overrides={overrides}
                  chosenComplexity={null}
                  onOverrideChange={onOverrideChange}
                  disabled={disabled}
                />
              </div>
            )}
          </>
        ) : (
          <>
            <HoursGrid
              mode="reviewer"
              phases={phases}
              snapshot={snapshot}
              overrides={overrides}
              chosenComplexity={complexity}
              onOverrideChange={onOverrideChange}
              disabled={disabled}
              collapsed={!showAllColumns}
            />
            <div className="flex items-center justify-between mt-3" style={{ gap: 16 }}>
              <div className="flex items-center" style={{ gap: 16 }}>
                <button
                  type="button"
                  onClick={onResetOverrides}
                  disabled={disabled || overrides.size === 0}
                  className="text-near-black bg-transparent border-0 cursor-pointer hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontSize: 12 }}
                >
                  Reset overrides
                </button>
                <button
                  type="button"
                  onClick={() => setShowAllColumns((v) => !v)}
                  className="bg-transparent border-0 p-0 cursor-pointer hover:underline"
                  style={{ fontSize: 12, color: "var(--color-accent)" }}
                >
                  {showAllColumns ? "Show chosen columns only" : "Show all columns"}
                </button>
              </div>
              {effectiveRate && !disabled && (
                <div className="text-warm-gray-med" style={{ fontSize: 11 }}>
                  Current rates: ${effectiveRate.onshoreRate} onshore · ${effectiveRate.offshoreRate} offshore.
                  Snapshotted on approval.
                </div>
              )}
            </div>
          </>
        )}
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

      {/* UX-3 sticky decision bar: the decision and its consequences never
          scroll away. Sticks to the viewport bottom while this item's card
          is in view. */}
      <div
        role="region"
        aria-label={`Decision for ${item.productName}`}
        style={{
          position: "sticky",
          bottom: 12,
          zIndex: 5,
          background: "var(--color-white)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: 10,
          boxShadow: "0 -4px 16px rgba(39,37,31,0.08), 0 2px 8px rgba(39,37,31,0.06)",
          padding: "10px 16px",
        }}
      >
        <div className="flex items-center flex-wrap" style={{ gap: 20 }}>
          <DecisionStat label="Complexity">
            {complexity ? (
              <span
                className="inline-flex items-center font-semibold rounded-md"
                style={{
                  padding: "1px 10px",
                  fontSize: 13,
                  background: "var(--color-accent-soft)",
                  color: "var(--color-accent)",
                  border: "1px solid var(--color-accent-border)",
                }}
              >
                {complexity === "MED" ? "Medium" : complexity === "LOW" ? "Low" : "High"}
              </span>
            ) : (
              <span className="text-warm-gray-med" style={{ fontSize: 13 }}>—</span>
            )}
          </DecisionStat>
          <DecisionStat label="Estimate">
            {complexity ? `${fmtHours(totalHrs)} hrs` : "—"}
          </DecisionStat>
          <DecisionStat label="Internal cost">
            {totalCst != null ? `$${fmtMoney(totalCst)}` : "—"}
          </DecisionStat>
          <DecisionStat label={`Client · ${pricingModelLabel(item.pricingModel)}`}>
            {clientPrice != null ? `$${fmtMoney(clientPrice)}` : "—"}
          </DecisionStat>
          {clientPrice != null && totalCst != null && clientPrice > 0 && (
            <DecisionStat label="Margin">
              <span style={{ color: "var(--color-success)", fontWeight: 600 }}>
                {Math.round(((clientPrice - totalCst) / clientPrice) * 100)}%
              </span>
            </DecisionStat>
          )}
          <div style={{ flex: 1 }} />
          <SecondaryButton onClick={onClarifyClick} disabled={disabled}>
            Request clarification
          </SecondaryButton>
          <DestructiveButton onClick={onRejectClick} disabled={disabled}>
            Reject
          </DestructiveButton>
          <PrimaryButton onClick={onApproveClick} disabled={approveDisabled}>
            Approve
          </PrimaryButton>
        </div>
        {isMyReview && approveDisabled && (
          <p className="m-0 text-warm-gray-med" style={{ fontSize: 12, marginTop: 6 }}>
            {complexity === null && justification.trim() === ""
              ? "Pick a complexity and add a justification to approve."
              : complexity === null
                ? "Pick a complexity to approve."
                : "Add a justification to approve."}
          </p>
        )}
      </div>
    </div>
  );
}

/** Labelled figure inside the decision bar. */
function DecisionStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-warm-gray-med uppercase"
        style={{ fontSize: 10, letterSpacing: "0.06em", fontWeight: 600 }}
      >
        {label}
      </div>
      <div className="text-near-black font-semibold tabular-nums" style={{ fontSize: 15, marginTop: 1 }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Compact pre-complexity view of the snapshot (UX-3): one row per
 * complexity with total hours + estimated internal cost, replacing the
 * 6-column wall of disabled cells until the reviewer picks.
 */
function ComplexityPreviewTable({
  phases,
  snapshot,
  effectiveRate,
}: {
  phases: PhaseMeta[];
  snapshot: Map<number, RowValues>;
  effectiveRate: { onshoreRate: string; offshoreRate: string } | null;
}) {
  const rows = (["LOW", "MED", "HIGH"] as const).map((cx) => {
    let ons = 0;
    let off = 0;
    for (const phase of phases) {
      const v = snapshot.get(phase.id);
      if (!v) continue;
      const keys = editableKeysForComplexity(cx);
      for (const key of keys) {
        if (key.startsWith("onshore")) ons += v[key] ?? 0;
        else off += v[key] ?? 0;
      }
    }
    const cost = effectiveRate
      ? ons * Number(effectiveRate.onshoreRate) + off * Number(effectiveRate.offshoreRate)
      : null;
    return { cx, label: cx === "MED" ? "Medium" : cx === "LOW" ? "Low" : "High", ons, off, cost };
  });

  return (
    <div
      role="table"
      aria-label="Template summary by complexity"
      className="rounded-md"
      style={{ border: "1px solid var(--color-border)", overflow: "hidden" }}
    >
      <div
        role="rowheader"
        className="grid text-warm-gray-med uppercase font-medium"
        style={{
          gridTemplateColumns: "1fr repeat(4, 120px)",
          gap: 8,
          padding: "8px 14px",
          fontSize: 11,
          letterSpacing: "0.06em",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface-tertiary)",
        }}
      >
        <span>Complexity</span>
        <span style={{ textAlign: "right" }}>Onshore Hrs</span>
        <span style={{ textAlign: "right" }}>Offshore Hrs</span>
        <span style={{ textAlign: "right" }}>Total Hrs</span>
        <span style={{ textAlign: "right" }}>Est. Cost</span>
      </div>
      {rows.map((r) => (
        <div
          key={r.cx}
          role="row"
          className="grid items-center"
          style={{
            gridTemplateColumns: "1fr repeat(4, 120px)",
            gap: 8,
            padding: "9px 14px",
            fontSize: 13,
            borderBottom: "1px solid var(--color-warm-gray-light)",
          }}
        >
          <span className="font-semibold text-near-black">{r.label}</span>
          <span className="tabular-nums" style={{ textAlign: "right" }}>{fmtHrs(r.ons)}</span>
          <span className="tabular-nums" style={{ textAlign: "right" }}>{fmtHrs(r.off)}</span>
          <span className="tabular-nums font-semibold" style={{ textAlign: "right" }}>{fmtHrs(r.ons + r.off)}</span>
          <span className="tabular-nums" style={{ textAlign: "right" }}>
            {r.cost != null ? fmtCost(r.cost) : "—"}
          </span>
        </div>
      ))}
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
  const clientPrice = isApproved
    ? computeClientPrice(
        item.pricingModel, totalCst, totalHrs,
        item.tmMultiplier, item.tmTargetMarginPct,
        item.matBillableRate, item.matDiscountPct,
      )
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
            collapsed
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
            {clientPrice != null && (
              <div className="text-right">
                <div
                  className="text-warm-gray-med"
                  style={{ fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}
                >
                  Client Price · {pricingModelLabel(item.pricingModel)}
                </div>
                <div
                  className="text-near-black font-semibold tabular-nums"
                  style={{ fontSize: 18, marginTop: 2 }}
                >
                  ${fmtMoney(Math.ceil(clientPrice))}
                </div>
              </div>
            )}
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

function AwaitingClarificationPanel({
  clarificationNote,
  item,
}: {
  clarificationNote: string;
  item: EstimateRequestItemDto;
}) {
  return (
    <div className="flex flex-col" style={{ gap: 12, marginTop: 8 }}>
      <div
        className="rounded-md"
        style={{
          background: "rgba(184, 134, 11, 0.07)",
          border: "1px solid rgba(184, 134, 11, 0.3)",
          padding: "12px 16px",
          fontSize: 13,
          color: "var(--fg-1)",
        }}
      >
        <div className="font-semibold" style={{ marginBottom: 4 }}>
          Awaiting requester response
        </div>
        <p className="m-0 text-warm-gray-med" style={{ fontSize: 13 }}>
          You requested clarification from the requester. Once they respond, this
          item will return to your review queue.
        </p>
      </div>
      {clarificationNote && (
        <div>
          <SectionLabel>Your clarification note</SectionLabel>
          <blockquote
            className="m-0 mt-1"
            style={{
              borderLeft: "4px solid rgba(184, 134, 11, 0.45)",
              paddingLeft: 12,
              fontStyle: "italic",
              fontSize: 14,
              color: "var(--fg-1)",
            }}
          >
            {clarificationNote}
          </blockquote>
        </div>
      )}
      {item.answers.length > 0 && <QuestionsSection answers={item.answers} />}
    </div>
  );
}

function RecalledByRequesterPanel() {
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
      <span>The requester recalled this item. It is no longer in the review queue.</span>
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

/**
 * Sticky per-item navigation for multi-item requests (UX-3). Mirrors the
 * wizard's Step-2 rail: product, status, jump-to-card.
 */
function ItemRail({ items }: { items: EstimateRequestItemDto[] }) {
  const doneCount = items.filter(
    (i) => i.status === "APPROVED" || i.status === "REJECTED",
  ).length;
  return (
    <aside
      aria-label="Items on this request"
      style={{ position: "sticky", top: 16, display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div
        className="flex items-center justify-between text-warm-gray-med font-medium uppercase"
        style={{ fontSize: 11, letterSpacing: "0.06em", padding: "0 4px 2px" }}
      >
        <span>Items</span>
        <span className="tabular-nums">{doneCount} / {items.length} decided</span>
      </div>
      {items.map((item) => {
        const { variant, label } = estimateStatusBadge(item.status);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() =>
              document
                .getElementById(`item-card-${item.id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="text-left bg-white rounded-lg border cursor-pointer hover:border-accent"
            style={{
              padding: "10px 12px",
              borderColor: "var(--color-border)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <span className="text-near-black font-semibold" style={{ fontSize: 13, lineHeight: "16px" }}>
              {item.productName}
            </span>
            {item.subFeatureName && (
              <span className="text-warm-gray-med" style={{ fontSize: 11 }}>
                {item.subFeatureName}
              </span>
            )}
            <StatusBadge variant={variant}>{label}</StatusBadge>
          </button>
        );
      })}
    </aside>
  );
}

function ClaimedBanner({
  reviewerName,
  onTakeOver,
}: {
  reviewerName: string;
  /** Admins only: shows the take-over action (UX: complete another SO's review). */
  onTakeOver?: () => void;
}) {
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
      <Info className="w-3.5 h-3.5 flex-none" strokeWidth={1.5} />
      <span style={{ flex: 1 }}>
        <strong>{reviewerName}</strong> is reviewing this request. You can view
        the snapshot but only the reviewer can change complexity or approve.
        {onTakeOver && " As an Admin, you can take over this review to complete it yourself."}
      </span>
      {onTakeOver && (
        <SecondaryButton onClick={onTakeOver} className="flex-none">
          Take over review
        </SecondaryButton>
      )}
    </div>
  );
}

// ====================================================================
// AddScopeItemDialog — SO picks a catalog product to add to an INTAKE request
// ====================================================================

function AddScopeItemDialog({
  open,
  requestId,
  userTeamIds,
  onClose,
}: {
  open: boolean;
  requestId: number;
  userTeamIds: number[];
  onClose: () => void;
}) {
  const toast = useToast();
  const addMutation = useAddScopeItemMutation();
  const productsQuery = useProductsQuery({ status: "ACTIVE", size: 200 });

  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedSubFeatureId, setSelectedSubFeatureId] = useState<number | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);

  // Filter products to teams the SO belongs to (or all products when user has no teams — admins)
  const myProducts = useMemo(() => {
    const all = productsQuery.data?.items ?? [];
    if (userTeamIds.length === 0) return all;
    return all.filter(
      (p) => p.team == null || userTeamIds.includes(p.team.id),
    );
  }, [productsQuery.data?.items, userTeamIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return myProducts;
    return myProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [myProducts, search]);

  const subFeaturesQuery = useSubFeaturesForProductQuery(expandedProductId);
  const subFeatures = (subFeaturesQuery.data ?? []).filter((s) => s.active);

  function handleProductSelect(productId: number, mode: string) {
    if (mode === "ATOMIC") {
      setSelectedProductId(productId);
      setSelectedSubFeatureId(null);
      setExpandedProductId(null);
    } else {
      setExpandedProductId((prev) => (prev === productId ? null : productId));
      setSelectedProductId(null);
      setSelectedSubFeatureId(null);
    }
  }

  function handleSubFeatureSelect(productId: number, subFeatureId: number) {
    setSelectedProductId(productId);
    setSelectedSubFeatureId(subFeatureId);
  }

  function handleConfirm() {
    if (!selectedProductId) return;
    addMutation.mutate(
      {
        requestId,
        body: { productId: selectedProductId, subFeatureId: selectedSubFeatureId ?? undefined },
      },
      {
        onSuccess: () => {
          toast.success("Scope item added and assigned to you for review.");
          handleClose();
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Could not add scope item."),
      },
    );
  }

  function handleClose() {
    setSearch("");
    setSelectedProductId(null);
    setSelectedSubFeatureId(null);
    setExpandedProductId(null);
    onClose();
  }

  if (!open) return null;

  const selectedProduct = myProducts.find((p) => p.id === selectedProductId) ?? null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 1000, background: "rgba(0,0,0,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="bg-white rounded-lg flex flex-col"
        style={{ width: 540, maxHeight: "80vh", border: "1px solid var(--color-border)", overflow: "hidden" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--color-warm-gray-light)",
          }}
        >
          <span className="text-near-black font-semibold" style={{ fontSize: 15 }}>
            Add scope item
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="text-warm-gray-med bg-transparent border-0 cursor-pointer"
            style={{ fontSize: 18, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--color-warm-gray-light)",
          }}
        >
          <label
            className="flex items-center"
            style={{
              gap: 8,
              padding: "0 10px",
              height: 32,
              background: "var(--color-warm-gray-light)",
              borderRadius: 6,
              border: "1px solid transparent",
            }}
          >
            <Search style={{ width: 13, height: 13, flexShrink: 0, color: "var(--fg-2)" }} strokeWidth={1.5} />
            <input
              type="search"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              className="bg-transparent border-0 outline-none text-near-black"
              style={{ flex: 1, fontSize: 13 }}
              autoFocus
            />
          </label>
        </div>

        {/* Product list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {productsQuery.isPending ? (
            <p className="text-warm-gray-med" style={{ padding: "16px", fontSize: 13, margin: 0 }}>
              Loading products…
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-warm-gray-med" style={{ padding: "16px", fontSize: 13, margin: 0 }}>
              No products found.
            </p>
          ) : (
            filtered.map((product) => {
              const isAtomic = product.mode === "ATOMIC";
              const isSelected =
                selectedProductId === product.id && (isAtomic || selectedSubFeatureId == null);
              const isExpanded = expandedProductId === product.id;

              return (
                <div key={product.id}>
                  <button
                    type="button"
                    onClick={() => handleProductSelect(product.id, product.mode)}
                    className="w-full flex items-center text-left bg-transparent border-0"
                    style={{
                      padding: "10px 14px",
                      gap: 10,
                      fontSize: 14,
                      background: isSelected ? "var(--color-light-blue-soft)" : "transparent",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--color-warm-gray-light)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLElement).style.background = "var(--color-warm-gray-light)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = isSelected
                        ? "var(--color-light-blue-soft)"
                        : "transparent";
                    }}
                  >
                    {!isAtomic && (
                      <ChevronRight
                        style={{
                          width: 12,
                          height: 12,
                          flexShrink: 0,
                          color: "var(--fg-2)",
                          transform: isExpanded ? "rotate(90deg)" : "none",
                          transition: "transform 160ms ease",
                        }}
                        strokeWidth={1.7}
                      />
                    )}
                    {isAtomic && (
                      <span style={{ width: 12, flexShrink: 0, display: "inline-flex", justifyContent: "center" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--fg-2)" }} />
                      </span>
                    )}
                    <span style={{ flex: 1 }}>{product.name}</span>
                    {product.team && (
                      <span className="text-warm-gray-med" style={{ fontSize: 11 }}>
                        {product.team.name}
                      </span>
                    )}
                  </button>

                  {/* Sub-features */}
                  {!isAtomic && isExpanded && (
                    <div style={{ background: "#FAFAF9" }}>
                      {subFeaturesQuery.isPending ? (
                        <div className="text-warm-gray-med" style={{ padding: "8px 14px 8px 38px", fontSize: 13 }}>
                          Loading…
                        </div>
                      ) : subFeatures.length === 0 ? (
                        <div className="text-warm-gray-med" style={{ padding: "8px 14px 8px 38px", fontSize: 13 }}>
                          No sub-features available.
                        </div>
                      ) : (
                        subFeatures.map((sf) => {
                          const sfSelected = selectedProductId === product.id && selectedSubFeatureId === sf.id;
                          return (
                            <button
                              key={sf.id}
                              type="button"
                              onClick={() => handleSubFeatureSelect(product.id, sf.id)}
                              className="w-full flex items-center text-left bg-transparent border-0"
                              style={{
                                padding: "9px 14px 9px 38px",
                                fontSize: 13,
                                background: sfSelected ? "var(--color-light-blue-soft)" : "transparent",
                                cursor: "pointer",
                                borderBottom: "1px solid var(--color-warm-gray-light)",
                              }}
                              onMouseEnter={(e) => {
                                if (!sfSelected)
                                  (e.currentTarget as HTMLElement).style.background = "var(--color-warm-gray-light)";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.background = sfSelected
                                  ? "var(--color-light-blue-soft)"
                                  : "transparent";
                              }}
                            >
                              {sf.name}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--color-warm-gray-light)",
            background: "#FBFBFA",
          }}
        >
          <span className="text-warm-gray-med" style={{ fontSize: 13 }}>
            {selectedProduct
              ? `Selected: ${selectedProduct.name}${selectedSubFeatureId ? " (sub-feature)" : ""}`
              : "Select a product above"}
          </span>
          <div className="flex items-center" style={{ gap: 8 }}>
            <SecondaryButton onClick={handleClose}>Cancel</SecondaryButton>
            <PrimaryButton
              disabled={selectedProductId == null || addMutation.isPending}
              onClick={handleConfirm}
            >
              {addMutation.isPending ? "Adding…" : "Add to estimate"}
            </PrimaryButton>
          </div>
        </div>
      </div>
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


// Silence unused-import linter for items kept for future variations.
void TertiaryButton;
void MoreVertical;
void KV;
