import { useRef, useState } from "react";
import { Bell, Search } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useClickOutside } from "../lib/useClickOutside";
import { BrandMark } from "./BrandMark";
import { UserAvatar } from "./UserAvatar";
import { UserMenu } from "./UserMenu";

const WORKSPACE_NAME = "HealthCare Development Group, Inc";

export function TopBar() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuContainerRef, () => setMenuOpen(false), menuOpen);

  return (
    <header
      className="flex items-center gap-4 px-4 bg-white relative"
      style={{
        height: "var(--topbar-h)",
        borderBottom: "1px solid var(--color-warm-gray-light)",
        zIndex: 5,
      }}
    >
      <div className="flex items-center gap-2.5">
        <BrandMark />
        <span className="text-near-black font-semibold" style={{ fontSize: 16, letterSpacing: "-0.005em" }}>
          Estimator
        </span>
      </div>

      <span
        aria-hidden="true"
        className="bg-border"
        style={{ width: 1, height: 20, marginLeft: 6, marginRight: 6 }}
      />
      <span className="text-warm-gray-med text-body">{WORKSPACE_NAME}</span>

      <span className="flex-1" />

      <label
        className="inline-flex items-center gap-2 px-3 rounded-md transition-colors cursor-text"
        style={{
          width: 320,
          height: 32,
          background: "var(--color-warm-gray-light)",
          border: "1px solid transparent",
          color: "var(--fg-2)",
        }}
      >
        <Search className="w-3.5 h-3.5" strokeWidth={1.5} />
        <input
          type="search"
          placeholder="Search products, estimates, teams…"
          className="flex-1 border-0 outline-none bg-transparent text-near-black"
          style={{ fontSize: 13 }}
          // Visual-only in Phase 1
          readOnly
        />
        <span
          aria-hidden="true"
          className="font-mono text-warm-gray-med"
          style={{
            fontSize: 10,
            padding: "1px 5px",
            border: "1px solid var(--color-border)",
            borderRadius: 3,
            background: "white",
          }}
        >
          ⌘K
        </span>
      </label>

      <button
        type="button"
        aria-label="Notifications"
        className="relative inline-flex items-center justify-center bg-transparent border-0 rounded-md cursor-pointer text-near-black hover:bg-warm-gray-light focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        style={{ width: 32, height: 32 }}
        // Visual-only in Phase 1
      >
        <Bell className="w-4.5 h-4.5" strokeWidth={1.5} style={{ width: 18, height: 18 }} />
        <span
          aria-hidden="true"
          className="absolute"
          style={{
            top: 7,
            right: 7,
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--color-cardinal-red)",
            border: "1.5px solid var(--color-white)",
            boxSizing: "content-box",
          }}
        />
      </button>

      {user && (
        <div ref={menuContainerRef} className="relative">
          <UserAvatar
            firstName={user.firstName}
            lastName={user.lastName}
            aria-label="User menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((o) => !o)}
          />
          {menuOpen && <UserMenu onClose={() => setMenuOpen(false)} />}
        </div>
      )}
    </header>
  );
}
