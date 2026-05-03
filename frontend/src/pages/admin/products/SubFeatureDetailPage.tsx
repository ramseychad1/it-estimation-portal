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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { EntityHeader } from "../../../components/EntityHeader";
import { CountPill } from "../../../components/CountPill";
import { EmptyState } from "../../../components/EmptyState";
import { StatusBadge } from "../../../components/StatusBadge";
import { KebabMenu, type KebabMenuItem } from "../../../components/KebabMenu";
import { PrimaryButton } from "../../../components/buttons";
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
import { TemplateEditorCard } from "./TemplateEditorCard";
import { SortableQuestionRow } from "./QuestionRow";
import {
  useCreateSubFeatureTemplateMutation,
  useSaveSubFeatureTemplateMutation,
  useSubFeatureTemplateQuery,
} from "../../../lib/queries/templates";

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
      label: "Edit Product",
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
          <SubFeatureTemplateEditor subFeatureId={sub.id} />
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

// SortableQuestionRow + RequiredPill lifted to QuestionRow.tsx at Phase
// 5b close-out. Both pages now import the shared component.

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

/**
 * SubFeature equivalent of {@code ProductTemplateEditor}. Inline for the
 * same locality reasons; if the two start to drift they should split.
 */
function SubFeatureTemplateEditor({ subFeatureId }: { subFeatureId: number }) {
  const query = useSubFeatureTemplateQuery(subFeatureId);
  const create = useCreateSubFeatureTemplateMutation();
  const save = useSaveSubFeatureTemplateMutation();

  return (
    <TemplateEditorCard
      template={query.data ?? null}
      loading={query.isLoading}
      parentNoun="sub-feature"
      onCreate={async () => {
        await create.mutateAsync({ subFeatureId });
      }}
      onSave={(req) => save.mutateAsync({ subFeatureId, body: req })}
    />
  );
}
