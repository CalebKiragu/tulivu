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
import { Check, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@tulivu/shared";

export type ToastTone = "success" | "error" | "info";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
}

interface ToastItem extends ToastInput {
  id: number;
  tone: ToastTone;
}

interface ToastContextValue {
  push: (toast: ToastInput) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, string> = {
  success: "border-leaf/25 bg-[#f6faf5] text-forest",
  error: "border-clay/30 bg-[#fbf4f0] text-[#6f3b2b]",
  info: "border-line bg-paper text-ink",
};

function ToneIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") return <Check className="h-4 w-4" aria-hidden />;
  if (tone === "error") return <TriangleAlert className="h-4 w-4" aria-hidden />;
  return <Info className="h-4 w-4" aria-hidden />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      const item: ToastItem = { ...toast, id, tone: toast.tone ?? "info" };
      setToasts((current) => [...current.slice(-3), item]);
      const timer = setTimeout(() => dismiss(id), toast.tone === "error" ? 7000 : 4500);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const currentTimers = timers.current;
    return () => {
      for (const timer of currentTimers.values()) clearTimeout(timer);
      currentTimers.clear();
    };
  }, []);

  const value = useMemo(() => ({ push, dismiss }), [dismiss, push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[80] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px]"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "animate-rise pointer-events-auto flex w-full items-start gap-3 rounded-2xl border px-4 py-3 shadow-lift backdrop-blur",
              toneStyles[toast.tone],
            )}
            role="status"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/70">
              <ToneIcon tone={toast.tone} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-5">{toast.title}</p>
              {toast.description ? (
                <p className="mt-1 text-xs leading-5 text-muted">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-md p-1 text-muted transition hover:bg-black/5 hover:text-ink"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
