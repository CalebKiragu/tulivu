import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { STAGE_NAMES, WORKFLOW_STAGES, type StageName } from "@tulivu/shared";
import type { Database } from "../db/client.js";
import {
  artifacts,
  businesses,
  campaigns,
  workflowRuns,
  workflowStageRuns,
  type BusinessRow,
  type CampaignRow,
} from "../db/schema.js";
import type { StageDeps } from "./stage-context.js";
import { createStageContext, loadArtifactMap } from "./stage-context.js";
import { STAGE_RUNNERS } from "./stages.js";
import { emitWorkflowEvent, recordAudit } from "../services/audit.js";

export class WorkflowError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code = "workflow_error", statusCode = 400) {
    super(message);
    this.name = "WorkflowError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface WorkflowEngineOptions {
  /** Used only by tests to exercise retry and resume paths deterministically. */
  failStageOnce?: StageName;
  retryDelayMs?: number;
}

export interface WorkflowEngine {
  startRun(campaignId: string, ownerId: string, options?: { wait?: boolean }): Promise<{ runId: string }>;
  startQualityReview(campaignId: string, ownerId: string, options?: { wait?: boolean }): Promise<{ runId: string }>;
  executeRun(runId: string): Promise<void>;
  cancelRun(runId: string, ownerId: string): Promise<void>;
  resumeRun(runId: string, ownerId: string, options?: { wait?: boolean }): Promise<void>;
  recoverInterruptedRuns(): Promise<number>;
}

const cancelledRuns = new Set<string>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 800);
  return "Unknown workflow error";
}

export function createWorkflowEngine(deps: StageDeps, options: WorkflowEngineOptions = {}): WorkflowEngine {
  const failOnce = new Set<StageName>(options.failStageOnce ? [options.failStageOnce] : []);
  const runningJobs = new Map<string, Promise<void>>();

  async function getOwnedRun(db: Database, runId: string, ownerId: string) {
    const [row] = await db
      .select()
      .from(workflowRuns)
      .where(and(eq(workflowRuns.id, runId), eq(workflowRuns.ownerId, ownerId)))
      .limit(1);
    if (!row) throw new WorkflowError("Workflow run not found for this workspace.", "not_found", 404);
    return row;
  }

  async function isCancelled(db: Database, runId: string): Promise<boolean> {
    if (cancelledRuns.has(runId)) return true;
    const [row] = await db.select({ status: workflowRuns.status }).from(workflowRuns).where(eq(workflowRuns.id, runId)).limit(1);
    return row?.status === "cancelled";
  }

  async function updateCampaignStatus(db: Database, campaignId: string, status: CampaignRow["status"]) {
    await db.update(campaigns).set({ status, updatedAt: new Date() }).where(eq(campaigns.id, campaignId));
  }

  async function executeRun(runId: string): Promise<void> {
    const { db } = deps;
    const [run] = await db.select().from(workflowRuns).where(eq(workflowRuns.id, runId)).limit(1);
    if (!run) throw new WorkflowError("Workflow run not found.", "not_found", 404);
    if (run.status === "completed") return;

    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, run.campaignId)).limit(1);
    if (!campaign) throw new WorkflowError("Campaign not found.", "not_found", 404);
    const [business] = await db.select().from(businesses).where(eq(businesses.id, campaign.businessId)).limit(1);
    if (!business) throw new WorkflowError("Business not found.", "not_found", 404);

    await updateCampaignStatus(db, campaign.id, "running");

    const stageRows = await db
      .select()
      .from(workflowStageRuns)
      .where(eq(workflowStageRuns.workflowRunId, run.id));
    const stageByName = new Map(stageRows.map((row) => [row.stageName, row]));

    for (const stage of STAGE_NAMES) {
      const stageRow = stageByName.get(stage);
      if (!stageRow) continue;
      if (stageRow.status === "completed") continue;

      if (await isCancelled(db, run.id)) {
        await finaliseCancelled(run.id, campaign.id);
        return;
      }

      await db
        .update(workflowStageRuns)
        .set({
          status: "running",
          attempt: sql`${workflowStageRuns.attempt} + 1`,
          startedAt: new Date(),
          errorJson: null,
        })
        .where(eq(workflowStageRuns.id, stageRow.id));
      await db
        .update(workflowRuns)
        .set({ currentStage: stage, status: "running" })
        .where(eq(workflowRuns.id, run.id));
      await emitWorkflowEvent(db, {
        runId: run.id,
        campaignId: campaign.id,
        ownerId: campaign.ownerId,
        type: "stage.started",
        payload: { stage, label: WORKFLOW_STAGES.find((item) => item.name === stage)?.label ?? stage },
      });

      const started = Date.now();
      let succeeded = false;
      let lastError: unknown;
      let artifactId: string | undefined;
      let summary = "";
      let usage = { inputTokens: 0, outputTokens: 0 };
      let providerId = run.providerId;
      let modelId = run.modelId;

      if (failOnce.has(stage)) {
        failOnce.delete(stage);
        lastError = new Error(`Injected test failure at stage ${stage}. This failure is intentional.`);
      }

      for (let attempt = 1; attempt <= 2 && !succeeded && !lastError; attempt += 1) {
        try {
          const artifacts = await loadArtifactMap(db, campaign.id);
          const context = createStageContext({
            deps,
            ownerId: campaign.ownerId,
            campaignId: campaign.id,
            runId: run.id,
            stage,
            business: business as BusinessRow,
            campaign,
            brief: campaign.briefJson,
            artifacts,
          });
          const result = await STAGE_RUNNERS[stage](context);
          artifactId = result.artifactId;
          summary = result.summary;
          usage = context.modelUsage;
          providerId = context.providerId;
          modelId = context.modelId;
          succeeded = true;
        } catch (error) {
          lastError = error;
          if (attempt < 2) {
            await recordAudit(db, {
              ownerId: campaign.ownerId,
              campaignId: campaign.id,
              runId: run.id,
              eventType: "stage.retry",
              actorType: "system",
              actorId: "tulivu",
              metadata: { stage, attempt, error: errorMessage(error) },
            });
            await sleep(options.retryDelayMs ?? 200);
            lastError = undefined;
          }
        }
      }

      if (!succeeded) {
        const message = errorMessage(lastError);
        await db
          .update(workflowStageRuns)
          .set({
            status: "failed",
            completedAt: new Date(),
            latencyMs: Date.now() - started,
            errorJson: { message },
          })
          .where(eq(workflowStageRuns.id, stageRow.id));
        await db
          .update(workflowRuns)
          .set({ status: "failed", errorSummary: message, completedAt: new Date() })
          .where(eq(workflowRuns.id, run.id));
        await updateCampaignStatus(db, campaign.id, "failed");
        await emitWorkflowEvent(db, {
          runId: run.id,
          campaignId: campaign.id,
          ownerId: campaign.ownerId,
          type: "stage.failed",
          payload: { stage, message },
        });
        await emitWorkflowEvent(db, {
          runId: run.id,
          campaignId: campaign.id,
          ownerId: campaign.ownerId,
          type: "run.failed",
          payload: { message, resumable: true },
        });
        await recordAudit(db, {
          ownerId: campaign.ownerId,
          campaignId: campaign.id,
          runId: run.id,
          eventType: "run.failed",
          actorType: "agent",
          actorId: "tulivu",
          metadata: { stage, error: message },
        });
        return;
      }

      await db
        .update(workflowStageRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          latencyMs: Date.now() - started,
          outputJson: { summary, artifactId: artifactId ?? null },
          errorJson: null,
        })
        .where(eq(workflowStageRuns.id, stageRow.id));
      await db
        .update(workflowRuns)
        .set({
          currentStage: stage,
          providerId,
          modelId,
          tokenUsageJson: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
        })
        .where(eq(workflowRuns.id, run.id));
      await emitWorkflowEvent(db, {
        runId: run.id,
        campaignId: campaign.id,
        ownerId: campaign.ownerId,
        type: "stage.completed",
        payload: { stage, summary, artifactId: artifactId ?? null },
      });
    }

    const [current] = await db
      .select({ version: campaigns.currentVersion })
      .from(campaigns)
      .where(eq(campaigns.id, campaign.id))
      .limit(1);
    await db
      .update(workflowRuns)
      .set({ status: "completed", completedAt: new Date(), currentStage: "quality" })
      .where(eq(workflowRuns.id, run.id));
    await updateCampaignStatus(db, campaign.id, "needs_review");
    await emitWorkflowEvent(db, {
      runId: run.id,
      campaignId: campaign.id,
      ownerId: campaign.ownerId,
      type: "run.completed",
      payload: { campaignVersion: current?.version ?? campaign.currentVersion },
    });
    await emitWorkflowEvent(db, {
      runId: run.id,
      campaignId: campaign.id,
      ownerId: campaign.ownerId,
      type: "approval.required",
      payload: { campaignVersion: current?.version ?? campaign.currentVersion },
    });
    await recordAudit(db, {
      ownerId: campaign.ownerId,
      campaignId: campaign.id,
      runId: run.id,
      eventType: "run.completed",
      actorType: "agent",
      actorId: "tulivu",
      metadata: { campaignVersion: current?.version ?? campaign.currentVersion, note: "Package ready for human review." },
    });
  }

  async function finaliseCancelled(runId: string, campaignId: string) {
    const { db } = deps;
    const [run] = await db.select().from(workflowRuns).where(eq(workflowRuns.id, runId)).limit(1);
    if (!run) return;
    await db
      .update(workflowRuns)
      .set({ status: "cancelled", completedAt: new Date(), errorSummary: "Cancelled by a person." })
      .where(eq(workflowRuns.id, runId));
    await db
      .update(workflowStageRuns)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(and(eq(workflowStageRuns.workflowRunId, runId), eq(workflowStageRuns.status, "running")));
    await updateCampaignStatus(db, campaignId, "cancelled");
    await emitWorkflowEvent(db, {
      runId,
      campaignId,
      ownerId: run.ownerId,
      type: "run.cancelled",
      payload: { message: "Run cancelled. Completed artifacts were kept." },
    });
    await recordAudit(db, {
      ownerId: run.ownerId,
      campaignId,
      runId,
      eventType: "run.cancelled",
      actorType: "user",
      actorId: "owner",
      metadata: { note: "Completed artifacts retained." },
    });
  }

  return {
    async startRun(campaignId, ownerId, startOptions) {
      const { db } = deps;
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, ownerId)))
        .limit(1);
      if (!campaign) throw new WorkflowError("Campaign not found for this workspace.", "not_found", 404);
      if (campaign.status === "running" || campaign.status === "executing") {
        throw new WorkflowError("This campaign already has an active run.", "run_active", 409);
      }
      const [active] = await db
        .select({ id: workflowRuns.id })
        .from(workflowRuns)
        .where(and(eq(workflowRuns.campaignId, campaignId), eq(workflowRuns.status, "running")))
        .limit(1);
      if (active) throw new WorkflowError("This campaign already has an active run.", "run_active", 409);

      const info = deps.providers.info();
      const runId = randomUUID();
      // A run produces one coherent package version. All artifacts written by
      // the stages belong to this version; edits bump it again explicitly.
      await db
        .update(campaigns)
        .set({
          status: "running",
          currentVersion: campaign.currentVersion + 1,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId));
      await db.insert(workflowRuns).values({
        id: runId,
        campaignId,
        ownerId,
        status: "running",
        currentStage: STAGE_NAMES[0],
        providerId: info.providerId,
        modelId: info.modelId,
      });
      await db.insert(workflowStageRuns).values(
        STAGE_NAMES.map((stage) => ({
          id: randomUUID(),
          workflowRunId: runId,
          campaignId,
          stageName: stage,
          status: "pending" as const,
        })),
      );
      await emitWorkflowEvent(db, {
        runId,
        campaignId,
        ownerId,
        type: "run.started",
        payload: {
          provider: info.providerId,
          model: info.modelId,
          mode: info.mode,
          note: info.mode === "mock" ? "Deterministic demo model. No API key used." : "Configured live model.",
        },
      });
      await recordAudit(db, {
        ownerId,
        campaignId,
        runId,
        eventType: "run.started",
        actorType: "agent",
        actorId: "tulivu",
        metadata: { provider: info.providerId, model: info.modelId },
      });

      const job = executeRun(runId)
        .catch((error) => {
          deps.config.nodeEnv !== "test" && console.error("Workflow execution failed", error);
        })
        .finally(() => runningJobs.delete(runId));
      runningJobs.set(runId, job);

      if (startOptions?.wait ?? deps.config.workflowInline) {
        await job;
      }
      return { runId };
    },

    async startQualityReview(campaignId, ownerId, reviewOptions) {
      const { db } = deps;
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, ownerId)))
        .limit(1);
      if (!campaign) throw new WorkflowError("Campaign not found for this workspace.", "not_found", 404);
      if (campaign.status === "running" || campaign.status === "executing") {
        throw new WorkflowError("Wait for the active operation to finish before re-running quality review.", "busy", 409);
      }
      const [artifact] = await db
        .select({ id: artifacts.id })
        .from(artifacts)
        .where(eq(artifacts.campaignId, campaignId))
        .limit(1);
      if (!artifact) {
        throw new WorkflowError("Run the campaign workflow before requesting a quality review.", "no_artifacts", 409);
      }
      const [active] = await db
        .select({ id: workflowRuns.id })
        .from(workflowRuns)
        .where(and(eq(workflowRuns.campaignId, campaignId), eq(workflowRuns.status, "running")))
        .limit(1);
      if (active) throw new WorkflowError("This campaign already has an active run.", "run_active", 409);

      const info = deps.providers.info();
      const runId = randomUUID();
      await db.insert(workflowRuns).values({
        id: runId,
        campaignId,
        ownerId,
        status: "running",
        currentStage: "quality",
        providerId: info.providerId,
        modelId: info.modelId,
      });
      await db.insert(workflowStageRuns).values({
        id: randomUUID(),
        workflowRunId: runId,
        campaignId,
        stageName: "quality",
        status: "pending",
      });
      await updateCampaignStatus(db, campaignId, "running");
      await emitWorkflowEvent(db, {
        runId,
        campaignId,
        ownerId,
        type: "run.started",
        payload: {
          provider: info.providerId,
          model: info.modelId,
          mode: info.mode,
          scope: "quality",
          note: "Re-running the independent quality review against the current artifacts.",
        },
      });
      await recordAudit(db, {
        ownerId,
        campaignId,
        runId,
        eventType: "run.started",
        actorType: "agent",
        actorId: "tulivu",
        metadata: { provider: info.providerId, model: info.modelId, scope: "quality" },
      });

      const job = executeRun(runId)
        .catch((error) => {
          deps.config.nodeEnv !== "test" && console.error("Quality review failed", error);
        })
        .finally(() => runningJobs.delete(runId));
      runningJobs.set(runId, job);
      if (reviewOptions?.wait ?? deps.config.workflowInline) await job;
      return { runId };
    },

    executeRun,

    async cancelRun(runId, ownerId) {
      const run = await getOwnedRun(deps.db, runId, ownerId);
      if (run.status !== "running") {
        throw new WorkflowError("Only a running workflow can be cancelled.", "not_running", 409);
      }
      cancelledRuns.add(runId);
      await deps.db.update(workflowRuns).set({ status: "cancelled" }).where(eq(workflowRuns.id, runId));
      await emitWorkflowEvent(deps.db, {
        runId,
        campaignId: run.campaignId,
        ownerId,
        type: "run.cancelling",
        payload: { message: "Cancellation requested. The current tool call will finish." },
      });
      await finaliseCancelled(runId, run.campaignId);
    },

    async resumeRun(runId, ownerId, resumeOptions) {
      const run = await getOwnedRun(deps.db, runId, ownerId);
      if (!["failed", "cancelled"].includes(run.status)) {
        throw new WorkflowError("Only a failed or cancelled run can be resumed.", "not_resumable", 409);
      }
      const [campaign] = await deps.db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.id, run.campaignId), eq(campaigns.ownerId, ownerId)))
        .limit(1);
      if (!campaign) throw new WorkflowError("Campaign not found.", "not_found", 404);
      cancelledRuns.delete(runId);
      await deps.db
        .update(workflowRuns)
        .set({ status: "running", errorSummary: null, completedAt: null })
        .where(eq(workflowRuns.id, runId));
      await updateCampaignStatus(deps.db, campaign.id, "running");
      await emitWorkflowEvent(deps.db, {
        runId,
        campaignId: campaign.id,
        ownerId,
        type: "run.resumed",
        payload: { message: "Resuming from the first incomplete stage. Completed artifacts are retained." },
      });
      await recordAudit(deps.db, {
        ownerId,
        campaignId: campaign.id,
        runId,
        eventType: "run.resumed",
        actorType: "user",
        actorId: "owner",
        metadata: { fromStage: run.currentStage },
      });
      const job = executeRun(runId)
        .catch((error) => {
          deps.config.nodeEnv !== "test" && console.error("Workflow resume failed", error);
        })
        .finally(() => runningJobs.delete(runId));
      runningJobs.set(runId, job);
      if (resumeOptions?.wait ?? deps.config.workflowInline) await job;
    },

    async recoverInterruptedRuns() {
      const { db } = deps;
      const interrupted = await db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.status, "running"));
      for (const run of interrupted) {
        const message = "Interrupted by a server restart. Completed artifacts are retained; resume to continue.";
        await db
          .update(workflowRuns)
          .set({ status: "failed", errorSummary: message, completedAt: new Date() })
          .where(eq(workflowRuns.id, run.id));
        await db
          .update(workflowStageRuns)
          .set({ status: "failed", completedAt: new Date(), errorJson: { message } })
          .where(and(eq(workflowStageRuns.workflowRunId, run.id), eq(workflowStageRuns.status, "running")));
        await db.update(campaigns).set({ status: "failed", updatedAt: new Date() }).where(eq(campaigns.id, run.campaignId));
        await recordAudit(db, {
          ownerId: run.ownerId,
          campaignId: run.campaignId,
          runId: run.id,
          eventType: "run.interrupted",
          actorType: "system",
          actorId: "tulivu",
          metadata: { message },
        });
      }
      return interrupted.length;
    },
  };
}
