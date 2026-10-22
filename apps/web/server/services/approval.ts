import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  qualityReportSchema,
  stableStringify,
  type QualityReport,
} from "@tulivu/shared";
import type { Database } from "../db/client.js";
import {
  approvals,
  artifacts,
  businesses,
  campaigns,
  users,
  type ArtifactRow,
  type CampaignRow,
} from "../db/schema.js";
import { recordAudit } from "./audit.js";
import { businessDto, campaignBudget } from "./campaigns.js";

export class ApprovalError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code = "approval_error", statusCode = 400) {
    super(message);
    this.name = "ApprovalError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function latestArtifactRows(db: Database, campaignId: string) {
  const rows = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.campaignId, campaignId))
    .orderBy(desc(artifacts.version));
  const latest = new Map<string, ArtifactRow>();
  for (const row of rows) {
    if (!latest.has(row.type) || (latest.get(row.type)?.version ?? 0) < row.version) latest.set(row.type, row);
  }
  return latest;
}

/**
 * A hash of the exact package a person approved. Execution recomputes it and
 * refuses to publish if any artifact, campaign field or budget changed.
 */
export async function computeOperationHash(
  db: Database,
  campaign: CampaignRow,
  latest?: Map<string, ArtifactRow>,
): Promise<string> {
  const artifactMap = latest ?? (await latestArtifactRows(db, campaign.id));
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, campaign.businessId))
    .limit(1);
  const content = {
    campaign: {
      id: campaign.id,
      businessId: campaign.businessId,
      name: campaign.name,
      objective: campaign.objective,
      channels: campaign.channelsJson,
      budgetAmount: campaignBudget(campaign),
      budgetCurrency: campaign.budgetCurrency,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      currentVersion: campaign.currentVersion,
      brief: campaign.briefJson,
    },
    business: business
      ? {
          id: business.id,
          name: business.name,
          websiteUrl: business.websiteUrl,
          brandProfile: business.brandProfileJson,
        }
      : null,
    artifacts: [...artifactMap.entries()]
      .filter(([type]) => type !== "quality")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, row]) => ({ type, version: row.version, content: row.contentJson })),
  };
  return createHash("sha256").update(stableStringify(content)).digest("hex");
}

export function qualityStaleness(latest: Map<string, ArtifactRow>): boolean {
  const quality = latest.get("quality");
  const latestOther = [...latest.entries()]
    .filter(([type]) => type !== "quality")
    .map(([, row]) => row.createdAt.getTime());
  if (latestOther.length === 0) return false;
  return !quality || quality.createdAt.getTime() < Math.max(...latestOther);
}

export async function approveCampaign(
  db: Database,
  input: {
    campaignId: string;
    ownerId: string;
    campaignVersion: number;
    acknowledgeWarnings: boolean;
    note?: string;
  },
) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.ownerId, input.ownerId)))
    .limit(1);
  if (!campaign) throw new ApprovalError("Campaign not found.", "not_found", 404);
  if (campaign.currentVersion !== input.campaignVersion) {
    throw new ApprovalError(
      `This campaign is now version ${campaign.currentVersion}. Review the latest version before approving.`,
      "stale_version",
      409,
    );
  }
  if (["running", "executing"].includes(campaign.status)) {
    throw new ApprovalError("Wait for the active operation to finish before approving.", "busy", 409);
  }
  if (campaign.status === "published_demo") {
    throw new ApprovalError(
      "This campaign already has simulated resources. Start a new version to create a new package.",
      "already_published",
      409,
    );
  }

  const latest = await latestArtifactRows(db, campaign.id);
  const qualityRow = latest.get("quality");
  if (!qualityRow) throw new ApprovalError("Run the quality review before approving.", "quality_required", 409);
  if (qualityStaleness(latest)) {
    throw new ApprovalError(
      "Artifacts changed after the quality review. Re-run the quality review before approving.",
      "quality_stale",
      409,
    );
  }
  const quality = qualityReportSchema.parse(qualityRow.contentJson) as QualityReport;
  if (quality.campaignVersion !== campaign.currentVersion) {
    throw new ApprovalError(
      `The quality review covers version ${quality.campaignVersion}, but this campaign is version ${campaign.currentVersion}. Re-run the quality review.`,
      "quality_version_mismatch",
      409,
    );
  }
  if (quality.verdict === "fail") {
    throw new ApprovalError(
      "The quality review found blocking failures. Fix them and rerun the review before approving.",
      "quality_failed",
      409,
    );
  }
  if (quality.verdict === "warn" && !input.acknowledgeWarnings) {
    throw new ApprovalError(
      "This package has warnings. Acknowledge them explicitly before approving.",
      "warnings_unacknowledged",
      409,
    );
  }

  const operationHash = await computeOperationHash(db, campaign, latest);
  const [user] = await db.select().from(users).where(eq(users.id, input.ownerId)).limit(1);
  await db
    .update(approvals)
    .set({ status: "invalidated" })
    .where(and(eq(approvals.campaignId, campaign.id), eq(approvals.status, "active")));
  const [approval] = await db
    .insert(approvals)
    .values({
      id: randomUUID(),
      ownerId: input.ownerId,
      campaignId: campaign.id,
      campaignVersion: campaign.currentVersion,
      operationType: "publish_demo",
      operationHash,
      approvedBy: user?.displayName ?? "Workspace owner",
      status: "active",
      note: input.note,
    } satisfies typeof approvals.$inferInsert)
    .returning();
  await db
    .update(campaigns)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(campaigns.id, campaign.id));
  await recordAudit(db, {
    ownerId: input.ownerId,
    campaignId: campaign.id,
    eventType: "campaign.approved",
    actorType: "user",
    actorId: input.ownerId,
    metadata: {
      campaignVersion: campaign.currentVersion,
      operationHash: operationHash.slice(0, 16),
      qualityVerdict: quality.verdict,
      warningsAcknowledged: input.acknowledgeWarnings,
      operationType: "publish_demo",
    },
  });
  return { approval: approval!, operationHash, campaignVersion: campaign.currentVersion };
}

export async function invalidateApprovals(
  db: Database,
  campaignId: string,
  ownerId: string,
  reason: string,
) {
  await db
    .update(approvals)
    .set({ status: "invalidated" })
    .where(and(eq(approvals.campaignId, campaignId), eq(approvals.status, "active")));
  await db
    .update(campaigns)
    .set({ status: "needs_review", updatedAt: new Date() })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.status, "approved")));
  await recordAudit(db, {
    ownerId,
    campaignId,
    eventType: "approval.invalidated",
    actorType: "system",
    actorId: "tulivu",
    metadata: { reason },
  });
}

export async function activeApproval(db: Database, campaignId: string, version: number) {
  const [approval] = await db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.campaignId, campaignId),
        eq(approvals.campaignVersion, version),
        eq(approvals.status, "active"),
      ),
    )
    .orderBy(desc(approvals.approvedAt))
    .limit(1);
  return approval ?? null;
}

export async function businessForCampaign(db: Database, campaign: CampaignRow) {
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, campaign.businessId))
    .limit(1);
  return business ? businessDto(business) : null;
}
