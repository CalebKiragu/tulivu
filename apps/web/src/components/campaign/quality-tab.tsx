import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Info,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  formatDate,
  type ArtifactType,
  type CampaignDetail,
  type QualityReport,
} from "@tulivu/shared";
import { ArtifactMissing, ArtifactPanel, BulletList, artifactContent } from "./artifact-panel";
import { Badge, Button, Callout, Card, EmptyState, Progress, SectionLabel, VerdictBadge } from "@/components/ui";
import { cn } from "@tulivu/shared";

function CheckIcon({ status }: { status: "pass" | "warn" | "fail" }) {
  if (status === "pass") return <CircleCheck className="h-4 w-4 text-leaf" aria-hidden />;
  if (status === "warn") return <CircleAlert className="h-4 w-4 text-gold-deep" aria-hidden />;
  return <CircleX className="h-4 w-4 text-clay" aria-hidden />;
}

function statusTone(status: "pass" | "warn" | "fail") {
  if (status === "pass") return "success" as const;
  if (status === "warn") return "warning" as const;
  return "danger" as const;
}

export function QualityTab({
  detail,
  qualityStale,
  onRevalidate,
  revalidating,
  onOpenApproval,
}: {
  detail: CampaignDetail;
  qualityStale: boolean;
  onRevalidate: () => void;
  revalidating: boolean;
  onOpenApproval: () => void;
}) {
  const quality = artifactContent<QualityReport>(detail, "quality");
  const currentVersion = detail.campaign.currentVersion;
  const versionMismatch = Boolean(quality && quality.campaignVersion !== currentVersion);
  const hasOtherArtifacts = Object.keys(detail.artifacts).some((type) => type !== "quality");

  if (!quality) {
    if (!hasOtherArtifacts) {
      return (
        <ArtifactMissing
          type="quality"
          description="The independent review runs after all artifacts exist. It checks platform limits, unsupported claims, missing fields and destination readiness before a person can approve."
        />
      );
    }
    return (
      <Card>
        <EmptyState
          icon={<Scale className="h-5 w-5" aria-hidden />}
          title="No quality review yet"
          description="The package is ready for an independent review. This check reads the exact saved artifacts and can pass, warn or block approval."
          action={
            <Button onClick={onRevalidate} loading={revalidating}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Run quality review
            </Button>
          }
        />
      </Card>
    );
  }

  const failing = quality.checks.filter((check) => check.status === "fail");
  const warnings = quality.checks.filter((check) => check.status === "warn");
  const deterministic = quality.checks.filter((check) => check.source === "deterministic");
  const modelChecks = quality.checks.filter((check) => check.source === "model");

  return (
    <div className="space-y-5">
      {qualityStale || versionMismatch ? (
        <Callout tone="warning" icon={<CircleAlert className="h-4 w-4" aria-hidden />} title="This review no longer covers the campaign">
          {versionMismatch
            ? `The review covers version ${quality.campaignVersion}, but the campaign is now version ${currentVersion}.`
            : "An artifact changed after this review was saved."}{" "}
          Re-run the review before approving this version.
        </Callout>
      ) : null}

      <ArtifactPanel
        detail={detail}
        type="quality"
        description={`Independent review of campaign version ${quality.campaignVersion}`}
        onEdit={(_type: ArtifactType) => undefined}
        actions={
          <Button variant="secondary" size="sm" onClick={onRevalidate} loading={revalidating}>
            <RefreshCw className="h-3 w-3" aria-hidden />
            Re-run review
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex items-center gap-4">
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
                  <circle cx="50" cy="50" r="44" fill="none" stroke="var(--color-line)" strokeWidth="7" />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke={quality.verdict === "fail" ? "var(--color-clay)" : quality.verdict === "warn" ? "var(--color-gold-deep)" : "var(--color-leaf)"}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={`${(quality.score / 100) * 276.46} 276.46`}
                  />
                </svg>
                <div className="relative text-center">
                  <p className="font-display text-2xl leading-none text-forest">{quality.score}</p>
                  <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-muted">/ 100</p>
                </div>
              </div>
              <div>
                <VerdictBadge verdict={quality.verdict} />
                <p className="mt-2 text-[10px] leading-4 text-muted">
                  Reviewed {formatDate(quality.reviewedAt, "datetime")}
                  <br />
                  {quality.checks.length} checks · {warnings.length} warnings · {failing.length} blocking
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-paper/50 px-4 py-3.5">
              <SectionLabel>Verdict</SectionLabel>
              <p className="mt-1.5 text-xs leading-5 text-ink">
                {quality.verdict === "pass"
                  ? "All checks passed. A person can still edit the work before approving it."
                  : quality.verdict === "warn"
                    ? "The package can be approved only after the warnings are explicitly acknowledged."
                    : "Blocking failures must be fixed and reviewed again. Approval is unavailable for this version."}
              </p>
              <div className="mt-3">
                <Progress value={quality.score} />
              </div>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionLabel>Deterministic checks</SectionLabel>
              <Badge tone="neutral">
                {deterministic.filter((check) => check.status === "pass").length}/{deterministic.length} passed
              </Badge>
            </div>
            <ul className="mt-2 divide-y divide-line/80 rounded-xl border border-line bg-[#fffdf8]">
              {deterministic.map((check) => (
                <li key={check.id} className="flex gap-3 px-4 py-3">
                  <span className="mt-0.5 shrink-0">
                    <CheckIcon status={check.status} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-semibold text-ink">{check.label}</p>
                      <Badge tone={statusTone(check.status)} className="px-1.5 py-0.5 text-[8px]">
                        {check.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[10px] leading-4 text-muted">{check.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {modelChecks.length > 0 ? (
            <div>
              <SectionLabel>Model critique</SectionLabel>
              <ul className="mt-2 divide-y divide-line/80 rounded-xl border border-line bg-[#fffdf8]">
                {modelChecks.map((check) => (
                  <li key={check.id} className="flex gap-3 px-4 py-3">
                    <span className="mt-0.5 shrink-0">
                      <CheckIcon status={check.status} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[11px] font-semibold text-ink">{check.label}</p>
                        <Badge tone="gold" className="px-1.5 py-0.5 text-[8px]">
                          model
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[10px] leading-4 text-muted">{check.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : quality.modelCritiqueSkippedReason ? (
            <Callout tone="info" icon={<Info className="h-4 w-4" aria-hidden />} title="Model critique was skipped">
              {quality.modelCritiqueSkippedReason} The deterministic checks above are still authoritative for this
              verdict.
            </Callout>
          ) : null}

          {quality.modelCritique ? (
            <div className="rounded-xl border border-gold-deep/25 bg-gold/[0.08] p-4">
              <div className="flex items-center gap-2 text-forest">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                <p className="text-[10px] font-bold uppercase tracking-[0.12em]">Editorial critique</p>
              </div>
              <p className="mt-2 whitespace-pre-line text-[11px] leading-5 text-ink">{quality.modelCritique}</p>
            </div>
          ) : null}

          {quality.suggestions.length > 0 ? (
            <div>
              <SectionLabel>Suggested improvements</SectionLabel>
              <div className="mt-2">
                <BulletList items={quality.suggestions} tone="warning" />
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-[10px] font-medium text-leaf">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              No further suggestions were recorded.
            </p>
          )}
        </div>
      </ArtifactPanel>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2.5">
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", quality.verdict === "fail" ? "bg-[#f9ece6] text-clay" : "bg-forest/[0.06] text-forest")}>
            <Scale className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold text-forest">Ready for the human gate?</p>
            <p className="text-[10px] text-muted">
              Approval and simulated execution are separate, explicit actions on the exact reviewed version.
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onOpenApproval}>
          Open approval
        </Button>
      </Card>
    </div>
  );
}
