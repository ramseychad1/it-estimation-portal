import { api } from "../api";

export interface ProgramTypeDto {
  id: number;
  name: string;
  displayOrder: number;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ProgramTypeRequest {
  name: string;
  active: boolean;
}

export function listActiveProgramTypes(): Promise<ProgramTypeDto[]> {
  return api(`/catalog/program-types`);
}

export function listAllProgramTypes(): Promise<ProgramTypeDto[]> {
  return api(`/admin/program-types`);
}

export function createProgramType(body: ProgramTypeRequest): Promise<ProgramTypeDto> {
  return api(`/admin/program-types`, { method: "POST", body });
}

export function updateProgramType(id: number, body: ProgramTypeRequest): Promise<ProgramTypeDto> {
  return api(`/admin/program-types/${id}`, { method: "PATCH", body });
}

export function deleteProgramType(id: number): Promise<void> {
  return api(`/admin/program-types/${id}`, { method: "DELETE" });
}
