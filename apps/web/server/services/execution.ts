import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  campaignDraftSchema,
  type CampaignDraft,
  type ChannelId,
  type QualityReport,
} from "@tulivu/shared";
import type { Database } from "../db/client.js";
import { campaigns, externalOperations } from "../db/schema.js";
import type { ToolRegistry } from "../tools/registry.js";
import { recordAudit } from "./audit.js";
import {
  activeApproval,
  computeOperationHash,
  invalidateApprovals,
  latestArtifactRows,
} from "./approval.js";

export class ExecutionError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code = "execution_error", statusCode = 400) {
    super(message);
    this.name = "ExecutionError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface ExecutionDeps {
  db: Database;
  tools: ToolRegistry;
}

export interface ExecutionInput {
  campaignId: string;
  ownerId: string;
  campaignVersion: number;
}

interface ChannelResult {
  platform: ChannelId;
  externalCampaignId: string;
  status: "PAUSED" | "ACTIVE";
  simulated: boolean;
  publishedAt: string;
  warnings: string[];
  responseSummary: Record<string, unknown>;
}

export interface ExecutionResult {
  status: "published_demo" | "already_executed" | "partial_failure";
  campaignVersion: number;
  results: ChannelResult[];
  failures: Array<{ platform: string; message: string; externalCampaignId: string | null }>;
  simulated: true;
  message: string;
}

function idempotencyKey(campaignId: string, version: number, channel: string): string {
  return `publish_demo:${campaignId}:v${version}:${channel}`;
}

function operationResult(row: typeof externalOperations.$inferSelect): ChannelResult {
  const summary = row.responseSummaryJson as Record<string, unknown>;
  return {
    platform: row.provider as ChannelId,
    externalCampaignId: row.providerResourceId ?? String(summary.externalCampaignId ?? ""),
    status: (summary.status as "PAUSED" | "ACTIVE" | undefined) ?? "PAUSED",
    simulated: true,
    publishedAt: String(summary.publishedAt ?? row.updatedAt.toISOString()),
    warnings: Array.isArray(summary.warnings) ? (summary.warnings as string[]) : [],
    responseSummary: summary,
  };
}

/**
 * Publishes one approved campaign version through the configured adapter.
 * Each channel has its own idempotency key, so a retry after a partial failure
 * never duplicates a channel that already produced simulated resources.
 */
export async function executeCampaign(
  deps: ExecutionDeps,
  input: ExecutionInput,
): Promise<ExecutionResult> {
  const { db } = deps;
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.ownerId, input.ownerId)))
    .limit(1);
  if (!campaign) throw new ExecutionError("Campaign not found.", "not_found", 404);
  if (campaign.currentVersion !== input.campaignVersion) {
    throw new ExecutionError(
      `This campaign is now version ${campaign.currentVersion}. Approve the current version before executing.`,
      "stale_version",
      409,
    );
  }

  const latest = await latestArtifactRows(db, campaign.id);
  const draftRow = latest.get("draft");
  if (!draftRow) {
    throw new ExecutionError("The campaign has no configuration to execute. Run the workflow first.", "draft_required", 409);
  }
  const draft = campaignDraftSchema.parse(draftRow.contentJson) as CampaignDraft;
  const channels = draft.platformNeutral.channels as ChannelId[];
  if (channels.length === 0) {
    throw new ExecutionError("The campaign configuration contains no channels.", "no_channels", 409);
  }

  // Check the human approval gate before the draft version. An edit bumps the
  // campaign version while the draft still belongs to the previous version, so
  // "approval required" is the actionable message for the operator.
  const approval = await activeApproval(db, campaign.id, campaign.currentVersion);
  if (!approval) {
    throw new ExecutionError(
      "This exact campaign version has no active approval. Review and approve it before executing.",
      "approval_required",
      409,
    );
  }

  // The draft may predate a manual artifact edit that was re-reviewed with a
  // quality-only run. The approval hash covers the exact draft plus every
  // current artifact, so a stale draft version is safe here; re-running the
  // assembly stage is recommended rather than required.

  const keys = channels.map((channel) => idempotencyKey(campaign.id, campaign.currentVersion, channel));
  const existing = await db
    .select()
    .from(externalOperations)
    .where(inArray(externalOperations.idempotencyKey, keys));
  const existingByKey = new Map(existing.map((row) => [row.idempotencyKey, row]));
  const succeeded = channels.filter((channel) => {
    const row = existingByKey.get(idempotencyKey(campaign.id, campaign.currentVersion, channel));
    return row?.status === "succeeded";
  });
  if (succeeded.length === channels.length) {
    return {
      status: "already_executed",
      campaignVersion: campaign.currentVersion,
      results: channels.map((channel) =>
        operationResult(existingByKey.get(idempotencyKey(campaign.id, campaign.currentVersion, channel))!),
      ),
      failures: [],
      simulated: true,
      message: "These simulated resources already exist for this exact approved version. Nothing was created twice.",
    };
  }

  if (campaign.status === "running") {
    throw new ExecutionError("Wait for the active workflow run to finish before executing.", "busy", 409);
  }

  const operationHash = await computeOperationHash(db, campaign, latest);
  if (operationHash !== approval.operationHash) {
    await invalidateApprovals(
      db,
      campaign.id,
      input.ownerId,
      "The approved package changed before execution. Approval was invalidated.",
    );
    throw new ExecutionError(
      "The campaign changed after it was approved. Approve the current version again.",
      "approval_hash_mismatch",
      409,
    );
  }

  const qualityRow = latest.get("quality");
  if (!qualityRow) {
    throw new ExecutionError("The approved package has no quality review.", "quality_required", 409);
  }
  const quality = qualityRow.contentJson as QualityReport;

  await db
    .update(campaigns)
    .set({ status: "executing", updatedAt: new Date() })
    .where(eq(campaigns.id, campaign.id));
  await recordAudit(db, {
    ownerId: input.ownerId,
    campaignId: campaign.id,
    eventType: "execution.started",
    actorType: "user",
    actorId: input.ownerId,
    metadata: {
      campaignVersion: campaign.currentVersion,
      channels,
      mode: "demo",
      approvalId: approval.id,
      qualityVerdict: quality.verdict,
      note: "Demo execution. No real advertising account is contacted.",
    },
  });

  const results: ChannelResult[] = [];
  const failures: ExecutionResult["failures"] = [];

  for (const channel of channels) {
    const key = idempotencyKey(campaign.id, campaign.currentVersion, channel);
    const prior = existingByKey.get(key);
    if (prior?.status === "succeeded") {
      results.push(operationResult(prior));
      continue;
    }

    const singleChannelDraft: CampaignDraft = {
      ...draft,
      platformNeutral: { ...draft.platformNeutral, channels: [channel] },
      channels: { [channel]: draft.channels[channel] },
    } as CampaignDraft;

    const requestSummary = {
      channel,
      campaignVersion: campaign.currentVersion,
      approvalId: approval.id,
      operationHash: approval.operationHash.slice(0, 16),
      mode: "demo",
      simulated: true,
    };

    let operationRow: typeof externalOperations.$inferSelect | undefined;
    if (prior) {
      const [updated] = await db
        .update(externalOperations)
        .set({ status: "pending", requestSummaryJson: requestSummary, updatedAt: new Date() })
        .where(eq(externalOperations.id, prior.id))
        .returning();
      operationRow = updated;
    } else {
      const [inserted] = await db
        .insert(externalOperations)
        .values({
          id: randomUUID(),
          campaignId: campaign.id,
          ownerId: input.ownerId,
          provider: channel,
          operationType: "publish_demo",
          idempotencyKey: key,
          status: "pending",
          requestSummaryJson: requestSummary,
        })
        .returning();
      operationRow = inserted;
    }

    try {
      const published = await deps.tools.execute<ChannelResult[]>(
        "ads.publish_campaign",
        {
          draft: singleChannelDraft,
          campaignVersion: campaign.currentVersion,
          operationHash: approval.operationHash,
          approvedBy: approval.approvedBy,
        },
        {
          ownerId: input.ownerId,
          campaignId: campaign.id,
          runId: null,
          actorId: input.ownerId,
          approval: {
            id: approval.id,
            campaignVersion: approval.campaignVersion,
            operationHash: approval.operationHash,
          },
        },
      );
      const result = published.find((item) => item.platform === channel) ?? published[0];
      if (!result) {
        throw new Error("The platform adapter returned no result for this channel.");
      }
      if (operationRow) {
        await db
          .update(externalOperations)
          .set({
            status: "succeeded",
            providerResourceId: result.externalCampaignId,
            responseSummaryJson: {
              ...result.responseSummary,
              externalCampaignId: result.externalCampaignId,
              status: result.status,
              simulated: true,
              publishedAt: result.publishedAt,
              warnings: result.warnings,
            },
            updatedAt: new Date(),
          })
          .where(eq(externalOperations.id, operationRow.id));
      }
      results.push(result);
      await recordAudit(db, {
        ownerId: input.ownerId,
        campaignId: campaign.id,
        eventType: "execution.channel.succeeded",
        actorType: "agent",
        actorId: "tulivu",
        metadata: {
          channel,
          externalCampaignId: result.externalCampaignId,
          simulated: true,
          campaignVersion: campaign.currentVersion,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown execution error";
      if (operationRow) {
        await db
          .update(externalOperations)
          .set({
            status: "failed",
            responseSummaryJson: { error: message.slice(0, 500), simulated: true },
            updatedAt: new Date(),
          })
          .where(eq(externalOperations.id, operationRow.id));
      }
      failures.push({ platform: channel, message, externalCampaignId: null });
      await recordAudit(db, {
        ownerId: input.ownerId,
        campaignId: campaign.id,
        eventType: "execution.channel.failed",
        actorType: "agent",
        actorId: "tulivu",
        metadata: { channel, error: message.slice(0, 500), campaignVersion: campaign.currentVersion },
      });
    }
  }

  if (failures.length > 0) {
    await db.update(campaigns).set({ status: "failed", updatedAt: new Date() }).where(eq(campaigns.id, campaign.id));
    await recordAudit(db, {
      ownerId: input.ownerId,
      campaignId: campaign.id,
      eventType: "execution.partial_failure",
      actorType: "system",
      actorId: "tulivu",
      metadata: {
        campaignVersion: campaign.currentVersion,
        failedChannels: failures.map((failure) => failure.platform),
        succeededChannels: results.map((result) => result.platform),
        note: "Successful channels are recorded and will not be duplicated on retry.",
      },
    });
    return {
      status: "partial_failure",
      campaignVersion: campaign.currentVersion,
      results,
      failures,
      simulated: true,
      message:
        results.length > 0
          ? "Some simulated resources were created. Retrying will skip channels that already succeeded."
          : "No simulated resources were created. Review the error and retry execution.",
    };
  }

  await db
    .update(campaigns)
    .set({ status: "published_demo", updatedAt: new Date() })
    .where(eq(campaigns.id, campaign.id));
  await recordAudit(db, {
    ownerId: input.ownerId,
    campaignId: campaign.id,
    eventType: "execution.completed",
    actorType: "agent",
    actorId: "tulivu",
    metadata: {
      campaignVersion: campaign.currentVersion,
      channels,
      simulated: true,
      note: "Simulated paused resources created. No real advertising resources exist.",
    },
  });

  return {
    status: "published_demo",
    campaignVersion: campaign.currentVersion,
    results,
    failures: [],
    simulated: true,
    message: "Simulated paused resources created for every channel. No real ads were published.",
  };
}
