CREATE TABLE "booking_items_ops" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"booking_id" text NOT NULL,
	"service_id" text,
	"name" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"price_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_status_history_ops" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"booking_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings_ops" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"business_id" text,
	"reference" text NOT NULL,
	"customer_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"service_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"source" text DEFAULT 'storefront' NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"customer_note" text,
	"internal_note" text,
	"idempotency_key" text,
	"is_demo" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_ops_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "business_hours_ops" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"business_id" text,
	"weekday" integer NOT NULL,
	"opens_at" text DEFAULT '09:00' NOT NULL,
	"closes_at" text DEFAULT '17:00' NOT NULL,
	"is_closed" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_consents_ops" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"type" text NOT NULL,
	"granted" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'booking' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"business_id" text,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"notes" text,
	"is_demo" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'Africa/Nairobi' NOT NULL,
	"default_currency" text DEFAULT 'KES' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"business_id" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_description" text NOT NULL,
	"description" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"buffer_before_minutes" integer DEFAULT 10 NOT NULL,
	"buffer_after_minutes" integer DEFAULT 10 NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"image_url" text,
	"category" text DEFAULT 'General' NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_availability_ops" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"business_id" text,
	"user_id" text,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"image_url" text,
	"email" text,
	"phone" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"color" text DEFAULT '#244D40' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_services" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"service_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_off_ops" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text DEFAULT 'Unavailable' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "booking_items_ops" ADD CONSTRAINT "booking_items_ops_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items_ops" ADD CONSTRAINT "booking_items_ops_booking_id_bookings_ops_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings_ops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_items_ops" ADD CONSTRAINT "booking_items_ops_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_history_ops" ADD CONSTRAINT "booking_status_history_ops_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_status_history_ops" ADD CONSTRAINT "booking_status_history_ops_booking_id_bookings_ops_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings_ops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings_ops" ADD CONSTRAINT "bookings_ops_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings_ops" ADD CONSTRAINT "bookings_ops_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings_ops" ADD CONSTRAINT "bookings_ops_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings_ops" ADD CONSTRAINT "bookings_ops_staff_id_staff_profiles_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings_ops" ADD CONSTRAINT "bookings_ops_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_hours_ops" ADD CONSTRAINT "business_hours_ops_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_hours_ops" ADD CONSTRAINT "business_hours_ops_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_consents_ops" ADD CONSTRAINT "customer_consents_ops_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_consents_ops" ADD CONSTRAINT "customer_consents_ops_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_availability_ops" ADD CONSTRAINT "staff_availability_ops_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_availability_ops" ADD CONSTRAINT "staff_availability_ops_staff_id_staff_profiles_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_staff_id_staff_profiles_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_ops" ADD CONSTRAINT "time_off_ops_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off_ops" ADD CONSTRAINT "time_off_ops_staff_id_staff_profiles_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_items_ops_owner_idx" ON "booking_items_ops" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "booking_status_history_ops_owner_idx" ON "booking_status_history_ops" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "bookings_ops_owner_idx" ON "bookings_ops" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "bookings_ops_business_idx" ON "bookings_ops" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "bookings_ops_starts_at_idx" ON "bookings_ops" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "bookings_ops_staff_starts_idx" ON "bookings_ops" USING btree ("staff_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_ops_idempotency_idx" ON "bookings_ops" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "business_hours_ops_owner_idx" ON "business_hours_ops" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_hours_business_weekday_idx" ON "business_hours_ops" USING btree ("business_id","weekday");--> statement-breakpoint
CREATE INDEX "customer_consents_ops_owner_idx" ON "customer_consents_ops" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_consents_customer_type_idx" ON "customer_consents_ops" USING btree ("owner_id","customer_id","type");--> statement-breakpoint
CREATE INDEX "customers_owner_idx" ON "customers" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "customers_business_idx" ON "customers" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_idx" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organizations_owner_idx" ON "organizations" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "services_owner_idx" ON "services" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "services_business_idx" ON "services" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "services_business_slug_idx" ON "services" USING btree ("business_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "services_owner_slug_idx" ON "services" USING btree ("owner_id","slug");--> statement-breakpoint
CREATE INDEX "staff_availability_ops_owner_idx" ON "staff_availability_ops" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_availability_staff_weekday_idx" ON "staff_availability_ops" USING btree ("owner_id","staff_id","weekday");--> statement-breakpoint
CREATE INDEX "staff_owner_idx" ON "staff_profiles" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "staff_business_idx" ON "staff_profiles" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "staff_services_owner_idx" ON "staff_services" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_services_pair_idx" ON "staff_services" USING btree ("owner_id","staff_id","service_id");--> statement-breakpoint
CREATE INDEX "time_off_ops_owner_idx" ON "time_off_ops" USING btree ("owner_id");