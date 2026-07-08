import { api } from "../api";

export type InvitationStatus = "ACTIVE" | "PENDING_INVITE" | "INACTIVE";
export type RoleId = number;

export interface TeamRef {
  id: number;
  name: string;
}

export interface UserListItem {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  invitationStatus: InvitationStatus;
  active: boolean;
  roles: string[];
  teams: TeamRef[];
  lastActiveAt: string | null;
  createdAt: string | null;
}

export interface UserDetail {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  invitationStatus: InvitationStatus;
  active: boolean;
  roles: string[];
  teams: TeamRef[];
  invitedAt: string | null;
  invitedBy: number | null;
  invitationExpiresAt: string | null;
  invitationAcceptedAt: string | null;
  lastActiveAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UserListMeta {
  activeAdminCount?: number;
}

export interface PageResponse<T, M = unknown> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  /** List-level extras populated by the server (e.g. activeAdminCount). */
  meta?: M;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  roleIds?: number[];
  /** null = leave unchanged; empty array = clear all teams */
  teamIds?: number[] | null;
}

export interface UserHistoryItem {
  id: number;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedBy: number | null;
  changedAt: string;
  notes: string | null;
}

export interface ListUsersParams {
  search?: string;
  role?: string;
  status?: InvitationStatus;
  page?: number;
  size?: number;
  sort?: string;
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

export function listUsers(
  params: ListUsersParams = {},
): Promise<PageResponse<UserListItem, UserListMeta>> {
  return api(`/admin/users${toQuery(params as Record<string, unknown>)}`);
}

export function getUser(id: number): Promise<UserDetail> {
  return api(`/admin/users/${id}`);
}

export function updateUser(id: number, body: UpdateUserRequest): Promise<UserDetail> {
  return api(`/admin/users/${id}`, { method: "PATCH", body });
}

export function activateUser(id: number): Promise<UserDetail> {
  return api(`/admin/users/${id}/activate`, { method: "POST" });
}

export function deactivateUser(id: number): Promise<UserDetail> {
  return api(`/admin/users/${id}/deactivate`, { method: "POST" });
}

/** SEC-1: returns a copy/paste reset link instead of a plaintext password. */
export interface PasswordResetLinkResponse {
  resetUrl: string;
  expiresAt: string;
}

export function resetUserPassword(id: number): Promise<PasswordResetLinkResponse> {
  return api(`/admin/users/${id}/reset-password`, { method: "POST" });
}

export interface ValidateResetTokenResponse {
  valid: boolean;
  email?: string;
  expiresAt?: string;
}

export function validateResetToken(token: string): Promise<ValidateResetTokenResponse> {
  return api(`/auth/password-resets/${encodeURIComponent(token)}`);
}

export function completePasswordReset(token: string, password: string): Promise<void> {
  return api(`/auth/password-resets/${encodeURIComponent(token)}`, {
    method: "POST",
    body: { password },
  });
}

export function deleteUser(id: number, confirmationName: string): Promise<void> {
  return api(`/admin/users/${id}`, {
    method: "DELETE",
    body: { confirmationName },
  });
}

export function listUserHistory(id: number): Promise<UserHistoryItem[]> {
  return api(`/admin/users/${id}/history`);
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return api("/auth/me/password", { method: "PATCH", body: { currentPassword, newPassword } });
}

export function usersExportUrl(params: ListUsersParams = {}): string {
  return `/api/admin/users/export${toQuery(params as Record<string, unknown>)}`;
}

// ---- role catalog (static — Phase 1 seed) ------------------------------

export const ROLE_CATALOG: { id: number; name: string; description: string }[] = [
  {
    id: 1,
    name: "Admin",
    description: "Full access. Can configure teams, phases, rates, and users.",
  },
  {
    id: 2,
    name: "Solution Owner",
    description: "Can create and manage products, sub-features, and estimate templates.",
  },
  {
    id: 3,
    name: "Estimator",
    description: "Can fill in hours on assigned estimate requests.",
  },
  {
    id: 4,
    name: "Requester",
    description: "Can create new estimate requests.",
  },
  {
    id: 5,
    name: "Revenue Manager",
    description: "Can manage Categories, Client Pricing Calculations and Review Estimates for Client Pricing.",
  },
];

export function roleIdByName(name: string): number | undefined {
  return ROLE_CATALOG.find((r) => r.name === name)?.id;
}
