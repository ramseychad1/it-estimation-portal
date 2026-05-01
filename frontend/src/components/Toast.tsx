import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastVariant = "success" | "error" | "info";

interface ToastEntry {
  id: number;
  variant: ToastVariant;
  message: string;
  /** ms before auto-dismiss; 0 = sticky */
  duration: number;
}

interface ToastApi {
  show: (variant: ToastVariant, message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const api = useMemo<ToastApi>(() => {
    const show = (variant: ToastVariant, message: string, duration = 4000) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, variant, message, duration }]);
    };
    return {
      show,
      success: (m, d) => show("success", m, d),
      error: (m, d) => show("error", m, d ?? 6000),
      info: (m, d) => show("info", m, d),
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// ---- internal viewport ---------------------------------------------------

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastEntry[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      style={{ maxWidth: 420 }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastEntry; onDismiss: () => void }) {
  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = window.setTimeout(onDismiss, toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  const accent =
    toast.variant === "success"
      ? "var(--color-success)"
      : toast.variant === "error"
        ? "var(--color-cardinal-red)"
        : "var(--color-light-blue)";

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      className="pointer-events-auto bg-white rounded-lg flex items-start gap-3 px-3.5 py-3"
      style={{
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-popover)",
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <div className="flex-1 text-body text-near-black" style={{ lineHeight: "20px" }}>
        {toast.message}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-warm-gray-med hover:text-near-black bg-transparent border-0 cursor-pointer"
        style={{ fontSize: 18, lineHeight: "20px" }}
      >
        ×
      </button>
    </div>
  );
}
