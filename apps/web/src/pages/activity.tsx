import { useMemo, useState } from "react";
import { Activity, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { formatDate, type AuditItem } from "@tulivu/shared";
import { PageHeader } from "@/components/page-header";
import { ActivityRow } from "@/components/activity-item";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageSkeleton,
  Select,
} from "@/components/ui";
import { useActivity, useCampaigns } from "@/lib/queries";
import { describeAudit } from "@/lib/events";

function dayKey(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function dayLabel(key: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return formatDate(key, "long");
}

export default function ActivityPage() {
  const campaigns = useCampaigns();
  const [campaignId, setCampaignId] = useState("all");
  const [search, setSearch] = useState("");
  const activity = useActivity(campaignId === "all" ? undefined : campaignId, 150);

  const list = activity.data?.activity ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((item) => {
      const meta = describeAudit(item);
      return `${meta.title} ${meta.detail ?? ""} ${item.campaignName ?? ""} ${item.eventType}`
        .toLowerCase()
        .includes(term);
    });
  }, [list, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, AuditItem[]>();
    for (const item of filtered) {
      const key = dayKey(item.createdAt);
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  if (activity.isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Activity"
        title={
          <>
            The record, <span className="italic text-leaf">unabridged.</span>
          </>
        }
        description="Every agent step, human decision, edit and simulated operation is written to an append-only audit trail. This is the same record the approval gate relies on."
        actions={
          <Button variant="secondary" onClick={() => void activity.refetch()} loading={activity.isFetching}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="tulivu-label">Recorded events</p>
          <p className="mt-1.5 font-display text-2xl leading-none text-forest">{list.length}</p>
          <p className="mt-1.5 text-[10px] text-muted">Most recent 150 events in this workspace.</p>
        </Card>
        <Card className="p-4">
          <p className="tulivu-label">Campaigns represented</p>
          <p className="mt-1.5 font-display text-2xl leading-none text-forest">
            {new Set(list.map((item) => item.campaignId).filter(Boolean)).size}
          </p>
          <p className="mt-1.5 text-[10px] text-muted">Events without a campaign are workspace-level.</p>
        </Card>
        <Card className="p-4">
          <p className="tulivu-label">Human decisions</p>
          <p className="mt-1.5 font-display text-2xl leading-none text-forest">
            {list.filter((item) => item.eventType === "campaign.approved").length}
          </p>
          <p className="mt-1.5 text-[10px] text-muted">Approvals recorded against an exact campaign version.</p>
        </Card>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            aria-label="Filter activity by campaign"
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
            className="h-9 w-full text-xs sm:w-64"
          >
            <option value="all">All campaigns</option>
            {(campaigns.data?.campaigns ?? []).map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </Select>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              aria-label="Search activity"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search the audit trail"
              className="h-9 pl-9 text-xs"
            />
          </div>
        </div>
        <Badge tone="gold" className="w-fit">
          <ShieldCheck className="h-3 w-3" aria-hidden />
          Append-only
        </Badge>
      </div>

      {activity.isError ? (
        <Card>
          <EmptyState
            title="Activity could not load"
            description="The API did not respond. Try again once the server is reachable."
            action={<Button onClick={() => void activity.refetch()}>Try again</Button>}
          />
        </Card>
      ) : grouped.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Activity className="h-5 w-5" aria-hidden />}
            title={list.length === 0 ? "No activity yet" : "Nothing matches this search"}
            description={
              list.length === 0
                ? "Create a business and a campaign, then run the agent. Events appear here as work happens."
                : "Try another campaign or a broader search term."
            }
            action={
              list.length > 0 ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setCampaignId("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(([day, items]) => (
            <Card key={day} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-forest">{dayLabel(day)}</p>
                <span className="text-[9px] font-semibold text-muted">{items.length} events</span>
              </div>
              <ul className="divide-y divide-line/70 px-5">
                {items.map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <p className="px-1 text-[9px] leading-4 text-muted">
        Metadata is recorded server-side. Edits and approval invalidation cannot be erased from this view.
      </p>
    </div>
  );
}
