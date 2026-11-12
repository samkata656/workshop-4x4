ALTER TABLE "requests" ADD COLUMN "offer_subject" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "offer_body" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "offer_items" jsonb;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "offer_drafted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "offer_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "offer_sent_to" text;