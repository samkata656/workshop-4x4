ALTER TABLE "requests" ADD COLUMN "non_stock" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "non_stock_brand" "vehicle_brand";--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "non_stock_model" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "non_stock_generation" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "non_stock_engine" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "non_stock_transmission" text;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_non_stock_described" CHECK (not "requests"."non_stock" or ("requests"."non_stock_brand" is not null and "requests"."non_stock_model" is not null
        and "requests"."non_stock_generation" is not null and "requests"."non_stock_engine" is not null
        and "requests"."non_stock_transmission" is not null));