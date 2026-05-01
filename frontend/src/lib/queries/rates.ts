import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRate,
  getRatesPage,
  type CreateRateRequest,
  type ListRatesParams,
} from "../api/rates";

const RATES_KEY = ["rates"] as const;

function ratesPageKey(params: ListRatesParams) {
  return [...RATES_KEY, "page", params] as const;
}

export function useRatesPageQuery(params: ListRatesParams) {
  return useQuery({
    queryKey: ratesPageKey(params),
    queryFn: () => getRatesPage(params),
  });
}

export function useCreateRateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRateRequest) => createRate(body),
    onSuccess: () => {
      // Targeted invalidation: ONLY rate-related queries, not the whole cache.
      qc.invalidateQueries({ queryKey: RATES_KEY });
    },
  });
}
