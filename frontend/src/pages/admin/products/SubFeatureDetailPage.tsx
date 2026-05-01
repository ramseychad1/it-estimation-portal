import {
  CheckCircle2,
  History,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EntityHeader } from "../../../components/EntityHeader";
import { CountPill } from "../../../components/CountPill";
import { EmptyState } from "../../../components/EmptyState";
import { StatusBadge } from "../../../components/StatusBadge";
import { KebabMenu, type KebabMenuItem } from "../../../components/KebabMenu";
import { PrimaryButton } from "../../../components/buttons";
import { DragHandle } from "../../../components/DragHandle";
import { ConfirmModal } from "../../../components/ConfirmModal";
import { useToast } from "../../../components/Toast";
import {
  useActivateSubFeatureMutation,
  useDeactivateSubFeatureMutation,
  useSubFeatureQuery,
} from "../../../lib/queries/subFeatures";
import { useProductQuery } from "../../../lib/queries/products";
import {
  useDeleteQuestionMutation,
  useReorderSubFeatureQuestionsMutation,
  useSubFeatureQuestionsQuery,
} from "../../../lib/queries/questions";
import type { QuestionListItem } from "../../../lib/api/questions";
import { EditSubFeatureDrawer } from "./EditSubFeatureDrawer";
import { DeleteSubFeatureModal } from "./DeleteSubFeatureModal";
import { AddQuestionDrawer, type QuestionDrawerParent } from "./AddQuestionDrawer";

type Drawer =
  | { kind: "closed" }
  | { kind: "edit-sub-feature" }
  | { kind: "add-question"; parent: QuestionDrawerParent }
  | { kind: "edit-question"; question: QuestionListItem; parent: QuestionDrawerParent };

export function SubFeatureDetailPage() {
  const { productId, subFeatureId } = useParams<{ productId: string; subFeatureId: string }>();
  const pid = productId ? Number(productId) : null;
  const sid = subFeatureId ? Number(subFeatureId) : null;
  const navigate = useNavigate();
  const toast = useToast();

  const productQuery = useProductQuery(pid);
  const subFeatureQuery = useSubFeatureQuery(sid);
  const questionsQuery = useSubFeatureQuestionsQuery(sid);

  const activateMutation = useActivateSubFeatureMutation();
  const deactivateMutation = useDeactivateSubFeatureMutation();

  const [drawer, setDrawer] = useState<Drawer>({ kind: "closed" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<QuestionListItem | null>(null);

  useEffect(() => {
    if (subFeatureQuery.data) {
      document.title = `${subFeatureQuery.data.name} — Estimator`;
    }
  }, [subFeatureQuery.data?.name]);

  if (subFeatureQuery.isLoading) {
    return <p className="text-warm-gray-med py-12 text-center">Loading…</p>;
  }
  if (subFeatureQuery.isError || !subFeatureQuery.data) {
    return (
      <EmptyState
        title="Sub-feature not found"
        description="The sub-feature may have been deleted, or it belongs to a different product."
        action={
          <button
            type="button"
            onClick={() => navigate("/catalog/products")}
            className="text-near-black hover:underline bg-transparent border-0 cursor-pointer"
            style={{ fontSize: 13 }}
          >
            ← Back to products
          </button>
        }
      />
    );
  }

  const sub = subFeatureQuery.data;
  const product = productQuery.data;
  const questions = questionsQuery.data ?? [];

  const headerKebab: KebabMenuItem[] = [
    {
      label: "Edit Quick Info",
      icon: <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />,
      onSelect: () => setDrawer({ kind: "edit-sub-feature" }),
    },
    {
      label: "View history",
      icon: <History className="w-3.5 h-3.5" strokeWidth={1.5} />,
      onSelect: () =>
        navigate(`/admin/change-log?search=${encodeURIComponent(sub.name)}`),
    },
    { kind: "divider" },
    sub.active
      ? {
          label: "Deactivate",
          icon: <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} />,
          onSelect: () =>
            deactivateMutation.mutate(sub.id, {
              onSuccess: () => toast.success(`${sub.name} deactivated.`),
              onError: () => toast.error("Could not deactivate."),
            }),
        }
      : {
          label: "Activate",
          icon: <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
          onSelect: () =>
            activateMutation.mutate(sub.id, {
              onSuccess: () => toast.success(`${sub.name} activated.`),
              onError: (err) =>
                toast.error(
                  err instanceof Error && err.message.includes("Cannot reactivate")
                    ? err.message
                    : "Could not activate.",
                ),
            }),
        },
    {
      label: "Delete",
      icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
      destructive: true,
      onSelect: () => setDeleteOpen(true),
    },
  ];

  return (
    <>
      <EntityHeader
        breadcrumb={[
          { label: "Catalog", to: "/catalog/products" },
          { label: "Products", to: "/catalog/products" },
          {
            label: product?.name ?? "…",
            to: pid != null ? `/catalog/products/${pid}` : undefined,
          },
          { label: sub.name },
        ]}
        title={sub.name}
        titleSuffix={
          <StatusBadge variant={sub.active ? "active" : "inactive"}>
            {sub.active ? "Active" : "Inactive"}
          </StatusBadge>
        }
        subtitle={sub.description ? <span>{sub.description}</span> : undefined}
        actions={<KebabMenu items={headerKebab} />}
        auditFooter={
          <EntityHeader.AuditFooter
            createdAt={sub.createdAt}
            createdBy={sub.createdBy}
            updatedAt={sub.updatedAt}
            updatedBy={sub.updatedBy}
          />
        }
      />

      <div className="flex flex-col gap-6 mt-6">
        <Section title="Estimate template">
          <div
            className="text-center rounded-md"
            style={{
              padding: "32px 24px",
              background: "var(--color-warm-gray-light)",
              border: "1px dashed var(--color-border-strong)",
              color: "var(--color-warm-gray-med)",
              fontSize: 13,
            }}
          >
            Estimate template editor coming with Phase 5b.
          </div>
        </Section>

        <Section
          title="Critical questions"
          count={questions.length}
          action={
            <PrimaryButton
              onClick={() =>
                setDrawer({
                  kind: "add-question",
                  parent: { kind: "SubFeature", id: sub.id, name: sub.name },
                })
              }
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              Add question
            </PrimaryButton>
          }
        >
          {questionsQuery.isLoading ? (
            <p className="text-warm-gray-med text-center py-8">Loading…</p>
          ) : questions.length === 0 ? (
            <EmptyState
              variant="inline"
              title="No questions yet"
              description="Critical questions are asked of the requester before an estimate can be generated."
              action={
                <PrimaryButton
                  onClick={() =>
                    setDrawer({
                      kind: "add-question",
                      parent: { kind: "SubFeature", id: sub.id, name: sub.name },
                    })
                  }
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                  Add question
                </PrimaryButton>
              }
            />
          ) : (
            <DraggableSubFeatureQuestionList
              subFeatureId={sub.id}
              questions={questions}
              onEdit={(q) =>
                setDrawer({
                  kind: "edit-question",
                  question: q,
                  parent: { kind: "SubFeature", id: sub.id, name: sub.name },
                })
              }
              onRequestDelete={(q) => setQuestionToDelete(q)}
            />
          )}
        </Section>
      </div>

      <EditSubFeatureDrawer
        open={drawer.kind === "edit-sub-feature"}
        subFeature={sub}
        onClose={() => setDrawer({ kind: "closed" })}
        onRequestDelete={() => {
          setDrawer({ kind: "closed" });
          setDeleteOpen(true);
        }}
      />
      <DeleteSubFeatureModal
        open={deleteOpen}
        subFeature={sub}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() =>
          navigate(pid != null ? `/catalog/products/${pid}` : "/catalog/products")
        }
      />
      <AddQuestionDrawer
        open={drawer.kind === "add-question"}
        parent={drawer.kind === "add-question" ? drawer.parent : null}
        onClose={() => setDrawer({ kind: "closed" })}
      />
      <AddQuestionDrawer
        open={drawer.kind === "edit-question"}
        parent={drawer.kind === "edit-question" ? drawer.parent : null}
        question={drawer.kind === "edit-question" ? (drawer.question as any) : null}
        onClose={() => setDrawer({ kind: "closed" })}
      />
      <DeleteQuestionConfirm
        open={!!questionToDelete}
        question={questionToDelete}
        onClose={() => setQuestionToDelete(null)}
      />
    </>
  );
}

// =====================================================================
// Drag list scoped to a sub-feature parent
// =====================================================================

function DraggableSubFeatureQuestionList({
  subFeatureId,
  questions,
  onEdit,
  onRequestDelete,
}: {
  subFeatureId: number;
  questions: QuestionListItem[];
  onEdit: (q: QuestionListItem) => void;
  onRequestDelete: (q: QuestionListItem) => void;
}) {
  const reorderMutation = useReorderSubFeatureQuestionsMutation();
  const toast = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = useMemo(() => questions.map((q) => q.id), [questions]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(Number(active.id));
    const newIndex = ids.indexOf(Number(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = [...ids];
    next.splice(oldIndex, 1);
    next.splice(newIndex, 0, Number(active.id));
    reorderMutation.mutate(
      { subFeatureId, questionIds: next },
      { onError: () => toast.error("Could not reorder questions.") }
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="m-0 p-0 list-none flex flex-col gap-2">
          {questions.map((q) => (
            <SortableQuestionRow
              key={q.id}
              question={q}
              onEdit={() => onEdit(q)}
              onDelete={() => onRequestDelete(q)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

// TODO(post-5b-consolidation): byte-identical twin of ProductDetailPage's
// SortableQuestionRow. If both rows stay identical through Phase 5b,
// consolidate onto a shared SortableQuestionsList component. See the
// matching TODO in ProductDetailPage.tsx — both must move together.
function SortableQuestionRow({
  question,
  onEdit,
  onDelete,
}: {
  question: QuestionListItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={{
        ...style,
        padding: "12px 14px",
        background: "var(--color-white)",
        border: "1px solid var(--color-warm-gray-light)",
        borderRadius: 6,
      }}
      className="flex items-start gap-3"
    >
      <DragHandle {...attributes} {...listeners} />
      <span
        aria-label={`Display order ${question.displayOrder}`}
        className="inline-flex items-center justify-center text-near-black tabular-nums flex-shrink-0"
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "var(--color-warm-gray-light)",
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {question.displayOrder}
      </span>
      <div className="flex-1 min-w-0">
        <p className="m-0 font-semibold text-near-black" style={{ fontSize: 14 }}>
          {question.questionText}
        </p>
        {question.helpText && (
          <p className="m-0 mt-1 text-warm-gray-med" style={{ fontSize: 12 }}>
            {question.helpText}
          </p>
        )}
      </div>
      <RequiredPill required={question.required} />
      <StatusBadge variant={question.active ? "active" : "inactive"}>
        {question.active ? "Active" : "Inactive"}
      </StatusBadge>
      <KebabMenu
        items={[
          { label: "Edit", icon: <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />, onSelect: onEdit },
          {
            label: "Delete",
            icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
            destructive: true,
            onSelect: onDelete,
          },
        ]}
      />
    </li>
  );
}

function RequiredPill({ required }: { required: boolean }) {
  if (required) {
    return (
      <span
        className="inline-flex items-center"
        style={{
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 500,
          background: "var(--color-white)",
          color: "var(--color-cardinal-red)",
          border: "1px solid var(--color-cardinal-red)",
        }}
      >
        Required
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center text-warm-gray-med"
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        background: "var(--color-warm-gray-light)",
        border: "1px solid var(--color-border-strong)",
      }}
    >
      Optional
    </span>
  );
}

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-md bg-white"
      style={{ border: "1px solid var(--color-warm-gray-light)", padding: 24 }}
    >
      <header className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <h2
            className="m-0 text-near-black font-semibold tracking-tight"
            style={{ fontSize: 18 }}
          >
            {title}
          </h2>
          {typeof count === "number" && <CountPill count={count} />}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function DeleteQuestionConfirm({
  open,
  question,
  onClose,
}: {
  open: boolean;
  question: QuestionListItem | null;
  onClose: () => void;
}) {
  const deleteMutation = useDeleteQuestionMutation();
  const toast = useToast();

  if (!question) return null;

  async function handleConfirm() {
    if (!question) return;
    try {
      await deleteMutation.mutateAsync(question.id);
      toast.success("Question deleted.");
      onClose();
    } catch {
      toast.error("Could not delete that question.");
    }
  }

  return (
    <ConfirmModal
      open={open}
      title="Delete this question?"
      body={
        <>
          <p className="m-0" style={{ fontSize: 14 }}>
            <em>"{question.questionText}"</em>
          </p>
          <p
            className="m-0 mt-2"
            style={{ fontSize: 13, color: "var(--color-warm-gray-med)" }}
          >
            This question will be removed from <strong>'{question.parentName}'</strong>. This action cannot be undone.
          </p>
        </>
      }
      onCancel={onClose}
      onConfirm={handleConfirm}
      confirmLabel="Delete question"
      destructive
    />
  );
}
