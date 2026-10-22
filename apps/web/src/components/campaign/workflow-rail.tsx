import { Check, Circle, Loader2, Radio, TriangleAlert, X } from "lucide-react";
import { WORKFLOW_STAGES, STAGE_STATE_LABELS, formatDate, type CampaignDetail } from "@tulivu/shared";
import { Badge, Card, Progress } from "@/components/ui";
import { cn } from "@tulivu/shared";

const stageToTab: Record<string, string> = {
  intake: "strategy",
  strategy: "strategy",
  audience: "audience",
  copy: "copy",
  creative: "creative",
  conversion: "landing",
  assembly: "configuration",
  quality: "quality",
};

const doneStates = new Set(["completed", "skipped"]);
const activeStates = new Set(["running"]);
const failedStates = new Set(["failed", "cancelled"]);

export function WorkflowRail({
  detail,
  connected,
  onSelectTab,
}: {
  detail: CampaignDetail;
  connected: boolean;
  onSelectTab: (tab: string) => void;
}) {
  const latestRun = detail.runs[0] ?? null;
  const runStages = latestRun ? detail.stages.filter((stage) => stage.runId === latestRun.id) : [];
  const byName = new Map<string, (typeof runStages)[number]>();
  for (const stage of runStages) {
    const current = byName.get(stage.stageName);
    if (!current || stage.attempt > current.attempt) byName.set(stage.stageName, stage);
  }
  const doneCount = WORKFLOW_STAGES.filter((stage) => doneStates.has(byName.get(stage.name)?.status ?? "")).length;
  const progress = latestRun ? (doneCount / WORKFLOW_STAGES.length) * 100 : (Object.keys(detail.artifacts).length / 8) * 100;
  const runError = latestRun?.errorSummary;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-gold">
            <Radio className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-forest">Agent workflow</p>
            <p className="mt-0.5 text-[10px] text-muted">
              {latestRun
                ? `Run started ${formatDate(latestRun.startedAt, "datetime")} · ${doneCount}/8 stages complete`
                : "Not started. Eight bounded stages produce this package."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {latestRun ? <Badge tone={latestRun.status === "completed" ? "success" : latestRun.status === "failed" ? "danger" : "active"} dot>{latestRun.status.replace(/_/g, " ")}</Badge> : null}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em]",
              connected ? "border-leaf/20 bg-sage/40 text-leaf" : "border-line bg-paper text-muted",
            )}
            title={connected ? "Live updates are connected" : "Live updates are reconnecting"}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "animate-pulse-dot bg-leaf" : "bg-muted/50")} aria-hidden />
            {connected ? "Live" : "Polling"}
          </span>
        </div>
      </div>

      <div className="tulivu-scroll overflow-x-auto px-3 py-4 sm:px-5">
        <div className="relative flex min-w-[760px] items-start justify-between gap-1">
          <div className="absolute left-[4%] right-[4%] top-[13px] h-px bg-line" aria-hidden />
          <div
            className="absolute left-[4%] top-[13px] h-px bg-leaf/60 transition-all duration-500"
            style={{ width: `calc(${Math.max(0, Math.min(100, progress))}% * 0.92)` }}
            aria-hidden
          />
          {WORKFLOW_STAGES.map((stage, index) => {
            const status = byName.get(stage.name)?.status ?? "pending";
            const done = doneStates.has(status);
            const active = activeStates.has(status);
            const failed = failedStates.has(status);
            return (
              <button
                key={stage.name}
                type="button"
                onClick={() => onSelectTab(stageToTab[stage.name] ?? "strategy")}
                className="group relative flex flex-1 flex-col items-center px-1 text-center"
                title={byName.get(stage.name)?.error?.message ?? `${stage.description} · ${STAGE_STATE_LABELS[status as keyof typeof STAGE_STATE_LABELS] ?? status}`}
              >
                <span
                  className={cn(
                    "relative z-10 flex h-[27px] w-[27px] items-center justify-center rounded-full border-2 bg-[#fffdf8] transition",
                    done && "border-leaf bg-leaf text-ivory",
                    active && "border-forest bg-forest text-gold",
                    failed && "border-clay bg-[#fbf1ec] text-clay",
                    !done && !active && !failed && "border-line text-muted/50 group-hover:border-forest/40 group-hover:text-forest",
                  )}
                >
                  {done ? (
                    <Check className="h-3 w-3" aria-hidden />
                  ) : active ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  ) : failed ? (
                    <X className="h-3 w-3" aria-hidden />
                  ) : (
                    <Circle className="h-2 w-2 fill-current" aria-hidden />
                  )}
                </span>
                <span className={cn("mt-2 text-[10px] font-semibold transition group-hover:text-forest", done || active ? "text-forest" : "text-muted") }>
                  {stage.short}
                </span>
                <span className="mt-0.5 text-[8px] font-medium uppercase tracking-wider text-muted/65">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </button>
            );
          })}
        </div>
        <Progress value={progress} className="mt-3.5 min-w-[300px]" />
      </div>

      {runError ? (
        <div className="flex items-start gap-2 border-t border-clay/20 bg-[#fbf1ec] px-4 py-2.5 text-[11px] text-[#743d2b] sm:px-5">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <p className="leading-5">
            <span className="font-semibold">The last run stopped: </span>
            {runError}
          </p>
        </div>
      ) : null}
      {latestRun?.status === "running" ? (
        <div className="flex items-center gap-2 border-t border-line bg-paper/60 px-4 py-2.5 text-[10px] font-medium text-muted sm:px-5">
          <Loader2 className="h-3 w-3 animate-spin text-forest" aria-hidden />
          Tulivu is working. This page updates as each stage saves its artifact.
        </div>
      ) : null}
    </Card>
  );
}
