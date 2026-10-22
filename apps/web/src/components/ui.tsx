import {
  forwardRef,
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Loader2, X } from "lucide-react";
import { cn } from "@tulivu/shared";
import { useToast } from "./toast";

/* -------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "gold" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-forest text-ivory border-forest hover:bg-leaf shadow-[0_8px_20px_-12px_rgba(23,61,53,0.7)]",
  secondary: "border-line bg-[#fffdf8] text-forest hover:border-forest/35 hover:bg-paper",
  ghost: "border-transparent bg-transparent text-forest hover:bg-forest/[0.06]",
  gold: "bg-gold text-forest border-gold hover:bg-[#e2d19e] shadow-[0_8px_20px_-14px_rgba(185,163,106,0.8)]",
  danger: "border-clay/30 bg-[#fbf4f0] text-[#7a3f2c] hover:border-clay/60 hover:bg-[#f7ece6]",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-sm gap-2.5 rounded-xl",
};

export function buttonClass(options: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(
    "inline-flex select-none items-center justify-center border font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-45",
    buttonVariants[options.variant ?? "primary"],
    buttonSizes[options.size ?? "md"],
    options.className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={buttonClass({ variant, size, className })}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-muted transition hover:border-line hover:bg-paper hover:text-forest disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

export function Card({
  className,
  children,
  quiet = false,
  as: Tag = "div",
}: {
  className?: string;
  children: ReactNode;
  quiet?: boolean;
  as?: "div" | "section" | "article" | "aside";
}) {
  return <Tag className={cn(quiet ? "tulivu-card-quiet" : "tulivu-card", className)}>{children}</Tag>;
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("tulivu-label", className)}>{children}</p>;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line", className)} />;
}

/* -------------------------------------------------------------------------- */
/* Badges and status                                                          */
/* -------------------------------------------------------------------------- */

type BadgeTone = "neutral" | "forest" | "gold" | "success" | "warning" | "danger" | "active";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-line bg-[#f4f1e9] text-muted",
  forest: "border-forest/15 bg-forest/[0.06] text-forest",
  gold: "border-gold-deep/30 bg-gold/20 text-[#6e5b2b]",
  success: "border-leaf/20 bg-sage/70 text-leaf",
  warning: "border-[#d8bd7e]/50 bg-[#f7efd9] text-[#755b20]",
  danger: "border-clay/25 bg-[#f9ece6] text-[#7a3f2c]",
  active: "border-leaf/25 bg-forest/[0.07] text-leaf",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot = false,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.09em]",
        badgeTones[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tones: Record<string, BadgeTone> = {
    neutral: "neutral",
    active: "active",
    attention: "warning",
    success: "success",
    danger: "danger",
  };
  const meta =
    {
      draft: { label: "Draft", tone: "neutral" },
      running: { label: "Agent running", tone: "active" },
      needs_review: { label: "Needs review", tone: "attention" },
      approved: { label: "Approved", tone: "success" },
      executing: { label: "Executing", tone: "active" },
      published_demo: { label: "Simulated launch", tone: "success" },
      failed: { label: "Needs attention", tone: "danger" },
      cancelled: { label: "Cancelled", tone: "neutral" },
    }[status] ?? { label: status, tone: "neutral" };
  return (
    <Badge tone={tones[meta.tone] ?? "neutral"} dot>
      {label ?? meta.label}
    </Badge>
  );
}

export function VerdictBadge({ verdict }: { verdict: "pass" | "warn" | "fail" }) {
  if (verdict === "pass") return <Badge tone="success">Passed</Badge>;
  if (verdict === "warn") return <Badge tone="warning">Warnings</Badge>;
  return <Badge tone="danger">Blocked</Badge>;
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                              */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
  optional = false,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="tulivu-label flex items-center gap-2">
        {label}
        {optional ? <span className="normal-case font-medium tracking-normal text-muted/70">optional</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-clay" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] leading-4 text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn("tulivu-input", className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn("tulivu-input resize-y leading-6", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn("tulivu-input appearance-none pr-8", className)} {...props}>
        {children}
      </select>
    );
  },
);

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-[#fffdf8] p-3.5 transition hover:border-forest/25",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#173D35]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-xs leading-5 text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <div className="absolute inset-0 bg-forest/45 backdrop-blur-[3px] animate-fade" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={cn(
          "animate-rise relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[1.5rem] border border-line bg-ivory shadow-lift sm:rounded-[1.5rem]",
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-6 border-b border-line bg-paper/80 px-5 py-4 sm:px-6">
          <div>
            <h2 id={id} className="text-xl font-medium text-forest">
              {title}
            </h2>
            {description ? <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">{description}</p> : null}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
        <div className="tulivu-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-paper/70 px-5 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
  disabled?: boolean;
}

export function Tabs({
  items,
  active,
  onChange,
  className,
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("tulivu-scroll -mx-1 overflow-x-auto border-b border-line", className)} role="tablist">
      <div className="flex min-w-max gap-1 px-1">
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={item.disabled}
              onClick={() => onChange(item.id)}
              className={cn(
                "relative flex items-center gap-2 whitespace-nowrap px-3 py-3 text-xs font-semibold transition",
                selected ? "text-forest" : "text-muted hover:text-forest",
                item.disabled && "cursor-not-allowed opacity-40",
              )}
            >
              {item.label}
              {item.badge !== undefined ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                    selected ? "bg-forest text-ivory" : "bg-forest/[0.07] text-muted",
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
              {selected ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-forest" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs text-muted", className)} role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon ? (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-paper text-forest">
          {icon}
        </span>
      ) : null}
      <h3 className="text-lg font-medium text-forest">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm leading-6 text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-line", className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-forest transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
  icon,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-line bg-paper text-ink",
    warning: "border-[#d8bd7e]/60 bg-[#fbf5e5] text-[#6d5620]",
    danger: "border-clay/25 bg-[#fbf1ec] text-[#743d2b]",
    success: "border-leaf/20 bg-[#f3f8f1] text-forest",
  };
  return (
    <div className={cn("flex gap-3 rounded-xl border px-4 py-3.5", tones[tone], className)}>
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0 text-xs leading-5">
        {title ? <p className="mb-0.5 text-sm font-semibold">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const { push } = useToast();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          push({ title: "Copied to clipboard", tone: "success" });
        } catch {
          push({ title: "Could not copy", description: "Select the text and copy it manually.", tone: "error" });
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] font-semibold text-muted transition hover:bg-forest/[0.06] hover:text-forest"
      aria-label={label}
    >
      <Copy className="h-3 w-3" aria-hidden />
      {label}
    </button>
  );
}

export function InlineCheck({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-leaf">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-forest/[0.08]">
        <Check className="h-2.5 w-2.5" aria-hidden />
      </span>
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                   */
/* -------------------------------------------------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-line/70", className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
