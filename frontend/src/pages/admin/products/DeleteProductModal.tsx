import { ConfirmModal } from "../../../components/ConfirmModal";
import { useDeleteProductMutation } from "../../../lib/queries/products";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/api";
import type { ProductDetail } from "../../../lib/api/products";

interface DeleteProductModalProps {
  open: boolean;
  product: ProductDetail | null;
  onClose: () => void;
  /** Called once the deletion succeeds. */
  onDeleted?: () => void;
}

/**
 * Heavy-variant ConfirmModal: typed-name confirmation + cascade summary.
 * Numbers come from the product's detail row (subFeatureCount,
 * questionCount). Templates are mentioned only when 5b ships them; for
 * 5a the count is implicitly 0 and we omit the line.
 */
export function DeleteProductModal({ open, product, onClose, onDeleted }: DeleteProductModalProps) {
  const deleteMutation = useDeleteProductMutation();
  const toast = useToast();

  if (!product) return null;

  async function handleConfirm() {
    if (!product) return;
    try {
      await deleteMutation.mutateAsync({
        id: product.id,
        confirmationName: product.name,
      });
      toast.success(`Product '${product.name}' deleted.`);
      onClose();
      onDeleted?.();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error("Could not delete the product. Please try again.");
      }
    }
  }

  const cascadeLines: string[] = [];
  if (product.subFeatureCount > 0) {
    cascadeLines.push(
      `${product.subFeatureCount} sub-feature${product.subFeatureCount === 1 ? "" : "s"}`
    );
  }
  if (product.questionCount > 0) {
    cascadeLines.push(
      `${product.questionCount} critical question${product.questionCount === 1 ? "" : "s"}`
    );
  }

  const body = (
    <>
      <p className="m-0" style={{ fontSize: 14 }}>
        This will permanently delete <strong>'{product.name}'</strong>
        {cascadeLines.length > 0 ? <> along with:</> : <>.</>}
      </p>
      {cascadeLines.length > 0 && (
        <ul className="mt-2 mb-2" style={{ fontSize: 13, paddingLeft: 18 }}>
          {cascadeLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <p className="m-0 mt-2" style={{ fontSize: 13, color: "var(--color-warm-gray-med)" }}>
        This action cannot be undone.
      </p>
    </>
  );

  return (
    <ConfirmModal
      open={open}
      title="Delete this product?"
      body={body}
      onCancel={onClose}
      onConfirm={handleConfirm}
      confirmLabel="Delete product"
      destructive
      requireTypedConfirmation={{
        value: product.name,
        label: "Type the product name to confirm",
      }}
    />
  );
}
