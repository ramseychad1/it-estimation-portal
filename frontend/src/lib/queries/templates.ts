import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProductTemplate,
  createSubFeatureTemplate,
  getProductTemplate,
  getSubFeatureTemplate,
  saveProductTemplate,
  saveSubFeatureTemplate,
  type CreateTemplateRequest,
  type SaveTemplateVersionRequest,
} from "../api/templates";

const TEMPLATES_KEY = ["templates"] as const;
const PRODUCTS_KEY = ["products"] as const;
const SUB_FEATURES_KEY = ["sub-features"] as const;

export function useProductTemplateQuery(productId: number | null) {
  return useQuery({
    queryKey: [...TEMPLATES_KEY, "product", productId ?? -1],
    queryFn: () => getProductTemplate(productId as number),
    enabled: productId != null,
  });
}

export function useSubFeatureTemplateQuery(subFeatureId: number | null) {
  return useQuery({
    queryKey: [...TEMPLATES_KEY, "sub-feature", subFeatureId ?? -1],
    queryFn: () => getSubFeatureTemplate(subFeatureId as number),
    enabled: subFeatureId != null,
  });
}

export function useCreateProductTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, body }: { productId: number; body?: CreateTemplateRequest }) =>
      createProductTemplate(productId, body ?? {}),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [...TEMPLATES_KEY, "product", vars.productId] });
      // Bump the parent's detail (template-status indicator may update).
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
  });
}

export function useCreateSubFeatureTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subFeatureId, body }: { subFeatureId: number; body?: CreateTemplateRequest }) =>
      createSubFeatureTemplate(subFeatureId, body ?? {}),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [...TEMPLATES_KEY, "sub-feature", vars.subFeatureId] });
      qc.invalidateQueries({ queryKey: SUB_FEATURES_KEY });
    },
  });
}

export function useSaveProductTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, body }: { productId: number; body: SaveTemplateVersionRequest }) =>
      saveProductTemplate(productId, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [...TEMPLATES_KEY, "product", vars.productId] });
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
    },
  });
}

export function useSaveSubFeatureTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subFeatureId, body }: { subFeatureId: number; body: SaveTemplateVersionRequest }) =>
      saveSubFeatureTemplate(subFeatureId, body),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [...TEMPLATES_KEY, "sub-feature", vars.subFeatureId] });
      qc.invalidateQueries({ queryKey: SUB_FEATURES_KEY });
    },
  });
}
