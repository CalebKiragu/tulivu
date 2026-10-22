import {
  ArrowUpRight,
  Check,
  CircleAlert,
  Clock,
  Globe2,
  Link2,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  formatDate,
  type ArtifactType,
  type CampaignDetail,
  type ConversionReadinessReport,
} from "@tulivu/shared";
import { ArtifactMissing, ArtifactPanel, BulletList, ChipList, InfoGrid, artifactContent } from "./artifact-panel";
import { Badge, Callout, Card, CopyButton, SectionLabel } from "@/components/ui";

function StatusIcon({ ok }: { ok: boolean | null }) {
  if (ok === true) return <Check className="h-3.5 w-3.5 text-leaf" aria-hidden />;
  if (ok === false) return <X className="h-3.5 w-3.5 text-clay" aria-hidden />;
  return <Clock className="h-3.5 w-3.5 text-muted" aria-hidden />;
}

export function LandingTab({
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
  const report = artifactContent<ConversionReadinessReport>(detail, "conversion");

  if (!report) {
    return (
      <ArtifactMissing
        type="conversion"
        onRun={onRun}
        running={running}
        description="The conversion stage checks the destination, records tracking readiness and separates URL syntax from reachability."
      />
    );
  }

  const reachableLabel =
    report.reachable === true ? "Reachable" : report.reachable === false ? "Not reachable" : "Not checked";

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="tulivu-grain bg-forest px-5 py-5 text-ivory sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-gold">Landing page readiness</p>
              <h2 className="mt-1.5 break-all text-lg leading-snug text-ivory">
                {report.destinationUrl || "No destination supplied"}
              </h2>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-ivory/55">
                <Clock className="h-3 w-3" aria-hidden />
                Checked {formatDate(report.checkedAt, "datetime")}
                {report.httpStatus ? ` · HTTP ${report.httpStatus}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={report.syntaxValid ? "success" : "danger"} className="border-ivory/15 bg-ivory/10">
                Syntax {report.syntaxValid ? "valid" : "invalid"}
              </Badge>
              <Badge
                tone={report.reachable === true ? "success" : report.reachable === false ? "danger" : "neutral"}
                className="border-ivory/15 bg-ivory/10"
              >
                {reachableLabel}
              </Badge>
            </div>
          </div>
          {report.destinationUrl && report.syntaxValid ? (
            <a
              href={report.destinationUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-3 py-1.5 text-[10px] font-semibold text-gold transition hover:bg-gold/20"
            >
              Open destination
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "URL syntax",
              value: report.syntaxValid ? "Valid" : "Invalid",
              icon: <Link2 className="h-3.5 w-3.5" aria-hidden />,
              tone: report.syntaxValid ? "text-leaf" : "text-clay",
            },
            {
              label: "Reachability",
              value: reachableLabel,
              icon: <Globe2 className="h-3.5 w-3.5" aria-hidden />,
              tone: report.reachable === true ? "text-leaf" : report.reachable === false ? "text-clay" : "text-muted",
            },
            {
              label: "Tracking",
              value: report.measurement.configured ? "Configured" : "Not configured",
              icon: <ShieldCheck className="h-3.5 w-3.5" aria-hidden />,
              tone: report.measurement.configured ? "text-leaf" : "text-[#8b6f2a]",
            },
            {
              label: "UTM parameters",
              value: String(report.utm.length),
              icon: <Link2 className="h-3.5 w-3.5" aria-hidden />,
              tone: "text-forest",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-line bg-paper/50 px-3.5 py-3">
              <div className="flex items-center gap-1.5 text-muted">
                {item.icon}
                <p className="text-[9px] font-bold uppercase tracking-[0.1em]">{item.label}</p>
              </div>
              <p className={`mt-1.5 text-sm font-semibold ${item.tone}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <ArtifactPanel detail={detail} type="conversion" title="Conversion readiness" description="Destination, tracking and issues" onEdit={onEdit}>
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <CircleAlert className="h-3.5 w-3.5 text-gold-deep" aria-hidden />
                <SectionLabel>Check note</SectionLabel>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-ink">{report.checkNote}</p>
            </div>

            <div>
              <SectionLabel>Issues found</SectionLabel>
              {report.issues.length === 0 ? (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-leaf">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  No issues were recorded in this review.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {report.issues.map((issue, index) => (
                    <li key={`${issue.message}-${index}`} className="flex gap-2">
                      {issue.severity === "error" ? (
                        <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-clay" aria-hidden />
                      ) : issue.severity === "warning" ? (
                        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a5812e]" aria-hidden />
                      ) : (
                        <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                      )}
                      <span className="text-[11px] leading-5 text-ink">
                        <span className="mr-1.5 text-[9px] font-bold uppercase tracking-wide text-muted">{issue.severity}</span>
                        {issue.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <SectionLabel>Recommendations</SectionLabel>
              <div className="mt-2"><BulletList items={report.recommendations} /></div>
            </div>
          </div>

          <div className="space-y-4">
            <div className={`rounded-xl border p-4 ${report.measurement.configured ? "border-leaf/20 bg-[#f3f8f1]" : "border-[#d8bd7e]/45 bg-[#fbf5e5]"}`}>
              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${report.measurement.configured ? "bg-forest text-gold" : "bg-[#8b6f2a] text-ivory"}`}>
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                </span>
                <div>
                  <p className="text-[11px] font-semibold text-forest">
                    {report.measurement.configured ? "Measurement is configured" : "Measurement is not configured"}
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-muted">{report.measurement.note}</p>
                  <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">
                    {report.measurement.required ? "Required for this objective" : "Optional for this objective"}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <SectionLabel>UTM parameters</SectionLabel>
                {report.utm.length > 0 ? <CopyButton value={report.utm.join("\n")} label="Copy all" /> : null}
              </div>
              {report.utm.length === 0 ? (
                <p className="mt-2 text-[11px] text-muted">No UTM parameters were generated.</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {report.utm.map((parameter) => (
                    <div key={parameter} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-[#fffdf8] px-2.5 py-1.5">
                      <code className="truncate font-mono text-[10px] text-ink">{parameter}</code>
                      <CopyButton value={parameter} label="" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <InfoGrid
              columns={2}
              items={[
                { label: "Checked at", value: formatDate(report.checkedAt, "datetime") },
                { label: "HTTP status", value: report.httpStatus ? String(report.httpStatus) : "No response" },
                { label: "Syntax valid", value: report.syntaxValid ? "Yes" : "No" },
                { label: "Reachable", value: reachableLabel },
              ]}
            />

            {!report.syntaxValid ? (
              <Callout tone="danger" title="The destination cannot be used">
                Fix the destination URL in the campaign brief, then re-run the conversion stage. Tulivu will not invent a
                working link.
              </Callout>
            ) : null}
            {report.syntaxValid && report.reachable === null ? (
              <Callout tone="warning" title="Reachability was not confirmed">
                The URL is syntactically valid, but this environment could not resolve it. That is a warning, not a
                fabricated success.
              </Callout>
            ) : null}
          </div>
        </div>
      </ArtifactPanel>

      <Card quiet className="p-4">
        <div className="flex items-start gap-2.5">
          <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
          <p className="text-[10px] leading-5 text-muted">
            URL checks run separately from copy generation. A valid-but-unresolvable destination is recorded as a warning,
            while malformed URLs are blocking errors. No external page is fetched into the model context.
          </p>
        </div>
      </Card>
    </div>
  );
}
