import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth, hasRole } from "../lib/auth";
import { NAV_SECTIONS } from "../lib/navigation";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuth();
  const sections = NAV_SECTIONS.filter(
    (s) => !s.requiresRole || hasRole(user, s.requiresRole),
  );

  return (
    <aside
      className="bg-white flex flex-col overflow-hidden relative"
      style={{
        width: collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)",
        borderRight: "1px solid var(--color-warm-gray-light)",
        transition: "width 160ms cubic-bezier(0.2,0.8,0.2,1)",
      }}
      data-testid="sidebar"
      data-collapsed={collapsed}
    >
      <div className="flex-1 overflow-y-auto" style={{ padding: "12px 0 8px" }}>
        {sections.map((section) => (
          <div key={section.label} data-testid={`section-${section.label}`}>
            {!collapsed && (
              <div style={{ padding: "14px 16px 6px" }}>
                <div
                  className="text-warm-gray-med uppercase font-medium"
                  style={{ fontSize: 12, letterSpacing: "0.06em" }}
                >
                  {section.label}
                </div>
              </div>
            )}
            <div className="flex flex-col" style={{ gap: 2, marginTop: collapsed ? 4 : 2 }}>
              {section.items.map((item) => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  Icon={item.icon}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        className="flex items-center justify-between gap-2 bg-white"
        style={{
          borderTop: "1px solid var(--color-warm-gray-light)",
          padding: collapsed ? "10px 0" : "10px 16px",
        }}
      >
        {!collapsed && (
          <a
            href="#"
            className="inline-flex items-center gap-1.5 text-warm-gray-med hover:text-near-black hover:underline"
            style={{ fontSize: 12 }}
          >
            Help &amp; docs
            <ExternalLink style={{ width: 12, height: 12 }} strokeWidth={1.5} />
          </a>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="inline-flex items-center justify-center bg-transparent border-0 cursor-pointer text-warm-gray-med hover:text-near-black hover:bg-warm-gray-light rounded-md"
          style={{ width: 28, height: 28 }}
        >
          {collapsed ? (
            <ChevronRight strokeWidth={1.5} style={{ width: 14, height: 14 }} />
          ) : (
            <ChevronLeft strokeWidth={1.5} style={{ width: 14, height: 14 }} />
          )}
        </button>
      </div>
    </aside>
  );
}

interface NavItemProps {
  to: string;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  collapsed: boolean;
}

function NavItem({ to, label, Icon, collapsed }: NavItemProps) {
  return (
    <NavLink
      to={to}
      data-testid={`nav-${label}`}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        [
          "flex items-center text-near-black no-underline cursor-pointer transition-colors",
          "duration-hover ease-out-soft",
          isActive ? "is-active font-semibold" : "",
          collapsed ? "justify-center" : "",
        ].join(" ")
      }
      style={({ isActive }) => ({
        gap: 12,
        height: 36,
        padding: collapsed ? 0 : "0 12px",
        borderLeft: `3px solid ${isActive ? "var(--color-cardinal-red)" : "transparent"}`,
        fontSize: 14,
        background: isActive ? "var(--color-warm-gray-light)" : "transparent",
        color: "var(--color-near-black)",
      })}
    >
      <Icon
        className="flex-none"
        style={{ width: 16, height: 16, color: "var(--fg-2)" }}
        strokeWidth={1.5}
      />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}
