import {
  ArrowUpRight,
  CalendarDays,
  CircleAlert,
  Layers,
  PlugZap,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  channelLabel,
  formatDate,
  formatMoney,
  titleCase,
  type ArtifactType,
  type CampaignDetail,
  type CampaignDraft,
} from "@tulivu/shared";
import {
  ArtifactMissing,
  ArtifactPanel,
  ChipList,
  InfoGrid,
  artifactContent,
} from "./artifact-panel";
import { Badge, Callout, Card, SectionLabel } from "@/components/ui";

const levelLabels: Record<string, string> = {
  campaign: "Campaign",
  ad_set: "Ad set",
  ad_group: "Ad group",
  creative: "Creative",
  ad: "Ad",
};

export function ConfigurationTab({
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
  const draft = artifactContent<CampaignDraft>(detail, "draft");

  if (!draft) {
    return (
      <ArtifactMissing
        type="draft"
        onRun={onRun}
        running={running}
        description="Campaign assembly builds the platform-neutral draft, validates each channel and records the integrations a live launch would need."
      />
    );
  }

  const channelDrafts = draft.platformNeutral.channels.flatMap((channel) => {
    const entry = draft.channels[channel];
    return entry ? [{ channel, entry }] : [];
  });

  return (
    <div className="space-y-5">
      <ArtifactPanel
        detail={detail}
        type="draft"
        description={`Assembled for campaign version ${draft.campaignVersion} at ${formatDate(draft.generatedAt, "datetime")}`}
        onEdit={onEdit}
      >
        <div className="space-y-5">
          <div className="tulivu-grain rounded-xl bg-forest px-5 py-4 text-ivory">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-gold">Platform-neutral draft</p>
                <h3 className="mt-1.5 text-xl leading-tight text-ivory">{draft.platformNeutral.name}</h3>
                <p className="mt-1 text-[11px] text-ivory/60">
                  {draft.platformNeutral.geography} · {draft.platformNeutral.channels.map(channelLabel).join(" + ")}
                </p>
              </div>
              <Badge tone="gold" className="border-gold/30 bg-gold/15 text-gold">
                Demo configuration
              </Badge>
            </div>
            <div className="mt-4 grid gap-4 border-t border-ivory/10 pt-4 sm:grid-cols-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ivory/40">Budget</p>
                <p className="mt-1 text-sm font-semibold text-ivory">
                  {formatMoney(draft.platformNeutral.budget.amount, draft.platformNeutral.budget.currency)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ivory/40">Schedule</p>
                <p className="mt-1 text-sm font-semibold text-ivory">
                  {formatDate(draft.platformNeutral.schedule.start)} → {formatDate(draft.platformNeutral.schedule.end)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ivory/40">Conversion</p>
                <p className="mt-1 truncate text-sm font-semibold text-ivory">{draft.platformNeutral.conversionAction}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-line bg-paper/50 p-4">
              <SectionLabel>Brief frame</SectionLabel>
              <div className="mt-3">
                <InfoGrid
                  columns={2}
                  items={[
                    { label: "Objective", value: titleCase(draft.platformNeutral.objective) },
                    { label: "Destination", value: draft.platformNeutral.destinationUrl || "Not required" },
                    { label: "Audience", value: draft.platformNeutral.audience },
                    {
                      label: "Estimated spend",
                      value: (
                        <span className="inline-flex items-center gap-1.5">
                          <Wallet className="h-3 w-3 text-muted" aria-hidden />
                          {formatMoney(draft.estimatedSpend.amount, draft.estimatedSpend.currency)}
                        </span>
                      ),
                      hint: draft.estimatedSpend.note,
                    },
                  ]}
                />
              </div>
            </div>

            <div className="rounded-xl border border-line bg-paper/50 p-4">
              <SectionLabel>Required integrations</SectionLabel>
              {draft.requiredIntegrations.length === 0 ? (
                <div className="mt-3">
                  <Callout tone="success" icon={<ShieldCheck className="h-4 w-4" aria-hidden />}>
                    Nothing else is required for this demo configuration. Live publishing would need the
                    integrations listed by the ad platform adapter.
                  </Callout>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {draft.requiredIntegrations.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-[#fffdf8] px-2.5 py-1 text-[10px] font-medium text-ink"
                      >
                        <PlugZap className="h-3 w-3 text-muted" aria-hidden />
                        {item}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] leading-4 text-muted">
                    These are recorded as requirements, not assumed to be connected. This demo never contacts a live
                    advertising account.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </ArtifactPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        {channelDrafts.map(({ channel, entry }) => {
          const validation = draft.validation.find((item) => item.platform === channel);
          return (
            <Card key={channel} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest/[0.06] text-forest">
                    <Layers className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-forest">{channelLabel(channel)}</h3>
                    <p className="text-[10px] text-muted">{entry.externalPreviewId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{titleCase(entry.status)}</Badge>
                  {validation ? (
                    <Badge
                      tone={
                        validation.status === "pass" ? "success" : validation.status === "warning" ? "warning" : "danger"
                      }
                    >
                      {validation.status}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4 p-4">
                <InfoGrid
                  columns={2}
                  items={[
                    { label: "Campaign name", value: entry.campaignName },
                    { label: "Objective", value: titleCase(entry.objective) },
                    {
                      label: "Budget",
                      value: formatMoney(entry.budget.amount, entry.budget.currency),
                      hint: `${formatMoney(entry.budget.daily, entry.budget.currency)} daily · ${entry.budget.allocation}% allocation`,
                    },
                    {
                      label: "Schedule",
                      value: (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3 w-3 text-muted" aria-hidden />
                          {formatDate(entry.schedule.start)} → {formatDate(entry.schedule.end)}
                        </span>
                      ),
                    },
                  ]}
                />

                <div>
                  <SectionLabel>Structure</SectionLabel>
                  <ol className="mt-2 space-y-2">
                    {entry.structure.map((node, index) => (
                      <li
                        key={`${node.level}-${node.name}-${index}`}
                        className="flex gap-2.5 rounded-lg border border-line/80 bg-[#fffdf8] px-3 py-2"
                      >
                        <span className="mt-0.5 shrink-0 rounded-full border border-forest/15 bg-forest/[0.05] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-forest">
                          {levelLabels[node.level] ?? node.level}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-ink">{node.name}</p>
                          <p className="mt-0.5 text-[10px] leading-4 text-muted">{node.details}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <SectionLabel>Creative assets</SectionLabel>
                  <div className="mt-2">
                    <ChipList items={entry.creativeIds} tone="forest" />
                  </div>
                </div>

                {validation && validation.issues.length > 0 ? (
                  <div>
                    <SectionLabel>Channel validation</SectionLabel>
                    <ul className="mt-2 space-y-1.5">
                      {validation.issues.map((issue, index) => (
                        <li key={`${issue.code}-${index}`} className="flex gap-2 text-[10px] leading-4 text-ink">
                          <CircleAlert
                            className={`mt-0.5 h-3 w-3 shrink-0 ${
                              issue.severity === "error"
                                ? "text-clay"
                                : issue.severity === "warning"
                                  ? "text-gold-deep"
                                  : "text-muted"
                            }`}
                            aria-hidden
                          />
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-[10px] font-medium text-leaf">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    Channel validation found no issues.
                  </p>
                )}

                {entry.destinationUrl ? (
                  <a
                    href={entry.destinationUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-leaf hover:underline"
                  >
                    Destination
                    <ArrowUpRight className="h-3 w-3" aria-hidden />
                  </a>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>

      {draft.previews && draft.previews.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <SectionLabel>Provider previews</SectionLabel>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              Demo previews show configuration only. Reach, spend and performance are not estimated or invented.
            </p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {draft.previews.map((preview) => (
              <div key={`${preview.platform}-${preview.externalPreviewId}`} className="rounded-xl border border-line bg-paper/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-forest">{channelLabel(preview.platform)}</p>
                  <Badge tone={preview.simulated ? "gold" : "neutral"}>
                    {preview.simulated ? "Simulated" : "Provider estimate"}
                  </Badge>
                </div>
                <p className="mt-1 text-[10px] text-muted">{preview.externalPreviewId}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="tulivu-label">Reach estimate</p>
                    <p className="mt-1 text-[11px] text-ink">
                      {preview.estimatedReach
                        ? `${preview.estimatedReach.min.toLocaleString()} – ${preview.estimatedReach.max.toLocaleString()}`
                        : "Not estimated in demo"}
                    </p>
                  </div>
                  <div>
                    <p className="tulivu-label">Daily spend estimate</p>
                    <p className="mt-1 text-[11px] text-ink">
                      {preview.estimatedDailySpend
                        ? formatMoney(preview.estimatedDailySpend.amount, preview.estimatedDailySpend.currency)
                        : "Not estimated in demo"}
                    </p>
                  </div>
                </div>
                {preview.notes.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-[10px] leading-4 text-muted">
                    {preview.notes.map((note, index) => (
                      <li key={`${note}-${index}`}>{note}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
