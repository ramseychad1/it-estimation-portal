import { api } from "../api";
import type { UserDetail } from "./users";

export interface InviteUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  roleIds: number[];
  // teamIds intentionally absent — the user/team association table doesn't
  // exist yet (arrives in Phase 5 with Solution Owner work). The Invite User
  // modal still renders a Teams multi-select for visual completeness; its
  // value is local to the modal and is NOT submitted.
  expiresInDays?: number;
  personalNote?: string;
}

export interface InvitationResult {
  user: UserDetail;
  inviteUrl: string;
  tokenExpiresAt: string;
}

export interface ValidateTokenResponse {
  valid: boolean;
  email?: string;
  expiresAt?: string;
}

export interface AcceptInviteResult {
  email: string;
}

export function inviteUser(body: InviteUserRequest): Promise<InvitationResult> {
  return api(`/admin/users/invitations`, { method: "POST", body });
}

export function resendInvitation(userId: number): Promise<InvitationResult> {
  return api(`/admin/users/invitations/${userId}/resend`, { method: "POST" });
}

export function revokeInvitation(userId: number): Promise<void> {
  return api(`/admin/users/invitations/${userId}`, { method: "DELETE" });
}

export function validateInvitationToken(token: string): Promise<ValidateTokenResponse> {
  return api(`/auth/invitations/${encodeURIComponent(token)}`);
}

export function acceptInvitation(token: string, password: string): Promise<AcceptInviteResult> {
  return api(`/auth/invitations/${encodeURIComponent(token)}/accept`, {
    method: "POST",
    body: { password },
  });
}
