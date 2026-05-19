import { api } from "../api";

export interface ProgramDto {
  id: number;
  clientId: number;
  clientName: string;
  name: string;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ProgramRequest {
  clientId: number;
  name: string;
  active: boolean;
}

export function listActivePrograms(clientId?: number): Promise<ProgramDto[]> {
  const qs = clientId != null ? `?clientId=${clientId}` : "";
  return api(`/catalog/programs${qs}`);
}

export function listAllPrograms(clientId?: number): Promise<ProgramDto[]> {
  const qs = clientId != null ? `?clientId=${clientId}` : "";
  return api(`/admin/programs${qs}`);
}

export function createProgram(body: ProgramRequest): Promise<ProgramDto> {
  return api(`/admin/programs`, { method: "POST", body });
}

export function updateProgram(id: number, body: ProgramRequest): Promise<ProgramDto> {
  return api(`/admin/programs/${id}`, { method: "PATCH", body });
}

export function deleteProgram(id: number): Promise<void> {
  return api(`/admin/programs/${id}`, { method: "DELETE" });
}
