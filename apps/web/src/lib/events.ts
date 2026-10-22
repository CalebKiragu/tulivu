import { titleCase } from "@tulivu/shared";
import type { AuditItem } from "@tulivu/shared";

export type EventTone = "neutral" | "forest" | "gold" | "success" | "warning" | "danger" | "active";

export interface EventMeta {
  title: string;
  detail?: string;
  tone: EventTone;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function metadataNumber(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "number" || typeof value === "string" ? String(value) : null;
}

export function describeAudit(item: AuditItem): EventMeta {
  const metadata = item.metadata ?? {};
  const note = typeof metadata.note === "string" ? metadata.note : undefined;
  const version = metadataNumber(metadata, "campaignVersion");

  if (item.eventType.startsWith("artifact.") && item.eventType.endsWith(".edited")) {
    const type = item.eventType.split(".")[1] ?? "artifact";
    return {
      title: `${titleCase(type)} artifact edited`,
      detail: version ? `Campaign version ${version} created` : "A new artifact version was saved",
      tone: "warning",
    };
  }
  if (item.eventType.startsWith("tool.")) {
    return {
      title: `Tool ran: ${item.eventType.slice(5).replace(/[._]/g, " ")}`,
      detail: note ?? "Recorded in the tool audit trail",
      tone: "neutral",
    };
  }

  const map: Record<string, EventMeta> = {
    "workspace.seeded": {
      title: "Demo workspace seeded",
      detail: note ?? "Sample business and campaign created",
      tone: "gold",
    },
    "business.created": { title: "Business profile created", detail: note, tone: "success" },
    "business.updated": {
      title: "Business profile updated",
      detail: strings(metadata.fields).length ? `Fields: ${strings(metadata.fields).join(", ")}` : note,
      tone: "neutral",
    },
    "campaign.created": {
      title: "Campaign brief created",
      detail: strings(metadata.channels).length
        ? `${strings(metadata.channels).join(" + ")} · ${metadata.budgetCurrency ?? ""}`.trim()
        : note,
      tone: "success",
    },
    "campaign.brief_updated": {
      title: "Campaign brief updated",
      detail: version ? `Now version ${version}` : note,
      tone: "warning",
    },
    "run.started": { title: "Agent run started", detail: note ?? "Workflow is processing the brief", tone: "active" },
    "run.completed": {
      title: "Agent run completed",
      detail: note ?? "All stages finished; package ready for review",
      tone: "success",
    },
    "run.failed": { title: "Agent run failed", detail: note ?? "A stage needs attention", tone: "danger" },
    "run.cancelled": { title: "Agent run cancelled", detail: note ?? "Stopped by a person", tone: "neutral" },
    "run.cancelling": { title: "Cancelling run", detail: note ?? "Waiting for the current stage to stop", tone: "warning" },
    "run.resumed": { title: "Agent run resumed", detail: note ?? "Continuing from the failed stage", tone: "active" },
    "run.interrupted": {
      title: "Run interrupted",
      detail: note ?? "The server restarted while this run was active",
      tone: "warning",
    },
    "stage.retry": {
      title: `Retrying ${typeof metadata.stage === "string" ? titleCase(metadata.stage) : "stage"}`,
      detail: note,
      tone: "warning",
    },
    "campaign.approved": {
      title: "Campaign approved",
      detail: version ? `Version ${version} approved` : note,
      tone: "success",
    },
    "approval.invalidated": {
      title: "Approval invalidated",
      detail: typeof metadata.reason === "string" ? metadata.reason : note,
      tone: "warning",
    },
    "execution.started": {
      title: "Demo execution started",
      detail: note ?? "Creating simulated paused resources",
      tone: "active",
    },
    "execution.completed": {
      title: "Simulated launch complete",
      detail: note ?? "No real advertising resources were created",
      tone: "success",
    },
    "execution.channel.succeeded": {
      title: `Simulated ${metadata.channel ?? "channel"} resource created`,
      detail: typeof metadata.externalCampaignId === "string" ? metadata.externalCampaignId : note,
      tone: "success",
    },
    "execution.channel.failed": {
      title: `Simulated ${metadata.channel ?? "channel"} resource failed`,
      detail: note,
      tone: "danger",
    },
    "execution.partial_failure": {
      title: "Demo execution partially failed",
      detail: note ?? "Successful channels will not be duplicated on retry",
      tone: "danger",
    },
    "settings.updated": { title: "Workspace settings updated", detail: note, tone: "neutral" },
  };

  return map[item.eventType] ?? { title: titleCase(item.eventType), detail: note, tone: "neutral" };
}

export function relativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];
  for (const [unit, size] of ranges) {
    if (Math.abs(seconds) >= size || unit === "second") {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }
  return "just now";
}
