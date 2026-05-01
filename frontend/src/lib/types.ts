export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

export const ROLE_ADMIN = "Admin";
export const ROLE_SOLUTION_OWNER = "Solution Owner";
export const ROLE_ESTIMATOR = "Estimator";
export const ROLE_REQUESTER = "Requester";
