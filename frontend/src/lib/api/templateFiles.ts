import { readCookie } from "../api";

const CSRF_COOKIE = "XSRF-TOKEN";
const CSRF_HEADER = "X-XSRF-TOKEN";

export interface TemplateFileMeta {
  id: number;
  originalFilename: string;
  contentType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  uploadedBy: number;
}

function csrfHeaders(): Record<string, string> {
  const token = readCookie(CSRF_COOKIE);
  return token ? { [CSRF_HEADER]: token } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text().catch(() => "");
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  if (!res.ok) throw { status: res.status, body: parsed };
  return parsed as T;
}

export async function uploadProductTemplateFile(
  productId: number,
  file: File,
): Promise<TemplateFileMeta> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/catalog/products/${productId}/template-file`, {
    method: "POST",
    credentials: "include",
    headers: csrfHeaders(),
    body: form,
  });
  return handleResponse<TemplateFileMeta>(res);
}

export async function deleteProductTemplateFile(productId: number): Promise<void> {
  const res = await fetch(`/api/catalog/products/${productId}/template-file`, {
    method: "DELETE",
    credentials: "include",
    headers: csrfHeaders(),
  });
  if (!res.ok && res.status !== 204) throw { status: res.status };
}

export async function uploadSubFeatureTemplateFile(
  subFeatureId: number,
  file: File,
): Promise<TemplateFileMeta> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/catalog/sub-features/${subFeatureId}/template-file`, {
    method: "POST",
    credentials: "include",
    headers: csrfHeaders(),
    body: form,
  });
  return handleResponse<TemplateFileMeta>(res);
}

export async function deleteSubFeatureTemplateFile(subFeatureId: number): Promise<void> {
  const res = await fetch(`/api/catalog/sub-features/${subFeatureId}/template-file`, {
    method: "DELETE",
    credentials: "include",
    headers: csrfHeaders(),
  });
  if (!res.ok && res.status !== 204) throw { status: res.status };
}

/** Triggers a browser Save-As download. Works for both product and sub-feature. */
export async function downloadTemplateFile(
  url: string,
  filename: string,
): Promise<void> {
  const res = await fetch(url, { method: "GET", credentials: "include" });
  if (!res.ok) throw { status: res.status };
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export function productTemplateFileDownloadUrl(productId: number): string {
  return `/api/catalog/products/${productId}/template-file/download`;
}

export function subFeatureTemplateFileDownloadUrl(subFeatureId: number): string {
  return `/api/catalog/sub-features/${subFeatureId}/template-file/download`;
}
