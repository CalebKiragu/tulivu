import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { assets } from "../db/schema.js";
import type { AssetStorage } from "./storage.js";

export interface PersistAssetInput {
  ownerId: string;
  campaignId: string;
  key: string;
  bytes: Uint8Array;
  mimeType: string;
  width: number;
  height: number;
  kind: string;
  metadata?: Record<string, unknown>;
}

export function assetUrl(key: string): string {
  return `/api/assets/${key}`;
}

export async function persistAsset(
  db: Database,
  storage: AssetStorage,
  input: PersistAssetInput,
) {
  const isText = input.mimeType === "image/svg+xml" || input.mimeType.startsWith("text/");
  if (!isText) {
    await storage.put(input.key, input.bytes, input.mimeType);
  }
  const contentText = isText ? Buffer.from(input.bytes).toString("utf8") : null;
  const values = {
    id: randomUUID(),
    ownerId: input.ownerId,
    campaignId: input.campaignId,
    key: input.key,
    kind: input.kind,
    mimeType: input.mimeType,
    width: input.width,
    height: input.height,
    sizeBytes: input.bytes.byteLength,
    contentText,
    metadataJson: input.metadata ?? {},
  };
  const [row] = await db
    .insert(assets)
    .values(values)
    .onConflictDoUpdate({
      target: assets.key,
      set: {
        mimeType: values.mimeType,
        width: values.width,
        height: values.height,
        sizeBytes: values.sizeBytes,
        contentText: values.contentText,
        metadataJson: values.metadataJson,
        kind: values.kind,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to persist creative asset");
  return row;
}

export async function getAssetForOwner(db: Database, key: string, ownerId: string) {
  const [row] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.key, key), eq(assets.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

export async function getAssetContent(
  db: Database,
  storage: AssetStorage,
  row: { contentText: string | null; key: string; mimeType: string },
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  if (row.contentText !== null) {
    return { bytes: Buffer.from(row.contentText, "utf8"), mimeType: row.mimeType };
  }
  return storage.get(row.key);
}

export async function listAssetsForOwner(db: Database, ownerId: string, campaignId?: string) {
  return db
    .select()
    .from(assets)
    .where(
      campaignId
        ? and(eq(assets.ownerId, ownerId), eq(assets.campaignId, campaignId))
        : eq(assets.ownerId, ownerId),
    )
    .orderBy(assets.createdAt);
}
