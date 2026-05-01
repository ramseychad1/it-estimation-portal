import type { ReactNode } from "react";
import { useSidebarCollapsed } from "../lib/sidebarState";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, toggle] = useSidebarCollapsed();

  return (
    <div
      className="grid h-screen min-h-[720px]"
      style={{
        gridTemplateColumns: collapsed
          ? "var(--sidebar-w-collapsed) 1fr"
          : "var(--sidebar-w) 1fr",
        gridTemplateRows: "var(--topbar-h) 1fr",
        gridTemplateAreas: '"topbar topbar" "sidebar main"',
      }}
    >
      <div style={{ gridArea: "topbar" }}>
        <TopBar />
      </div>
      <div style={{ gridArea: "sidebar" }}>
        <Sidebar collapsed={collapsed} onToggle={toggle} />
      </div>
      <main className="bg-white overflow-y-auto" style={{ gridArea: "main" }}>
        <div style={{ padding: "32px 32px 48px", maxWidth: "var(--content-max)" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
