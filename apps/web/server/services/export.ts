import { formatMoney, formatDate, channelLabel, statusMeta, type CampaignDetail } from "@tulivu/shared";
import type { Database } from "../db/client.js";
import { getCampaignDetail } from "./campaigns.js";

export interface ExportBundle {
  filename: string;
  json: string;
  markdown: string;
}

function section(title: string): string {
  return `## ${title}\n`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Produces a human-readable and machine-readable package. Every simulated
 * result is labelled. The export never claims that a real ad was published.
 */
export async function buildExportBundle(
  db: Database,
  campaignId: string,
  ownerId: string,
): Promise<ExportBundle | null> {
  const detail = await getCampaignDetail(db, campaignId, ownerId);
  if (!detail) return null;
  return bundleFromDetail(detail);
}

export function bundleFromDetail(detail: CampaignDetail): ExportBundle {
  const { campaign, business, artifacts, approvals, operations } = detail;
  const quality = asRecord(artifacts.quality?.content).verdict as string | undefined;
  const brief = asRecord(artifacts.brief?.content);
  const strategy = asRecord(artifacts.strategy?.content);
  const audience = asRecord(artifacts.audience?.content);
  const copy = asRecord(artifacts.copy?.content);
  const creative = asRecord(artifacts.creative?.content);
  const conversion = asRecord(artifacts.conversion?.content);
  const draft = asRecord(artifacts.draft?.content);

  const slug = campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const generatedAt = new Date().toISOString();

  const lines: string[] = [
    `# ${campaign.name}`,
    "",
    `**Business:** ${business.name}  `,
    `**Status:** ${statusMeta(campaign.status).label}  `,
    `**Package version:** ${campaign.currentVersion}  `,
    `**Budget:** ${formatMoney(campaign.budgetAmount, campaign.budgetCurrency)}  `,
    `**Schedule:** ${formatDate(campaign.startDate)} → ${formatDate(campaign.endDate)}  `,
    `**Channels:** ${campaign.channels.map(channelLabel).join(", ")}  `,
    `**Quality verdict:** ${quality ?? "not reviewed"}  `,
    `**Exported:** ${formatDate(generatedAt, "datetime")}`,
    "",
    "> This is a Tulivu demo package. No real advertising account was contacted and no live ads were published.",
    "",
  ];

  if (brief.product) {
    lines.push(section("Brief"));
    lines.push(`**Product:** ${String(brief.product)}`, "");
    lines.push(`**Audience:** ${String(brief.audience ?? campaign.brief.audience)}`, "");
    if (Array.isArray(brief.missingInformation) && brief.missingInformation.length) {
      lines.push(`**Missing information:** ${brief.missingInformation.join("; ")}`, "");
    }
    if (Array.isArray(brief.assumptions) && brief.assumptions.length) {
      lines.push(`**Assumptions:** ${brief.assumptions.join("; ")}`, "");
    }
  }

  if (strategy.valueProposition) {
    lines.push(section("Strategy"));
    lines.push(`**Value proposition:** ${String(strategy.valueProposition)}`, "");
    lines.push(`**Positioning:** ${String(strategy.positioning ?? "")}`, "");
    lines.push(`**Primary CTA:** ${String(strategy.cta ?? "")}`, "");
    if (Array.isArray(strategy.keyMessages)) {
      lines.push("**Key messages:**", ...strategy.keyMessages.map((item) => `- ${String(item)}`), "");
    }
    if (Array.isArray(strategy.groundedIn) && strategy.groundedIn.length) {
      lines.push(`**Grounded in:** ${strategy.groundedIn.join("; ")}`, "");
    }
  }

  if (audience.summary) {
    lines.push(section("Audience"));
    lines.push(`${String(audience.summary)}`, "");
    lines.push(`**Evidence mode:** ${String(audience.mode ?? "hypothesis")} (${String(audience.provider ?? "none")})`, "");
    lines.push(...list(audience.hypotheses).map((item) => `- ${String(item)}`), "");
  }

  if (copy.meta || copy.google) {
    lines.push(section("Ad copy"));
    const meta = asRecord(copy.meta);
    if (Object.keys(meta).length) {
      lines.push("### Meta", "");
      for (const variant of list(meta.primaryTexts)) {
        lines.push(`- **Primary text:** ${String(asRecord(variant).text ?? "")}`);
      }
      for (const variant of list(meta.headlines)) {
        lines.push(`- **Headline:** ${String(asRecord(variant).text ?? "")}`);
      }
      for (const variant of list(meta.descriptions)) {
        lines.push(`- **Description:** ${String(asRecord(variant).text ?? "")}`);
      }
      lines.push("");
    }
    const google = asRecord(copy.google);
    if (Object.keys(google).length) {
      lines.push("### Google", "");
      for (const variant of list(google.headlines)) {
        lines.push(`- **Headline:** ${String(asRecord(variant).text ?? "")}`);
      }
      for (const variant of list(google.descriptions)) {
        lines.push(`- **Description:** ${String(asRecord(variant).text ?? "")}`);
      }
      if (Array.isArray(google.keywordThemes)) {
        lines.push(`- **Keyword themes:** ${google.keywordThemes.join(", ")}`);
      }
      if (Array.isArray(google.negativeKeywords)) {
        lines.push(`- **Negative keywords:** ${google.negativeKeywords.join(", ")}`);
      }
      lines.push("");
    }
  }

  const assets = list(creative.assets);
  if (assets.length) {
    lines.push(section("Creative assets"));
    for (const asset of assets) {
      const item = asRecord(asset);
      lines.push(
        `- ${String(item.placement ?? "Creative")} — ${String(item.width ?? "?")}×${String(item.height ?? "?")} ${String(item.format ?? "").toUpperCase()} (${String(item.status ?? "unknown")}${item.url ? `, ${String(item.url)}` : ""})`,
      );
    }
    lines.push("");
  }

  if (conversion.checkNote) {
    lines.push(section("Conversion readiness"));
    lines.push(`${String(conversion.checkNote)}`, "");
    if (Array.isArray(conversion.utm)) {
      lines.push(`**Suggested UTM parameters:** ${conversion.utm.join("&")}`, "");
    }
  }

  if (campaign.channels.length) {
    lines.push(section("Configuration"));
    const channelDrafts = asRecord(draft.channels);
    for (const channel of campaign.channels) {
      const channelDraft = asRecord(channelDrafts[channel]);
      lines.push(`### ${channelLabel(channel)}`, "");
      lines.push(`- Campaign name: ${String(channelDraft.campaignName ?? "—")}`);
      lines.push(`- Status: ${String(channelDraft.status ?? "—")}`);
      lines.push(`- Destination: ${String(channelDraft.destinationUrl ?? "—")}`);
      const budget = asRecord(channelDraft.budget);
      lines.push(
        `- Budget: ${formatMoney(Number(budget.amount ?? 0), String(budget.currency ?? campaign.budgetCurrency))} planned`,
      );
      for (const level of list(channelDraft.structure)) {
        const item = asRecord(level);
        lines.push(`- ${String(item.level ?? "item")}: ${String(item.name ?? "")} — ${String(item.details ?? "")}`);
      }
      lines.push("");
    }
  }

  if (operations.length) {
    lines.push(section("Execution results"));
    lines.push("> All results below are simulated. No real platform resources exist.", "");
    for (const operation of operations) {
      lines.push(
        `- ${channelLabel(operation.provider)}: ${operation.status} — ${operation.providerResourceId ?? "no resource id"} (${formatDate(operation.createdAt, "datetime")})`,
      );
    }
    lines.push("");
  }

  lines.push(section("Approval history"));
  if (approvals.length === 0) {
    lines.push("No approvals recorded.", "");
  } else {
    for (const approval of approvals) {
      lines.push(
        `- Version ${approval.campaignVersion}: ${approval.status} — ${approval.operationType} (${formatDate(approval.approvedAt, "datetime")})`,
      );
    }
    lines.push("");
  }

  if (quality) {
    lines.push(section("Quality review"));
    const checks = list(artifacts.quality?.content ? asRecord(artifacts.quality.content).checks : []);
    for (const check of checks) {
      const item = asRecord(check);
      lines.push(`- **${String(item.status ?? "")}** ${String(item.label ?? "")}: ${String(item.detail ?? "")}`);
    }
    lines.push("");
  }

  return {
    filename: `tulivu-${slug}-v${campaign.currentVersion}`,
    json: JSON.stringify(
      {
        exportedAt: generatedAt,
        simulated: true,
        disclaimer:
          "Tulivu demo export. Ad platform resources are simulated. No real ads were published or performance data exists.",
        campaign,
        business,
        artifacts,
        approvals,
        operations,
        qualityStale: detail.qualityStale,
      },
      null,
      2,
    ),
    markdown: lines.join("\n"),
  };
}
