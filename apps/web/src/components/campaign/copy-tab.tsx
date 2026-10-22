import { useState } from "react";
import { Check, CircleAlert, Copy, MessageSquare, Search, Sparkles, TriangleAlert, X } from "lucide-react";
import {
  channelLabel,
  type AdCopyPackage,
  type ArtifactType,
  type CampaignDetail,
  type CopyVariant,
} from "@tulivu/shared";
import { PLATFORM_SPECS } from "@tulivu/ad-platforms";
import { ArtifactMissing, ArtifactPanel, ChipList, artifactContent } from "./artifact-panel";
import { Badge, Card, CopyButton, SectionLabel } from "@/components/ui";
import { cn } from "@tulivu/shared";

function count(text: string): number {
  return Array.from(text).length;
}

function variantTone(length: number, recommended: number, max: number): "success" | "warning" | "danger" {
  if (length > max) return "danger";
  if (length > recommended) return "warning";
  return "success";
}

function VariantRow({
  variant,
  max,
  recommended,
  label,
}: {
  variant: CopyVariant;
  max: number;
  recommended: number;
  label: string;
}) {
  const length = count(variant.text);
  const tone = variantTone(length, recommended, max);
  return (
    <div className="group rounded-xl border border-line bg-[#fffdf8] p-3.5 transition hover:border-forest/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
          <p className="mt-1 text-[12px] leading-5 text-ink">{variant.text}</p>
        </div>
        <CopyButton value={variant.text} label="" />
      </div>
      {variant.rationale ? <p className="mt-2 text-[10px] italic leading-4 text-muted">{variant.rationale}</p> : null}
      <div className="mt-2.5 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
          <div
            className={cn(
              "h-full rounded-full",
              tone === "success" ? "bg-leaf/60" : tone === "warning" ? "bg-[#c4a24d]" : "bg-clay",
            )}
            style={{ width: `${Math.min(100, (length / max) * 100)}%` }}
          />
        </div>
        <span
          className={cn(
            "shrink-0 text-[9px] font-semibold tabular-nums",
            tone === "success" ? "text-leaf" : tone === "warning" ? "text-[#8b6f2a]" : "text-clay",
          )}
        >
          {length}/{max}
        </span>
      </div>
    </div>
  );
}

function ValidationCard({ copy }: { copy: AdCopyPackage }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {copy.validation.map((channel) => (
        <div key={channel.channel} className="rounded-xl border border-line bg-paper/50 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-forest">{channelLabel(channel.channel)}</p>
            <Badge tone={channel.status === "pass" ? "success" : channel.status === "warning" ? "warning" : "danger"}>
              {channel.status}
            </Badge>
          </div>
          {channel.issues.length === 0 ? (
            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-leaf">
              <Check className="h-3 w-3" aria-hidden />
              Within the planning limits.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {channel.issues.map((issue, index) => (
                <li key={`${issue.code}-${index}`} className="flex gap-1.5 text-[10px] leading-4 text-muted">
                  {issue.severity === "warning" ? (
                    <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-[#a5812e]" aria-hidden />
                  ) : issue.severity === "error" ? (
                    <X className="mt-0.5 h-3 w-3 shrink-0 text-clay" aria-hidden />
                  ) : (
                    <CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-muted" aria-hidden />
                  )}
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export function CopyTab({
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
  const copy = artifactContent<AdCopyPackage>(detail, "copy");
  const [view, setView] = useState<"meta" | "google">(copy?.meta ? "meta" : "google");

  if (!copy) {
    return (
      <ArtifactMissing
        type="copy"
        onRun={onRun}
        running={running}
        description="Channel copy is generated after strategy and audience work. Every variant is validated against the versioned platform limits before it is saved."
      />
    );
  }

  const metaSpec = PLATFORM_SPECS.meta;
  const googleSpec = PLATFORM_SPECS.google;
  const showMeta = Boolean(copy.meta);
  const showGoogle = Boolean(copy.google);
  const active = view === "meta" && showMeta ? "meta" : showGoogle ? "google" : "meta";

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="tulivu-label">Copy package</p>
            <h2 className="mt-1 text-lg leading-tight text-forest">Channel-ready language</h2>
            <p className="mt-1 text-[10px] text-muted">
              Constraints: {copy.constraintsVersion} · generated {new Date(copy.generatedAt).toLocaleDateString("en-GB")}
            </p>
          </div>
          <div className="flex gap-1 rounded-xl border border-line bg-paper p-1">
            {showMeta ? (
              <button
                type="button"
                onClick={() => setView("meta")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition",
                  active === "meta" ? "bg-forest text-ivory" : "text-muted hover:text-forest",
                )}
              >
                Meta
              </button>
            ) : null}
            {showGoogle ? (
              <button
                type="button"
                onClick={() => setView("google")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition",
                  active === "google" ? "bg-forest text-ivory" : "text-muted hover:text-forest",
                )}
              >
                Google
              </button>
            ) : null}
          </div>
        </div>
        <div className="p-5">
          <ValidationCard copy={copy} />
        </div>
      </Card>

      {active === "meta" && copy.meta ? (
        <div className="space-y-5">
          <ArtifactPanel detail={detail} type="copy" title="Meta · Facebook & Instagram" description="Primary text, headlines and concepts" onEdit={onEdit}>
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-gold-deep" aria-hidden />
                    <SectionLabel>Primary text</SectionLabel>
                    <span className="text-[9px] text-muted">{metaSpec.limits.primaryTextRecommended} recommended</span>
                  </div>
                  <div className="mt-2.5 space-y-2.5">
                    {copy.meta.primaryTexts.map((variant, index) => (
                      <VariantRow
                        key={variant.id}
                        variant={variant}
                        label={`Variation ${index + 1}`}
                        max={metaSpec.limits.primaryTextMax}
                        recommended={metaSpec.limits.primaryTextRecommended}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-gold-deep" aria-hidden />
                    <SectionLabel>Headlines</SectionLabel>
                    <span className="text-[9px] text-muted">{metaSpec.limits.headlineMax} max</span>
                  </div>
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    {copy.meta.headlines.map((variant, index) => (
                      <VariantRow
                        key={variant.id}
                        variant={variant}
                        label={`Headline ${index + 1}`}
                        max={metaSpec.limits.headlineMax}
                        recommended={metaSpec.limits.headlineRecommended}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <SectionLabel>Descriptions</SectionLabel>
                  <div className="mt-2.5 space-y-2">
                    {copy.meta.descriptions.map((variant, index) => (
                      <VariantRow
                        key={variant.id}
                        variant={variant}
                        label={`Description ${index + 1}`}
                        max={metaSpec.limits.descriptionMax}
                        recommended={metaSpec.limits.descriptionRecommended}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <SectionLabel>Call to action</SectionLabel>
                  <div className="mt-2"><ChipList items={copy.meta.ctas} tone="gold" /></div>
                </div>
                <div className="rounded-xl border border-line bg-paper/60 p-3.5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">Platform notes</p>
                  <ul className="mt-1.5 space-y-1">
                    {metaSpec.notes.map((note) => (
                      <li key={note} className="text-[10px] leading-4 text-muted">· {note}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {copy.meta.concepts.length > 0 ? (
              <div className="mt-6 border-t border-line pt-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-gold-deep" aria-hidden />
                  <SectionLabel>Creative concepts</SectionLabel>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {copy.meta.concepts.map((concept, index) => (
                    <div key={`${concept.name}-${index}`} className="rounded-xl border border-line bg-[#fffdf8] p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-semibold text-forest">{concept.name}</h3>
                        <span className="text-[9px] font-bold text-muted">{String(index + 1).padStart(2, "0")}</span>
                      </div>
                      <p className="mt-2 text-[10px] leading-4 text-muted">{concept.idea}</p>
                      <p className="mt-2 border-t border-line/70 pt-2 text-[10px] leading-4 text-ink">{concept.visualDirection}</p>
                      <p className="mt-1.5 text-[9px] font-semibold text-leaf">{concept.placement}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </ArtifactPanel>
        </div>
      ) : null}

      {active === "google" && copy.google ? (
        <ArtifactPanel detail={detail} type="copy" title="Google · Responsive search" description="Headlines, descriptions and keyword intent" onEdit={onEdit}>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-gold-deep" aria-hidden />
                  <SectionLabel>Headlines</SectionLabel>
                  <span className="text-[9px] text-muted">{googleSpec.limits.headlineMax} max</span>
                </div>
                <div className="mt-2.5 space-y-2">
                  {copy.google.headlines.map((variant, index) => (
                    <VariantRow
                      key={variant.id}
                      variant={variant}
                      label={`Headline ${index + 1}`}
                      max={googleSpec.limits.headlineMax}
                      recommended={googleSpec.limits.headlineRecommended}
                    />
                  ))}
                </div>
              </div>
              <div>
                <SectionLabel>Descriptions</SectionLabel>
                <div className="mt-2.5 space-y-2">
                  {copy.google.descriptions.map((variant, index) => (
                    <VariantRow
                      key={variant.id}
                      variant={variant}
                      label={`Description ${index + 1}`}
                      max={googleSpec.limits.descriptionMax}
                      recommended={googleSpec.limits.descriptionRecommended}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-xl border border-line bg-[#fffdf8] p-4">
                <div className="flex items-center gap-2">
                  <Copy className="h-3.5 w-3.5 text-gold-deep" aria-hidden />
                  <SectionLabel>Sitelinks</SectionLabel>
                </div>
                <div className="mt-2"><ChipList items={copy.google.sitelinks} /></div>
              </div>
              <div>
                <SectionLabel>Keyword themes</SectionLabel>
                <div className="mt-2"><ChipList items={copy.google.keywordThemes} tone="forest" /></div>
              </div>
              <div>
                <SectionLabel>Negative keywords</SectionLabel>
                <div className="mt-2"><ChipList items={copy.google.negativeKeywords} tone="gold" /></div>
              </div>
              <div className="rounded-xl border border-line bg-paper/60 p-3.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">Responsive search notes</p>
                <ul className="mt-1.5 space-y-1">
                  {googleSpec.notes.map((note) => (
                    <li key={note} className="text-[10px] leading-4 text-muted">· {note}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </ArtifactPanel>
      ) : null}
    </div>
  );
}
