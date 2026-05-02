import {
  ChartLine,
  ClipboardList,
  Clock3,
  GitBranch,
  HelpCircle,
  History,
  Inbox,
  Layers,
  Package,
  Receipt,
  Shield,
  Users,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { ROLE_ADMIN, ROLE_SOLUTION_OWNER } from "./types";

export interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /**
   * Optional role gate for individual nav items. When the section as a
   * whole isn't role-gated (Workspace mixes Requester-only and SO-only
   * surfaces), per-item gates keep each link visible to the right
   * audience without splitting the section.
   */
  requiresRole?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
  /** If set, only users with this role see the section. */
  requiresRole?: string;
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: ChartLine },
      { label: "Estimate requests", to: "/requests", icon: ClipboardList },
      // Phase 6b — SO-only review queue, gated per-item rather than by
      // section since Workspace also carries Requester-only surfaces.
      { label: "Review queue", to: "/review", icon: Inbox, requiresRole: ROLE_SOLUTION_OWNER },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Products", to: "/catalog/products", icon: Package },
      { label: "Critical questions", to: "/catalog/questions", icon: HelpCircle },
      { label: "Template history", to: "/catalog/template-history", icon: History },
    ],
  },
  {
    label: "Admin",
    requiresRole: ROLE_ADMIN,
    items: [
      { label: "Teams", to: "/admin/teams", icon: Users },
      { label: "SDLC phases", to: "/admin/phases", icon: Layers },
      { label: "Blended rates", to: "/admin/rates", icon: Receipt },
      { label: "Users & roles", to: "/admin/users", icon: Shield },
      { label: "Change log", to: "/admin/change-log", icon: GitBranch },
    ],
  },
];

// Re-export the icon module so AppShell modules don't import lucide directly
// in spots they don't need it.
export { Clock3 };
