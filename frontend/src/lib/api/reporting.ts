import { api } from "../api";
import type { UserListItem } from "./users";
import type { ProductListItem } from "./products";

export interface TeamWorkloadRow {
  teamId: number;
  teamName: string;
  memberCount: number;
  activeProductCount: number;
  totalEstimateRequests: number;
  submittedCount: number;
  inReviewCount: number;
  approvedCount: number;
  totalApprovedOnshoreHours: number;
  totalApprovedOffshoreHours: number;
  totalApprovedCost: number;
}

export interface RecentEstimateItem {
  id: number;
  title: string;
  productName: string;
  complexity: "LOW" | "MED" | "HIGH" | null;
  totalOnshoreHours: number;
  totalOffshoreHours: number;
  cost: number | null;
  reviewedAt: string | null;
}

export interface TeamWorkloadDetail {
  teamId: number;
  teamName: string;
  members: UserListItem[];
  products: ProductListItem[];
  recentApprovedEstimates: RecentEstimateItem[];
}

export function getTeamWorkloadSummary(): Promise<TeamWorkloadRow[]> {
  return api(`/reports/team-workload`);
}

export function getTeamWorkloadDetail(teamId: number): Promise<TeamWorkloadDetail> {
  return api(`/reports/team-workload/${teamId}`);
}
