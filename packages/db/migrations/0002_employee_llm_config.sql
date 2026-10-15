ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "llm_provider" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "llm_model" text;
