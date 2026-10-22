import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  CircleAlert,
  Clock,
  Fingerprint,
  FlaskConical,
  LockKeyhole,
  Play,
  Rocket,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  channelLabel,
  formatDate,
  formatMoney,
  titleCase,
  type CampaignDetail,
  type CampaignDraft,
  type QualityReport,
} from "@tulivu/shared";
import { artifactContent } from "./artifact-panel";
import { apiErrorMessage } from "@/lib/api";
import { useApprove, useExecute } from "@/lib/queries";
import { useToast } from "@/components/toast";
import {
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  Field,
  Modal,
  SectionLabel,
  StatusBadge,
  Textarea,
  VerdictBadge,
} from "@/components/ui";
import { cn } from "@tulivu/shared";

function operationTone(status: string) {
  if (status === "succeeded") return "success" as const;
  if (status === "failed") return "danger" as const;
  return "warning" as const;
}

export function ApprovalTab({
  detail,
  qualityStale,
  onOpenQuality,
}: {
  detail: CampaignDetail;
  qualityStale: boolean;
  onOpenQuality: () => void;
}) {
  const campaignId = detail.campaign.id;
  const currentVersion = detail.campaign.currentVersion;
  const quality = artifactContent<QualityReport>(detail, "quality");
  const draft = artifactContent<CampaignDraft>(detail, "draft");
  const approve = useApprove(campaignId);
  const execute = useExecute(campaignId);
  const { push } = useToast();
  const [acknowledged, setAcknowledged] = useState(false);
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const activeApproval = detail.approvals.find(
    (approval) => approval.status === "active" && approval.campaignVersion === currentVersion,
  );
  const published = detail.campaign.status === "published_demo";
  const busy = detail.campaign.status === "running" || detail.campaign.status === "executing";
  const warnings = quality?.checks.filter((check) => check.status === "warn") ?? [];
  const failures = quality?.checks.filter((check) => check.status === "fail") ?? [];

  const blockers = useMemo(() => {
    const list: string[] = [];
    if (!quality) list.push("No quality review exists for this campaign yet.");
    if (quality && qualityStale) list.push("Artifacts changed after the quality review. Re-run it.");
    if (quality && quality.campaignVersion !== currentVersion) {
      list.push(`The review covers version ${quality.campaignVersion}; the campaign is version ${currentVersion}.`);
    }
    if (quality?.verdict === "fail") list.push("The quality review found blocking failures.");
    if (busy) list.push("Wait for the active agent run to finish.");
    return list;
  }, [quality, qualityStale, currentVersion, busy]);

  const canApprove = blockers.length === 0 && !activeApproval && !published;

  async function onApprove() {
    try {
      await approve.mutateAsync({
        campaignVersion: currentVersion,
        acknowledgeWarnings: acknowledged,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      push({
        title: `Version ${currentVersion} approved`,
        description: "The exact package is approved. Demo execution is a separate action.",
        tone: "success",
      });
      setNote("");
    } catch (error) {
      push({ title: "Approval was not recorded", description: apiErrorMessage(error), tone: "error" });
    }
  }

  async function onExecute() {
    try {
      const result = await execute.mutateAsync(currentVersion);
      setConfirmOpen(false);
      if (result.execution.status === "already_executed") {
        push({
          title: "Already executed",
          description: result.execution.message,
          tone: "info",
        });
      } else if (result.execution.status === "partial_failure") {
        push({
          title: "Some demo channels failed",
          description: "Successful channels were kept. Re-running will not duplicate them.",
          tone: "error",
        });
      } else {
        push({
          title: "Simulated launch complete",
          description: "Paused demo resources were created. No real ad account was contacted.",
          tone: "success",
        });
      }
    } catch (error) {
      push({ title: "Demo execution failed", description: apiErrorMessage(error), tone: "error" });
    }
  }

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="tulivu-grain bg-forest px-5 py-5 text-ivory sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-gold">Human approval gate</p>
              <h2 className="mt-1.5 text-2xl leading-tight text-ivory">
                {published ? "This version is complete." : activeApproval ? "Approved. Execution is yours to start." : "The agent stops here."}
              </h2>
              <p className="mt-2 text-[11px] leading-5 text-ivory/60">
                Tulivu never approves its own work. Approval binds to campaign version {currentVersion}, the exact
                artifacts, the business profile and the budget. Any change voids it.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="gold" className="border-gold/30 bg-gold/15 text-gold">
                Version {currentVersion}
              </Badge>
              <StatusBadge status={detail.campaign.status} />
            </div>
          </div>

          <ol className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-ivory/10 pt-4">
            {[
              { label: "Review the package", done: Boolean(quality) && !qualityStale },
              { label: "Approve this version", done: Boolean(activeApproval) || published },
              { label: "Create demo resources", done: published },
            ].map((step, index) => (
              <li key={step.label} className="flex items-center gap-2 text-[10px] font-semibold">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border text-[9px]",
                    step.done ? "border-gold bg-gold text-forest" : "border-ivory/25 text-ivory/50",
                  )}
                >
                  {step.done ? <BadgeCheck className="h-3 w-3" aria-hidden /> : index + 1}
                </span>
                <span className={step.done ? "text-ivory/85" : "text-ivory/45"}>{step.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <div>
              <SectionLabel>Quality review</SectionLabel>
              <p className="mt-1 text-[11px] text-muted">What the independent review found.</p>
            </div>
            {quality ? <VerdictBadge verdict={quality.verdict} /> : <Badge tone="neutral">Not run</Badge>}
          </div>

          <div className="p-5">
            {!quality ? (
              <div className="rounded-xl border border-line bg-paper/60 px-4 py-5 text-center">
                <p className="text-xs font-semibold text-forest">A review is required before approval</p>
                <p className="mx-auto mt-1 max-w-sm text-[11px] leading-5 text-muted">
                  Run the workflow, then run the quality review. Its verdict determines whether this version can be
                  approved.
                </p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={onOpenQuality}>
                  Go to quality
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line bg-paper">
                    <span className="font-display text-xl text-forest">{quality.score}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-forest">
                      {quality.verdict === "pass"
                        ? "No blocking issues or warnings."
                        : quality.verdict === "warn"
                          ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"} need acknowledgement.`
                          : `${failures.length} blocking failure${failures.length === 1 ? "" : "s"} must be fixed.`}
                    </p>
                    <p className="mt-1 text-[10px] text-muted">
                      Reviewed {formatDate(quality.reviewedAt, "datetime")} · version {quality.campaignVersion}
                    </p>
                  </div>
                </div>

                {warnings.length > 0 ? (
                  <ul className="space-y-1.5 rounded-xl border border-gold-deep/25 bg-gold/[0.07] p-3.5">
                    {warnings.slice(0, 5).map((check) => (
                      <li key={check.id} className="flex gap-2 text-[10px] leading-4 text-[#6d5620]">
                        <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                        <span>
                          <span className="font-semibold">{check.label}: </span>
                          {check.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {failures.length > 0 ? (
                  <ul className="space-y-1.5 rounded-xl border border-clay/25 bg-[#fbf1ec] p-3.5">
                    {failures.map((check) => (
                      <li key={check.id} className="flex gap-2 text-[10px] leading-4 text-[#743d2b]">
                        <Ban className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                        <span>
                          <span className="font-semibold">{check.label}: </span>
                          {check.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={onOpenQuality}>
                    Read the full review
                    <ArrowRight className="h-3 w-3" aria-hidden />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <SectionLabel>Decision</SectionLabel>
            <p className="mt-1 text-[11px] text-muted">
              {published
                ? "This version already has simulated resources."
                : activeApproval
                  ? "The exact version is approved."
                  : "Approve one exact version, or keep refining the work."}
            </p>
          </div>

          <div className="space-y-4 p-5">
            {published ? (
              <Callout tone="success" icon={<Rocket className="h-4 w-4" aria-hidden />} title="Simulated launch complete">
                Paused demo resources exist for version {currentVersion}. No real Meta or Google account was contacted.
                Update the brief to start a new version.
              </Callout>
            ) : activeApproval ? (
              <>
                <Callout tone="success" icon={<ShieldCheck className="h-4 w-4" aria-hidden />} title="Approved">
                  Approved {formatDate(activeApproval.approvedAt, "datetime")} for version{" "}
                  {activeApproval.campaignVersion}. Demo execution will use this exact package.
                </Callout>
                <div className="rounded-xl border border-line bg-paper/60 p-3.5">
                  <div className="flex items-center gap-2 text-forest">
                    <Fingerprint className="h-3.5 w-3.5" aria-hidden />
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em]">Bound operation</p>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-4 text-muted">
                    The operation hash covers the brief, artifacts, business profile and budget. It is recomputed
                    immediately before execution.
                  </p>
                </div>
                <Button className="w-full" onClick={() => setConfirmOpen(true)} loading={execute.isPending}>
                  <Play className="h-3.5 w-3.5" aria-hidden />
                  Create paused demo resources
                </Button>
                <p className="text-center text-[9px] leading-4 text-muted">
                  Demo adapter only. No credentials, spend or live ads.
                </p>
              </>
            ) : (
              <>
                {blockers.length > 0 ? (
                  <Callout tone="warning" icon={<TriangleAlert className="h-4 w-4" aria-hidden />} title="Approval is blocked">
                    <ul className="mt-1 space-y-1">
                      {blockers.map((blocker) => (
                        <li key={blocker} className="flex gap-1.5">
                          <span aria-hidden>·</span>
                          {blocker}
                        </li>
                      ))}
                    </ul>
                  </Callout>
                ) : null}

                {quality?.verdict === "warn" ? (
                  <Checkbox
                    checked={acknowledged}
                    onChange={setAcknowledged}
                    label="I acknowledge the warnings"
                    description="Approval is not allowed until each warning has been read and accepted for this exact version."
                  />
                ) : null}

                <Field label="Approval note" htmlFor="approval-note" optional hint="Stored in the audit trail with the approved version.">
                  <Textarea
                    id="approval-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    placeholder="For example: approved for a two-week test at the stated budget."
                  />
                </Field>

                <Button
                  className="w-full"
                  onClick={onApprove}
                  loading={approve.isPending}
                  disabled={
                    !canApprove ||
                    (quality?.verdict === "warn" && !acknowledged)
                  }
                >
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  Approve version {currentVersion}
                </Button>
                <p className="text-center text-[9px] leading-4 text-muted">
                  Approval does not publish anything. Execution is a separate step.
                </p>
              </>
            )}
          </div>
        </Card>
      </div>

      {detail.operations.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/[0.18] text-[#6e5b2b]">
                <FlaskConical className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div>
                <SectionLabel>Demo operations</SectionLabel>
                <p className="mt-0.5 text-[10px] text-muted">Simulated provider records, kept for idempotency.</p>
              </div>
            </div>
            <Badge tone="gold">Demo only</Badge>
          </div>
          <ul className="divide-y divide-line/80">
            {detail.operations.map((operation) => {
              const summary = (operation.responseSummary ?? {}) as Record<string, unknown>;
              const warnings = Array.isArray(summary.warnings) ? (summary.warnings as string[]) : [];
              return (
                <li key={operation.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-semibold text-forest">{channelLabel(operation.provider)}</p>
                      <Badge tone={operationTone(operation.status)}>{operation.status}</Badge>
                      <Badge tone="neutral">{titleCase(operation.operationType)}</Badge>
                    </div>
                    <p className="mt-1 break-all text-[10px] text-muted">
                      {operation.providerResourceId ?? "No resource id"}
                      {summary.status ? ` · ${String(summary.status)}` : ""}
                      {summary.simulated ? " · simulated" : ""}
                    </p>
                    {warnings.length > 0 ? (
                      <ul className="mt-1 space-y-0.5">
                        {warnings.map((warning, index) => (
                          <li key={`${warning}-${index}`} className="text-[10px] leading-4 text-[#6d5620]">
                            {warning}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-[10px] text-muted">
                    <Clock className="h-3 w-3" aria-hidden />
                    {formatDate(operation.createdAt, "datetime")}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <SectionLabel>Approval history</SectionLabel>
          <p className="mt-1 text-[11px] text-muted">
            Invalidated approvals stay in the record. Only the active approval on the current version can execute.
          </p>
        </div>
        {detail.approvals.length === 0 ? (
          <p className="px-5 py-6 text-[11px] text-muted">No approval has been recorded for this campaign.</p>
        ) : (
          <ul className="divide-y divide-line/80">
            {detail.approvals.map((approval) => (
              <li key={approval.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={approval.status === "active" ? "success" : "neutral"} dot>
                    {approval.status === "active" ? "Active" : titleCase(approval.status)}
                  </Badge>
                  <p className="text-[11px] font-semibold text-ink">Version {approval.campaignVersion}</p>
                  <span className="text-[10px] text-muted">
                    {approval.status === "active" && approval.campaignVersion !== currentVersion
                      ? "· covers an earlier version"
                      : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted">
                  {approval.operationType === "publish_demo" ? <LockKeyhole className="h-3 w-3" aria-hidden /> : null}
                  {formatDate(approval.approvedAt, "datetime")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest/[0.06] text-forest">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold text-forest">This demo never publishes live ads</p>
            <p className="text-[10px] leading-4 text-muted">
              Execution creates paused records in a demo adapter. No Meta or Google account, spend or audience is
              touched. Live publishing requires separate accounts, permissions and review.
            </p>
          </div>
        </div>
        {draft ? (
          <Badge tone="neutral">
            Estimated spend {formatMoney(draft.estimatedSpend.amount, draft.estimatedSpend.currency)}
          </Badge>
        ) : null}
      </Card>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Create paused demo resources?"
        description="This runs the demo ad adapter for the approved version. Nothing is sent to Meta or Google."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={execute.isPending}>
              Cancel
            </Button>
            <Button onClick={onExecute} loading={execute.isPending}>
              <Play className="h-3.5 w-3.5" aria-hidden />
              Create demo resources
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Callout tone="info" icon={<FlaskConical className="h-4 w-4" aria-hidden />}>
            The demo adapter returns deterministic, paused records. They are idempotent per campaign version and
            channel, so a retry will not create duplicates.
          </Callout>
          <ul className="space-y-1.5 text-[11px] leading-5 text-muted">
            <li>Campaign version: {currentVersion}</li>
            <li>Channels: {detail.campaign.channels.map(channelLabel).join(", ")}</li>
            <li>Approval: {activeApproval ? "Active" : "Missing"}</li>
            <li>Live credentials required: none, because nothing leaves this demo.</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
}
