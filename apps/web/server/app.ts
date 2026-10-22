import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import secureSession from "@fastify/secure-session";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { z, type ZodTypeAny } from "zod";
import {
  ARTIFACT_TYPES,
  CHANNELS,
  CURRENCIES,
  OBJECTIVES,
  STAGE_NAMES,
  WORKFLOW_STAGES,
  addDays,
  artifactContentSchemas,
  artifactPatchSchema,
  approvalRequestSchema,
  brandProfileSchema,
  businessInputSchema,
  businessUpdateSchema,
  campaignCreateSchema,
  campaignUpdateSchema,
  executeRequestSchema,
  resetDemoSchema,
  settingsPreferencesSchema,
  type AdCopyPackage,
  type ArtifactType,
  type CampaignBriefInput,
  type CampaignDraft,
  type ChannelId,
} from "@tulivu/shared";
import { PLATFORM_SPECS, validateCopyAgainstChannels } from "@tulivu/ad-platforms";
import { publicConfig, type AppConfig } from "./config.js";
import type { Database } from "./db/client.js";
import {
  artifacts,
  businesses,
  campaigns,
  userSettings,
  users,
  workflowEvents,
  workflowRuns,
} from "./db/schema.js";
import { createAppContext, type AppContext } from "./context.js";
import {
  ApprovalError,
  approveCampaign,
  invalidateApprovals,
  qualityStaleness,
  latestArtifactRows,
} from "./services/approval.js";
import {
  businessDto as toBusinessDto,
  getBusiness,
  getCampaignDetail,
  getCampaignRow,
  getOverview,
  listActivity,
  listAssets,
  listCampaigns,
} from "./services/campaigns.js";
import { getAssetContent, getAssetForOwner } from "./services/assets.js";
import { buildExportBundle } from "./services/export.js";
import { executeCampaign, ExecutionError } from "./services/execution.js";
import { ensureDemoWorkspace } from "./services/seed.js";
import { saveArtifact } from "./services/audit.js";
import { recordAudit } from "./services/audit.js";
import { WorkflowError } from "./workflow/engine.js";

declare module "fastify" {
  interface FastifyRequest {
    ownerId: string;
  }
}

declare module "@fastify/secure-session" {
  interface SessionData {
    ownerId: string;
  }
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, code = "request_error", statusCode = 400, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface BuildAppOptions {
  config: AppConfig;
  db: Database;
}

const clientDir = fileURLToPath(new URL("../dist/client", import.meta.url));

function parse<S extends ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError("The request could not be validated.", "validation_error", 400, result.error.flatten());
  }
  return result.data;
}

function sessionKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

async function ownedCampaign(db: Database, campaignId: string, ownerId: string) {
  const row = await getCampaignRow(db, campaignId, ownerId);
  if (!row) throw new ApiError("Campaign not found for this workspace.", "not_found", 404);
  return row;
}

function activeRunGuard(status: string): void {
  if (status === "running" || status === "executing") {
    throw new ApiError("Wait for the active operation to finish first.", "busy", 409);
  }
}

export async function buildApp({ config, db }: BuildAppOptions): Promise<{
  app: FastifyInstance;
  context: AppContext;
}> {
  const app = Fastify({
    logger:
      config.nodeEnv === "test"
        ? false
        : { level: config.nodeEnv === "development" ? "info" : "warn" },
    bodyLimit: 1024 * 1024,
    trustProxy: true,
    disableRequestLogging: config.nodeEnv === "test",
  });
  const context = createAppContext(config, db);
  const seededOwners = new Set<string>();

  await app.register(rateLimit, {
    global: true,
    max: config.rateLimitMax,
    timeWindow: "1 minute",
    allowList: [],
  });
  await app.register(secureSession, {
    key: sessionKey(config.sessionSecret),
    cookieName: "tulivu_session",
    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: config.isProduction,
      maxAge: 60 * 60 * 24 * 30,
    },
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "strict-origin-when-cross-origin");
    reply.header("x-frame-options", "DENY");
    reply.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId: request.id,
        },
      });
    }
    if (error instanceof ApprovalError || error instanceof ExecutionError || error instanceof WorkflowError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, requestId: request.id },
      });
    }
    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: "rate_limited",
          message: "Too many requests. Wait a moment and try again.",
          requestId: request.id,
        },
      });
    }
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode && statusCode < 500) {
      return reply.status(statusCode).send({
        error: {
          code: "request_error",
          message: error instanceof Error ? error.message : "The request could not be processed.",
          requestId: request.id,
        },
      });
    }
    request.log.error(error);
    return reply.status(500).send({
      error: {
        code: "internal_error",
        message: "Something went wrong on the Tulivu server. The request was not completed.",
        requestId: request.id,
      },
    });
  });

  await app.register(async (api) => {
    api.addHook("preHandler", async (request) => {
      let ownerId = request.session.get("ownerId");
      if (typeof ownerId !== "string" || !ownerId) {
        ownerId = randomUUID();
        request.session.set("ownerId", ownerId);
      }
      request.ownerId = ownerId;
      if (!seededOwners.has(ownerId) && request.url !== "/api/health") {
        await ensureDemoWorkspace(db, ownerId);
        seededOwners.add(ownerId);
      }
    });

    api.get("/health", async () => ({
      ok: true,
      service: "tulivu",
      mode: config.adapterMode,
      persistence: config.databaseUrl ? "postgres" : "pglite",
      time: new Date().toISOString(),
    }));

    api.get("/config", async () => ({
      config: publicConfig(config),
      currencies: CURRENCIES,
      channels: CHANNELS,
      objectives: OBJECTIVES,
      stages: WORKFLOW_STAGES,
      platformSpecs: PLATFORM_SPECS,
    }));

    api.get("/overview", async (request) => {
      const overview = await getOverview(db, request.ownerId);
      return {
        ...overview,
        provider: publicConfig(config),
      };
    });

    /* -------------------------------- businesses ------------------------------ */
    api.get("/businesses", async (request) => {
      const rows = await db
        .select()
        .from(businesses)
        .where(eq(businesses.ownerId, request.ownerId))
        .orderBy(desc(businesses.updatedAt));
      const counts = rows.length
        ? await db
            .select({ businessId: campaigns.businessId, count: sql<number>`count(*)::int` })
            .from(campaigns)
            .where(and(eq(campaigns.ownerId, request.ownerId), inArray(campaigns.businessId, rows.map((row) => row.id))))
            .groupBy(campaigns.businessId)
        : [];
      const countMap = new Map(counts.map((row) => [row.businessId, row.count]));
      return {
        businesses: rows.map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          industry: row.industry,
          country: row.country,
          city: row.city,
          websiteUrl: row.websiteUrl,
          defaultCurrency: row.defaultCurrency,
          brandColors: brandProfileSchema.safeParse(row.brandProfileJson).data?.colors ?? [],
          campaignCount: countMap.get(row.id) ?? 0,
          updatedAt: row.updatedAt.toISOString(),
        })),
      };
    });

    api.post("/businesses", async (request, reply) => {
      const body = parse(businessInputSchema, request.body);
      const id = randomUUID();
      const [row] = await db
        .insert(businesses)
        .values({
          id,
          ownerId: request.ownerId,
          name: body.name,
          description: body.description,
          websiteUrl: body.websiteUrl,
          industry: body.industry,
          country: body.country,
          city: body.city,
          defaultCurrency: body.defaultCurrency,
          targetCustomers: body.targetCustomers,
          socialUrls: body.socialUrls,
          brandProfileJson: body.brandProfile,
        })
        .returning();
      await recordAudit(db, {
        ownerId: request.ownerId,
        eventType: "business.created",
        actorType: "user",
        actorId: request.ownerId,
        metadata: { businessId: id, name: body.name },
      });
      return reply.status(201).send({ business: row ? toBusinessDto(row) : null });
    });

    api.get("/businesses/:businessId", async (request) => {
      const { businessId } = request.params as { businessId: string };
      const row = await getBusiness(db, businessId, request.ownerId);
      if (!row) throw new ApiError("Business not found for this workspace.", "not_found", 404);
      return { business: toBusinessDto(row) };
    });

    api.patch("/businesses/:businessId", async (request) => {
      const { businessId } = request.params as { businessId: string };
      const row = await getBusiness(db, businessId, request.ownerId);
      if (!row) throw new ApiError("Business not found for this workspace.", "not_found", 404);
      const body = parse(businessUpdateSchema, request.body);
      const [updated] = await db
        .update(businesses)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.websiteUrl !== undefined ? { websiteUrl: body.websiteUrl } : {}),
          ...(body.industry !== undefined ? { industry: body.industry } : {}),
          ...(body.country !== undefined ? { country: body.country } : {}),
          ...(body.city !== undefined ? { city: body.city } : {}),
          ...(body.defaultCurrency !== undefined ? { defaultCurrency: body.defaultCurrency } : {}),
          ...(body.targetCustomers !== undefined ? { targetCustomers: body.targetCustomers } : {}),
          ...(body.socialUrls !== undefined ? { socialUrls: body.socialUrls } : {}),
          ...(body.brandProfile !== undefined ? { brandProfileJson: body.brandProfile } : {}),
          updatedAt: new Date(),
        })
        .where(eq(businesses.id, businessId))
        .returning();
      await recordAudit(db, {
        ownerId: request.ownerId,
        eventType: "business.updated",
        actorType: "user",
        actorId: request.ownerId,
        metadata: { businessId, fields: Object.keys(body) },
      });
      return { business: updated ? toBusinessDto(updated) : null };
    });

    /* -------------------------------- campaigns ------------------------------- */
    api.get("/campaigns", async (request) => ({ campaigns: await listCampaigns(db, request.ownerId) }));

    api.post("/campaigns", async (request, reply) => {
      const body = parse(campaignCreateSchema, request.body);
      const business = await getBusiness(db, body.businessId, request.ownerId);
      if (!business) throw new ApiError("Business not found for this workspace.", "not_found", 404);
      const brief: CampaignBriefInput = body.brief;
      const id = randomUUID();
      await db.insert(campaigns).values({
        id,
        businessId: body.businessId,
        ownerId: request.ownerId,
        name: brief.name,
        objective: brief.objective,
        status: "draft",
        channelsJson: brief.channels,
        budgetAmount: String(brief.budgetAmount),
        budgetCurrency: brief.budgetCurrency,
        startDate: brief.startDate,
        endDate: addDays(brief.startDate, brief.durationDays),
        briefJson: brief,
        currentVersion: 1,
      });
      await recordAudit(db, {
        ownerId: request.ownerId,
        campaignId: id,
        eventType: "campaign.created",
        actorType: "user",
        actorId: request.ownerId,
        metadata: { name: brief.name, channels: brief.channels, budgetCurrency: brief.budgetCurrency },
      });
      const detail = await getCampaignDetail(db, id, request.ownerId);
      return reply.status(201).send({ campaign: detail });
    });

    api.get("/campaigns/:campaignId", async (request) => {
      const { campaignId } = request.params as { campaignId: string };
      const detail = await getCampaignDetail(db, campaignId, request.ownerId);
      if (!detail) throw new ApiError("Campaign not found for this workspace.", "not_found", 404);
      const latest = await latestArtifactRows(db, campaignId);
      return { campaign: detail, qualityStale: qualityStaleness(latest) || detail.qualityStale };
    });

    api.patch("/campaigns/:campaignId", async (request) => {
      const { campaignId } = request.params as { campaignId: string };
      const campaign = await ownedCampaign(db, campaignId, request.ownerId);
      activeRunGuard(campaign.status);
      const body = parse(campaignUpdateSchema, request.body);
      const brief = body.brief;
      const [artifact] = await db
        .select({ id: artifacts.id })
        .from(artifacts)
        .where(eq(artifacts.campaignId, campaignId))
        .limit(1);
      const hasArtifacts = Boolean(artifact?.id);
      const nextVersion = hasArtifacts ? campaign.currentVersion + 1 : campaign.currentVersion;
      await db
        .update(campaigns)
        .set({
          name: brief.name,
          objective: brief.objective,
          channelsJson: brief.channels,
          budgetAmount: String(brief.budgetAmount),
          budgetCurrency: brief.budgetCurrency,
          startDate: brief.startDate,
          endDate: addDays(brief.startDate, brief.durationDays),
          briefJson: brief,
          currentVersion: nextVersion,
          status: hasArtifacts ? "needs_review" : campaign.status,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId));
      if (hasArtifacts) {
        await invalidateApprovals(db, campaignId, request.ownerId, "The campaign brief changed.");
      }
      await recordAudit(db, {
        ownerId: request.ownerId,
        campaignId,
        eventType: "campaign.brief_updated",
        actorType: "user",
        actorId: request.ownerId,
        metadata: {
          campaignVersion: nextVersion,
          changedFields: Object.keys(brief),
          note: hasArtifacts
            ? "Existing artifacts belong to an earlier version. Re-run the workflow or review affected artifacts."
            : "Draft brief updated before the workflow was run.",
        },
      });
      return { campaign: await getCampaignDetail(db, campaignId, request.ownerId) };
    });

    api.post("/campaigns/:campaignId/runs", async (request, reply) => {
      const { campaignId } = request.params as { campaignId: string };
      await ownedCampaign(db, campaignId, request.ownerId);
      const { runId } = await context.workflow.startRun(campaignId, request.ownerId);
      return reply.status(202).send({ runId, status: "running" });
    });

    api.post("/campaigns/:campaignId/quality/revalidate", async (request, reply) => {
      const { campaignId } = request.params as { campaignId: string };
      await ownedCampaign(db, campaignId, request.ownerId);
      const { runId } = await context.workflow.startQualityReview(campaignId, request.ownerId);
      return reply.status(202).send({ runId, status: "running", scope: "quality" });
    });

    api.post("/campaigns/:campaignId/runs/:runId/cancel", async (request) => {
      const { campaignId, runId } = request.params as { campaignId: string; runId: string };
      const [run] = await db
        .select()
        .from(workflowRuns)
        .where(
          and(
            eq(workflowRuns.id, runId),
            eq(workflowRuns.campaignId, campaignId),
            eq(workflowRuns.ownerId, request.ownerId),
          ),
        )
        .limit(1);
      if (!run) throw new ApiError("Workflow run not found for this campaign.", "not_found", 404);
      await context.workflow.cancelRun(runId, request.ownerId);
      return { status: "cancelled" };
    });

    api.post("/campaigns/:campaignId/runs/:runId/resume", async (request, reply) => {
      const { campaignId, runId } = request.params as { campaignId: string; runId: string };
      const [run] = await db
        .select()
        .from(workflowRuns)
        .where(
          and(
            eq(workflowRuns.id, runId),
            eq(workflowRuns.campaignId, campaignId),
            eq(workflowRuns.ownerId, request.ownerId),
          ),
        )
        .limit(1);
      if (!run) throw new ApiError("Workflow run not found for this campaign.", "not_found", 404);
      await context.workflow.resumeRun(runId, request.ownerId);
      return reply.status(202).send({ runId, status: "running" });
    });

    api.patch("/campaigns/:campaignId/artifacts/:artifactType", async (request) => {
      const { campaignId, artifactType } = request.params as { campaignId: string; artifactType: string };
      if (!ARTIFACT_TYPES.includes(artifactType as ArtifactType)) {
        throw new ApiError("Unknown artifact type.", "unknown_artifact", 404);
      }
      if (artifactType === "quality") {
        throw new ApiError(
          "The quality review cannot be edited. Re-run it instead so the verdict stays independent.",
          "quality_read_only",
          403,
        );
      }
      const type = artifactType as ArtifactType;
      const campaign = await ownedCampaign(db, campaignId, request.ownerId);
      activeRunGuard(campaign.status);
      const body = parse(artifactPatchSchema, request.body);
      const parsed = artifactContentSchemas[type].safeParse(body.content);
      if (!parsed.success) {
        throw new ApiError(`The edited ${type} artifact is invalid.`, "invalid_artifact", 400, parsed.error.flatten());
      }
      const latest = await latestArtifactRows(db, campaignId);
      if (!latest.has(type)) {
        throw new ApiError("This artifact does not exist yet. Run the workflow first.", "artifact_not_found", 404);
      }
      const nextVersion = campaign.currentVersion + 1;
      let content: unknown = parsed.data;
      if (type === "copy") {
        const copy = parsed.data as AdCopyPackage;
        content = {
          ...copy,
          validation: validateCopyAgainstChannels(copy, campaign.channelsJson as ChannelId[]),
          generatedAt: new Date().toISOString(),
        };
      }
      if (type === "draft") {
        content = { ...(parsed.data as CampaignDraft), campaignVersion: nextVersion };
      }
      await db
        .update(campaigns)
        .set({ currentVersion: nextVersion, status: "needs_review", updatedAt: new Date() })
        .where(eq(campaigns.id, campaignId));
      const row = await saveArtifact(db, {
        campaignId,
        ownerId: request.ownerId,
        type,
        content,
        metadata: {
          editedBy: request.ownerId,
          source: "manual_edit",
          note: body.note ?? "",
          campaignVersion: nextVersion,
        },
      });
      await invalidateApprovals(db, campaignId, request.ownerId, `The ${type} artifact was edited.`);
      await recordAudit(db, {
        ownerId: request.ownerId,
        campaignId,
        eventType: `artifact.${type}.edited`,
        actorType: "user",
        actorId: request.ownerId,
        metadata: {
          artifactId: row.id,
          artifactVersion: row.version,
          campaignVersion: nextVersion,
          note: body.note ?? "",
          noteToReviewer: "Editing invalidates the previous quality review and approval.",
        },
      });
      return {
        artifact: { id: row.id, version: row.version, content: row.contentJson },
        campaignVersion: nextVersion,
        qualityStale: true,
      };
    });

    api.post("/campaigns/:campaignId/approve", async (request) => {
      const { campaignId } = request.params as { campaignId: string };
      const body = parse(approvalRequestSchema, request.body);
      const result = await approveCampaign(db, {
        campaignId,
        ownerId: request.ownerId,
        campaignVersion: body.campaignVersion,
        acknowledgeWarnings: body.acknowledgeWarnings,
        note: body.note,
      });
      return {
        approval: {
          id: result.approval.id,
          campaignVersion: result.approval.campaignVersion,
          status: result.approval.status,
          approvedAt: result.approval.approvedAt.toISOString(),
          operationHash: result.operationHash.slice(0, 16),
        },
        campaignVersion: result.campaignVersion,
        campaign: await getCampaignDetail(db, campaignId, request.ownerId),
      };
    });

    api.post("/campaigns/:campaignId/execute", async (request) => {
      const { campaignId } = request.params as { campaignId: string };
      const body = parse(executeRequestSchema, request.body);
      const result = await executeCampaign(
        { db, tools: context.tools },
        { campaignId, ownerId: request.ownerId, campaignVersion: body.campaignVersion },
      );
      return {
        execution: result,
        campaign: await getCampaignDetail(db, campaignId, request.ownerId),
      };
    });

    api.get("/campaigns/:campaignId/export", async (request, reply) => {
      const { campaignId } = request.params as { campaignId: string };
      const query = request.query as { format?: string };
      const bundle = await buildExportBundle(db, campaignId, request.ownerId);
      if (!bundle) throw new ApiError("Campaign not found for this workspace.", "not_found", 404);
      const format = query.format === "json" ? "json" : "markdown";
      const extension = format === "json" ? "json" : "md";
      const content = format === "json" ? bundle.json : bundle.markdown;
      reply
        .header("content-type", format === "json" ? "application/json; charset=utf-8" : "text/markdown; charset=utf-8")
        .header("content-disposition", `attachment; filename="${bundle.filename}.${extension}"`);
      return reply.send(content);
    });

    api.get("/campaigns/:campaignId/events", async (request, reply) => {
      const { campaignId } = request.params as { campaignId: string };
      const campaign = await ownedCampaign(db, campaignId, request.ownerId);
      const query = request.query as { since?: string };
      let lastSeq = Number.parseInt(query.since ?? "0", 10);
      if (!Number.isFinite(lastSeq) || lastSeq < 0) lastSeq = 0;

      reply.hijack();
      reply.raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      reply.raw.write("retry: 3000\n\n");
      reply.raw.write(
        `data: ${JSON.stringify({
          type: "stream.ready",
          payload: {
            campaignId: campaign.id,
            currentVersion: campaign.currentVersion,
            status: campaign.status,
          },
        })}\n\n`,
      );

      let closed = false;
      let sending = false;
      const sendEvents = async () => {
        if (closed || sending) return;
        sending = true;
        try {
          const rows = await db
            .select()
            .from(workflowEvents)
            .where(
              and(
                eq(workflowEvents.campaignId, campaignId),
                eq(workflowEvents.ownerId, request.ownerId),
                sql`${workflowEvents.seq} > ${lastSeq}`,
              ),
            )
            .orderBy(workflowEvents.seq)
            .limit(100);
          for (const row of rows) {
            if (closed) break;
            lastSeq = row.seq;
            reply.raw.write(
              `id: ${row.seq}\ndata: ${JSON.stringify({ type: row.type, payload: row.payloadJson })}\n\n`,
            );
          }
        } catch (error) {
          request.log.warn({ error }, "SSE poll failed");
        } finally {
          sending = false;
        }
      };

      await sendEvents();
      const poll = setInterval(() => {
        void sendEvents();
      }, 1000);
      const heartbeat = setInterval(() => {
        if (!closed) reply.raw.write(`: heartbeat ${Date.now()}\n\n`);
      }, 15_000);
      const close = () => {
        closed = true;
        clearInterval(poll);
        clearInterval(heartbeat);
        reply.raw.end();
      };
      request.raw.on("close", close);
      request.raw.on("error", close);
      // Keep the handler alive until the client disconnects.
      await new Promise<void>((resolve) => request.raw.on("close", resolve));
    });

    /* --------------------------------- activity -------------------------------- */
    api.get("/activity", async (request) => {
      const query = request.query as { limit?: string; campaignId?: string };
      const limit = Math.min(Math.max(Number.parseInt(query.limit ?? "60", 10) || 60, 1), 200);
      return {
        activity: await listActivity(db, request.ownerId, {
          limit,
          ...(query.campaignId ? { campaignId: query.campaignId } : {}),
        }),
      };
    });

    /* ---------------------------------- assets --------------------------------- */
    api.get("/assets", async (request) => {
      const query = request.query as { campaignId?: string };
      return { assets: await listAssets(db, request.ownerId, query.campaignId) };
    });

    api.get("/assets/*", async (request, reply) => {
      const key = (request.params as Record<string, string>)["*"];
      if (!key) throw new ApiError("Asset key is required.", "invalid_key", 400);
      const row = await getAssetForOwner(db, key, request.ownerId);
      if (!row) throw new ApiError("Asset not found for this workspace.", "not_found", 404);
      const content = await getAssetContent(db, context.storage, row);
      if (!content) throw new ApiError("Asset content is unavailable.", "asset_unavailable", 404);
      reply
        .header("content-type", row.mimeType)
        .header("content-length", content.bytes.byteLength)
        .header("content-disposition", `inline; filename="${key.split("/").pop() ?? "asset"}"`)
        .header("cache-control", "private, max-age=3600")
        .header("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
      return reply.send(Buffer.from(content.bytes));
    });

    /* --------------------------------- settings -------------------------------- */
    api.get("/settings", async (request) => {
      const [user] = await db.select().from(users).where(eq(users.id, request.ownerId)).limit(1);
      const [settings] = await db.select().from(userSettings).where(eq(userSettings.ownerId, request.ownerId)).limit(1);
      return {
        workspace: {
          name: String((settings?.preferencesJson as { workspaceLabel?: string } | undefined)?.workspaceLabel ?? "Demo workspace"),
          createdAt: user?.createdAt.toISOString() ?? new Date().toISOString(),
        },
        preferences: settings?.preferencesJson ?? {},
        provider: publicConfig(config),
        platformSpecs: PLATFORM_SPECS,
      };
    });

    api.patch("/settings", async (request) => {
      const body = parse(settingsPreferencesSchema, request.body);
      const [existing] = await db.select().from(userSettings).where(eq(userSettings.ownerId, request.ownerId)).limit(1);
      const preferences = {
        ...((existing?.preferencesJson as Record<string, unknown> | undefined) ?? {}),
        ...(body.workspaceLabel !== undefined ? { workspaceLabel: body.workspaceLabel } : {}),
        ...(body.defaultCurrency !== undefined ? { defaultCurrency: body.defaultCurrency } : {}),
      };
      await db
        .insert(userSettings)
        .values({ ownerId: request.ownerId, preferencesJson: preferences })
        .onConflictDoUpdate({
          target: userSettings.ownerId,
          set: { preferencesJson: preferences, updatedAt: new Date() },
        });
      await recordAudit(db, {
        ownerId: request.ownerId,
        eventType: "settings.updated",
        actorType: "user",
        actorId: request.ownerId,
        metadata: { fields: Object.keys(body) },
      });
      return { preferences };
    });

    api.post("/demo/reset", async (request) => {
      parse(resetDemoSchema, request.body);
      await db.delete(users).where(eq(users.id, request.ownerId));
      seededOwners.delete(request.ownerId);
      await ensureDemoWorkspace(db, request.ownerId);
      seededOwners.add(request.ownerId);
      return { ok: true, message: "Demo workspace reset to its seeded state." };
    });

    /* --------------------------------- platform -------------------------------- */
    api.get("/platforms", async () => {
      const capabilities = [];
      for (const channel of CHANNELS) {
        capabilities.push(...(await context.platforms.forChannel(channel.id).getCapabilities()));
      }
      return { mode: context.platforms.mode, capabilities };
    });
  }, { prefix: "/api" });

  if (existsSync(clientDir)) {
    await app.register(fastifyStatic, {
      root: clientDir,
      prefix: "/",
      index: ["index.html"],
      maxAge: config.isProduction ? "1h" : 0,
    });
  }

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    if (request.url.startsWith("/api/")) {
      return reply.status(404).send({
        error: { code: "not_found", message: "API route not found.", requestId: request.id },
      });
    }
    const indexFile = `${clientDir}/index.html`;
    if (existsSync(indexFile)) {
      return reply.type("text/html; charset=utf-8").sendFile("index.html");
    }
    return reply.status(404).send({
      error: {
        code: "not_found",
        message: "The frontend has not been built. Run the Vite dev server or `pnpm build`.",
        requestId: request.id,
      },
    });
  });

  return { app, context };
}
