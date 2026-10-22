import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  CircleAlert,
  Download,
  FileJson,
  FileText,
  Layers,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Square,
  Target,
  Wallet,
} from "lucide-react";
import {
  CAMPAIGN_STATUSES,
  OBJECTIVES,
  channelLabel,
  formatDate,
  formatMoney,
  stageLabel,
  statusMeta,
  type ArtifactType,
  type QualityReport,
} from "@tulivu/shared";
import { PageHeader } from "@/components/page-header";
import { ArtifactEditorModal } from "@/components/artifact-editor";
import { WorkflowRail } from "@/components/campaign/workflow-rail";
import { StrategyTab } from "@/components/campaign/strategy-tab";
import { AudienceTab } from "@/components/campaign/audience-tab";
import { CopyTab } from "@/components/campaign/copy-tab";
import { CreativeTab } from "@/components/campaign/creative-tab";
import { LandingTab } from "@/components/campaign/landing-tab";
import { ConfigurationTab } from "@/components/campaign/configuration-tab";
import { QualityTab } from "@/components/campaign/quality-tab";
import { ApprovalTab } from "@/components/campaign/approval-tab";
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  Modal,
  PageSkeleton,
  StatusBadge,
  Tabs,
  buttonClass,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { apiErrorMessage, downloadCampaignExport } from "@/lib/api";
import {
  useCampaign,
  useCampaignEvents,
  useCancelRun,
  useResumeRun,
  useRevalidateQuality,
  useStartRun,
} from "@/lib/queries";
import { cn } from "@tulivu/shared";

const TAB_IDS = [
  "strategy",
  "audience",
  "copy",
  "creative",
  "landing",
  "configuration",
  "quality",
  "approval",
] as const;

type TabId = (typeof TAB_IDS)[number];

const TAB_LABELS: Record<TabId, string> = {
  strategy: "Strategy",
  audience: "Audience",
  copy: "Copy",
  creative: "Creative",
  landing: "Landing page",
  configuration: "Configuration",
  quality: "Quality",
  approval: "Approval",
};

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const campaign = useCampaign(campaignId);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab: TabId = TAB_IDS.includes(requestedTab as TabId) ? (requestedTab as TabId) : "strategy";
  const [editing, setEditing] = useState<ArtifactType | null>(null);
  const [confirmRunOpen, setConfirmRunOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<"markdown" | "json" | null>(null);

  const startRun = useStartRun(campaignId ?? "");
  const cancelRun = useCancelRun(campaignId ?? "");
  const resumeRun = useResumeRun(campaignId ?? "");
  const revalidate = useRevalidateQuality(campaignId ?? "");
  const { connected, lastEvent } = useCampaignEvents(campaignId, Boolean(campaignId));
  const { push } = useToast();
  const seenEvents = useRef(new Set<string>());

  const detail = campaign.data?.campaign;

  useEffect(() => {
    if (!detail) return;
    document.title = `${detail.campaign.name} · tulivu`;
    return () => {
      document.title = "tulivu — autonomous marketing, with a human gate";
    };
  }, [detail]);

  useEffect(() => {
    if (!lastEvent) return;
    const key = `${lastEvent.type}:${JSON.stringify(lastEvent.payload)}`;
    if (seenEvents.current.has(key)) return;
    seenEvents.current.add(key);
    if (seenEvents.current.size > 60) {
      const first = seenEvents.current.values().next().value;
      if (first) seenEvents.current.delete(first);
    }

    const stage = typeof lastEvent.payload.stage === "string" ? lastEvent.payload.stage : null;
    const message = typeof lastEvent.payload.message === "string" ? lastEvent.payload.message : undefined;

    switch (lastEvent.type) {
      case "run.started":
        push({ title: "Agent run started", description: "Tulivu is working through the eight bounded stages.", tone: "info" });
        break;
      case "run.completed":
        push({
          title: "Package ready for review",
          description: "All stages completed. Read the quality review, then decide.",
          tone: "success",
        });
        break;
      case "run.failed":
        push({
          title: "A stage needs attention",
          description: message ?? "The run stopped. Resume it without losing completed stages.",
          tone: "error",
        });
        break;
      case "stage.failed":
        push({
          title: stage ? `${stageLabel(stage)} failed` : "A stage failed",
          description: message ?? "The run can be resumed from this stage.",
          tone: "error",
        });
        break;
      case "run.cancelled":
        push({ title: "Run cancelled", description: "Completed artifacts were kept.", tone: "info" });
        break;
      case "approval.required":
        push({
          title: "Human decision required",
          description: "The agent has stopped at the approval gate.",
          tone: "info",
        });
        break;
      case "approval.invalidated":
        push({
          title: "Approval invalidated",
          description: message ?? "The package changed. Review and approve the current version.",
          tone: "error",
        });
        break;
      default:
        break;
    }
  }, [lastEvent, push]);

  if (campaign.isLoading) return <PageSkeleton />;

  if (campaign.isError || !detail || !campaignId) {
    return (
      <EmptyState
        title="This campaign could not be opened"
        description="It may not exist in this workspace, or the API could not be reached."
        action={
          <Link to="/app/campaigns" className={buttonClass()}>
            Back to campaigns
          </Link>
        }
      />
    );
  }

  const currentVersion = detail.campaign.currentVersion;
  const campaignName = detail.campaign.name;
  const artifacts = detail.artifacts;
  const hasArtifacts = Object.keys(artifacts).length > 0;
  const latestRun = detail.runs[0] ?? null;
  const running = detail.campaign.status === "running";
  const executing = detail.campaign.status === "executing";
  const published = detail.campaign.status === "published_demo";
  const canResume = detail.campaign.status === "failed" || latestRun?.status === "failed";
  const quality = artifacts.quality?.content as QualityReport | undefined;
  const activeApproval = detail.approvals.find(
    (approval) => approval.status === "active" && approval.campaignVersion === currentVersion,
  );
  const objectiveLabel = OBJECTIVES.find((item) => item.id === detail.campaign.objective)?.label ?? detail.campaign.objective;
  const qualityStale = campaign.data?.qualityStale ?? detail.qualityStale;

  function selectTab(next: string) {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  }

  function openEditor(type: ArtifactType) {
    if (!artifacts[type]) {
      push({
        title: "Run the agent first",
        description: "This artifact has not been produced yet.",
        tone: "info",
      });
      return;
    }
    setEditing(type);
  }

  async function doRun() {
    try {
      await startRun.mutateAsync();
      setConfirmRunOpen(false);
      push({
        title: hasArtifacts ? `Version ${currentVersion + 1} started` : "Agent run started",
        description: "The workflow is running. This page updates as each stage saves its artifact.",
        tone: "info",
      });
    } catch (error) {
      push({ title: "The agent could not start", description: apiErrorMessage(error), tone: "error" });
    }
  }

  function requestRun() {
    if (running || executing) {
      push({ title: "The agent is already working", description: "Wait for the current run to finish.", tone: "info" });
      return;
    }
    if (hasArtifacts) {
      setConfirmRunOpen(true);
      return;
    }
    void doRun();
  }

  async function doCancel() {
    if (!latestRun) return;
    try {
      await cancelRun.mutateAsync(latestRun.id);
      setConfirmCancelOpen(false);
      push({
        title: "Run cancelled",
        description: "Completed artifacts were kept. You can start a new run when ready.",
        tone: "info",
      });
    } catch (error) {
      push({ title: "The run could not be cancelled", description: apiErrorMessage(error), tone: "error" });
    }
  }

  async function doResume() {
    if (!latestRun) return;
    try {
      await resumeRun.mutateAsync(latestRun.id);
      push({
        title: "Run resumed",
        description: "Continuing from the first incomplete stage. Completed artifacts are retained.",
        tone: "info",
      });
    } catch (error) {
      push({ title: "The run could not resume", description: apiErrorMessage(error), tone: "error" });
    }
  }

  async function runQuality() {
    try {
      await revalidate.mutateAsync();
      push({
        title: "Quality review started",
        description: "The review reads the latest saved artifacts without regenerating them.",
        tone: "info",
      });
      selectTab("quality");
    } catch (error) {
      push({ title: "The review could not start", description: apiErrorMessage(error), tone: "error" });
    }
  }

  async function doExport(format: "markdown" | "json") {
    setExporting(format);
    try {
      await downloadCampaignExport(campaignId!, format, campaignName);
      push({
        title: `Exported as ${format === "json" ? "JSON" : "Markdown"}`,
        description: "The package includes the brief, artifacts and approval state.",
        tone: "success",
      });
      setExportOpen(false);
    } catch (error) {
      push({ title: "Export failed", description: apiErrorMessage(error), tone: "error" });
    } finally {
      setExporting(null);
    }
  }

  const stageStatus = statusMeta(detail.campaign.status);

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ to: "/app/campaigns", label: "All campaigns" }}
        eyebrow={`${detail.business.name} · campaign v${currentVersion}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {detail.campaign.name}
            <StatusBadge status={detail.campaign.status} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{objectiveLabel}</span>
            <span className="text-line">·</span>
            <span>{detail.campaign.channels.map(channelLabel).join(" + ")}</span>
            <span className="text-line">·</span>
            <span>{formatMoney(detail.campaign.budgetAmount, detail.campaign.budgetCurrency)}</span>
            <span className="text-line">·</span>
            <span>
              {formatDate(detail.campaign.startDate)} → {formatDate(detail.campaign.endDate)}
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setExportOpen(true)}>
              <Download className="h-3.5 w-3.5" aria-hidden />
              Export
            </Button>
            {running ? (
              <Button variant="danger" onClick={() => setConfirmCancelOpen(true)} loading={cancelRun.isPending}>
                <Square className="h-3.5 w-3.5" aria-hidden />
                Stop run
              </Button>
            ) : canResume ? (
              <Button onClick={doResume} loading={resumeRun.isPending}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Resume run
              </Button>
            ) : (
              <Button
                onClick={requestRun}
                loading={startRun.isPending}
                disabled={executing || published}
                title={published ? "Update the brief to start a new version." : undefined}
              >
                <Play className="h-3.5 w-3.5" aria-hidden />
                {hasArtifacts ? "Run again" : "Run the agent"}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Objective",
            value: objectiveLabel,
            hint: stageStatus.description,
            icon: <Target className="h-4 w-4" aria-hidden />,
          },
          {
            label: "Channels",
            value: detail.campaign.channels.map(channelLabel).join(" + "),
            hint: "Channel-specific copy and configuration",
            icon: <Layers className="h-4 w-4" aria-hidden />,
          },
          {
            label: "Planned budget",
            value: formatMoney(detail.campaign.budgetAmount, detail.campaign.budgetCurrency),
            hint: "Planning figure. No live spend occurs in this demo.",
            icon: <Wallet className="h-4 w-4" aria-hidden />,
          },
          {
            label: "Schedule",
            value: `${formatDate(detail.campaign.startDate)} → ${formatDate(detail.campaign.endDate)}`,
            hint: `${detail.campaign.brief.durationDays} days`,
            icon: <CalendarDays className="h-4 w-4" aria-hidden />,
          },
        ].map((metric) => (
          <Card key={metric.label} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="tulivu-label">{metric.label}</p>
                <p className="mt-1.5 truncate text-sm font-semibold text-forest">{metric.value}</p>
                <p className="mt-1 text-[10px] leading-4 text-muted">{metric.hint}</p>
              </div>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest/[0.055] text-forest">
                {metric.icon}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <WorkflowRail detail={detail} connected={connected} onSelectTab={selectTab} />

      {published ? (
        <Callout tone="success" icon={<ShieldCheck className="h-4 w-4" aria-hidden />} title="Simulated launch only">
          Paused demo resources exist for this version. No live Meta or Google ads, spend or audiences were touched.
          Update the brief to begin a new version.
        </Callout>
      ) : null}

      {detail.campaign.status === "failed" ? (
        <Callout tone="danger" icon={<CircleAlert className="h-4 w-4" aria-hidden />} title="The last run stopped">
          {latestRun?.errorSummary ?? "A stage failed."} Resume keeps every completed artifact and retries from the
          first incomplete stage.
        </Callout>
      ) : null}

      <Card className="overflow-hidden">
        <div className="px-3 pt-2 sm:px-4">
          <Tabs
            items={TAB_IDS.map((id) => ({
              id,
              label: TAB_LABELS[id],
              ...(id === "quality" && quality ? { badge: quality.score } : {}),
              ...(id === "approval" && activeApproval ? { badge: "approved" } : {}),
            }))}
            active={tab}
            onChange={selectTab}
          />
        </div>

        <div className="p-4 sm:p-5">
          {tab === "strategy" ? (
            <StrategyTab detail={detail} onEdit={openEditor} onRun={requestRun} running={running || executing} />
          ) : null}
          {tab === "audience" ? (
            <AudienceTab detail={detail} onEdit={openEditor} onRun={requestRun} running={running || executing} />
          ) : null}
          {tab === "copy" ? (
            <CopyTab detail={detail} onEdit={openEditor} onRun={requestRun} running={running || executing} />
          ) : null}
          {tab === "creative" ? (
            <CreativeTab detail={detail} onEdit={openEditor} onRun={requestRun} running={running || executing} />
          ) : null}
          {tab === "landing" ? (
            <LandingTab detail={detail} onEdit={openEditor} onRun={requestRun} running={running || executing} />
          ) : null}
          {tab === "configuration" ? (
            <ConfigurationTab detail={detail} onEdit={openEditor} onRun={requestRun} running={running || executing} />
          ) : null}
          {tab === "quality" ? (
            <QualityTab
              detail={detail}
              qualityStale={qualityStale}
              onRevalidate={runQuality}
              revalidating={revalidate.isPending}
              onOpenApproval={() => selectTab("approval")}
            />
          ) : null}
          {tab === "approval" ? (
            <ApprovalTab
              detail={detail}
              qualityStale={qualityStale}
              onOpenQuality={() => selectTab("quality")}
            />
          ) : null}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest/[0.055] text-forest">
              <RefreshCw className={cn("h-3.5 w-3.5", revalidate.isPending && "animate-spin")} aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold text-forest">Re-run the quality review only</p>
              <p className="text-[10px] text-muted">
                Useful after an edit. It re-checks the saved package without regenerating artifacts.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={runQuality} loading={revalidate.isPending}>
            Re-run quality
          </Button>
        </div>
      </Card>

      {editing ? (
        <ArtifactEditorModal
          campaignId={campaignId}
          type={editing}
          content={artifacts[editing]?.content}
          open
          onClose={() => setEditing(null)}
        />
      ) : null}

      <Modal
        open={confirmRunOpen}
        onClose={() => setConfirmRunOpen(false)}
        title="Start a new campaign version?"
        description={`A new run creates version ${currentVersion + 1} and regenerates the package from the current brief.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRunOpen(false)} disabled={startRun.isPending}>
              Cancel
            </Button>
            <Button onClick={doRun} loading={startRun.isPending}>
              <Play className="h-3.5 w-3.5" aria-hidden />
              Start version {currentVersion + 1}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Callout tone="warning" icon={<CircleAlert className="h-4 w-4" aria-hidden />} title="Existing artifacts are kept">
            Artifacts from version {currentVersion} remain in the history, but the current package is replaced. Any
            active approval is invalidated as soon as the new version starts.
          </Callout>
          <ul className="space-y-1 text-[11px] leading-5 text-muted">
            <li>Approval on version {currentVersion}: {activeApproval ? "will be invalidated" : "none active"}</li>
            <li>Quality review: regenerated at the end of the run</li>
            <li>Execution: still a separate action after approval</li>
          </ul>
        </div>
      </Modal>

      <Modal
        open={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        title="Stop this agent run?"
        description="Tulivu stops after the current stage. Completed artifacts are kept."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmCancelOpen(false)} disabled={cancelRun.isPending}>
              Keep running
            </Button>
            <Button variant="danger" onClick={doCancel} loading={cancelRun.isPending}>
              <Square className="h-3.5 w-3.5" aria-hidden />
              Stop run
            </Button>
          </>
        }
      >
        <p className="text-[11px] leading-5 text-muted">
          The run will be marked cancelled. You can start a new run later; nothing is published and no approval is
          created.
        </p>
      </Modal>

      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export this campaign"
        description="Download the current package for review or handover. Exports never include secrets."
        size="sm"
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void doExport("markdown")}
            disabled={exporting !== null}
            className="flex w-full items-center gap-3 rounded-xl border border-line bg-[#fffdf8] p-4 text-left transition hover:border-forest/30 disabled:opacity-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/[0.06] text-forest">
              <FileText className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-ink">Markdown brief</span>
              <span className="mt-0.5 block text-[10px] leading-4 text-muted">
                A readable handover with artifacts, quality findings and approval state.
              </span>
            </span>
            {exporting === "markdown" ? <RefreshCw className="h-4 w-4 animate-spin text-muted" aria-hidden /> : null}
          </button>
          <button
            type="button"
            onClick={() => void doExport("json")}
            disabled={exporting !== null}
            className="flex w-full items-center gap-3 rounded-xl border border-line bg-[#fffdf8] p-4 text-left transition hover:border-forest/30 disabled:opacity-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/[0.06] text-forest">
              <FileJson className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-ink">JSON package</span>
              <span className="mt-0.5 block text-[10px] leading-4 text-muted">
                Structured data for tooling, archives or another review.
              </span>
            </span>
            {exporting === "json" ? <RefreshCw className="h-4 w-4 animate-spin text-muted" aria-hidden /> : null}
          </button>
          <div className="flex items-center gap-2 text-[10px] text-muted">
            <Badge tone="neutral">Version {currentVersion}</Badge>
            <Badge tone="gold">Demo workspace</Badge>
          </div>
        </div>
      </Modal>

      <p className="px-1 text-[9px] leading-4 text-muted">
        {CAMPAIGN_STATUSES.find((item) => item.id === detail.campaign.status)?.description ??
          "Campaign status is managed by the workflow and approval gate."}
      </p>
    </div>
  );
}
