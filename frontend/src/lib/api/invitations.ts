import { api } from "../api";
import type { UserDetail } from "./users";

export interface InviteUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  roleIds: number[];
  expiresInDays?: number;
  personalNote?: string;
  /** Optional. Each id must reference an active team. */
  teamIds?: number[];
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

export function sendInvitationEmail(userId: number): Promise<void> {
  return api(`/admin/users/invitations/${userId}/send-email`, { method: "POST" });
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
