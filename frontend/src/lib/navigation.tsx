import {
  BarChart3,
  Briefcase,
  ChartLine,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  FolderOpen,
  FolderKanban,
  GitBranch,
  HelpCircle,
  Inbox,
  Layers,
  Package,
  Receipt,
  Settings,
  Shield,
  Tag,
  Users,
  Wallet,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { ROLE_ADMIN, ROLE_REQUESTER, ROLE_REVENUE_MANAGER, ROLE_SOLUTION_OWNER } from "./types";

export interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /**
   * Optional role gate for individual nav items. Accepts a single role name
   * or an array (user must hold at least one). Admins always pass via the
   * Admin-implies-all rule in {@code lib/permissions.hasPermission}.
   */
  requiresRole?: string | string[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
  /** If set, only users with this role (or array of roles) see the section. */
  requiresRole?: string | string[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: ChartLine },
      { label: "Estimate requests", to: "/requests", icon: ClipboardList, requiresRole: [ROLE_REQUESTER, ROLE_REVENUE_MANAGER] },
      { label: "Review queue", to: "/review", icon: Inbox, requiresRole: [ROLE_SOLUTION_OWNER, ROLE_REVENUE_MANAGER] },
      { label: "Pricing review", to: "/pricing-review", icon: Wallet, requiresRole: ROLE_REVENUE_MANAGER },
    ],
  },
  {
    label: "Catalog",
    requiresRole: [ROLE_SOLUTION_OWNER, ROLE_REVENUE_MANAGER],
    items: [
      { label: "Products", to: "/catalog/products", icon: Package },
      { label: "Critical questions", to: "/catalog/questions", icon: HelpCircle },
    ],
  },
  {
    label: "Reports",
    requiresRole: [ROLE_SOLUTION_OWNER, ROLE_REVENUE_MANAGER],
    items: [
      { label: "Team workload", to: "/reports/team-workload", icon: BarChart3 },
    ],
  },
  {
    // Admin section has no section-level gate so Revenue Managers can see
    // their two allowed items. Per-item gates control visibility.
    label: "Admin",
    items: [
      { label: "Teams", to: "/admin/teams", icon: Users, requiresRole: ROLE_ADMIN },
      { label: "SDLC phases", to: "/admin/phases", icon: Layers, requiresRole: ROLE_ADMIN },
      { label: "Blended rates", to: "/admin/rates", icon: Receipt, requiresRole: ROLE_ADMIN },
      { label: "Program types", to: "/admin/program-types", icon: Tag, requiresRole: ROLE_ADMIN },
      { label: "Clients", to: "/admin/clients", icon: Briefcase, requiresRole: ROLE_ADMIN },
      { label: "Programs", to: "/admin/programs", icon: FolderKanban, requiresRole: ROLE_ADMIN },
      { label: "Categories", to: "/admin/categories", icon: FolderOpen, requiresRole: [ROLE_ADMIN, ROLE_REVENUE_MANAGER] },
      { label: "Global Client Pricing", to: "/admin/client-pricing", icon: CircleDollarSign, requiresRole: [ROLE_ADMIN, ROLE_REVENUE_MANAGER] },
      { label: "Users & roles", to: "/admin/users", icon: Shield, requiresRole: ROLE_ADMIN },
      { label: "Change log", to: "/admin/change-log", icon: GitBranch, requiresRole: ROLE_ADMIN },
      { label: "Global settings", to: "/admin/settings", icon: Settings, requiresRole: ROLE_ADMIN },
    ],
  },
];

// Re-export the icon module so AppShell modules don't import lucide directly
// in spots they don't need it.
export { Clock3 };
