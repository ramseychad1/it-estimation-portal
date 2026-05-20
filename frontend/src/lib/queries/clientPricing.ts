import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getClientPricingDefaults,
  getEffectiveCategoryPricing,
  listCategoryPricingConfigs,
  updateCategoryPricing,
  updateClientPricingDefaults,
  type UpdateCategoryPricingRequest,
  type UpdateDefaultsRequest,
} from "../api/clientPricing";

const CP_KEY = ["clientPricing"] as const;

export function useClientPricingDefaultsQuery() {
  return useQuery({
    queryKey: [...CP_KEY, "defaults"],
    queryFn: getClientPricingDefaults,
  });
}

export function useCategoryPricingConfigsQuery() {
  return useQuery({
    queryKey: [...CP_KEY, "categories"],
    queryFn: listCategoryPricingConfigs,
  });
}

export function useEffectiveCategoryPricingQuery(categoryId: number | null | undefined) {
  return useQuery({
    queryKey: [...CP_KEY, "effective", categoryId],
    queryFn: () => getEffectiveCategoryPricing(categoryId!),
    enabled: categoryId != null,
  });
}

function invalidateClientPricing(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: CP_KEY });
}

export function useUpdateClientPricingDefaultsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateDefaultsRequest) => updateClientPricingDefaults(body),
    onSuccess: () => invalidateClientPricing(qc),
  });
}

export function useUpdateCategoryPricingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateCategoryPricingRequest }) =>
      updateCategoryPricing(id, body),
    onSuccess: () => {
      invalidateClientPricing(qc);
      // also invalidate categories since pricingModel field is updated on Category
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
