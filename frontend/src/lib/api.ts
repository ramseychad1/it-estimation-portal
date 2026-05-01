/**
 * Typed fetch wrapper for the Estimator backend.
 *
 * Pairs with Spring Security's CookieCsrfTokenRepository (non-HttpOnly cookie):
 *   - The backend sets XSRF-TOKEN as a readable cookie on first request.
 *   - We echo that token back in the X-XSRF-TOKEN header on every non-GET request.
 *
 * In dev, the Vite proxy forwards /api/* to http://localhost:8080.
 * In production the frontend is served by the same origin as the API.
 */

const CSRF_COOKIE = "XSRF-TOKEN";
const CSRF_HEADER = "X-XSRF-TOKEN";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `Request failed with status ${status}`);
    this.name = "ApiError";
  }
}

export interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined" || !document.cookie) return undefined;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp("(?:^|; )" + escaped + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, headers, method = "GET", ...rest } = options;
  const upperMethod = method.toUpperCase();

  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...((headers as Record<string, string>) ?? {}),
  };

  if (!SAFE_METHODS.has(upperMethod)) {
    const token = readCookie(CSRF_COOKIE);
    if (token) requestHeaders[CSRF_HEADER] = token;
  }

  const init: RequestInit = {
    method: upperMethod,
    credentials: "include",
    headers: requestHeaders,
    ...rest,
  };

  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(`/api${path}`, init);

  const text = await response.text();
  let parsed: unknown = undefined;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, parsed);
  }

  return parsed as T;
}

/**
 * Hit a safe endpoint (GET) once on app startup so the backend sets the
 * XSRF-TOKEN cookie. /api/health is the cheapest public endpoint.
 */
export async function primeCsrfToken(): Promise<void> {
  try {
    await api("/health");
  } catch {
    // ignore — login flow will surface real auth/network errors
  }
}
