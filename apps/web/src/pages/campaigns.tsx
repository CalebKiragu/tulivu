import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Megaphone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  CAMPAIGN_STATUSES,
  channelLabel,
  formatDate,
  formatMoney,
  pluralise,
} from "@tulivu/shared";
import { PageHeader } from "@/components/page-header";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageSkeleton,
  Progress,
  StatusBadge,
  buttonClass,
} from "@/components/ui";
import { useCampaigns } from "@/lib/queries";

const filters = [
  { id: "all", label: "All" },
  { id: "needs_review", label: "Needs review" },
  { id: "approved", label: "Approved" },
  { id: "published_demo", label: "Simulated launches" },
  { id: "running", label: "Running" },
  { id: "failed", label: "Attention" },
] as const;

export default function CampaignsPage() {
  const campaigns = useCampaigns();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof filters)[number]["id"]>("all");

  const list = campaigns.data?.campaigns ?? [];

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: list.length };
    for (const campaign of list) map[campaign.status] = (map[campaign.status] ?? 0) + 1;
    return map;
  }, [list]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return list.filter((campaign) => {
      if (status !== "all" && campaign.status !== status) return false;
      if (!term) return true;
      return `${campaign.name} ${campaign.businessName}`.toLowerCase().includes(term);
    });
  }, [list, search, status]);

  if (campaigns.isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Campaigns"
        title="The work in progress."
        description="Briefs, agent runs and review-ready packages. Each campaign keeps its full artifact history and its own approval boundary."
        actions={
          <Link to="/app/campaigns/new" className={buttonClass()}>
            <Plus className="h-4 w-4" aria-hidden />
            New campaign
          </Link>
        }
      />

      {campaigns.isError ? (
        <Card>
          <EmptyState
            title="Campaigns could not load"
            description="The API did not respond. Check the server and try again."
            action={<Button onClick={() => void campaigns.refetch()}>Try again</Button>}
          />
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Megaphone className="h-5 w-5" aria-hidden />}
            title="No campaigns yet"
            description="Build a brief from the seeded business profile, then let the agent prepare the package."
            action={<Link to="/app/campaigns/new" className={buttonClass()}>Create a campaign</Link>}
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="tulivu-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {filters.map((filter) => {
                const active = status === filter.id;
                const count = counts[filter.id] ?? 0;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setStatus(filter.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                      active
                        ? "border-forest bg-forest text-ivory"
                        : "border-line bg-[#fffdf8] text-muted hover:border-forest/30 hover:text-forest"
                    }`}
                  >
                    {filter.label}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                        active ? "bg-ivory/15 text-ivory" : "bg-forest/[0.06] text-muted"
                      }`}
                    >
                      {filter.id === "all" ? count : count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="relative w-full lg:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                aria-label="Search campaigns"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search campaigns or businesses"
                className="h-9 pl-9 text-xs"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                title="Nothing matches this view"
                description="Try a different status or clear the search."
                action={
                  <Button variant="secondary" onClick={() => { setStatus("all"); setSearch(""); }}>
                    Clear filters
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line/80">
                {filtered.map((campaign) => {
                  const statusInfo = CAMPAIGN_STATUSES.find((item) => item.id === campaign.status);
                  const running = campaign.status === "running" || campaign.status === "executing";
                  return (
                    <li key={campaign.id} className="group relative">
                      <Link
                        to={`/app/campaigns/${campaign.id}`}
                        className="flex flex-col gap-4 px-4 py-5 transition hover:bg-paper/65 sm:px-5 lg:flex-row lg:items-center"
                      >
                        <span
                          className={`absolute inset-y-0 left-0 w-[3px] ${
                            campaign.status === "failed"
                              ? "bg-clay"
                              : campaign.status === "needs_review"
                                ? "bg-gold-deep"
                                : campaign.status === "approved" || campaign.status === "published_demo"
                                  ? "bg-leaf"
                                  : running
                                    ? "bg-forest"
                                    : "bg-transparent"
                          }`}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1 lg:pl-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-[15px] font-semibold text-forest group-hover:underline">
                              {campaign.name}
                            </h2>
                            <StatusBadge status={campaign.status} />
                            {campaign.hasActiveApproval ? (
                              <Badge tone="success">
                                <ShieldCheck className="h-2.5 w-2.5" aria-hidden />
                                Approved version
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[11px] text-muted">
                            {campaign.businessName} · v{campaign.currentVersion} ·{" "}
                            {campaign.channels.map(channelLabel).join(" + ")}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" aria-hidden />
                              {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Sparkles className="h-3 w-3" aria-hidden />
                              {statusInfo?.description ?? "Campaign workspace"}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-line/60 pt-3 sm:grid-cols-3 lg:w-[390px] lg:border-0 lg:pt-0">
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">Budget</p>
                            <p className="mt-0.5 text-xs font-semibold text-forest">
                              {formatMoney(campaign.budgetAmount, campaign.budgetCurrency)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">Artifacts</p>
                            <p className="mt-0.5 text-xs font-semibold text-forest">
                              {campaign.artifactCount}/8 · {pluralise(campaign.assetCount, "asset")}
                            </p>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <div className="flex items-center justify-between">
                              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">Progress</p>
                              <p className="text-[9px] font-semibold text-forest">{Math.round((campaign.artifactCount / 8) * 100)}%</p>
                            </div>
                            <Progress value={(campaign.artifactCount / 8) * 100} className="mt-1.5" />
                          </div>
                        </div>

                        <ArrowUpRight className="hidden h-4 w-4 shrink-0 text-muted transition group-hover:text-forest lg:block" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-[#fffdf8] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest/[0.055] text-forest">
                <Check className="h-3.5 w-3.5" aria-hidden />
              </span>
              <p className="text-[11px] text-muted">
                <span className="font-semibold text-forest">Versioned by design.</span> Any edit to a brief or artifact
                creates a new campaign version and invalidates the old approval.
              </p>
            </div>
            <Link to="/app/campaigns/new" className="text-[11px] font-semibold text-leaf hover:underline">
              Create another
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
