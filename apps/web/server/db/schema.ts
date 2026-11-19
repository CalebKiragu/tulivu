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
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    timezone: text("timezone").notNull().default("Africa/Nairobi"),
    defaultCurrency: text("default_currency").notNull().default("KES"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("organizations_owner_idx").on(table.ownerId)],
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<"owner" | "admin" | "staff" | "viewer">().notNull().default("staff"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_members_org_user_idx").on(table.organizationId, table.userId),
    index("organization_members_user_idx").on(table.userId),
  ],
);

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

// ── Operations (ported from Nuru-Wellness) ──────────────────────────────────

export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    businessId: text("business_id").references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    isDemo: integer("is_demo").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("customers_owner_idx").on(table.ownerId),
    index("customers_business_idx").on(table.businessId),
  ],
);

export const services = pgTable(
  "services",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    businessId: text("business_id").references(() => businesses.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    shortDescription: text("short_description").notNull(),
    description: text("description").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(10),
    bufferAfterMinutes: integer("buffer_after_minutes").notNull().default(10),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("KES"),
    imageUrl: text("image_url"),
    category: text("category").notNull().default("General"),
    isActive: integer("is_active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("services_owner_idx").on(table.ownerId),
    index("services_business_idx").on(table.businessId),
    uniqueIndex("services_business_slug_idx").on(table.businessId, table.slug),
    uniqueIndex("services_owner_slug_idx").on(table.ownerId, table.slug),
  ],
);

export const staffProfiles = pgTable(
  "staff_profiles",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    businessId: text("business_id").references(() => businesses.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    title: text("title").notNull(),
    bio: text("bio").notNull().default(""),
    imageUrl: text("image_url"),
    email: text("email"),
    phone: text("phone"),
    isActive: integer("is_active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    color: text("color").notNull().default("#244D40"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("staff_owner_idx").on(table.ownerId),
    index("staff_business_idx").on(table.businessId),
  ],
);

export const staffServices = pgTable(
  "staff_services",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    staffId: text("staff_id").notNull().references(() => staffProfiles.id, { onDelete: "cascade" }),
    serviceId: text("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("staff_services_owner_idx").on(table.ownerId),
    uniqueIndex("staff_services_pair_idx").on(table.ownerId, table.staffId, table.serviceId),
  ],
);

export const businessHours = pgTable(
  "business_hours_ops",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    businessId: text("business_id").references(() => businesses.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    opensAt: text("opens_at").notNull().default("09:00"),
    closesAt: text("closes_at").notNull().default("17:00"),
    isClosed: integer("is_closed").notNull().default(0),
  },
  (table) => [
    index("business_hours_ops_owner_idx").on(table.ownerId),
    uniqueIndex("business_hours_business_weekday_idx").on(table.businessId, table.weekday),
  ],
);

export const staffAvailability = pgTable(
  "staff_availability_ops",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    staffId: text("staff_id").notNull().references(() => staffProfiles.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    isActive: integer("is_active").notNull().default(1),
  },
  (table) => [
    index("staff_availability_ops_owner_idx").on(table.ownerId),
    uniqueIndex("staff_availability_staff_weekday_idx").on(table.ownerId, table.staffId, table.weekday),
  ],
);

export const timeOff = pgTable(
  "time_off_ops",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    staffId: text("staff_id").notNull().references(() => staffProfiles.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason").notNull().default("Unavailable"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("time_off_ops_owner_idx").on(table.ownerId)],
);

export const bookings = pgTable(
  "bookings_ops",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    businessId: text("business_id").references(() => businesses.id, { onDelete: "cascade" }),
    reference: text("reference").notNull().unique(),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    staffId: text("staff_id").notNull().references(() => staffProfiles.id, { onDelete: "restrict" }),
    serviceId: text("service_id").notNull().references(() => services.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("confirmed"),
    source: text("source").notNull().default("storefront"),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("KES"),
    customerNote: text("customer_note"),
    internalNote: text("internal_note"),
    idempotencyKey: text("idempotency_key"),
    isDemo: integer("is_demo").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("bookings_ops_owner_idx").on(table.ownerId),
    index("bookings_ops_business_idx").on(table.businessId),
    index("bookings_ops_starts_at_idx").on(table.startsAt),
    index("bookings_ops_staff_starts_idx").on(table.staffId, table.startsAt),
    uniqueIndex("bookings_ops_idempotency_idx").on(table.idempotencyKey),
  ],
);

export const bookingItems = pgTable(
  "booking_items_ops",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    bookingId: text("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    serviceId: text("service_id").references(() => services.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    priceCents: integer("price_cents").notNull(),
  },
  (table) => [index("booking_items_ops_owner_idx").on(table.ownerId)],
);

export const bookingStatusHistory = pgTable(
  "booking_status_history_ops",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    bookingId: text("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("booking_status_history_ops_owner_idx").on(table.ownerId)],
);

export const customerConsents = pgTable(
  "customer_consents_ops",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    granted: integer("granted").notNull().default(0),
    source: text("source").notNull().default("booking"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("customer_consents_ops_owner_idx").on(table.ownerId),
    uniqueIndex("customer_consents_customer_type_idx").on(table.ownerId, table.customerId, table.type),
  ],
);
