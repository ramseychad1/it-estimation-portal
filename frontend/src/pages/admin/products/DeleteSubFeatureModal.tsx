import { ConfirmModal } from "../../../components/ConfirmModal";
import { useDeleteSubFeatureMutation } from "../../../lib/queries/subFeatures";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/api";
import type { SubFeatureDetail, SubFeatureListItem } from "../../../lib/api/subFeatures";

type SubFeatureLike = SubFeatureDetail | SubFeatureListItem;

interface DeleteSubFeatureModalProps {
  open: boolean;
  subFeature: SubFeatureLike | null;
  onClose: () => void;
  onDeleted?: () => void;
}

/**
 * Same heavy-variant pattern as DeleteProductModal: typed-name
 * confirmation + cascade summary. Cascades only purge the sub-feature's
 * questions and its template (when 5b ships); the parent product stays
 * put.
 */
export function DeleteSubFeatureModal({
  open,
  subFeature,
  onClose,
  onDeleted,
}: DeleteSubFeatureModalProps) {
  const deleteMutation = useDeleteSubFeatureMutation();
  const toast = useToast();

  if (!subFeature) return null;

  async function handleConfirm() {
    if (!subFeature) return;
    try {
      await deleteMutation.mutateAsync({
        id: subFeature.id,
        confirmationName: subFeature.name,
      });
      toast.success(`Sub-feature '${subFeature.name}' deleted.`);
      onClose();
      onDeleted?.();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error("Could not delete the sub-feature. Please try again.");
      }
    }
  }

  const body = (
    <>
      <p className="m-0" style={{ fontSize: 14 }}>
        This will permanently delete <strong>'{subFeature.name}'</strong>
        {subFeature.questionCount > 0 ? <> along with:</> : <>.</>}
      </p>
      {subFeature.questionCount > 0 && (
        <ul className="mt-2 mb-2" style={{ fontSize: 13, paddingLeft: 18 }}>
          <li>
            {subFeature.questionCount} critical question
            {subFeature.questionCount === 1 ? "" : "s"}
          </li>
        </ul>
      )}
      <p
        className="m-0 mt-2"
        style={{ fontSize: 13, color: "var(--color-warm-gray-med)" }}
      >
        This action cannot be undone.
      </p>
    </>
  );

  return (
    <ConfirmModal
      open={open}
      title="Delete this sub-feature?"
      body={body}
      onCancel={onClose}
      onConfirm={handleConfirm}
      confirmLabel="Delete sub-feature"
      destructive
      requireTypedConfirmation={{
        value: subFeature.name,
        label: "Type the sub-feature name to confirm",
      }}
    />
  );
}
