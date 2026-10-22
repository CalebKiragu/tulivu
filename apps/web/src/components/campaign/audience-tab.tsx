import { CircleAlert, ExternalLink, FlaskConical, Search, Users } from "lucide-react";
import {
  formatDate,
  type ArtifactType,
  type AudienceResearch,
  type CampaignDetail,
} from "@tulivu/shared";
import { ArtifactMissing, ArtifactPanel, BulletList, ChipList, artifactContent } from "./artifact-panel";
import { Badge, Callout, Card, SectionLabel } from "@/components/ui";

export function AudienceTab({
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
  const audience = artifactContent<AudienceResearch>(detail, "audience");

  if (!audience) {
    return (
      <ArtifactMissing
        type="audience"
        onRun={onRun}
        running={running}
        description="Audience thinking is produced after strategy. If no research provider is configured, Tulivu labels every segment as a hypothesis."
      />
    );
  }

  const researchMode = audience.mode === "research";

  return (
    <div className="space-y-5">
      <Card className={`overflow-hidden ${researchMode ? "border-leaf/25" : "border-gold-deep/30"}`}>
        <div className={`px-5 py-5 sm:px-6 ${researchMode ? "bg-[#f3f8f1]" : "bg-[#fbf6e9]"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${researchMode ? "bg-forest text-gold" : "bg-[#8b6f2a] text-ivory"}`}>
                {researchMode ? <Search className="h-4 w-4" aria-hidden /> : <FlaskConical className="h-4 w-4" aria-hidden />}
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
                  {researchMode ? "Sourced research" : "Hypothesis-based analysis"}
                </p>
                <h2 className="mt-1 text-xl leading-tight text-forest">
                  {researchMode ? "Built from observed sources." : "No market research is being claimed."}
                </h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={researchMode ? "success" : "warning"}>{audience.mode}</Badge>
              <Badge tone="neutral">Provider: {audience.provider}</Badge>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-[12px] leading-6 text-ink">{audience.summary}</p>
        </div>

        {!researchMode ? (
          <div className="flex items-start gap-2.5 border-t border-gold-deep/20 px-5 py-3 sm:px-6">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a5812e]" aria-hidden />
            <p className="text-[10px] leading-5 text-[#755b20]">
              Segments below are reasoned hypotheses, not observed facts. Validate them before increasing budget or
              making external claims.
            </p>
          </div>
        ) : null}
      </Card>

      {audience.observedFacts.length > 0 ? (
        <ArtifactPanel detail={detail} type="audience" title="Audience research" description="Sourced observations and segments" onEdit={onEdit}>
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-leaf" aria-hidden />
                <SectionLabel>Observed facts</SectionLabel>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {audience.observedFacts.map((fact, index) => (
                  <div key={`${fact.fact}-${index}`} className="rounded-xl border border-line bg-paper/60 p-3.5">
                    <p className="text-[11px] leading-5 text-ink">{fact.fact}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-2">
                      <span className="truncate text-[9px] text-muted">{fact.source}</span>
                      <span className="text-[9px] text-muted">{formatDate(fact.retrievedAt, "datetime")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <SegmentGrid audience={audience} />
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <SectionLabel>Keyword themes</SectionLabel>
                <div className="mt-2"><ChipList items={audience.keywordThemes} tone="forest" /></div>
              </div>
              <div>
                <SectionLabel>Hypotheses</SectionLabel>
                <div className="mt-2"><BulletList items={audience.hypotheses} /></div>
              </div>
            </div>
            <div className="rounded-xl border border-line bg-paper/50 p-4">
              <SectionLabel>Notes</SectionLabel>
              <p className="mt-1.5 text-[11px] leading-5 text-muted">{audience.notes}</p>
            </div>
          </div>
        </ArtifactPanel>
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="tulivu-label">Audience model</p>
                <h2 className="mt-1 text-lg leading-tight text-forest">Segments, needs and objections</h2>
              </div>
              <button
                type="button"
                onClick={() => onEdit("audience")}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-leaf hover:underline"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
                Edit JSON
              </button>
            </div>
          </div>
          <div className="space-y-7 p-5">
            <SegmentGrid audience={audience} />
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <SectionLabel>Keyword themes</SectionLabel>
                <div className="mt-2"><ChipList items={audience.keywordThemes} tone="forest" /></div>
              </div>
              <div>
                <SectionLabel>Hypotheses</SectionLabel>
                <div className="mt-2"><BulletList items={audience.hypotheses} /></div>
              </div>
            </div>
            <div className="rounded-xl border border-line bg-paper/50 p-4">
              <SectionLabel>Notes</SectionLabel>
              <p className="mt-1.5 text-[11px] leading-5 text-muted">{audience.notes}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function SegmentGrid({ audience }: { audience: AudienceResearch }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Users className="h-3.5 w-3.5 text-gold-deep" aria-hidden />
        <SectionLabel>Segments</SectionLabel>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {audience.segments.map((segment, index) => (
          <div key={`${segment.name}-${index}`} className="rounded-xl border border-line bg-[#fffdf8] p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold leading-snug text-forest">{segment.name}</h3>
              <span className="rounded-full bg-forest/[0.055] px-1.5 py-0.5 text-[9px] font-bold text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-5 text-muted">{segment.description}</p>
            <div className="mt-3 border-t border-line/70 pt-2.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-leaf">Needs</p>
              <ul className="mt-1 space-y-0.5">
                {segment.needs.map((need) => (
                  <li key={need} className="text-[10px] leading-4 text-ink">· {need}</li>
                ))}
              </ul>
            </div>
            <div className="mt-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#8b6f2a]">Objections</p>
              <ul className="mt-1 space-y-0.5">
                {segment.objections.map((objection) => (
                  <li key={objection} className="text-[10px] leading-4 text-muted">· {objection}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
