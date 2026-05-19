import { api } from "../api";

export interface ClientDto {
  id: number;
  name: string;
  pointOfContact: string;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ClientRequest {
  name: string;
  pointOfContact: string;
  active: boolean;
}

export function listActiveClients(): Promise<ClientDto[]> {
  return api(`/catalog/clients`);
}

export function listAllClients(): Promise<ClientDto[]> {
  return api(`/admin/clients`);
}

export function createClient(body: ClientRequest): Promise<ClientDto> {
  return api(`/admin/clients`, { method: "POST", body });
}

export function updateClient(id: number, body: ClientRequest): Promise<ClientDto> {
  return api(`/admin/clients/${id}`, { method: "PATCH", body });
}

export function deleteClient(id: number): Promise<void> {
  return api(`/admin/clients/${id}`, { method: "DELETE" });
}
