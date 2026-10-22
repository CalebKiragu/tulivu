import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  Palette,
  Sparkles,
} from "lucide-react";
import { channelLabel, formatDate, pluralise, type AssetSummary } from "@tulivu/shared";
import { PageHeader } from "@/components/page-header";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageSkeleton,
  Select,
  buttonClass,
} from "@/components/ui";
import { useAssets } from "@/lib/queries";

const kindFilters = [
  { id: "all", label: "All assets" },
  { id: "template", label: "Templates" },
  { id: "generated", label: "Generated" },
  { id: "copy", label: "Copy files" },
] as const;

function isImage(asset: AssetSummary): boolean {
  return asset.mimeType.startsWith("image/");
}

function assetTitle(asset: AssetSummary): string {
  const meta = asset.metadata ?? {};
  if (typeof meta.headline === "string" && meta.headline.trim()) return meta.headline;
  if (typeof meta.placement === "string" && meta.placement.trim()) return meta.placement;
  return asset.key.split("/").pop() ?? "Creative asset";
}

export default function StudioPage() {
  const assets = useAssets();
  const [kind, setKind] = useState<(typeof kindFilters)[number]["id"]>("all");
  const [campaignId, setCampaignId] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AssetSummary | null>(null);

  const list = assets.data?.assets ?? [];
  const campaigns = useMemo(() => {
    const map = new Map<string, string>();
    for (const asset of list) map.set(asset.campaignId, asset.campaignName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [list]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: list.length, template: 0, generated: 0, copy: 0 };
    for (const asset of list) map[asset.kind] = (map[asset.kind] ?? 0) + 1;
    return map;
  }, [list]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return list.filter((asset) => {
      if (kind !== "all" && asset.kind !== kind) return false;
      if (campaignId !== "all" && asset.campaignId !== campaignId) return false;
      if (!term) return true;
      return `${asset.campaignName} ${asset.key} ${assetTitle(asset)}`.toLowerCase().includes(term);
    });
  }, [list, kind, campaignId, search]);

  if (assets.isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Creative studio"
        title={
          <>
            Every asset, <span className="italic text-leaf">accounted for.</span>
          </>
        }
        description="Deterministic brand templates, optional generated imagery and copy-only assets. Text stays editable; generated images never carry essential claims."
        actions={
          <Link to="/app/campaigns" className={buttonClass({ variant: "secondary" })}>
            View campaigns
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Assets", value: counts.all ?? 0, detail: "In this demo workspace", icon: <ImageIcon className="h-4 w-4" aria-hidden /> },
          { label: "Templates", value: counts.template ?? 0, detail: "Deterministic SVG layouts", icon: <LayoutTemplate className="h-4 w-4" aria-hidden /> },
          { label: "Generated", value: counts.generated ?? 0, detail: "Optional image-provider output", icon: <Sparkles className="h-4 w-4" aria-hidden /> },
          { label: "Copy files", value: counts.copy ?? 0, detail: "Editable text exports", icon: <FileText className="h-4 w-4" aria-hidden /> },
        ].map((metric) => (
          <Card key={metric.label} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="tulivu-label">{metric.label}</p>
                <p className="mt-1.5 font-display text-2xl leading-none text-forest">{metric.value}</p>
                <p className="mt-1.5 text-[10px] text-muted">{metric.detail}</p>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest/[0.055] text-forest">
                {metric.icon}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="tulivu-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {kindFilters.map((filter) => {
            const active = kind === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setKind(filter.id)}
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
                  {counts[filter.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            aria-label="Filter by campaign"
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
            className="h-9 w-full text-xs sm:w-52"
          >
            <option value="all">All campaigns</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </Select>
          <Input
            aria-label="Search assets"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search placement or campaign"
            className="h-9 text-xs sm:w-60"
          />
        </div>
      </div>

      {assets.isError ? (
        <Card>
          <EmptyState
            title="Assets could not load"
            description="The API did not respond. Try again once the server is reachable."
            action={<Button onClick={() => void assets.refetch()}>Try again</Button>}
          />
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Palette className="h-5 w-5" aria-hidden />}
            title="No creative assets yet"
            description="Run the agent on a campaign. Creative production saves brand templates, copy files and optional generated imagery here."
            action={
              <Link to="/app/campaigns/new" className={buttonClass()}>
                Start a campaign
              </Link>
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing matches these filters"
            description="Try another kind, campaign or search term."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setKind("all");
                  setCampaignId("all");
                  setSearch("");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <p className="text-[10px] font-medium text-muted">
            Showing {pluralise(filtered.length, "asset")}
            {filtered.length !== list.length ? ` of ${list.length}` : ""}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((asset) => {
              const meta = asset.metadata ?? {};
              const headline = typeof meta.headline === "string" ? meta.headline : null;
              const placement = typeof meta.placement === "string" ? meta.placement : "Creative";
              return (
                <Card key={asset.id} className="group overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSelected(asset)}
                    className="relative block w-full overflow-hidden border-b border-line bg-paper text-left"
                    aria-label={`Preview ${assetTitle(asset)}`}
                  >
                    {isImage(asset) ? (
                      <img
                        src={asset.url}
                        alt={assetTitle(asset)}
                        loading="lazy"
                        className="aspect-[4/3] w-full object-contain transition duration-500 group-hover:scale-[1.015]"
                      />
                    ) : (
                      <div className="tulivu-grain flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-forest px-6 text-center text-ivory">
                        <FileText className="h-7 w-7 text-gold" aria-hidden />
                        <p className="line-clamp-2 font-display text-lg leading-tight">{assetTitle(asset)}</p>
                        <p className="text-[9px] uppercase tracking-[0.14em] text-ivory/50">Text asset</p>
                      </div>
                    )}
                    <span className="absolute left-3 top-3">
                      <Badge tone={asset.kind === "generated" ? "gold" : asset.kind === "copy" ? "neutral" : "forest"}>
                        {asset.kind}
                      </Badge>
                    </span>
                  </button>

                  <div className="space-y-2.5 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-forest">
                          {headline ?? `${channelLabel(String(meta.channel ?? ""))} · ${placement}`}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted">
                          {asset.width} × {asset.height} · {asset.mimeType.replace("image/", "").toUpperCase()}
                        </p>
                      </div>
                      <a
                        href={asset.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="rounded-md p-1 text-muted transition hover:bg-forest/[0.06] hover:text-forest"
                        aria-label="Open asset in a new tab"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    </div>
                    <Link
                      to={`/app/campaigns/${asset.campaignId}?tab=creative`}
                      className="block truncate text-[10px] font-semibold text-leaf hover:underline"
                    >
                      {asset.campaignName}
                    </Link>
                    <div className="flex items-center justify-between text-[9px] text-muted">
                      <span>{formatDate(asset.createdAt)}</span>
                      <span>{Math.max(1, Math.round(asset.sizeBytes / 1024))} KB</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? assetTitle(selected) : "Asset"}
        description={
          selected
            ? `${selected.campaignName} · ${String((selected.metadata ?? {}).placement ?? "Creative")} · ${selected.width} × ${selected.height}`
            : undefined
        }
        size="lg"
        footer={
          selected ? (
            <>
              <Link to={`/app/campaigns/${selected.campaignId}?tab=creative`} className={buttonClass({ variant: "secondary" })}>
                Open campaign
              </Link>
              <a href={selected.url} download className={buttonClass()}>
                <Download className="h-3.5 w-3.5" aria-hidden />
                Download asset
              </a>
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-4">
            {isImage(selected) ? (
              <div className="overflow-hidden rounded-xl border border-line bg-paper">
                <img src={selected.url} alt={assetTitle(selected)} className="mx-auto max-h-[60vh] w-auto" />
              </div>
            ) : (
              <div className="rounded-xl border border-line bg-paper p-6 text-center">
                <FileText className="mx-auto h-8 w-8 text-forest" aria-hidden />
                <p className="mt-2 text-xs font-semibold text-forest">This is a plain-text asset</p>
                <p className="mt-1 text-[10px] text-muted">Open it in a new tab to read or copy the contents.</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral">{selected.kind}</Badge>
              <Badge tone="neutral">{selected.mimeType}</Badge>
              <Badge tone="neutral">{selected.key.split("/").pop()}</Badge>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
