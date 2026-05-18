import { readCookie } from "../api";
import type { AttachmentMeta } from "./estimates";

const CSRF_COOKIE = "XSRF-TOKEN";
const CSRF_HEADER = "X-XSRF-TOKEN";

/** Upload (or replace) the document for a specific question on a DRAFT item. */
export async function uploadAnswerDocument(
  itemId: number,
  questionId: number,
  file: File,
): Promise<AttachmentMeta> {
  const form = new FormData();
  form.append("file", file);

  const token = readCookie(CSRF_COOKIE);
  const headers: Record<string, string> = {};
  if (token) headers[CSRF_HEADER] = token;

  const res = await fetch(
    `/api/estimates/items/${itemId}/answers/${questionId}/document`,
    { method: "POST", credentials: "include", headers, body: form },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    throw { status: res.status, body: parsed };
  }
  return res.json();
}

/** Remove the document for a specific question on a DRAFT item. */
export async function deleteAnswerDocument(
  itemId: number,
  questionId: number,
): Promise<void> {
  const token = readCookie(CSRF_COOKIE);
  const headers: Record<string, string> = {};
  if (token) headers[CSRF_HEADER] = token;

  const res = await fetch(
    `/api/estimates/items/${itemId}/answers/${questionId}/document`,
    { method: "DELETE", credentials: "include", headers },
  );
  if (!res.ok && res.status !== 204) {
    throw { status: res.status };
  }
}

/**
 * Trigger a file download by attachment ID. Opens the browser's native
 * Save dialog — no in-app viewer.
 */
export async function downloadAttachment(
  attachmentId: number,
  filename: string,
): Promise<void> {
  const token = readCookie(CSRF_COOKIE);
  const headers: Record<string, string> = {};
  if (token) headers[CSRF_HEADER] = token;

  const res = await fetch(`/api/documents/${attachmentId}/download`, {
    method: "GET",
    credentials: "include",
    headers,
  });

  if (!res.ok) throw { status: res.status };

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
