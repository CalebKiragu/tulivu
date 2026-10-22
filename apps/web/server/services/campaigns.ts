import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  brandProfileSchema,
  type AuditItem,
  type BusinessInput,
  type CampaignDetail,
  type CampaignSummary,
  type OverviewResponse,
} from "@tulivu/shared";
import type { Database } from "../db/client.js";
import {
  approvals,
  artifacts,
  assets,
  auditEvents,
  businesses,
  campaigns,
  externalOperations,
  userSettings,
  users,
  workflowRuns,
  workflowStageRuns,
  type BusinessRow,
  type CampaignRow,
} from "../db/schema.js";

export function campaignBudget(campaign: CampaignRow): number {
  return Number(campaign.budgetAmount);
}

export function businessDto(row: BusinessRow): BusinessInput & { id: string } {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    websiteUrl: row.websiteUrl,
    industry: row.industry,
    country: row.country,
    city: row.city,
    defaultCurrency: row.defaultCurrency as BusinessInput["defaultCurrency"],
    targetCustomers: row.targetCustomers,
    socialUrls: row.socialUrls,
    brandProfile: brandProfileSchema.parse(row.brandProfileJson),
  };
}

export async function getBusiness(db: Database, businessId: string, ownerId: string) {
  const [row] = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.id, businessId), eq(businesses.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

export async function getCampaignRow(db: Database, campaignId: string, ownerId: string) {
  const [row] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

export async function listCampaigns(db: Database, ownerId: string): Promise<CampaignSummary[]> {
  const rows = await db
    .select({ campaign: campaigns, businessName: businesses.name })
    .from(campaigns)
    .innerJoin(businesses, eq(businesses.id, campaigns.businessId))
    .where(eq(campaigns.ownerId, ownerId))
    .orderBy(desc(campaigns.updatedAt));
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.campaign.id);
  const artifactCounts = await db
    .select({
      campaignId: artifacts.campaignId,
      count: sql<number>`count(distinct ${artifacts.type})::int`,
    })
    .from(artifacts)
    .where(inArray(artifacts.campaignId, ids))
    .groupBy(artifacts.campaignId);
  const assetCounts = await db
    .select({ campaignId: assets.campaignId, count: sql<number>`count(*)::int` })
    .from(assets)
    .where(inArray(assets.campaignId, ids))
    .groupBy(assets.campaignId);
  const activeApprovals = await db
    .select({ campaignId: approvals.campaignId, campaignVersion: approvals.campaignVersion })
    .from(approvals)
    .where(and(inArray(approvals.campaignId, ids), eq(approvals.status, "active")));
  const runs = await db
    .select({
      campaignId: workflowRuns.campaignId,
      status: workflowRuns.status,
      currentStage: workflowRuns.currentStage,
      startedAt: workflowRuns.startedAt,
    })
    .from(workflowRuns)
    .where(inArray(workflowRuns.campaignId, ids))
    .orderBy(desc(workflowRuns.startedAt));

  const artifactMap = new Map(artifactCounts.map((row) => [row.campaignId, row.count]));
  const assetMap = new Map(assetCounts.map((row) => [row.campaignId, row.count]));
  const approvalSet = new Set(
    activeApprovals
      .filter((row) => {
        const campaign = rows.find((item) => item.campaign.id === row.campaignId)?.campaign;
        return campaign ? campaign.currentVersion === row.campaignVersion : false;
      })
      .map((row) => row.campaignId),
  );
  const latestRun = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!latestRun.has(run.campaignId)) latestRun.set(run.campaignId, run);
  }

  return rows.map(({ campaign, businessName }) => ({
    id: campaign.id,
    businessId: campaign.businessId,
    businessName,
    name: campaign.name,
    objective: campaign.objective,
    status: campaign.status,
    channels: campaign.channelsJson,
    budgetAmount: campaignBudget(campaign),
    budgetCurrency: campaign.budgetCurrency,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    currentVersion: campaign.currentVersion,
    updatedAt: campaign.updatedAt.toISOString(),
    artifactCount: artifactMap.get(campaign.id) ?? 0,
    assetCount: assetMap.get(campaign.id) ?? 0,
    hasActiveApproval: approvalSet.has(campaign.id),
    lastRunStatus: latestRun.get(campaign.id)?.status ?? null,
    lastRunStage: latestRun.get(campaign.id)?.currentStage ?? null,
  }));
}

export async function getCampaignDetail(
  db: Database,
  campaignId: string,
  ownerId: string,
): Promise<CampaignDetail | null> {
  const campaign = await getCampaignRow(db, campaignId, ownerId);
  if (!campaign) return null;
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, campaign.businessId))
    .limit(1);
  if (!business) return null;

  const artifactRows = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.campaignId, campaignId))
    .orderBy(desc(artifacts.createdAt));
  const latest = new Map<string, (typeof artifactRows)[number]>();
  for (const row of artifactRows) {
    const current = latest.get(row.type);
    if (!current || row.version > current.version) latest.set(row.type, row);
  }

  const runs = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.campaignId, campaignId))
    .orderBy(desc(workflowRuns.startedAt))
    .limit(10);
  const runIds = runs.map((run) => run.id);
  const stages = runIds.length
    ? await db
        .select()
        .from(workflowStageRuns)
        .where(inArray(workflowStageRuns.workflowRunId, runIds))
        .orderBy(workflowStageRuns.startedAt)
    : [];
  const approvalRows = await db
    .select()
    .from(approvals)
    .where(eq(approvals.campaignId, campaignId))
    .orderBy(desc(approvals.approvedAt));
  const operationRows = await db
    .select()
    .from(externalOperations)
    .where(eq(externalOperations.campaignId, campaignId))
    .orderBy(desc(externalOperations.createdAt));

  const latestNonQuality = artifactRows.filter((row) => row.type !== "quality")[0];
  const quality = latest.get("quality");
  const qualityStale = Boolean(
    latestNonQuality && (!quality || quality.createdAt.getTime() < latestNonQuality.createdAt.getTime()),
  );

  return {
    campaign: {
      id: campaign.id,
      businessId: campaign.businessId,
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.status,
      channels: campaign.channelsJson,
      budgetAmount: campaignBudget(campaign),
      budgetCurrency: campaign.budgetCurrency,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      currentVersion: campaign.currentVersion,
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
      brief: campaign.briefJson,
    },
    business: businessDto(business),
    artifacts: Object.fromEntries(
      [...latest.entries()].map(([type, row]) => [
        type,
        { id: row.id, version: row.version, content: row.contentJson, createdAt: row.createdAt.toISOString() },
      ]),
    ),
    artifactHistory: artifactRows.map((row) => ({
      id: row.id,
      type: row.type,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      metadata: row.metadataJson,
    })),
    runs: runs.map((run) => ({
      id: run.id,
      status: run.status,
      currentStage: run.currentStage ?? null,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      errorSummary: run.errorSummary,
      providerId: run.providerId,
      modelId: run.modelId,
    })),
    stages: stages.map((stage) => ({
      id: stage.id,
      runId: stage.workflowRunId,
      stageName: stage.stageName,
      status: stage.status,
      attempt: stage.attempt,
      startedAt: stage.startedAt?.toISOString() ?? null,
      completedAt: stage.completedAt?.toISOString() ?? null,
      error: stage.errorJson ? { message: String((stage.errorJson as { message?: string }).message ?? "Stage failed") } : null,
    })),
    approvals: approvalRows.map((row) => ({
      id: row.id,
      campaignVersion: row.campaignVersion,
      status: row.status,
      approvedAt: row.approvedAt.toISOString(),
      operationType: row.operationType,
    })),
    operations: operationRows.map((row) => ({
      id: row.id,
      provider: row.provider,
      operationType: row.operationType,
      status: row.status,
      providerResourceId: row.providerResourceId,
      requestSummary: row.requestSummaryJson,
      responseSummary: row.responseSummaryJson,
      createdAt: row.createdAt.toISOString(),
    })),
    qualityStale,
  };
}

export async function listActivity(
  db: Database,
  ownerId: string,
  options: { limit?: number; campaignId?: string } = {},
): Promise<AuditItem[]> {
  const rows = await db
    .select({ event: auditEvents, campaignName: campaigns.name })
    .from(auditEvents)
    .leftJoin(campaigns, eq(campaigns.id, auditEvents.campaignId))
    .where(
      options.campaignId
        ? and(eq(auditEvents.ownerId, ownerId), eq(auditEvents.campaignId, options.campaignId))
        : eq(auditEvents.ownerId, ownerId),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(options.limit ?? 60);
  return rows.map(({ event, campaignName }) => ({
    id: event.id,
    eventType: event.eventType,
    actorType: event.actorType,
    actorId: event.actorId,
    campaignId: event.campaignId,
    campaignName,
    runId: event.runId,
    metadata: event.metadataJson,
    createdAt: event.createdAt.toISOString(),
  }));
}

export async function getOverview(db: Database, ownerId: string): Promise<OverviewResponse> {
  const [user] = await db.select().from(users).where(eq(users.id, ownerId)).limit(1);
  const [settings] = await db.select().from(userSettings).where(eq(userSettings.ownerId, ownerId)).limit(1);
  const campaignList = await listCampaigns(db, ownerId);
  const [assetCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(assets)
    .where(eq(assets.ownerId, ownerId));

  const planned = new Map<string, number>();
  for (const campaign of campaignList) {
    if (["cancelled", "published_demo"].includes(campaign.status)) continue;
    planned.set(campaign.budgetCurrency, (planned.get(campaign.budgetCurrency) ?? 0) + campaign.budgetAmount);
  }

  const activity = await listActivity(db, ownerId, { limit: 12 });
  return {
    workspace: {
      name: String((settings?.preferencesJson as { workspaceLabel?: string } | undefined)?.workspaceLabel ?? "Demo workspace"),
      createdAt: user?.createdAt.toISOString() ?? new Date().toISOString(),
      demo: true,
    },
    metrics: {
      activeCampaigns: campaignList.filter((item) => ["running", "needs_review", "approved", "executing"].includes(item.status)).length,
      awaitingApproval: campaignList.filter((item) => item.status === "needs_review").length,
      approvedCampaigns: campaignList.filter((item) => item.status === "approved").length,
      simulatedLaunches: campaignList.filter((item) => item.status === "published_demo").length,
      creativeAssets: assetCount?.count ?? 0,
      failures: campaignList.filter((item) => item.status === "failed").length,
      plannedBudgets: [...planned.entries()].map(([currency, amount]) => ({ currency, amount })),
    },
    campaigns: campaignList.slice(0, 6),
    activity,
    attention: campaignList.filter((item) => item.status === "failed").slice(0, 4),
    provider: {
      modelProvider: "configured",
      modelName: "configured",
      imageProvider: "configured",
      researchProvider: "configured",
      demoMode: true,
    },
  };
}

export async function listAssets(db: Database, ownerId: string, campaignId?: string) {
  const rows = await db
    .select({ asset: assets, campaignName: campaigns.name })
    .from(assets)
    .innerJoin(campaigns, eq(campaigns.id, assets.campaignId))
    .where(campaignId ? and(eq(assets.ownerId, ownerId), eq(assets.campaignId, campaignId)) : eq(assets.ownerId, ownerId))
    .orderBy(desc(assets.createdAt));
  return rows.map(({ asset, campaignName }) => ({
    id: asset.id,
    campaignId: asset.campaignId,
    campaignName,
    key: asset.key,
    url: `/api/assets/${asset.key}`,
    kind: asset.kind,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    sizeBytes: asset.sizeBytes,
    metadata: asset.metadataJson,
    createdAt: asset.createdAt.toISOString(),
  }));
}

export async function listArtifactsForCampaign(db: Database, campaignId: string, ownerId: string) {
  const campaign = await getCampaignRow(db, campaignId, ownerId);
  if (!campaign) return null;
  return db
    .select()
    .from(artifacts)
    .where(eq(artifacts.campaignId, campaignId))
    .orderBy(desc(artifacts.createdAt));
}
