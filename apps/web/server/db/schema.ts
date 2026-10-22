import {
  bigserial,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { CampaignBriefInput, CampaignStatus, StageName } from "@tulivu/shared";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userSettings = pgTable("user_settings", {
  ownerId: text("owner_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  preferencesJson: jsonb("preferences_json").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businesses = pgTable(
  "businesses",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    websiteUrl: text("website_url").notNull().default(""),
    industry: text("industry").notNull(),
    country: text("country").notNull(),
    city: text("city").notNull().default(""),
    defaultCurrency: text("default_currency").notNull().default("KES"),
    targetCustomers: text("target_customers").notNull(),
    socialUrls: jsonb("social_urls").$type<string[]>().notNull().default([]),
    brandProfileJson: jsonb("brand_profile_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("businesses_owner_idx").on(table.ownerId)],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    objective: text("objective").notNull(),
    status: text("status").$type<CampaignStatus>().notNull().default("draft"),
    channelsJson: jsonb("channels_json").$type<string[]>().notNull().default([]),
    budgetAmount: numeric("budget_amount", { precision: 14, scale: 2 }).notNull(),
    budgetCurrency: text("budget_currency").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    briefJson: jsonb("brief_json").$type<CampaignBriefInput>().notNull(),
    currentVersion: integer("current_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("campaigns_owner_idx").on(table.ownerId),
    index("campaigns_business_idx").on(table.businessId),
    index("campaigns_status_idx").on(table.status),
  ],
);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status")
      .$type<"running" | "completed" | "failed" | "cancelled">()
      .notNull()
      .default("running"),
    currentStage: text("current_stage").$type<StageName>(),
    providerId: text("provider_id").notNull().default("mock"),
    modelId: text("model_id").notNull().default("mock-planning"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorSummary: text("error_summary"),
    tokenUsageJson: jsonb("token_usage_json").$type<Record<string, number>>().notNull().default({}),
  },
  (table) => [index("workflow_runs_campaign_idx").on(table.campaignId)],
);

export const workflowStageRuns = pgTable(
  "workflow_stage_runs",
  {
    id: text("id").primaryKey(),
    workflowRunId: text("workflow_run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    stageName: text("stage_name").$type<StageName>().notNull(),
    status: text("status")
      .$type<"pending" | "running" | "completed" | "failed" | "skipped" | "cancelled">()
      .notNull()
      .default("pending"),
    attempt: integer("attempt").notNull().default(0),
    inputJson: jsonb("input_json").$type<Record<string, unknown>>(),
    outputJson: jsonb("output_json").$type<Record<string, unknown>>(),
    errorJson: jsonb("error_json").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    latencyMs: integer("latency_ms"),
  },
  (table) => [
    uniqueIndex("workflow_stage_runs_run_stage_idx").on(table.workflowRunId, table.stageName),
    index("workflow_stage_runs_campaign_idx").on(table.campaignId),
  ],
);

export const workflowEvents = pgTable(
  "workflow_events",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("workflow_events_run_idx").on(table.runId, table.seq)],
);

export const artifacts = pgTable(
  "artifacts",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    version: integer("version").notNull(),
    contentJson: jsonb("content_json").$type<unknown>().notNull(),
    storageKey: text("storage_key"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdByRunId: text("created_by_run_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("artifacts_campaign_type_version_idx").on(table.campaignId, table.type, table.version),
    index("artifacts_campaign_idx").on(table.campaignId, table.type),
    index("artifacts_owner_idx").on(table.ownerId),
  ],
);

export const assets = pgTable(
  "assets",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    key: text("key").notNull().unique(),
    kind: text("kind").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    contentText: text("content_text"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("assets_campaign_idx").on(table.campaignId), index("assets_owner_idx").on(table.ownerId)],
);

export const approvals = pgTable(
  "approvals",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignVersion: integer("campaign_version").notNull(),
    operationType: text("operation_type").notNull(),
    operationHash: text("operation_hash").notNull(),
    approvedBy: text("approved_by").notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }).notNull().defaultNow(),
    status: text("status").$type<"active" | "invalidated">().notNull().default("active"),
    note: text("note"),
  },
  (table) => [index("approvals_campaign_idx").on(table.campaignId, table.status)],
);

export const externalOperations = pgTable(
  "external_operations",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    operationType: text("operation_type").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    status: text("status").notNull(),
    providerResourceId: text("provider_resource_id"),
    requestSummaryJson: jsonb("request_summary_json").$type<Record<string, unknown>>().notNull().default({}),
    responseSummaryJson: jsonb("response_summary_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("external_operations_campaign_idx").on(table.campaignId)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
    runId: text("run_id"),
    eventType: text("event_type").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_owner_idx").on(table.ownerId, table.createdAt),
    index("audit_events_campaign_idx").on(table.campaignId),
  ],
);

export type BusinessRow = typeof businesses.$inferSelect;
export type CampaignRow = typeof campaigns.$inferSelect;
export type ArtifactRow = typeof artifacts.$inferSelect;
export type WorkflowRunRow = typeof workflowRuns.$inferSelect;
export type WorkflowStageRunRow = typeof workflowStageRuns.$inferSelect;
export type ExternalOperationRow = typeof externalOperations.$inferSelect;
export type ApprovalRow = typeof approvals.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;
