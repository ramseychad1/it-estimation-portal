import { api } from "../api";

export interface CategoryDto {
  id: number;
  name: string;
  displayOrder: number;
  active: boolean;
  pricingModel: "TARGET_MARGIN" | "TIME_AND_MATERIALS" | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CategoryRequest {
  name: string;
  active: boolean;
}

export function listActiveCategories(): Promise<CategoryDto[]> {
  return api(`/catalog/categories`);
}

export function listAllCategories(): Promise<CategoryDto[]> {
  return api(`/admin/categories`);
}

export function createCategory(body: CategoryRequest): Promise<CategoryDto> {
  return api(`/admin/categories`, { method: "POST", body });
}

export function updateCategory(id: number, body: CategoryRequest): Promise<CategoryDto> {
  return api(`/admin/categories/${id}`, { method: "PATCH", body });
}

export function deleteCategory(id: number): Promise<void> {
  return api(`/admin/categories/${id}`, { method: "DELETE" });
}
