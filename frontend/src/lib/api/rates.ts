import { api } from "../api";

export interface BlendedRateDto {
  id: number;
  onshoreRate: string;
  offshoreRate: string;
  effectiveDate: string;
  note: string | null;
  createdAt: string | null;
  createdBy: number | null;
  current: boolean;
  scheduled: boolean;
}

export interface BlendedRateListItem {
  id: number;
  onshoreRate: string;
  offshoreRate: string;
  effectiveDate: string;
  note: string | null;
  createdAt: string | null;
  createdBy: number | null;
  current: boolean;
  scheduled: boolean;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface RatesPageResponse {
  current: BlendedRateDto | null;
  history: PageResponse<BlendedRateListItem>;
}

export interface CreateRateRequest {
  onshoreRate: string;
  offshoreRate: string;
  effectiveDate: string;
  note?: string | null;
  confirmationAcknowledged: boolean;
}

export interface ListRatesParams {
  page?: number;
  size?: number;
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

export function getRatesPage(params: ListRatesParams = {}): Promise<RatesPageResponse> {
  return api(`/admin/rates${toQuery(params as Record<string, unknown>)}`);
}

export function getRate(id: number): Promise<BlendedRateDto> {
  return api(`/admin/rates/${id}`);
}

export function createRate(body: CreateRateRequest): Promise<BlendedRateDto> {
  return api(`/admin/rates`, { method: "POST", body });
}
