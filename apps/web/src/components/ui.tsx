import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "../lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-stone-400", className)} />;
}

export function PageLoader() {
  return (
    <div className="flex h-60 items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-3 rounded-2xl bg-stone-100 p-4 text-stone-500">{icon}</div>}
      <h3 className="font-display text-lg">{title}</h3>
      {text && <p className="mt-1 max-w-xs text-sm text-stone-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 px-4 pt-6 pb-4">
      <div>
        <h1 className="font-display text-[28px] leading-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  multi,
  className,
  scroll,
}: {
  options: Record<T, string> | [T, string][];
  value: T | T[] | null;
  onChange: (v: any) => void;
  multi?: boolean;
  className?: string;
  scroll?: boolean;
}) {
  const entries = (Array.isArray(options) ? options : Object.entries(options)) as [T, string][];
  const isOn = (k: T) => (multi ? (value as T[]).includes(k) : value === k);
  const toggle = (k: T) => {
    if (!multi) return onChange(k);
    const arr = value as T[];
    onChange(arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);
  };
  return (
    <div className={cn("flex gap-2", scroll ? "no-scrollbar -mx-4 overflow-x-auto px-4" : "flex-wrap", className)}>
      {entries.map(([k, l]) => (
        <button type="button" key={k} onClick={() => toggle(k)} className={cn("chip", isOn(k) && "chip-on")}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Scale({ value, onChange, labels }: { value: number; onChange: (n: number) => void; labels: readonly string[] }) {
  return (
    <div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            onClick={() => onChange(n)}
            className={cn("h-9 flex-1 rounded-lg text-sm ring-1 transition", n <= value ? "bg-ink text-paper ring-ink" : "bg-white ring-stone-200")}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-stone-500">{labels[value]}</p>
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="pb-safe relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-paper p-5 shadow-xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-stone-100" aria-label="Kapat">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---- Toast ----
type Toast = { id: number; text: string; kind: "ok" | "err" };
const ToastCtx = createContext<(text: string, kind?: "ok" | "err") => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn("pointer-events-auto rounded-xl px-4 py-2.5 text-sm shadow-lg", t.kind === "ok" ? "bg-ink text-paper" : "bg-red-600 text-white")}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}
