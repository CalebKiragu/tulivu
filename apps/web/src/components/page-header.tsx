import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@tulivu/shared";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {back ? (
          <Link
            to={back.to}
            className="mb-3 inline-flex items-center gap-1 text-[11px] font-semibold text-muted transition hover:text-forest"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? <p className="tulivu-label text-gold-deep">{eyebrow}</p> : null}
        <h1 className="mt-1.5 text-3xl leading-[1.12] tracking-[-0.03em] text-forest sm:text-[2.4rem]">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div> : null}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-xl font-medium tracking-[-0.02em] text-forest">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-5 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
