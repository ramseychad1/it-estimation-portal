import { useEffect } from "react";

/**
 * Native browser prompt on tab close / refresh / cross-origin navigation
 * when the parent form has unsaved changes.
 *
 * <p>Covers tab close + refresh + cross-origin navigation. SPA navigation
 * (React-Router) handled by deliberate user action only — the template
 * editor's exits today are explicit "Save changes" / "Discard changes"
 * clicks plus same-page section nav, none of which need a confirm.
 *
 * <p>Revisit if Phase 6+ adds nav paths from the editor (e.g., "go to
 * estimate request that uses this template" jump links). At that point
 * the SPA guard becomes load-bearing; the right answer is
 * react-router-dom v6.4+'s data-router {@code useBlocker} hook, but
 * that's a project-wide upgrade rather than a single-component fix.
 *
 * <p>Browsers ignore the message argument these days (the prompt copy
 * is vendor-fixed), but {@code beforeunload} still requires the listener
 * to call {@code preventDefault} and assign {@code returnValue} for the
 * dialog to appear.
 */
export function useUnsavedChangesGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}
