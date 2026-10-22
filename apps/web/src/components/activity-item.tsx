import { Link } from "react-router-dom";
import type { AuditItem } from "@tulivu/shared";
import { cn } from "@tulivu/shared";
import { describeAudit, relativeTime, type EventTone } from "@/lib/events";

const dotStyles: Record<EventTone, string> = {
  neutral: "bg-muted/60",
  forest: "bg-forest",
  gold: "bg-gold-deep",
  success: "bg-leaf",
  warning: "bg-[#b18d35]",
  danger: "bg-clay",
  active: "bg-forest",
};

export function ActivityRow({
  item,
  showCampaign = true,
  className,
}: {
  item: AuditItem;
  showCampaign?: boolean;
  className?: string;
}) {
  const meta = describeAudit(item);
  return (
    <li className={cn("relative flex gap-3 py-3", className)}>
      <span className="relative mt-1.5 flex h-2 w-2 shrink-0">
        <span className={cn("h-2 w-2 rounded-full", dotStyles[meta.tone])} aria-hidden />
        {meta.tone === "active" ? (
          <span className={cn("animate-pulse-dot absolute inset-0 rounded-full", dotStyles[meta.tone])} aria-hidden />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-xs font-semibold leading-5 text-ink">{meta.title}</p>
          <time className="text-[10px] text-muted/80" dateTime={item.createdAt}>
            {relativeTime(item.createdAt)}
          </time>
        </div>
        {meta.detail ? <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-muted">{meta.detail}</p> : null}
        {showCampaign && item.campaignId ? (
          <Link
            to={`/app/campaigns/${item.campaignId}`}
            className="mt-1 inline-block max-w-full truncate text-[10px] font-semibold text-leaf hover:underline"
          >
            {item.campaignName ?? "Campaign"}
          </Link>
        ) : null}
      </div>
    </li>
  );
}
