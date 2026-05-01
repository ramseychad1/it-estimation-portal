import type { ReactNode } from "react";

export interface ListToolbarSelection {
  count: number;
  /** Buttons / actions for the bulk strip (e.g. Activate, Deactivate, Delete). */
  actions: ReactNode;
  onClear: () => void;
}

interface ListToolbarProps {
  /** Default contents (search, filters, count, columns toggle, export, etc.). */
  children?: ReactNode;
  /**
   * When set, the toolbar swaps into bulk-select mode: shows "{count} selected"
   * + the provided actions + a Clear button, with a Light Blue tint background.
   */
  selection?: ListToolbarSelection;
}

/**
 * Toolbar for list views. In default mode, render whatever children you
 * pass (use <ListToolbar.Spacer /> to push content right). When `selection`
 * is set, the toolbar replaces its contents with the bulk strip — same
 * footprint, different look.
 */
export function ListToolbar({ children, selection }: ListToolbarProps) {
  if (selection) {
    return (
      <div
        className="flex items-center gap-3 mb-3 px-3 rounded-md"
        style={{
          height: 48,
          background: "rgba(187, 221, 230, 0.30)",
          border: "1px solid var(--color-light-blue)",
        }}
      >
        <span className="text-near-black font-semibold" style={{ fontSize: 13 }}>
          {selection.count} selected
        </span>
        <span className="flex-1" />
        {selection.actions}
        <button
          type="button"
          onClick={selection.onClear}
          className="text-warm-gray-med hover:text-near-black bg-transparent border-0 cursor-pointer"
          style={{ fontSize: 13 }}
        >
          Clear selection
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 mb-3" style={{ height: 48 }}>
      {children}
    </div>
  );
}

ListToolbar.Spacer = function Spacer() {
  return <span className="flex-1" />;
};
