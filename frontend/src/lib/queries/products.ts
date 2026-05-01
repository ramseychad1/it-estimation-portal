import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateProduct,
  createProduct,
  deactivateProduct,
  deleteProduct,
  getProduct,
  listProductHistory,
  listProducts,
  updateProduct,
  type CreateProductRequest,
  type ListProductsParams,
  type UpdateProductRequest,
} from "../api/products";

const PRODUCTS_KEY = ["products"] as const;

export function useProductsQuery(params: ListProductsParams) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, "list", params],
    queryFn: () => listProducts(params),
  });
}

export function useProductQuery(id: number | null) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, "detail", id ?? -1],
    queryFn: () => getProduct(id as number),
    enabled: id != null,
  });
}

export function useProductHistoryQuery(id: number | null) {
  return useQuery({
    queryKey: [...PRODUCTS_KEY, "history", id ?? -1],
    queryFn: () => listProductHistory(id as number),
    enabled: id != null,
  });
}

function invalidateAllProducts(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
}

export function useCreateProductMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProductRequest) => createProduct(body),
    onSuccess: () => invalidateAllProducts(qc),
  });
}

export function useUpdateProductMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateProductRequest }) => updateProduct(id, body),
    onSuccess: () => invalidateAllProducts(qc),
  });
}

export function useActivateProductMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => activateProduct(id),
    onSuccess: () => invalidateAllProducts(qc),
  });
}

export function useDeactivateProductMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deactivateProduct(id),
    onSuccess: () => invalidateAllProducts(qc),
  });
}

export function useDeleteProductMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirmationName }: { id: number; confirmationName: string }) =>
      deleteProduct(id, confirmationName),
    onSuccess: () => invalidateAllProducts(qc),
  });
}
