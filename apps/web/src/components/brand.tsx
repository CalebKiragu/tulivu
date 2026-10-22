import { cn } from "@tulivu/shared";

export function LeafMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-7 w-7", className)}
      aria-hidden="true"
    >
      <path
        d="M16 27.5V13.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M15.9 19.2C9.7 19.2 6.4 15.4 6.4 9.4c5.9 0 9.5 3.8 9.5 9.8Z"
        fill="currentColor"
      />
      <path
        d="M16.1 15.1c0-5.1 3.2-8.4 8.9-8.4 0 5.3-3.2 8.4-8.9 8.4Z"
        fill="currentColor"
        opacity="0.72"
      />
    </svg>
  );
}

export function Wordmark({
  className,
  markClassName,
  showTagline = false,
  inverse = false,
}: {
  className?: string;
  markClassName?: string;
  showTagline?: boolean;
  inverse?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border",
          inverse ? "border-gold/35 text-gold" : "border-forest/15 bg-forest text-gold",
          markClassName,
        )}
      >
        <LeafMark className="h-[18px] w-[18px]" />
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-[1.65rem] font-medium lowercase leading-none tracking-[-0.045em]",
            inverse ? "text-ivory" : "text-forest",
          )}
        >
          tulivu
        </span>
        {showTagline ? (
          <span
            className={cn(
              "mt-1 text-[9px] font-semibold uppercase tracking-[0.2em]",
              inverse ? "text-ivory/55" : "text-muted",
            )}
          >
            Growth agent
          </span>
        ) : null}
      </span>
    </span>
  );
}
