import { useState } from "react";
import { ArrowUpRight, Image as ImageIcon, Layers3, Palette, Sparkles, Wand2 } from "lucide-react";
import {
  channelLabel,
  formatDate,
  type ArtifactType,
  type CampaignDetail,
  type CreativeAsset,
  type CreativePackage,
} from "@tulivu/shared";
import { ArtifactMissing, ArtifactPanel, ChipList, artifactContent } from "./artifact-panel";
import { Badge, Card, EmptyState, Modal, SectionLabel } from "@/components/ui";

function AssetCard({ asset, onOpen }: { asset: CreativeAsset; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  const aspect = `${asset.width} / ${asset.height}`;
  const isText = asset.format === "text" || !asset.url;

  return (
    <Card className="group flex flex-col overflow-hidden p-0 transition hover:shadow-lift">
      <button
        type="button"
        onClick={onOpen}
        className="relative flex w-full items-center justify-center overflow-hidden bg-[#eeeae1] p-3 text-left"
        style={{ aspectRatio: aspect, maxHeight: 320 }}
        aria-label={`Preview ${asset.headline ?? asset.placement}`}
      >
        {!isText && !failed ? (
          <img
            src={asset.url}
            alt={asset.headline ?? `${channelLabel(asset.channel)} creative`}
            className="h-full w-full rounded-md object-contain shadow-sm"
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="flex flex-col items-center gap-2 text-center text-muted">
            <ImageIcon className="h-6 w-6" aria-hidden />
            <span className="text-[10px] font-semibold">{isText ? "Copy-only asset" : "Preview unavailable"}</span>
            {asset.format === "text" ? (
              <span className="max-w-[240px] text-[10px] leading-4 text-ink">{asset.copy}</span>
            ) : null}
          </span>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-[#fffdf8]/90 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-forest shadow-sm">
          {channelLabel(asset.channel)}
        </span>
        <span className="absolute right-2 top-2 rounded-full bg-forest/90 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-ivory">
          {asset.format.toUpperCase()}
        </span>
      </button>

      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold text-forest">{asset.placement}</p>
            <p className="mt-0.5 text-[9px] text-muted">
              {asset.width} × {asset.height} · {asset.provider}
            </p>
          </div>
          <Badge tone={asset.status === "ready" ? "success" : asset.status === "mock" ? "warning" : "danger"} className="px-2 py-0.5 text-[8px]">
            {asset.status}
          </Badge>
        </div>
        {asset.headline ? <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-4 text-ink">{asset.headline}</p> : null}
        {asset.notes.length > 0 ? (
          <p className="mt-2 line-clamp-2 text-[9px] leading-4 text-muted">{asset.notes[0]}</p>
        ) : null}
        <button
          type="button"
          onClick={onOpen}
          className="mt-auto flex items-center gap-1 pt-3 text-[9px] font-bold uppercase tracking-[0.08em] text-leaf hover:underline"
        >
          Inspect asset
          <ArrowUpRight className="h-2.5 w-2.5" aria-hidden />
        </button>
      </div>
    </Card>
  );
}

function AssetModal({ asset, onClose }: { asset: CreativeAsset | null; onClose: () => void }) {
  if (!asset) return null;
  return (
    <Modal open onClose={onClose} title={asset.headline ?? "Creative asset"} description={`${channelLabel(asset.channel)} · ${asset.placement}`} size="lg">
      <div className="space-y-5">
        <div className="rounded-xl border border-line bg-[#eeeae1] p-4">
          {asset.url && asset.format !== "text" ? (
            <img src={asset.url} alt={asset.headline ?? "Creative asset"} className="mx-auto max-h-[60vh] w-auto rounded-md shadow-sm" />
          ) : (
            <p className="whitespace-pre-wrap p-6 text-center text-sm leading-7 text-ink">{asset.copy ?? "No preview available."}</p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Channel", channelLabel(asset.channel)],
            ["Placement", asset.placement],
            ["Format", `${asset.format.toUpperCase()} · ${asset.width} × ${asset.height}`],
            ["Provider", asset.provider],
            ["Status", asset.status],
            ["Created", formatDate(asset.createdAt, "datetime")],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line bg-paper/60 px-3 py-2">
              <p className="tulivu-label">{label}</p>
              <p className="mt-1 text-[11px] font-medium text-ink">{value}</p>
            </div>
          ))}
        </div>
        {asset.headline || asset.subhead || asset.cta || asset.copy ? (
          <div className="rounded-xl border border-line p-4">
            <SectionLabel>Editable text</SectionLabel>
            {asset.headline ? <p className="mt-2 font-display text-xl leading-7 text-forest">{asset.headline}</p> : null}
            {asset.subhead ? <p className="mt-1 text-xs leading-5 text-muted">{asset.subhead}</p> : null}
            {asset.cta ? <span className="mt-3 inline-block rounded-full bg-forest px-3 py-1.5 text-[10px] font-bold text-ivory">{asset.cta}</span> : null}
            {asset.copy ? <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-ink">{asset.copy}</p> : null}
          </div>
        ) : null}
        {asset.prompt ? (
          <div className="rounded-xl border border-line bg-paper/60 p-4">
            <SectionLabel>Image prompt</SectionLabel>
            <p className="mt-1.5 text-[10px] leading-5 text-muted">{asset.prompt}</p>
          </div>
        ) : null}
        {asset.notes.length > 0 ? (
          <div>
            <SectionLabel>Notes</SectionLabel>
            <ul className="mt-2 space-y-1">
              {asset.notes.map((note, index) => (
                <li key={`${note}-${index}`} className="text-[10px] leading-4 text-muted">· {note}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {asset.url ? (
          <a
            href={asset.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-leaf hover:underline"
          >
            Open asset in a new tab
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </a>
        ) : null}
      </div>
    </Modal>
  );
}

export function CreativeTab({
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
  const creative = artifactContent<CreativePackage>(detail, "creative");
  const [selected, setSelected] = useState<CreativeAsset | null>(null);

  if (!creative) {
    return (
      <ArtifactMissing
        type="creative"
        onRun={onRun}
        running={running}
        description="Creative production turns the approved copy into brand-aligned templates. Essential ad text stays editable and outside generated imagery."
      />
    );
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest text-gold">
              <Palette className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="tulivu-label">Creative package</p>
              <h2 className="mt-1 text-lg leading-tight text-forest">{creative.assets.length} assets, ready to inspect</h2>
              <p className="mt-1 text-[10px] text-muted">
                Image provider: {creative.imageProvider} · generated {formatDate(creative.generatedAt, "datetime")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={creative.imageProvider.includes("mock") ? "warning" : "forest"}>{creative.imageProvider}</Badge>
            <button
              type="button"
              onClick={() => onEdit("creative")}
              className="rounded-lg border border-line bg-[#fffdf8] px-2.5 py-1.5 text-[10px] font-semibold text-forest hover:border-forest/30"
            >
              Edit JSON
            </button>
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3 xl:grid-cols-4">
          {creative.assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} onOpen={() => setSelected(asset)} />
          ))}
        </div>
        {creative.assets.length === 0 ? (
          <EmptyState
            icon={<Layers3 className="h-5 w-5" aria-hidden />}
            title="No assets in this package"
            description="Re-run the creative stage to produce templates for the selected channels."
          />
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Wand2 className="h-3.5 w-3.5 text-gold-deep" aria-hidden />
            <SectionLabel>Production notes</SectionLabel>
          </div>
          <ul className="mt-3 space-y-2">
            {creative.notes.map((note, index) => (
              <li key={`${note}-${index}`} className="flex gap-2 text-[11px] leading-5 text-muted">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold-deep" aria-hidden />
                {note}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-gold-deep" aria-hidden />
            <SectionLabel>What is editable</SectionLabel>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-muted">
            Essential ad text is stored as structured fields and rendered into deterministic SVG templates. Reviewers can
            edit those fields, or replace an asset with a human-designed file. Generated imagery never contains baked-in
            claims.
          </p>
          <div className="mt-3"><ChipList items={["SVG templates", "Copy-only variants", "Optional AI imagery"]} tone="forest" /></div>
        </Card>
      </div>

      <AssetModal asset={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
