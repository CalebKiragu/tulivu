import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { ArtifactType } from "@tulivu/shared";
import type { Database } from "../db/client.js";
import { artifacts, auditEvents, workflowEvents } from "../db/schema.js";

export async function recordAudit(
  db: Database,
  input: {
    ownerId: string;
    campaignId?: string | null;
    runId?: string | null;
    eventType: string;
    actorType: "user" | "agent" | "system";
    actorId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(auditEvents).values({
    id: randomUUID(),
    ownerId: input.ownerId,
    campaignId: input.campaignId ?? null,
    runId: input.runId ?? null,
    eventType: input.eventType,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    metadataJson: input.metadata ?? {},
  });
}

export async function emitWorkflowEvent(
  db: Database,
  input: {
    runId: string;
    campaignId: string;
    ownerId: string;
    type: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(workflowEvents).values({
    runId: input.runId,
    campaignId: input.campaignId,
    ownerId: input.ownerId,
    type: input.type,
    payloadJson: input.payload ?? {},
  });
}

export interface SaveArtifactInput {
  campaignId: string;
  ownerId: string;
  type: ArtifactType;
  content: unknown;
  runId?: string | null;
  metadata?: Record<string, unknown>;
  storageKey?: string | null;
}

export async function saveArtifact(db: Database, input: SaveArtifactInput) {
  const [maxRow] = await db
    .select({ maxVersion: sql<number>`coalesce(max(${artifacts.version}), 0)::int` })
    .from(artifacts)
    .where(and(eq(artifacts.campaignId, input.campaignId), eq(artifacts.type, input.type)));
  const version = (maxRow?.maxVersion ?? 0) + 1;
  const [row] = await db
    .insert(artifacts)
    .values({
      id: randomUUID(),
      campaignId: input.campaignId,
      ownerId: input.ownerId,
      type: input.type,
      version,
      contentJson: input.content,
      storageKey: input.storageKey ?? null,
      metadataJson: input.metadata ?? {},
      createdByRunId: input.runId ?? null,
    })
    .returning();
  if (!row) throw new Error("Failed to persist artifact");
  return row;
}

export async function listArtifactVersions(
  db: Database,
  campaignId: string,
  type?: ArtifactType,
  limit = 100,
) {
  const rows = await db
    .select()
    .from(artifacts)
    .where(
      type
        ? and(eq(artifacts.campaignId, campaignId), eq(artifacts.type, type))
        : eq(artifacts.campaignId, campaignId),
    )
    .orderBy(sql`${artifacts.createdAt} desc`)
    .limit(limit);
  return rows;
}

export async function latestArtifactMap(db: Database, campaignId: string) {
  const rows = await db.select().from(artifacts).where(eq(artifacts.campaignId, campaignId));
  const map = new Map<string, typeof rows[number]>();
  for (const row of rows) {
    const current = map.get(row.type);
    if (!current || row.version > current.version) map.set(row.type, row);
  }
  return map;
}

export async function latestArtifact(db: Database, campaignId: string, type: ArtifactType) {
  const [row] = await db
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.campaignId, campaignId), eq(artifacts.type, type)))
    .orderBy(sql`${artifacts.version} desc`)
    .limit(1);
  return row ?? null;
}
