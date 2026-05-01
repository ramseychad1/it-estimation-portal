import {
  ChartLine,
  ClipboardList,
  Clock3,
  GitBranch,
  HelpCircle,
  History,
  Layers,
  Package,
  Receipt,
  Shield,
  Users,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { ROLE_ADMIN } from "./types";

export interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
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
