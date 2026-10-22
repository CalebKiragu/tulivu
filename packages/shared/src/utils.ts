import { CAMPAIGN_STATUSES, CHANNELS, CURRENCIES, WORKFLOW_STAGES } from "./constants.js";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function formatMoney(amount: number, currency: string, options?: { compact?: boolean }): string {
  const meta = CURRENCIES.find((item) => item.code === currency);
  try {
    return new Intl.NumberFormat(meta?.locale ?? "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
      notation: options?.compact ? "compact" : "standard",
    }).format(amount);
  } catch {
    return `${meta?.symbol ?? currency} ${amount.toLocaleString()}`;
  }
}

export function formatDate(value: string | null | undefined, style: "short" | "long" | "datetime" = "short"): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  if (style === "datetime") {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: "numeric",
  }).format(date);
}

export function dateInputValue(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function channelLabel(channel: string): string {
  return CHANNELS.find((item) => item.id === channel)?.short ?? channel;
}

export function statusMeta(status: string) {
  return CAMPAIGN_STATUSES.find((item) => item.id === status) ?? CAMPAIGN_STATUSES[0];
}

export function stageLabel(stage: string): string {
  return WORKFLOW_STAGES.find((item) => item.name === stage)?.label ?? stage;
}

export function stageShortLabel(stage: string): string {
  return WORKFLOW_STAGES.find((item) => item.name === stage)?.short ?? stage;
}

export function titleCase(value: string): string {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function truncate(value: string, length: number): string {
  if (value.length <= length) return value;
  return `${value.slice(0, Math.max(0, length - 1)).trimEnd()}…`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Deterministic JSON stringify: object keys are sorted at every level. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`).join(",")}}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
