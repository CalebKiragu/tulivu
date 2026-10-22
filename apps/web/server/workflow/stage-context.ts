import { eq, sql } from "drizzle-orm";
import type { ArtifactType, CampaignBriefInput, StageName } from "@tulivu/shared";
import type { ZodType } from "zod";
import type { Database } from "../db/client.js";
import { approvals, artifacts, campaigns, type ArtifactRow, type BusinessRow, type CampaignRow } from "../db/schema.js";
import type { AppConfig } from "../config.js";
import type { ProviderRegistry } from "../providers/types.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { ImageGenerationProvider } from "../providers/images.js";
import type { AssetStorage } from "../services/storage.js";
import type { PlatformRegistry } from "../integrations/platforms.js";
import { emitWorkflowEvent, recordAudit, saveArtifact as saveArtifactRow } from "../services/audit.js";
import { SYSTEM_BASE } from "./prompts.js";

export interface StageDeps {
  db: Database;
  config: AppConfig;
  providers: ProviderRegistry;
  tools: ToolRegistry;
  storage: AssetStorage;
  imageProvider: ImageGenerationProvider;
  platforms: PlatformRegistry;
}

export interface StageContext {
  deps: StageDeps;
  ownerId: string;
  campaignId: string;
  runId: string;
  stage: StageName;
  business: BusinessRow;
  campaign: CampaignRow;
  brief: CampaignBriefInput;
  artifacts: Map<string, ArtifactRow>;
  modelUsage: { inputTokens: number; outputTokens: number };
  providerId: string;
  modelId: string;
  emit: (type: string, payload?: Record<string, unknown>) => Promise<void>;
  save: (type: ArtifactType, content: unknown, summary: string) => Promise<ArtifactRow>;
  read: <T>(type: ArtifactType, schema: ZodType<T>) => T | null;
  currentVersion: () => Promise<number>;
  generate: <T>(
    task: Parameters<ProviderRegistry["forTask"]>[0],
    schemaName: string,
    schema: ZodType<T>,
    prompt: string,
    context: Record<string, unknown>,
  ) => Promise<T>;
  audit: (eventType: string, metadata?: Record<string, unknown>) => Promise<void>;
}

export function createStageContext(input: {
  deps: StageDeps;
  ownerId: string;
  campaignId: string;
  runId: string;
  stage: StageName;
  business: BusinessRow;
  campaign: CampaignRow;
  brief: CampaignBriefInput;
  artifacts: Map<string, ArtifactRow>;
}): StageContext {
  const context: StageContext = {
    ...input,
    modelUsage: { inputTokens: 0, outputTokens: 0 },
    providerId: input.deps.providers.info().providerId,
    modelId: input.deps.providers.info().modelId,
    async emit(type, payload = {}) {
      await emitWorkflowEvent(input.deps.db, {
        runId: input.runId,
        campaignId: input.campaignId,
        ownerId: input.ownerId,
        type,
        payload,
      });
    },
    async save(type, content, summary) {
      const row = await saveArtifactRow(input.deps.db, {
        campaignId: input.campaignId,
        ownerId: input.ownerId,
        type,
        content,
        runId: input.runId,
        metadata: { stage: input.stage, summary, runId: input.runId },
      });
      await input.deps.db
        .update(campaigns)
        .set({ updatedAt: new Date() })
        .where(eq(campaigns.id, input.campaignId));
      await input.deps.db
        .update(approvals)
        .set({ status: "invalidated" })
        .where(sql`${approvals.campaignId} = ${input.campaignId} and ${approvals.status} = 'active'`);
      await context.emit("artifact.created", {
        artifactId: row.id,
        artifactType: type,
        version: row.version,
        summary,
      });
      await recordAudit(input.deps.db, {
        ownerId: input.ownerId,
        campaignId: input.campaignId,
        runId: input.runId,
        eventType: `artifact.${type}.created`,
        actorType: "agent",
        actorId: "tulivu",
        metadata: { artifactId: row.id, version: row.version, summary },
      });
      input.artifacts.set(type, row);
      return row;
    },
    read<T>(type: ArtifactType, schema: ZodType<T>): T | null {
      const row = input.artifacts.get(type);
      if (!row) return null;
      return schema.parse(row.contentJson);
    },
    async currentVersion() {
      const [row] = await input.deps.db
        .select({ version: campaigns.currentVersion })
        .from(campaigns)
        .where(eq(campaigns.id, input.campaignId))
        .limit(1);
      return row?.version ?? input.campaign.currentVersion;
    },
    async generate(task, schemaName, schema, prompt, modelContext) {
      const provider = input.deps.providers.forTask(task);
      context.providerId = provider.id;
      context.modelId = provider.modelId;
      const value = await provider.generateStructured({
        system: SYSTEM_BASE,
        prompt,
        task,
        context: modelContext,
        schemaName,
        schema,
        onUsage(usage) {
          context.modelUsage.inputTokens += usage.inputTokens ?? 0;
          context.modelUsage.outputTokens += usage.outputTokens ?? 0;
        },
      });
      return value;
    },
    async audit(eventType, metadata = {}) {
      await recordAudit(input.deps.db, {
        ownerId: input.ownerId,
        campaignId: input.campaignId,
        runId: input.runId,
        eventType,
        actorType: "agent",
        actorId: "tulivu",
        metadata,
      });
    },
  };
  return context;
}

export async function loadArtifactMap(db: Database, campaignId: string): Promise<Map<string, ArtifactRow>> {
  const rows = await db.select().from(artifacts).where(eq(artifacts.campaignId, campaignId));
  const map = new Map<string, ArtifactRow>();
  for (const row of rows) {
    const current = map.get(row.type);
    if (!current || row.version > current.version) map.set(row.type, row);
  }
  return map;
}
