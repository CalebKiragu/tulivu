import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CircleAlert,
  Clock,
  Image,
  Megaphone,
  Plus,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { channelLabel, formatDate, formatMoney, pluralise } from "@tulivu/shared";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { ActivityRow } from "@/components/activity-item";
import {
  Badge,
  Card,
  EmptyState,
  PageSkeleton,
  Progress,
  StatusBadge,
  buttonClass,
} from "@/components/ui";
import { useOverview } from "@/lib/queries";

function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-muted">{label}</p>
          <p className="mt-2 font-display text-[2rem] leading-none tracking-[-0.03em] text-forest">{value}</p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest/[0.055] text-forest">{icon}</span>
      </div>
      <p className="mt-3 text-[10px] leading-4 text-muted">{detail}</p>
    </Card>
  );
}

export default function OverviewPage() {
  const overview = useOverview();

  if (overview.isLoading) return <PageSkeleton />;
  if (overview.isError || !overview.data) {
    return (
      <EmptyState
        title="The workspace did not load"
        description="The demo session could not be reached. Check that the API server is running, then retry."
        action={
          <button type="button" onClick={() => void overview.refetch()} className={buttonClass()}>
            Try again
          </button>
        }
      />
    );
  }

  const data = overview.data;
  const { metrics, campaigns, activity, attention } = data;
  const approvalQueue = campaigns.filter((campaign) => campaign.status === "needs_review" || campaign.status === "failed");

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Demo workspace"
        title={
          <>
            Everything waiting for{" "}
            <span className="italic text-leaf">a decision.</span>
          </>
        }
        description="A private, seeded workspace. Run the agent, inspect the work, and take a campaign as far as a clearly labelled simulated launch."
        actions={
          <>
            <Link to="/app/campaigns" className={buttonClass({ variant: "secondary" })}>
              All campaigns
            </Link>
            <Link to="/app/campaigns/new" className={buttonClass()}>
              <Plus className="h-4 w-4" aria-hidden />
              New campaign
            </Link>
          </>
        }
      />

      {attention.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-clay/25 bg-[#fbf1ec] px-4 py-3">
          <CircleAlert className="h-4 w-4 shrink-0 text-clay" aria-hidden />
          <p className="flex-1 text-xs leading-5 text-[#743d2b]">
            <span className="font-semibold">
              {pluralise(attention.length, "campaign needs", "campaigns need")} attention.
            </span>{" "}
            A run failed and can be resumed without losing completed stages.
          </p>
          <Link to={`/app/campaigns/${attention[0]!.id}`} className="text-[11px] font-bold text-[#743d2b] underline underline-offset-2">
            Open campaign
          </Link>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active campaigns"
          value={String(metrics.activeCampaigns)}
          detail="Running, waiting for review, approved or executing."
          icon={<Megaphone className="h-4 w-4" aria-hidden />}
        />
        <MetricCard
          label="Awaiting approval"
          value={String(metrics.awaitingApproval)}
          detail="Packages ready for a human decision."
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
        />
        <MetricCard
          label="Simulated launches"
          value={String(metrics.simulatedLaunches)}
          detail="Demo resources only. No live ads exist."
          icon={<Rocket className="h-4 w-4" aria-hidden />}
        />
        <MetricCard
          label="Creative assets"
          value={String(metrics.creativeAssets)}
          detail="Stored templates and generated imagery."
          icon={<Image className="h-4 w-4" aria-hidden />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <SectionHeading
                title="Campaigns in motion"
                description="The latest work across this workspace."
                actions={
                  <Link to="/app/campaigns" className="text-[11px] font-semibold text-leaf hover:underline">
                    View all
                  </Link>
                }
              />
            </div>

            {campaigns.length === 0 ? (
              <EmptyState
                icon={<Megaphone className="h-5 w-5" aria-hidden />}
                title="No campaigns yet"
                description="Create a brief and let Tulivu turn it into a reviewable package."
                action={
                  <Link to="/app/campaigns/new" className={buttonClass()}>
                    Create a campaign
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-line/80">
                {campaigns.map((campaign) => (
                  <li key={campaign.id}>
                    <Link
                      to={`/app/campaigns/${campaign.id}`}
                      className="group flex flex-col gap-3 px-5 py-4 transition hover:bg-paper/70 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-forest group-hover:underline">
                            {campaign.name}
                          </h3>
                          <StatusBadge status={campaign.status} />
                        </div>
                        <p className="mt-1 truncate text-[11px] text-muted">
                          {campaign.businessName} · {campaign.channels.map(channelLabel).join(" + ")} · v
                          {campaign.currentVersion}
                        </p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" aria-hidden />
                            {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" aria-hidden />
                            Updated {formatDate(campaign.updatedAt, "datetime")}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-5 sm:shrink-0 sm:flex-col sm:items-end sm:gap-1.5">
                        <p className="text-sm font-semibold text-forest">
                          {formatMoney(campaign.budgetAmount, campaign.budgetCurrency)}
                        </p>
                        <p className="text-[10px] text-muted">
                          {campaign.artifactCount}/8 artifacts · {pluralise(campaign.assetCount, "asset")}
                        </p>
                        <Progress value={(campaign.artifactCount / 8) * 100} className="w-28" />
                      </div>
                      <ArrowUpRight className="hidden h-4 w-4 shrink-0 text-muted transition group-hover:text-forest sm:block" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <SectionHeading
                title="Where a person is needed"
                description="Tulivu does not approve its own work."
              />
            </div>
            {approvalQueue.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage/60 text-leaf">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold text-forest">The queue is clear</p>
                  <p className="mt-0.5 text-[11px] text-muted">Run a workflow to produce a package for review.</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-line/80">
                {approvalQueue.slice(0, 4).map((campaign) => (
                  <li key={campaign.id}>
                    <Link
                      to={`/app/campaigns/${campaign.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-paper/70"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[#7a6328]">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-forest">{campaign.name}</p>
                        <p className="mt-0.5 text-[10px] text-muted">
                          {campaign.status === "failed" ? "Run failed — resume available" : "Quality review ready"}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <SectionHeading
                title="Recent activity"
                actions={
                  <Link to="/app/activity" className="text-[11px] font-semibold text-leaf hover:underline">
                    Full log
                  </Link>
                }
              />
            </div>
            {activity.length === 0 ? (
              <EmptyState title="Nothing logged yet" description="Workspace events will appear here." />
            ) : (
              <ul className="divide-y divide-line/70 px-5">
                {activity.slice(0, 7).map((item) => (
                  <ActivityRow key={item.id} item={item} showCampaign={false} />
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="tulivu-label">This workspace</p>
              <Badge tone="gold">Demo</Badge>
            </div>
            <p className="mt-2 text-sm font-semibold text-forest">{data.workspace.name}</p>
            <p className="mt-1 text-[10px] text-muted">Created {formatDate(data.workspace.createdAt)}</p>

            <div className="mt-4 space-y-2 text-[10px]">
              {[
                ["Model", data.provider.modelName],
                ["Image", data.provider.imageProvider],
                ["Research", data.provider.researchProvider],
                ["Persistence", data.provider.persistence],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-line/70 pb-2 last:border-0 last:pb-0">
                  <span className="text-muted">{label}</span>
                  <span className="max-w-[60%] truncate font-semibold text-forest">{value}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-lg bg-forest/[0.04] px-3 py-2.5">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-deep" aria-hidden />
              <p className="text-[10px] leading-4 text-muted">
                Mock providers are first-class here. Nothing in this workspace contacts a paid model or an ad platform.
              </p>
            </div>

            <Link to="/app/settings" className="mt-4 flex items-center justify-between rounded-lg border border-line px-3 py-2.5 text-[11px] font-semibold text-forest transition hover:border-forest/30">
              Workspace settings
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </Card>
        </div>
      </div>

      <Card quiet className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-gold">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold text-forest">The launch boundary</p>
            <p className="mt-0.5 text-[10px] text-muted">
              Execution creates paused demo resources. No real Meta or Google campaign is ever published here.
            </p>
          </div>
        </div>
        <Link to="/app/campaigns" className="text-[11px] font-semibold text-leaf hover:underline">
          Inspect a campaign
        </Link>
      </Card>
    </div>
  );
}
