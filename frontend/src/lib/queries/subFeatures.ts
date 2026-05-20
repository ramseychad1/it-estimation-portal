import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateSubFeature,
  createSubFeature,
  deactivateSubFeature,
  deleteSubFeature,
  getSubFeature,
  listSubFeaturesForProduct,
  updateSubFeature,
  type CreateSubFeatureRequest,
  type UpdateSubFeatureRequest,
} from "../api/subFeatures";
import {
  deleteSubFeatureTemplateFile,
  uploadSubFeatureTemplateFile,
} from "../api/templateFiles";

const SUB_FEATURES_KEY = ["sub-features"] as const;
const PRODUCTS_KEY = ["products"] as const;

export function useSubFeaturesForProductQuery(productId: number | null) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, productId ?? -1, "sub-features"],
    queryFn: () => listSubFeaturesForProduct(productId as number),
    enabled: productId != null,
  });
}

export function useSubFeatureQuery(id: number | null) {
  return useQuery({
    queryKey: [...SUB_FEATURES_KEY, "detail", id ?? -1],
    queryFn: () => getSubFeature(id as number),
    enabled: id != null,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>, productId?: number) {
  qc.invalidateQueries({ queryKey: SUB_FEATURES_KEY });
  // Bump the parent's sub-feature list and the parent's questions count.
  if (productId != null) {
    qc.invalidateQueries({ queryKey: [...PRODUCTS_KEY, productId] });
  }
  qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
}

export function useCreateSubFeatureMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, body }: { productId: number; body: CreateSubFeatureRequest }) =>
      createSubFeature(productId, body),
    onSuccess: (_, vars) => invalidateAll(qc, vars.productId),
  });
}

export function useUpdateSubFeatureMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateSubFeatureRequest }) => updateSubFeature(id, body),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useActivateSubFeatureMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => activateSubFeature(id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeactivateSubFeatureMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deactivateSubFeature(id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteSubFeatureMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirmationName }: { id: number; confirmationName: string }) =>
      deleteSubFeature(id, confirmationName),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUploadSubFeatureTemplateFileMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) =>
      uploadSubFeatureTemplateFile(id, file),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteSubFeatureTemplateFileMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSubFeatureTemplateFile(id),
    onSuccess: () => invalidateAll(qc),
  });
}
