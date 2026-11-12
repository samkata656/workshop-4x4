ALTER TABLE "requests" ADD COLUMN "contact_email" text;--> statement-breakpoint
-- Requests made before this column existed: the customer row is the only e-mail we have for them.
UPDATE "requests" SET "contact_email" = "customers"."email" FROM "customers" WHERE "customers"."id" = "requests"."customer_id" AND "requests"."contact_email" IS NULL;
