import {
  CheckCircle2,
  History,
  Info,
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
  useActivateProductMutation,
  useDeactivateProductMutation,
  useProductQuery,
} from "../../../lib/queries/products";
import { useSubFeaturesForProductQuery } from "../../../lib/queries/subFeatures";
import {
  useDeleteQuestionMutation,
  useProductQuestionsQuery,
  useReorderProductQuestionsMutation,
} from "../../../lib/queries/questions";
import type { ProductMode } from "../../../lib/api/products";
import type { QuestionListItem } from "../../../lib/api/questions";
import type { SubFeatureListItem } from "../../../lib/api/subFeatures";
import { EditProductDrawer } from "./EditProductDrawer";
import { DeleteProductModal } from "./DeleteProductModal";
import { DeleteSubFeatureModal } from "./DeleteSubFeatureModal";
import { NewSubFeatureDrawer } from "./NewSubFeatureDrawer";
import { AddQuestionDrawer, type QuestionDrawerParent } from "./AddQuestionDrawer";
import { TemplateEditorCard } from "./TemplateEditorCard";
import { SortableQuestionRow } from "./QuestionRow";
import {
  useCreateProductTemplateMutation,
  useProductTemplateQuery,
  useSaveProductTemplateMutation,
} from "../../../lib/queries/templates";

type Drawer =
  | { kind: "closed" }
  | { kind: "edit-product" }
  | { kind: "new-sub-feature" }
  | { kind: "add-question"; parent: QuestionDrawerParent }
  | { kind: "edit-question"; question: QuestionListItem; parent: QuestionDrawerParent };

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const id = productId ? Number(productId) : null;
  const navigate = useNavigate();
  const toast = useToast();

  const productQuery = useProductQuery(id);
  const subFeaturesQuery = useSubFeaturesForProductQuery(
    productQuery.data?.mode === "CONTAINER" ? id : null
  );
  const questionsQuery = useProductQuestionsQuery(
    productQuery.data?.mode === "ATOMIC" ? id : null
  );

  const activateMutation = useActivateProductMutation();
  const deactivateMutation = useDeactivateProductMutation();

  const [drawer, setDrawer] = useState<Drawer>({ kind: "closed" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [subFeatureToDelete, setSubFeatureToDelete] = useState<SubFeatureListItem | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<QuestionListItem | null>(null);

  useEffect(() => {
    if (productQuery.data) {
      document.title = `${productQuery.data.name} — Estimator`;
    }
  }, [productQuery.data?.name]);

  if (productQuery.isLoading) {
    return <p className="text-warm-gray-med py-12 text-center">Loading…</p>;
  }
  if (productQuery.isError || !productQuery.data) {
    return (
      <EmptyState
        title="Product not found"
        description="The product you're looking for may have been deleted or you may not have access to it."
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

  const product = productQuery.data;

  const headerKebab: KebabMenuItem[] = [
    {
      label: "Edit Quick Info",
      icon: <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />,
      onSelect: () => setDrawer({ kind: "edit-product" }),
    },
    {
      label: "View history",
      icon: <History className="w-3.5 h-3.5" strokeWidth={1.5} />,
      // Deep-links to the Change Log filtered by this product's name so the
      // user lands on something useful rather than a generic feed. Search
      // is name-based because we don't expose the entity id in user-facing
      // surfaces; multiple deactivated copies sharing the name is acceptable
      // friction, not a correctness issue.
      onSelect: () =>
        navigate(
          `/admin/change-log?search=${encodeURIComponent(product.name)}`,
        ),
    },
    { kind: "divider" },
    product.active
      ? {
          label: "Deactivate",
          icon: <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} />,
          onSelect: () =>
            deactivateMutation.mutate(product.id, {
              onSuccess: () => toast.success(`${product.name} deactivated.`),
              onError: () => toast.error("Could not deactivate."),
            }),
        }
      : {
          label: "Activate",
          icon: <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
          onSelect: () =>
            activateMutation.mutate(product.id, {
              onSuccess: () => toast.success(`${product.name} activated.`),
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
          { label: product.name },
        ]}
        title={product.name}
        titleSuffix={
          <StatusBadge variant={product.active ? "active" : "inactive"}>
            {product.active ? "Active" : "Inactive"}
          </StatusBadge>
        }
        subtitle={
          <span className="inline-flex items-center gap-2">
            <ModePill mode={product.mode} />
            {product.description && (
              <>
                <span aria-hidden="true">·</span>
                <span>{product.description}</span>
              </>
            )}
          </span>
        }
        actions={<KebabMenu items={headerKebab} />}
        auditFooter={
          <EntityHeader.AuditFooter
            createdAt={product.createdAt}
            createdBy={product.createdBy}
            updatedAt={product.updatedAt}
            updatedBy={product.updatedBy}
          />
        }
      />

      <div className="flex flex-col gap-6 mt-6">
        {product.mode === "CONTAINER" ? (
          <ContainerLayout
            productId={product.id}
            productName={product.name}
            subFeatures={subFeaturesQuery.data ?? []}
            loading={subFeaturesQuery.isLoading}
            onAddSubFeature={() => setDrawer({ kind: "new-sub-feature" })}
            onRequestDeleteSubFeature={(sub) => setSubFeatureToDelete(sub)}
          />
        ) : (
          <AtomicLayout
            productId={product.id}
            productName={product.name}
            questions={questionsQuery.data ?? []}
            loading={questionsQuery.isLoading}
            onAddQuestion={() =>
              setDrawer({
                kind: "add-question",
                parent: { kind: "Product", id: product.id, name: product.name },
              })
            }
            onEditQuestion={(q) =>
              setDrawer({
                kind: "edit-question",
                question: q,
                parent: { kind: "Product", id: product.id, name: product.name },
              })
            }
            onRequestDeleteQuestion={(q) => setQuestionToDelete(q)}
          />
        )}
      </div>

      <EditProductDrawer
        open={drawer.kind === "edit-product"}
        product={product}
        onClose={() => setDrawer({ kind: "closed" })}
        onRequestDelete={() => {
          setDrawer({ kind: "closed" });
          setDeleteOpen(true);
        }}
      />
      <DeleteProductModal
        open={deleteOpen}
        product={product}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate("/catalog/products")}
      />
      <DeleteSubFeatureModal
        open={!!subFeatureToDelete}
        subFeature={subFeatureToDelete}
        onClose={() => setSubFeatureToDelete(null)}
      />
      <DeleteQuestionConfirm
        open={!!questionToDelete}
        question={questionToDelete}
        onClose={() => setQuestionToDelete(null)}
      />
      <NewSubFeatureDrawer
        open={drawer.kind === "new-sub-feature"}
        productId={product.id}
        productName={product.name}
        onClose={() => setDrawer({ kind: "closed" })}
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
    </>
  );
}

// =====================================================================
// CONTAINER LAYOUT — Sub-features section + container-questions notice
// =====================================================================

function ContainerLayout({
  productId,
  productName,
  subFeatures,
  loading,
  onAddSubFeature,
  onRequestDeleteSubFeature,
}: {
  productId: number;
  productName: string;
  subFeatures: SubFeatureListItem[];
  loading: boolean;
  onAddSubFeature: () => void;
  onRequestDeleteSubFeature: (sub: SubFeatureListItem) => void;
}) {
  return (
    <>
      <Section
        title="Sub-features"
        count={subFeatures.length}
        action={
          <PrimaryButton onClick={onAddSubFeature}>
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            New sub-feature
          </PrimaryButton>
        }
      >
        {loading ? (
          <p className="text-warm-gray-med text-center py-8">Loading…</p>
        ) : subFeatures.length === 0 ? (
          <EmptyState
            variant="inline"
            title="No sub-features yet"
            description="Add the first sub-feature to organize this product's variants."
            action={
              <PrimaryButton onClick={onAddSubFeature}>
                <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                New sub-feature
              </PrimaryButton>
            }
          />
        ) : (
          <SubFeatureMiniTable
            productId={productId}
            rows={subFeatures}
            onRequestDelete={onRequestDeleteSubFeature}
          />
        )}
      </Section>

      <Section title="Critical questions">
        <div
          className="flex items-start gap-2 rounded-md"
          style={{
            padding: "12px 14px",
            background: "var(--color-light-blue-soft)",
            border: "1px solid rgba(187,221,230,0.7)",
          }}
        >
          <Info className="w-4 h-4 mt-0.5 text-near-black flex-shrink-0" strokeWidth={1.5} />
          <p className="m-0 text-near-black" style={{ fontSize: 13 }}>
            Critical questions for container products live on each sub-feature. Open a
            sub-feature above to manage its questions.
          </p>
        </div>
      </Section>

      {/* productName referenced for downstream wiring/aria-context */}
      <span className="sr-only">{productName}</span>
    </>
  );
}

function SubFeatureMiniTable({
  productId,
  rows,
  onRequestDelete,
}: {
  productId: number;
  rows: SubFeatureListItem[];
  onRequestDelete: (sub: SubFeatureListItem) => void;
}) {
  const navigate = useNavigate();

  return (
    <div role="table" aria-label="Sub-features" className="flex flex-col">
      <div
        role="rowheader"
        className="grid items-center text-warm-gray-med uppercase font-medium"
        style={{
          gridTemplateColumns: "2fr 3fr 110px 100px 110px 48px",
          gap: 12,
          padding: "8px 12px",
          fontSize: 11,
          letterSpacing: "0.04em",
          borderBottom: "1px solid var(--color-warm-gray-light)",
        }}
      >
        <span>Name</span>
        <span>Description</span>
        <span style={{ textAlign: "right" }}>Questions</span>
        <span>Status</span>
        <span>Updated</span>
        <span />
      </div>
      {rows.map((sub) => (
        <div
          key={sub.id}
          role="row"
          tabIndex={0}
          onClick={() => navigate(`/catalog/products/${productId}/sub-features/${sub.id}`)}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate(`/catalog/products/${productId}/sub-features/${sub.id}`);
          }}
          className="grid items-center cursor-pointer hover:bg-warm-gray-light"
          style={{
            gridTemplateColumns: "2fr 3fr 110px 100px 110px 48px",
            gap: 12,
            padding: "10px 12px",
            borderBottom: "1px solid var(--color-warm-gray-light)",
            fontSize: 13,
          }}
        >
          <span className="font-semibold text-near-black">{sub.name}</span>
          <span
            className="text-warm-gray-med"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sub.description ?? "—"}
          </span>
          <span className="tabular-nums text-near-black" style={{ textAlign: "right" }}>
            {sub.questionCount}
          </span>
          <StatusBadge variant={sub.active ? "active" : "inactive"}>
            {sub.active ? "Active" : "Inactive"}
          </StatusBadge>
          <span className="text-warm-gray-med" style={{ fontSize: 12 }}>
            {sub.updatedAt ? new Date(sub.updatedAt).toLocaleDateString() : "—"}
          </span>
          <span onClick={(e) => e.stopPropagation()}>
            <KebabMenu
              items={[
                {
                  label: "Open",
                  onSelect: () => navigate(`/catalog/products/${productId}/sub-features/${sub.id}`),
                },
                { kind: "divider" },
                {
                  label: "Delete",
                  icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
                  destructive: true,
                  onSelect: () => onRequestDelete(sub),
                },
              ]}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

// =====================================================================
// ATOMIC LAYOUT — template placeholder + draggable questions list
// =====================================================================

function AtomicLayout({
  productId,
  productName,
  questions,
  loading,
  onAddQuestion,
  onEditQuestion,
  onRequestDeleteQuestion,
}: {
  productId: number;
  productName: string;
  questions: QuestionListItem[];
  loading: boolean;
  onAddQuestion: () => void;
  onEditQuestion: (q: QuestionListItem) => void;
  onRequestDeleteQuestion: (q: QuestionListItem) => void;
}) {
  return (
    <>
      <Section title="Estimate template">
        <ProductTemplateEditor productId={productId} />
      </Section>

      <Section
        title="Critical questions"
        count={questions.length}
        action={
          <PrimaryButton onClick={onAddQuestion}>
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            Add question
          </PrimaryButton>
        }
      >
        {loading ? (
          <p className="text-warm-gray-med text-center py-8">Loading…</p>
        ) : questions.length === 0 ? (
          <EmptyState
            variant="inline"
            title="No questions yet"
            description="Critical questions are asked of the requester before an estimate can be generated."
            action={
              <PrimaryButton onClick={onAddQuestion}>
                <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                Add question
              </PrimaryButton>
            }
          />
        ) : (
          <DraggableQuestionList
            productId={productId}
            questions={questions}
            onEdit={onEditQuestion}
            onRequestDelete={onRequestDeleteQuestion}
          />
        )}
      </Section>

      {/* productName kept in scope for downstream context. */}
      <span className="sr-only">{productName}</span>
    </>
  );
}

function DraggableQuestionList({
  productId,
  questions,
  onEdit,
  onRequestDelete,
}: {
  productId: number;
  questions: QuestionListItem[];
  onEdit: (q: QuestionListItem) => void;
  onRequestDelete: (q: QuestionListItem) => void;
}) {
  const reorderMutation = useReorderProductQuestionsMutation();
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
      { productId, questionIds: next },
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

// =====================================================================
// Section card — shared shell for both layouts
// =====================================================================

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

/**
 * Standard ConfirmModal for question delete — no typed-name confirmation
 * (per the prompt: "Questions are smaller surface than Products /
 * SubFeatures; basic confirm is enough").
 */
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
 * Thin wrapper that pulls the active product template via React Query
 * and hands it to the shared {@link TemplateEditorCard}. Stays inline in
 * this file because it has no other call sites; if the SubFeature
 * equivalent and this start to drift, lift them into separate files.
 */
function ProductTemplateEditor({ productId }: { productId: number }) {
  const query = useProductTemplateQuery(productId);
  const create = useCreateProductTemplateMutation();
  const save = useSaveProductTemplateMutation();

  return (
    <TemplateEditorCard
      template={query.data ?? null}
      loading={query.isLoading}
      parentNoun="atomic product"
      onCreate={async () => {
        await create.mutateAsync({ productId });
      }}
      onSave={(req) => save.mutateAsync({ productId, body: req })}
    />
  );
}

function ModePill({ mode }: { mode: ProductMode }) {
  const isAtomic = mode === "ATOMIC";
  return (
    <span
      data-testid={`mode-pill-${mode.toLowerCase()}`}
      className="inline-flex items-center text-near-black"
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        background: isAtomic ? "var(--color-warm-gray-light)" : "var(--color-light-blue-soft)",
        border: isAtomic
          ? "1px solid var(--color-border-strong)"
          : "1px solid rgba(187,221,230,0.7)",
      }}
    >
      {isAtomic ? "Atomic" : "Container"}
    </span>
  );
}
