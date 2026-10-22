import type { ReactNode } from "react";
import { ARTIFACT_LABELS, ARTIFACT_TYPES, formatDate, type ArtifactType, type CampaignDetail } from "@tulivu/shared";
import { FileText, Pencil, Play, Power } from "lucide-react";
import { Badge, Button, Card, EmptyState, SectionLabel } from "@/components/ui";

export function artifactContent<T>(detail: CampaignDetail, type: ArtifactType): T | undefined {
  const artifact = detail.artifacts[type];
  return artifact ? (artifact.content as T) : undefined;
}

export function ArtifactPanel({
  detail,
  type,
  title,
  description,
  actions,
  onEdit,
  children,
  muted = false,
}: {
  detail: CampaignDetail;
  type: ArtifactType;
  title?: string;
  description?: string;
  actions?: ReactNode;
  onEdit: (type: ArtifactType) => void;
  children: ReactNode;
  muted?: boolean;
}) {
  const artifact = detail.artifacts[type];
  if (!artifact) return null;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest/[0.06] text-forest">
              <FileText className="h-3.5 w-3.5" aria-hidden />
            </span>
            <h2 className="text-lg leading-tight text-forest">{title ?? ARTIFACT_LABELS[type]}</h2>
            <Badge tone={muted ? "neutral" : "forest"} className="px-2 py-0.5">v{artifact.version}</Badge>
          </div>
          <p className="mt-1.5 text-[10px] text-muted">
            Saved {formatDate(artifact.createdAt, "datetime")}
            {description ? ` · ${description}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {type !== "quality" ? (
            <Button variant="secondary" size="sm" onClick={() => onEdit(type)}>
              <Pencil className="h-3 w-3" aria-hidden />
              Edit JSON
            </Button>
          ) : null}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

export function ArtifactMissing({
  type,
  onRun,
  running,
  description,
}: {
  type: ArtifactType;
  onRun?: () => void;
  running?: boolean;
  description?: string;
}) {
  return (
    <Card>
      <EmptyState
        icon={<Power className="h-5 w-5" aria-hidden />}
        title={`${ARTIFACT_LABELS[type]} is not ready`}
        description={
          description ??
          "This artifact is produced by the agent workflow. Run the campaign to generate it, then come back to review and edit."
        }
        action={
          onRun ? (
            <Button onClick={onRun} loading={running}>
              <Play className="h-3.5 w-3.5" aria-hidden />
              Run the agent
            </Button>
          ) : undefined
        }
      />
    </Card>
  );
}

export function InfoGrid({
  items,
  columns = 2,
}: {
  items: Array<{ label: string; value: ReactNode; hint?: string }>;
  columns?: 2 | 3 | 4;
}) {
  return (
    <dl
      className={`grid gap-x-5 gap-y-4 ${
        columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
      }`}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="tulivu-label">{item.label}</dt>
          <dd className="mt-1.5 text-xs leading-5 text-ink">{item.value}</dd>
          {item.hint ? <p className="mt-1 text-[10px] leading-4 text-muted">{item.hint}</p> : null}
        </div>
      ))}
    </dl>
  );
}

export function ChipList({ items, tone = "neutral" }: { items: string[]; tone?: "neutral" | "gold" | "forest" }) {
  if (items.length === 0) return <p className="text-[11px] text-muted">None supplied.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${
            tone === "gold"
              ? "border-gold-deep/25 bg-gold/[0.14] text-[#6e5b2b]"
              : tone === "forest"
                ? "border-forest/15 bg-forest/[0.045] text-forest"
                : "border-line bg-paper text-ink"
          }`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function BulletList({ items, tone = "default" }: { items: string[]; tone?: "default" | "warning" | "danger" }) {
  if (items.length === 0) return <p className="text-[11px] text-muted">Nothing recorded.</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2.5 text-[11px] leading-5 text-ink">
          <span
            className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
              tone === "danger" ? "bg-clay" : tone === "warning" ? "bg-gold-deep" : "bg-leaf/60"
            }`}
            aria-hidden
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function ArtifactProvenance({ type, detail }: { type: ArtifactType; detail: CampaignDetail }) {
  const label = ARTIFACT_LABELS[type];
  return (
    <p className="text-[10px] text-muted">
      {label} · v{detail.artifacts[type]?.version ?? "—"} · campaign v{detail.campaign.currentVersion}
    </p>
  );
}

export function ArtifactNavigation({ active, onChange }: { active: ArtifactType; onChange: (type: ArtifactType) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {ARTIFACT_TYPES.filter((type) => type !== "quality").map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${
            active === type ? "border-forest bg-forest text-ivory" : "border-line bg-[#fffdf8] text-muted"
          }`}
        >
          {ARTIFACT_LABELS[type]}
        </button>
      ))}
    </div>
  );
}

export function ReviewNote() {
  return (
    <div className="rounded-xl border border-line bg-paper/60 px-4 py-3">
      <SectionLabel>Reviewer note</SectionLabel>
      <p className="mt-1.5 text-[11px] leading-5 text-muted">
        Artifacts are structured records. Editing one creates a new artifact version and a new campaign version, then
        marks quality and approval as stale.
      </p>
    </div>
  );
}
