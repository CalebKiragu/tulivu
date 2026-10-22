import {
  ArrowRight,
  CalendarDays,
  CircleAlert,
  Compass,
  MessageSquareQuote,
  Sparkles,
  Target,
} from "lucide-react";
import {
  OBJECTIVES,
  channelLabel,
  formatDate,
  formatMoney,
  type ArtifactType,
  type CampaignBriefArtifact,
  type CampaignDetail,
  type MarketingStrategy,
} from "@tulivu/shared";
import {
  ArtifactMissing,
  ArtifactPanel,
  BulletList,
  ChipList,
  InfoGrid,
  artifactContent,
} from "./artifact-panel";
import { Badge, Callout, Card, SectionLabel } from "@/components/ui";

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2 text-[12px] leading-6 text-ink">{children}</div>
    </div>
  );
}

export function StrategyTab({
  detail,
  onEdit,
  onRun,
  running,
}: {
  detail: CampaignDetail;
  onEdit: (type: ArtifactType) => void;
  onRun: () => void;
  running: boolean;
}) {
  const brief = artifactContent<CampaignBriefArtifact>(detail, "brief");
  const strategy = artifactContent<MarketingStrategy>(detail, "strategy");

  if (!brief) return <ArtifactMissing type="brief" onRun={onRun} running={running} />;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="tulivu-grain flex flex-wrap items-center justify-between gap-4 bg-forest px-5 py-5 text-ivory sm:px-6">
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-gold">The frame</p>
            <h2 className="mt-1.5 text-2xl leading-tight text-ivory">{brief.name}</h2>
            <p className="mt-1.5 text-[11px] text-ivory/55">
              {detail.business.name} · {channelLabel(brief.channels[0] ?? "")}
              {brief.channels.length > 1 ? ` + ${brief.channels.length - 1} more` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="gold" className="border-gold/30 bg-gold/15 text-gold">
              {OBJECTIVES.find((item) => item.id === brief.objective)?.label ?? brief.objective}
            </Badge>
            <Badge tone="neutral" className="border-ivory/15 bg-ivory/10 text-ivory/80">
              {formatMoney(brief.budget.amount, brief.budget.currency)}
            </Badge>
            <Badge tone="neutral" className="border-ivory/15 bg-ivory/10 text-ivory/80">
              {brief.durationDays} days
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
          <div className="space-y-5">
            <Block label="Product or service">{brief.product}</Block>
            <Block label="Audience">{brief.audience}</Block>
            <Block label="Conversion action">{brief.conversionAction}</Block>
          </div>
          <div className="space-y-4">
            <InfoGrid
              columns={2}
              items={[
                { label: "Geography", value: brief.geography },
                {
                  label: "Schedule",
                  value: (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3 text-muted" aria-hidden />
                      {formatDate(brief.startDate)} → {formatDate(brief.endDate)}
                    </span>
                  ),
                },
                { label: "Language", value: brief.language || "Not specified" },
                { label: "Offer", value: brief.offer || "No offer supplied" },
                { label: "Channels", value: brief.channels.map(channelLabel).join(", ") || "None" },
                { label: "Exclusions", value: brief.exclusions || "None supplied" },
              ]}
            />
            {brief.instructions ? (
              <Callout tone="info" title="Brief instructions">
                {brief.instructions}
              </Callout>
            ) : null}
            {brief.destinationUrl ? (
              <div className="rounded-xl border border-line bg-paper/60 px-3 py-2.5">
                <p className="tulivu-label">Destination</p>
                <p className="mt-1 break-all text-[10px] text-leaf">{brief.destinationUrl}</p>
              </div>
            ) : null}
          </div>
        </div>

        {brief.missingInformation.length > 0 || brief.clarifications.length > 0 ? (
          <div className="grid gap-4 border-t border-line bg-[#fbf6e9]/55 p-5 sm:grid-cols-2 sm:p-6">
            <div>
              <div className="flex items-center gap-2">
                <CircleAlert className="h-3.5 w-3.5 text-[#a5812e]" aria-hidden />
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#755b20]">Missing information</p>
              </div>
              <div className="mt-2">
                <BulletList items={brief.missingInformation} tone="warning" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[#a5812e]" aria-hidden />
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#755b20]">Assumptions recorded</p>
              </div>
              <div className="mt-2">
                <BulletList items={brief.assumptions} tone="warning" />
              </div>
              {brief.clarifications.length > 0 ? (
                <div className="mt-3 space-y-1.5">
                  {brief.clarifications.map((question) => (
                    <p key={question.field} className="text-[10px] leading-4 text-[#755b20]">
                      <span className="font-semibold">{question.field}:</span> {question.question}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 sm:px-6">
          <p className="text-[10px] text-muted">
            Normalised {detail.artifacts.brief ? formatDate(detail.artifacts.brief.createdAt, "datetime") : "—"} · artifact v
            {detail.artifacts.brief?.version ?? 1}
          </p>
          <button
            type="button"
            onClick={() => onEdit("brief")}
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-leaf hover:underline"
          >
            Edit brief artifact
            <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        </div>
      </Card>

      {!strategy ? (
        <ArtifactMissing
          type="strategy"
          onRun={onRun}
          running={running}
          description="The strategy artifact translates this brief into positioning, message and structure. Run the workflow to generate it."
        />
      ) : (
        <ArtifactPanel detail={detail} type="strategy" onEdit={onEdit}>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <div className="rounded-xl border border-line bg-paper/50 p-4">
                <div className="flex items-center gap-2">
                  <Compass className="h-3.5 w-3.5 text-gold-deep" aria-hidden />
                  <SectionLabel>Value proposition</SectionLabel>
                </div>
                <p className="mt-2 font-display text-lg leading-7 text-forest">{strategy.valueProposition}</p>
              </div>
              <Block label="Positioning">{strategy.positioning}</Block>
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquareQuote className="h-3.5 w-3.5 text-gold-deep" aria-hidden />
                  <SectionLabel>Key messages</SectionLabel>
                </div>
                <div className="mt-2">
                  <BulletList items={strategy.keyMessages} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {strategy.campaignStructure.meta ? (
                  <div className="rounded-xl border border-line p-3.5">
                    <p className="tulivu-label">Meta structure</p>
                    <p className="mt-1.5 text-[11px] leading-5 text-ink">{strategy.campaignStructure.meta}</p>
                  </div>
                ) : null}
                {strategy.campaignStructure.google ? (
                  <div className="rounded-xl border border-line p-3.5">
                    <p className="tulivu-label">Google structure</p>
                    <p className="mt-1.5 text-[11px] leading-5 text-ink">{strategy.campaignStructure.google}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-xl border border-gold-deep/25 bg-gold/[0.1] p-4">
                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-[#8b6f2a]" aria-hidden />
                  <SectionLabel>Call to action</SectionLabel>
                </div>
                <p className="mt-2 text-sm font-semibold text-forest">{strategy.cta}</p>
              </div>
              <div>
                <SectionLabel>Success metric</SectionLabel>
                <p className="mt-1.5 text-[11px] leading-5 text-ink">{strategy.successMetric}</p>
              </div>
              <div>
                <SectionLabel>Creative formats</SectionLabel>
                <div className="mt-2">
                  <ChipList items={strategy.creativeFormats} tone="forest" />
                </div>
              </div>
              <div>
                <SectionLabel>Grounded in</SectionLabel>
                <div className="mt-2">
                  <BulletList items={strategy.groundedIn} />
                </div>
              </div>
              <div className="rounded-xl border border-[#d8bd7e]/45 bg-[#fbf5e5] p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#755b20]">Assumptions</p>
                <div className="mt-2">
                  <BulletList items={strategy.assumptions} tone="warning" />
                </div>
              </div>
            </div>
          </div>
        </ArtifactPanel>
      )}
    </div>
  );
}
