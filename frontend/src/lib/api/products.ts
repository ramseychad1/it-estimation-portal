import { api } from "../api";
import type { PageResponse, TeamRef } from "./users";

export type ProductMode = "ATOMIC" | "CONTAINER";

export interface ProductListItem {
  id: number;
  name: string;
  description: string | null;
  mode: ProductMode;
  active: boolean;
  team: TeamRef | null;
  subFeatureCount: number;
  questionCount: number;
  updatedAt: string | null;
  updatedBy: number | null;
  createdAt: string | null;
  createdBy: number | null;
}

export interface ProductDetail extends ProductListItem {}

export interface CreateProductRequest {
  name: string;
  description?: string | null;
  mode: ProductMode;
  active?: boolean;
  teamId: number;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string | null;
  teamId?: number;
}

export interface ListProductsParams {
  search?: string;
  mode?: ProductMode;
  status?: "ALL" | "ACTIVE" | "INACTIVE";
  teamId?: number;
  page?: number;
  size?: number;
  sort?: string;
}

export interface ProductHistoryItem {
  id: number;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedBy: number | null;
  changedAt: string;
  notes: string | null;
}

function toQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export function listProducts(params: ListProductsParams = {}): Promise<PageResponse<ProductListItem>> {
  return api(`/catalog/products${toQuery(params as Record<string, unknown>)}`);
}

export function getProduct(id: number): Promise<ProductDetail> {
  return api(`/catalog/products/${id}`);
}

export function createProduct(body: CreateProductRequest): Promise<ProductDetail> {
  return api(`/catalog/products`, { method: "POST", body });
}

export function updateProduct(id: number, body: UpdateProductRequest): Promise<ProductDetail> {
  return api(`/catalog/products/${id}`, { method: "PATCH", body });
}

export function activateProduct(id: number): Promise<ProductDetail> {
  return api(`/catalog/products/${id}/activate`, { method: "POST" });
}

export function deactivateProduct(id: number): Promise<ProductDetail> {
  return api(`/catalog/products/${id}/deactivate`, { method: "POST" });
}

export function deleteProduct(id: number, confirmationName: string): Promise<void> {
  return api(`/catalog/products/${id}`, {
    method: "DELETE",
    body: { confirmationName },
  });
}

export function listProductHistory(id: number): Promise<ProductHistoryItem[]> {
  return api(`/catalog/products/${id}/history`);
}

export function productsExportUrl(params: ListProductsParams = {}): string {
  return `/api/catalog/products/export${toQuery(params as Record<string, unknown>)}`;
}
