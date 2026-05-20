CREATE TYPE "public"."alert_level" AS ENUM('warning', 'error');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('pending', 'running', 'passed', 'failed', 'error');--> statement-breakpoint
CREATE TYPE "public"."step_status" AS ENUM('passed', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"level" "alert_level" NOT NULL,
	"message" text NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"temperature" real,
	"voltage" real,
	"current_ma" real,
	"gpio_states" jsonb
);
--> statement-breakpoint
CREATE TABLE "test_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "run_status" DEFAULT 'pending' NOT NULL,
	"hardware_id" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "test_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"name" text NOT NULL,
	"status" "step_status" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"message" text
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_run_id_test_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."test_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_run_id_test_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."test_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_steps" ADD CONSTRAINT "test_steps_run_id_test_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_run_id_idx" ON "alerts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "metrics_run_id_idx" ON "metrics" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "metrics_recorded_at_idx" ON "metrics" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "test_steps_run_id_idx" ON "test_steps" USING btree ("run_id");