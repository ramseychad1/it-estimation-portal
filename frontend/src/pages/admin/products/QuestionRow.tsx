import { Pencil, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DragHandle } from "../../../components/DragHandle";
import { KebabMenu } from "../../../components/KebabMenu";
import { StatusBadge } from "../../../components/StatusBadge";
import type { QuestionListItem } from "../../../lib/api/questions";

/**
 * Draggable question row used by both the Atomic Product detail page and
 * the SubFeature detail page. Lifted from those two pages at Phase 5b
 * close-out — they had byte-identical copies through the end of 5a, and
 * Phase 5b didn't touch question rows, so the consolidation is safe.
 *
 * <p>The pages still own their own {@code DraggableQuestionList} shells
 * because each shell calls a different reorder mutation hook
 * ({@code useReorderProductQuestionsMutation} vs.
 * {@code useReorderSubFeatureQuestionsMutation}). Lifting the shell would
 * require a parameterised mutation factory, which is more abstraction
 * than the small win is worth.
 */
export function SortableQuestionRow({
  question,
  onEdit,
  onDelete,
}: {
  question: QuestionListItem;
  onEdit?: () => void;
  onDelete?: () => void;
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
      {(onEdit || onDelete) && (
        <KebabMenu
          items={[
            ...(onEdit ? [{ label: "Edit", icon: <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />, onSelect: onEdit }] : []),
            ...(onDelete ? [{
              label: "Delete",
              icon: <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
              destructive: true,
              onSelect: onDelete,
            }] : []),
          ]}
        />
      )}
    </li>
  );
}

export function RequiredPill({ required }: { required: boolean }) {
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
