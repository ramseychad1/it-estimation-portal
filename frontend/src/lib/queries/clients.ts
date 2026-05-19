import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createClient,
  deleteClient,
  listActiveClients,
  listAllClients,
  updateClient,
} from "../api/clients";
import type { ClientRequest } from "../api/clients";

const CLIENT_KEY = ["clients"] as const;

function invalidateClients(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: CLIENT_KEY });
}

export function useActiveClientsQuery() {
  return useQuery({ queryKey: [...CLIENT_KEY, "active"], queryFn: listActiveClients });
}

export function useAllClientsQuery() {
  return useQuery({ queryKey: [...CLIENT_KEY, "all"], queryFn: listAllClients });
}

export function useCreateClientMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ClientRequest) => createClient(body),
    onSuccess: () => invalidateClients(qc),
  });
}

export function useUpdateClientMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ClientRequest }) => updateClient(id, body),
    onSuccess: () => invalidateClients(qc),
  });
}

export function useDeleteClientMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteClient(id),
    onSuccess: () => invalidateClients(qc),
  });
}
