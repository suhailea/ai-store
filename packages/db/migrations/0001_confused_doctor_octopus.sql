CREATE TYPE "public"."business_memory_kind" AS ENUM('policy', 'brand_voice', 'company_fact', 'sop');--> statement-breakpoint
CREATE TYPE "public"."team_memory_kind" AS ENUM('briefing', 'delegation_note', 'outcome_summary');--> statement-breakpoint
ALTER TYPE "public"."memory_kind" ADD VALUE 'episodic';--> statement-breakpoint
ALTER TYPE "public"."memory_kind" ADD VALUE 'learned';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_memories" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"kind" "business_memory_kind" NOT NULL,
	"content" text NOT NULL,
	"source" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_memories" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"author_employee_id" text,
	"task_id" text,
	"kind" "team_memory_kind" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "business_memories" ADD CONSTRAINT "business_memories_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_memories" ADD CONSTRAINT "team_memories_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_memories" ADD CONSTRAINT "team_memories_author_employee_id_employees_id_fk" FOREIGN KEY ("author_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_memories" ADD CONSTRAINT "team_memories_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_memories_business_created_idx" ON "business_memories" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_memories_business_created_idx" ON "team_memories" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_employee_created_idx" ON "memories" USING btree ("employee_id","created_at");