CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inference_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_message_id" uuid NOT NULL,
	"assistant_message_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"latency_ms" integer,
	"time_to_first_token_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"finish_reason" text,
	"request_preview" text NOT NULL,
	"response_preview" text,
	"error_code" text,
	"error_message" text,
	"http_status" integer,
	"raw_metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inference_logs_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"content_preview" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"sequence_number" integer NOT NULL,
	"provider_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inference_logs" ADD CONSTRAINT "inference_logs_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inference_logs" ADD CONSTRAINT "inference_logs_user_message_id_fk" FOREIGN KEY ("user_message_id") REFERENCES "public"."messages"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inference_logs" ADD CONSTRAINT "inference_logs_assistant_message_id_fk" FOREIGN KEY ("assistant_message_id") REFERENCES "public"."messages"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_updated_at_idx" ON "conversations" ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_last_message_at_idx" ON "conversations" ("last_message_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_status_idx" ON "conversations" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inference_logs_conversation_id_idx" ON "inference_logs" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inference_logs_request_id_idx" ON "inference_logs" ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inference_logs_status_idx" ON "inference_logs" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inference_logs_provider_idx" ON "inference_logs" ("provider");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inference_logs_model_idx" ON "inference_logs" ("model");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inference_logs_started_at_idx" ON "inference_logs" ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_seq_idx" ON "messages" ("conversation_id","sequence_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "messages_conversation_seq_unique" ON "messages" ("conversation_id","sequence_number");