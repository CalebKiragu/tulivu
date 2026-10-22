CREATE TABLE "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"campaign_version" integer NOT NULL,
	"operation_type" text NOT NULL,
	"operation_hash" text NOT NULL,
	"approved_by" text NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"type" text NOT NULL,
	"version" integer NOT NULL,
	"content_json" jsonb NOT NULL,
	"storage_key" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"size_bytes" integer NOT NULL,
	"content_text" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"campaign_id" text,
	"run_id" text,
	"event_type" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"website_url" text DEFAULT '' NOT NULL,
	"industry" text NOT NULL,
	"country" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"default_currency" text DEFAULT 'KES' NOT NULL,
	"target_customers" text NOT NULL,
	"social_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"brand_profile_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"objective" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"channels_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"budget_amount" numeric(14, 2) NOT NULL,
	"budget_currency" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"brief_json" jsonb NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"provider" text NOT NULL,
	"operation_type" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text NOT NULL,
	"provider_resource_id" text,
	"request_summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response_summary_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_operations_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"preferences_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workflow_events" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"type" text NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"current_stage" text,
	"provider_id" text DEFAULT 'mock' NOT NULL,
	"model_id" text DEFAULT 'mock-planning' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_summary" text,
	"token_usage_json" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_stage_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_run_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"stage_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"input_json" jsonb,
	"output_json" jsonb,
	"error_json" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"latency_ms" integer
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_operations" ADD CONSTRAINT "external_operations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_operations" ADD CONSTRAINT "external_operations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_run_id_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_stage_runs" ADD CONSTRAINT "workflow_stage_runs_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_stage_runs" ADD CONSTRAINT "workflow_stage_runs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approvals_campaign_idx" ON "approvals" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "artifacts_campaign_type_version_idx" ON "artifacts" USING btree ("campaign_id","type","version");--> statement-breakpoint
CREATE INDEX "artifacts_campaign_idx" ON "artifacts" USING btree ("campaign_id","type");--> statement-breakpoint
CREATE INDEX "artifacts_owner_idx" ON "artifacts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "assets_campaign_idx" ON "assets" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "assets_owner_idx" ON "assets" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "audit_events_owner_idx" ON "audit_events" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_campaign_idx" ON "audit_events" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "businesses_owner_idx" ON "businesses" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "campaigns_owner_idx" ON "campaigns" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "campaigns_business_idx" ON "campaigns" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "external_operations_campaign_idx" ON "external_operations" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "workflow_events_run_idx" ON "workflow_events" USING btree ("run_id","seq");--> statement-breakpoint
CREATE INDEX "workflow_runs_campaign_idx" ON "workflow_runs" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_stage_runs_run_stage_idx" ON "workflow_stage_runs" USING btree ("workflow_run_id","stage_name");--> statement-breakpoint
CREATE INDEX "workflow_stage_runs_campaign_idx" ON "workflow_stage_runs" USING btree ("campaign_id");