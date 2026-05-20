export interface CurrentUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  teamIds: number[];
}

export const ROLE_ADMIN = "Admin";
export const ROLE_SOLUTION_OWNER = "Solution Owner";
export const ROLE_ESTIMATOR = "Estimator";
export const ROLE_REQUESTER = "Requester";
export const ROLE_REVENUE_MANAGER = "Revenue Manager";
