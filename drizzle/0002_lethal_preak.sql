CREATE TYPE "public"."threshold_condition" AS ENUM('lt', 'gt');--> statement-breakpoint
CREATE TABLE "thresholds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"metric" text NOT NULL,
	"condition" "threshold_condition" NOT NULL,
	"value" real NOT NULL,
	"level" "alert_level" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "test_runs" ADD COLUMN "firmware_version" text;