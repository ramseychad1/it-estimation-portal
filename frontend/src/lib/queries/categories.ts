import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCategory,
  deleteCategory,
  listActiveCategories,
  listAllCategories,
  updateCategory,
  type CategoryRequest,
} from "../api/categories";

const CAT_KEY = ["categories"] as const;

export function useActiveCategoriesQuery() {
  return useQuery({
    queryKey: [...CAT_KEY, "active"],
    queryFn: listActiveCategories,
  });
}

export function useAllCategoriesQuery() {
  return useQuery({
    queryKey: [...CAT_KEY, "all"],
    queryFn: listAllCategories,
  });
}

function invalidateCategories(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: CAT_KEY });
}

export function useCreateCategoryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CategoryRequest) => createCategory(body),
    onSuccess: () => invalidateCategories(qc),
  });
}

export function useUpdateCategoryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: CategoryRequest }) =>
      updateCategory(id, body),
    onSuccess: () => invalidateCategories(qc),
  });
}

export function useDeleteCategoryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => invalidateCategories(qc),
  });
}
