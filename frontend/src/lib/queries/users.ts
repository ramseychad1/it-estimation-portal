import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateUser,
  deactivateUser,
  deleteUser,
  getUser,
  listUserHistory,
  listUsers,
  resetUserPassword,
  updateUser,
  type ListUsersParams,
  type UpdateUserRequest,
} from "../api/users";
import {
  acceptInvitation,
  inviteUser,
  resendInvitation,
  revokeInvitation,
  sendInvitationEmail,
  validateInvitationToken,
  type InviteUserRequest,
} from "../api/invitations";

const USERS_KEY = ["users"] as const;

function listKey(params: ListUsersParams) {
  return [...USERS_KEY, "list", params] as const;
}

function detailKey(id: number) {
  return [...USERS_KEY, "detail", id] as const;
}

function historyKey(id: number) {
  return [...USERS_KEY, "history", id] as const;
}

export function useUsersQuery(params: ListUsersParams) {
  return useQuery({
    queryKey: listKey(params),
    queryFn: () => listUsers(params),
  });
}

export function useUserQuery(id: number | null) {
  return useQuery({
    queryKey: detailKey(id ?? -1),
    queryFn: () => getUser(id as number),
    enabled: id !== null,
  });
}

export function useUserHistoryQuery(id: number | null) {
  return useQuery({
    queryKey: historyKey(id ?? -1),
    queryFn: () => listUserHistory(id as number),
    enabled: id !== null,
  });
}

function invalidateUsers(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: USERS_KEY });
}

export function useUpdateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateUserRequest }) =>
      updateUser(id, body),
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useActivateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => activateUser(id),
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useDeactivateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deactivateUser(id),
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useResetUserPasswordMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => resetUserPassword(id),
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useDeleteUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirmationName }: { id: number; confirmationName: string }) =>
      deleteUser(id, confirmationName),
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useInviteUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: InviteUserRequest) => inviteUser(body),
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useResendInvitationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => resendInvitation(userId),
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useRevokeInvitationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => revokeInvitation(userId),
    onSuccess: () => invalidateUsers(qc),
  });
}

// Public flow — no cache invalidation needed.
export function useValidateInvitationTokenQuery(token: string | null) {
  return useQuery({
    queryKey: ["invitation-token", token],
    queryFn: () => validateInvitationToken(token as string),
    enabled: !!token,
    retry: false,
    staleTime: 0,
  });
}

export function useAcceptInvitationMutation() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      acceptInvitation(token, password),
  });
}

export function useSendInvitationEmailMutation() {
  return useMutation({
    mutationFn: (userId: number) => sendInvitationEmail(userId),
  });
}
