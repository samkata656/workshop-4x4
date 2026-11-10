CREATE TYPE "public"."booking_source" AS ENUM('web', 'admin', 'agent');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('booked', 'in_progress', 'done', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."fluid_kind" AS ENUM('engine_oil', 'atf', 'gear_oil', 'coolant', 'brake_fluid');--> statement-breakpoint
CREATE TYPE "public"."fuel_type" AS ENUM('petrol', 'diesel');--> statement-breakpoint
CREATE TYPE "public"."quote_kind" AS ENUM('service', 'repair', 'modification');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('new', 'contacted', 'converted', 'closed');--> statement-breakpoint
CREATE TYPE "public"."record_author" AS ENUM('seed', 'admin', 'AI');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('new', 'contacted', 'quoted', 'booked', 'closed');--> statement-breakpoint
CREATE TYPE "public"."request_type" AS ENUM('repair', 'modification');--> statement-breakpoint
CREATE TYPE "public"."service_fluid_source" AS ENUM('engine_oil', 'coolant', 'transmission', 'differentials', 'transfer_case', 'brake_fluid', 'none');--> statement-breakpoint
CREATE TYPE "public"."transmission_type" AS ENUM('manual', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."vehicle_brand" AS ENUM('Toyota', 'Lexus');--> statement-breakpoint
CREATE TABLE "bays" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "bays_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "booking_services" (
	"booking_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"service_name" text NOT NULL,
	"duration_min" smallint NOT NULL,
	"price_eur" numeric(10, 2),
	CONSTRAINT "booking_services_booking_id_service_id_pk" PRIMARY KEY("booking_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bookings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bay_id" smallint NOT NULL,
	"customer_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'booked' NOT NULL,
	"source" "booking_source" DEFAULT 'web' NOT NULL,
	"price_total_eur" numeric(10, 2),
	"price_breakdown" jsonb,
	"cancel_token" text DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_cancel_token_unique" UNIQUE("cancel_token"),
	CONSTRAINT "bookings_ends_after_start" CHECK ("bookings"."ends_at" > "bookings"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "consumables" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "consumables_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"price_eur" numeric(10, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consumables_slug_unique" UNIQUE("slug"),
	CONSTRAINT "consumables_price_not_negative" CHECK ("consumables"."price_eur" >= 0)
);
--> statement-breakpoint
CREATE TABLE "customer_vehicles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_vehicles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"customer_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"plate" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"consent_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fluid_prices" (
	"fluid" "fluid_kind" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price_per_litre_eur" numeric(10, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fluid_prices_not_negative" CHECK ("fluid_prices"."price_per_litre_eur" >= 0)
);
--> statement-breakpoint
CREATE TABLE "opening_hours" (
	"weekday" smallint PRIMARY KEY NOT NULL,
	"closed" boolean DEFAULT false NOT NULL,
	"opens_at" time,
	"closes_at" time,
	CONSTRAINT "opening_hours_weekday_range" CHECK ("opening_hours"."weekday" between 1 and 7),
	CONSTRAINT "opening_hours_times_when_open" CHECK ("opening_hours"."closed" or ("opening_hours"."opens_at" is not null and "opening_hours"."closes_at" is not null and "opening_hours"."closes_at" > "opening_hours"."opens_at"))
);
--> statement-breakpoint
CREATE TABLE "quote_services" (
	"quote_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"price_eur" numeric(10, 2),
	CONSTRAINT "quote_services_quote_id_service_id_pk" PRIMARY KEY("quote_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quotes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" "quote_kind" NOT NULL,
	"status" "quote_status" DEFAULT 'new' NOT NULL,
	"customer_id" integer NOT NULL,
	"vehicle_id" integer,
	"request_id" integer,
	"price_total_eur" numeric(10, 2),
	"price_breakdown" jsonb,
	"source" "booking_source" DEFAULT 'web' NOT NULL,
	"notes" text,
	"booking_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" "request_type" NOT NULL,
	"status" "request_status" DEFAULT 'new' NOT NULL,
	"customer_id" integer NOT NULL,
	"vehicle_id" integer,
	"mileage_km" integer,
	"description" text,
	"options" text[] DEFAULT '{}'::text[] NOT NULL,
	"ai_output" jsonb,
	"ai_completed_at" timestamp with time zone,
	"notes" text,
	"booking_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requests_mileage_not_negative" CHECK ("requests"."mileage_km" is null or "requests"."mileage_km" >= 0)
);
--> statement-breakpoint
CREATE TABLE "service_consumables" (
	"service_id" integer NOT NULL,
	"consumable_id" integer NOT NULL,
	"quantity" smallint DEFAULT 1 NOT NULL,
	CONSTRAINT "service_consumables_service_id_consumable_id_pk" PRIMARY KEY("service_id","consumable_id"),
	CONSTRAINT "service_consumables_quantity_positive" CHECK ("service_consumables"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "services_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"duration_min" smallint NOT NULL,
	"fluid_source" "service_fluid_source" DEFAULT 'none' NOT NULL,
	"labour_eur" numeric(10, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug"),
	CONSTRAINT "services_duration_positive" CHECK ("services"."duration_min" > 0),
	CONSTRAINT "services_labour_not_negative" CHECK ("services"."labour_eur" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"timezone" text DEFAULT 'Europe/Sofia' NOT NULL,
	"slot_minutes" smallint DEFAULT 30 NOT NULL,
	"booking_min_days_ahead" smallint DEFAULT 1 NOT NULL,
	"booking_max_days_ahead" smallint DEFAULT 30 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_single_row" CHECK ("settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"brand" "vehicle_brand" NOT NULL,
	"model" text NOT NULL,
	"generation" text NOT NULL,
	"years_from" smallint,
	"years_to" smallint,
	"engine_code" text NOT NULL,
	"fuel" "fuel_type" NOT NULL,
	"transmission" text NOT NULL,
	"transmission_type" "transmission_type" NOT NULL,
	"engine_oil_with_filter_l" numeric(5, 2),
	"transmission_l" numeric(5, 2),
	"front_diff_l" numeric(5, 2),
	"rear_diff_l" numeric(5, 2),
	"transfer_case_l" numeric(5, 2),
	"coolant_l" numeric(5, 2),
	"brake_fluid_l" numeric(5, 2),
	"verified" boolean DEFAULT false NOT NULL,
	"source" text,
	"created_by" "record_author" DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_combination_unique" UNIQUE NULLS NOT DISTINCT("brand","model","generation","engine_code","transmission","years_from"),
	CONSTRAINT "vehicles_capacities_positive" CHECK (coalesce("vehicles"."engine_oil_with_filter_l", 1) > 0 and coalesce("vehicles"."transmission_l", 1) > 0
        and coalesce("vehicles"."front_diff_l", 1) > 0 and coalesce("vehicles"."rear_diff_l", 1) > 0
        and coalesce("vehicles"."transfer_case_l", 1) > 0 and coalesce("vehicles"."coolant_l", 1) > 0
        and coalesce("vehicles"."brake_fluid_l", 1) > 0),
	CONSTRAINT "vehicles_years_in_order" CHECK ("vehicles"."years_to" is null or "vehicles"."years_from" is null or "vehicles"."years_to" >= "vehicles"."years_from")
);
--> statement-breakpoint
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bay_id_bays_id_fk" FOREIGN KEY ("bay_id") REFERENCES "public"."bays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_vehicles" ADD CONSTRAINT "customer_vehicles_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_vehicles" ADD CONSTRAINT "customer_vehicles_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_services" ADD CONSTRAINT "quote_services_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_services" ADD CONSTRAINT "quote_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_consumables" ADD CONSTRAINT "service_consumables_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_consumables" ADD CONSTRAINT "service_consumables_consumable_id_consumables_id_fk" FOREIGN KEY ("consumable_id") REFERENCES "public"."consumables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_starts_at_idx" ON "bookings" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_vehicles_customer_idx" ON "customer_vehicles" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_unique" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "quotes_inbox_idx" ON "quotes" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "quotes_customer_idx" ON "quotes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "requests_inbox_idx" ON "requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "requests_customer_idx" ON "requests" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "vehicles_picker_idx" ON "vehicles" USING btree ("brand","model","generation");